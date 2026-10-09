import unittest
from unittest.mock import patch
from apps.base.tests.test_lake_bindings import fixture
from apps.settings import projections

class SettingsQueries(unittest.TestCase):
    def test_each_section_uses_one_query(self):
        with fixture([
            ('mari.records.mari.principal',{'record_id':'person'}),
            ('mari.records.slack.principal',{'record_id':'slack-user'}),
            ('mari.records.mari.project',{'record_id':'project:workspace','name':'Workspace'}),
            ('mari.records.mari.preferences',{'record_id':'mine','actor':'demo'}),
            ('mari.records.mari.preferences',{'record_id':'theirs','actor':'other'}),
        ]) as (run,manifest,db):
            for section in projections.NODES:
                with patch.object(projections.reader,'execute',side_effect=run) as query:
                    result=projections.page.__wrapped__(section,'demo')
                    query.assert_called_once()
                    if section=='settings-members':self.assertEqual({r['record_id'] for r in result['records']},{'person','project:workspace'})
                    if section=='preferences':self.assertEqual([r['record_id'] for r in result['records']],['mine'])
