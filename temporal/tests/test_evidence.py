"""Worker reads remain bounded/project-scoped without a Mari HTTP server."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from temporal import evidence
from temporal.maintenance.compaction import maintenance_required


class EvidenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_identity_is_parameterized_and_rows_hydrated(self):
        identity = "x' OR true --"
        with patch.dict(os.environ, {'MARI_KNOWLEDGE_PROJECT_ID':'project-x'}), patch.object(evidence.engine, 'execute', return_value={'rows':[{'record_id':identity,'properties':'{"revision":2}'}]}) as query:
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
            return {'rows':[{'record_id':id,'properties':'{}'} for id in parameters['ids']]}
        with patch.object(evidence.engine, 'execute', side_effect=execute) as query:
            self.assertEqual(await evidence.current_evidence([]), {})
            query.assert_not_called()
            rows = await evidence.current_evidence([str(i) for i in range(201)]+['0'])
            self.assertEqual(len(rows), 201)
            self.assertEqual(query.call_count, 3)

    async def test_failed_reads_propagate_and_unsupported_search_does_not_query(self):
        with patch.object(evidence.engine, 'execute', side_effect=RuntimeError('catalog unavailable')) as query:
            with self.assertRaises(ValueError): await evidence.search_evidence('unconfigured text search')
            query.assert_not_called()
            with self.assertRaises(RuntimeError): await evidence.search_evidence('*')


class MaintenanceIdentifierTests(unittest.TestCase):
    def test_dotted_topic_is_one_table_component(self):
        with patch.dict(os.environ, {'ICEBERG_MAINTENANCE_TABLES':'mari_streams.mari.records.mari.document'}), patch('pyiceberg.catalog.load_catalog') as load:
            load.return_value.load_table.return_value = SimpleNamespace(current_snapshot=lambda:None)
            self.assertFalse(maintenance_required({}))
            load.return_value.load_table.assert_called_once_with(('mari_streams','mari.records.mari.document'))
