"""Sources enforces container identity before invoking its embedded read adapter."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from container.config import load_config
from container.server import grant_for
from apps.sources.web.server import app, QUERY


class SourcesTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'MARI_APP_GRANT_SECRET':'s'*48},clear=True)
        self.env.start();self.addCleanup(self.env.stop)
        self.client=TestClient(app)
        self.entry=next(a for a in load_config().apps if a.id=='sources')

    def authorization(self,project='1'):
        return {'Authorization':'Bearer '+grant_for(self.entry,{'sub':'local:demo','name':'demo'},project)}

    def test_no_reads_without_valid_audience_and_project(self):
        with patch('apps.sdk.orchid.query_pages') as read:
            self.assertEqual(self.client.get('/api/status').status_code,401)
            self.assertEqual(self.client.get('/api/status',headers=self.authorization('another-project')).status_code,401)
            self.entry.id='another-app'
            self.assertEqual(self.client.get('/api/status',headers=self.authorization()).status_code,401)
            read.assert_not_called()

    def test_bounded_project_scoped_read(self):
        pages=[[{'id':'connector','properties':{'provider':'slack','targets':[{'target':'C123','name':'team','interval_seconds':900}]},'observed_at':123}],[]]
        with patch('apps.sdk.orchid.query_pages',return_value=pages) as read:
            response=self.client.get('/api/status',headers=self.authorization())
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['sources'][0]['target'],'C123')
        query,parameters=read.call_args.args
        self.assertIn('r.project_id = $project',query)
        self.assertIn('LIMIT 101',query)
        self.assertTrue(all(p['project']=='1' for p in parameters))

    def test_engine_failure_is_not_replaced_with_demo_records(self):
        with patch('apps.sdk.orchid.query_pages',side_effect=RuntimeError('private connection details')):
            response=self.client.get('/api/status',headers=self.authorization())
        self.assertEqual(response.status_code,503)
        self.assertNotIn('private',response.text)
        self.assertNotIn('sources',response.json())
