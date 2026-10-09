"""The actual Sources app protects reads and sanitizes storage errors."""
import os
from contextlib import nullcontext
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from container.config import load_config
from container.server import grant_for
from apps.sources.server import app

class SourcesTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'MARI_APP_GRANT_SECRET':'s'*48},clear=True)
        self.env.start();self.addCleanup(self.env.stop)
        self.client=TestClient(app)
        self.entry=next(a for a in load_config().apps if a.id=='sources')

    def authorization(self,project='1'):
        return {'Authorization':'Bearer '+grant_for(self.entry,{'sub':'local:demo','name':'demo'},project)}

    def test_no_reads_without_valid_audience_and_project(self):
        with patch('apps.base.db.engine.session') as read:
            self.assertEqual(self.client.get('/api/connectors').status_code,401)
            self.assertEqual(self.client.get('/api/connectors',headers=self.authorization('another-project')).status_code,401)
            self.entry.id='another-app'
            self.assertEqual(self.client.get('/api/connectors',headers=self.authorization()).status_code,401)
            read.assert_not_called()

    def test_empty_sources_do_not_require_a_watermark(self):
        with patch('apps.base.db.engine.session',return_value=nullcontext()),patch('apps.sources.connectors.execute',return_value={'rows':[]}):
            response=self.client.get('/api/connectors',headers=self.authorization())
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json(),{'records': [], 'observed_at': '', 'truncated': False})

    def test_connector_reads_only_its_workflow_without_watermark(self):
        connector={'source':'temporal','kind':'temporal_connector','record_id':'slack-config',
            'provider':'slack','targets':[{'workflow_id':'slack-sync','target':'general'}, {'workflow_id':'slack-sync-2','target':'random'}]}
        with patch('apps.base.db.engine.session',return_value=nullcontext()),patch('apps.sources.connectors.execute',
                side_effect=[{'rows':[connector]},{'rows':[]},{'rows':[]}]) as execute:
            response=self.client.get('/api/connectors',headers=self.authorization())
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['records'][0]['properties']['targets'][0]['workflow_id'],'slack-sync')
        self.assertEqual(execute.call_count,3)
        run_query=execute.call_args_list[2]
        self.assertIn('MATCH (r:TemporalRun) WHERE r.workflow_id IN $ids',run_query.args[0])
        self.assertIn('max(r.started_at)',run_query.args[0])
        self.assertEqual(run_query.args[1],{'ids':['slack-sync','slack-sync-2']})

    def test_engine_failure_is_sanitized(self):
        with patch('apps.base.db.engine.session',side_effect=RuntimeError('private connection details')):
            response=self.client.get('/api/connectors',headers=self.authorization())
        self.assertEqual(response.status_code,503)
        self.assertNotIn('private',response.text)
