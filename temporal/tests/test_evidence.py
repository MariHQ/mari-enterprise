"""Worker reads remain bounded/project-scoped without a Mari HTTP server."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch, AsyncMock
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from temporal import evidence
from temporal.maintenance.compaction import maintenance_required


class EvidenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_identity_is_parameterized_and_rows_hydrated(self):
        identity = "owner/repo/issue/x' OR true --"
        with patch.dict(os.environ, {'MARI_KNOWLEDGE_PROJECT_ID':'project-x'}), patch.object(evidence.engine, 'execute', return_value={'rows':[{'record_id':identity,'source':'github','kind':'issue','properties':'{"revision":2}'}]}) as query:
            rows = await evidence.search_evidence('source_id:"'+identity+'"')
            args, kwargs = query.call_args
            self.assertNotIn(identity, args[0])
            self.assertEqual(args[1], {'id':identity})
            self.assertEqual(kwargs['project'], 'project-x')
            self.assertEqual(rows[0]['properties'], {'revision':2})
            self.assertEqual(rows[0]['source_id'], identity)

    async def test_current_evidence_batches_and_deduplicates(self):
        def execute(sql, parameters, **kwargs):
            self.assertLessEqual(len(parameters['ids']), 100)
            return {'rows':[{'record_id':id,'source':'slack','kind':'message','properties':'{}'} for id in parameters['ids']]}
        with patch.object(evidence.engine, 'execute', side_effect=execute) as query:
            self.assertEqual(await evidence.current_evidence([]), {})
            query.assert_not_called()
            rows = await evidence.current_evidence([f'T/C/{i}.000000' for i in range(201)]+['T/C/0.000000'])
            self.assertEqual(len(rows), 201)
            self.assertEqual(query.call_count, 3)

    async def test_identity_selects_only_its_source_table(self):
        with patch.object(evidence.engine, 'execute', return_value={'rows': []}) as query:
            await evidence.current_evidence(['T/C/1.000000', 'owner/repo/pull/42'])
        self.assertEqual(query.call_count, 2)
        self.assertIn('MATCH (r:SlackMessage)', query.call_args_list[0].args[0])
        self.assertIn('MATCH (r:GithubPullRequest)', query.call_args_list[1].args[0])

    async def test_unknown_identity_does_not_probe_all_tables(self):
        with patch.object(evidence.engine, 'execute', return_value={'rows': []}) as query:
            with self.assertRaises(ValueError): await evidence.current_evidence(['ambiguous-id'])
            query.assert_not_called()
            await evidence.current_evidence(['candidate-id'], node_type='AgentDecision')
            self.assertIn('MATCH (r:AgentDecision)', query.call_args.args[0])

    async def test_failed_reads_propagate_and_unsupported_search_does_not_query(self):
        with patch.object(evidence.engine, 'execute', side_effect=RuntimeError('catalog unavailable')) as query:
            with self.assertRaises(ValueError): await evidence.search_evidence('unconfigured text search')
            query.assert_not_called()
            with self.assertRaises(RuntimeError): await evidence.search_evidence('*')

    async def test_miner_carries_native_source_type_into_review(self):
        from temporal import worker
        source={'source_id':'arbitrary-document','node_type':'MariDocument','event_id':'rev','text':'chosen option'}
        candidate={'candidate_id':'candidate','source_id':'arbitrary-document','evidence_id':'rev','kind':'decision',
                   'text':'chosen option','evidence':[{'source_id':'arbitrary-document','evidence_id':'rev','quote':'chosen'}]}
        with patch('temporal.ax_miner.run_miner',new=AsyncMock(return_value=[candidate])):
            candidates=await worker.execute_substrate({'evidence':[source]})
        self.assertEqual(candidates[0]['source_node_type'],'MariDocument')
        with patch.object(worker,'current_evidence',new=AsyncMock(side_effect=[{'arbitrary-document':source},{}])) as read, patch.object(worker,'publish_record') as publish:
            await worker.record_review({'run_id':'run','candidates':candidates,'approved':True})
        self.assertEqual(read.call_args_list[0].kwargs,{'node_type':'MariDocument'})
        self.assertEqual(read.call_args_list[1].kwargs,{'node_type':'AgentDecision'})
        self.assertNotIn('source_node_type',publish.call_args_list[0].args[3])


class MaintenanceIdentifierTests(unittest.TestCase):
    def test_dotted_topic_is_one_table_component(self):
        with patch.dict(os.environ, {'ICEBERG_MAINTENANCE_TABLES':'mari.mari.records.mari.document'}), patch('pyiceberg.catalog.load_catalog') as load:
            load.return_value.load_table.return_value = SimpleNamespace(current_snapshot=lambda:None)
            self.assertFalse(maintenance_required({}))
            load.return_value.load_table.assert_called_once_with(('mari','mari.records.mari.document'))
