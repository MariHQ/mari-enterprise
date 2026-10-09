"""Concrete lineage endpoints, direction and bounds using native Cypher."""
import unittest
from unittest.mock import patch
from apps.base.tests.test_lake_bindings import fixture
from apps.lineage import lineage

class LineageQueries(unittest.TestCase):
    def test_forward_reverse_and_unrelated_table(self):
        with fixture([
            ('mari.records.agent.trajectory',{'record_id':'run','step_ids':['step']}),
            ('mari.records.agent.step',{'record_id':'step','ordinal':1}),
            ('mari.records.ax.step',{'record_id':'step','ordinal':2}),
        ]) as (run,manifest,db):
            db.execute('DROP TABLE lake.mari."mari.records.slack.message"')
            with patch.object(lineage,'execute',side_effect=run) as query,patch.object(lineage.engine,'manifest',return_value=manifest):
                for focal,node_type in [('run','AgentTrajectory'),('step','AgentStep')]:
                    query.reset_mock()
                    result=lineage.lineage.__wrapped__(focal=focal,node_type=node_type,relation=None,limit=10)
                    self.assertEqual({r['node_type'] for r in result['records']},{'AgentTrajectory','AgentStep'})
                    self.assertEqual(len(result['edges']),1)
                    self.assertEqual((result['edges'][0]['from_type'],result['edges'][0]['to_type']),('AgentTrajectory','AgentStep'))
    def test_limit_and_empty_without_supported_seed(self):
        with fixture([
            ('mari.records.agent.trajectory',{'record_id':'run','step_ids':['one','two']}),
            ('mari.records.agent.step',{'record_id':'one','ordinal':1}),
            ('mari.records.agent.step',{'record_id':'two','ordinal':2}),
        ]) as (run,manifest,db):
            with patch.object(lineage,'execute',side_effect=run) as query,patch.object(lineage.engine,'manifest',return_value=manifest):
                empty=lineage.lineage.__wrapped__(focal=None,node_type=None,relation=None,limit=1)
                self.assertEqual(empty['records'],[])
                result=lineage.lineage.__wrapped__(focal='run',node_type='AgentTrajectory',relation=None,limit=1)
                self.assertEqual(len(result['edges']),1);self.assertTrue(result['has_more'])
    def test_multiple_relationships_keep_native_types(self):
        with fixture([
            ('mari.records.slack.message',{'record_id':'message','collection_id':'channel','author_record_id':'author'}),
            ('mari.records.slack.collection',{'record_id':'channel','name':'general'}),
            ('mari.records.slack.principal',{'record_id':'author','name':'Author'}),
        ]) as (run,manifest,db):
            with patch.object(lineage,'execute',side_effect=run) as query,patch.object(lineage.engine,'manifest',return_value=manifest):
                result=lineage.lineage.__wrapped__(focal='message',node_type='SlackMessage',relation=None,limit=10)
                self.assertEqual({r['node_type'] for r in result['records']},{'SlackMessage','SlackCollection','SlackPrincipal'})
                self.assertEqual(len(result['edges']),2)
                self.assertTrue(all(' UNION ALL ' not in c.args[0] for c in query.call_args_list))

    def test_navigation_opens_recent_claim_with_evidence(self):
        with fixture([
            ('mari.records.agent.fact',{'record_id':'fact','supporting_evidence_ids':['evidence']}),
            ('mari.records.agent.evidence',{'record_id':'evidence','source_id':'source','source_node_type':'SlackMessage'}),
        ]) as (run,manifest,db):
            with patch.object(lineage,'execute',side_effect=run),patch.object(lineage.engine,'manifest',return_value=manifest):
                result=lineage.lineage.__wrapped__(focal=None,node_type=None,relation=None,limit=10)
                self.assertEqual(result['focal'],'fact')
                self.assertEqual(result['node_type'],'AgentFact')
                self.assertEqual({r['record_id'] for r in result['records']},{'fact','evidence'})
                self.assertEqual(len(result['edges']),1)
