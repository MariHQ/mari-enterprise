"""Run with the released Orchid native library, using only in-memory tables."""
import unittest
from unittest.mock import patch
from apps.base.tests.test_lake_bindings import fixture
from apps.overview import overview
from apps.facts import facts
from apps.decisions import decisions
from apps.knowledge import records, projections

class NativeContentQueries(unittest.TestCase):
    def test_home_global_limit_keeps_newer_rows_from_later_branch(self):
        rows = [('mari.records.mari.document', {'record_id': str(i), 'observed_at': i}) for i in range(20)]
        rows += [('mari.records.slack.message', {'record_id': str(i), 'observed_at': 100 + i}) for i in range(20)]
        with fixture(rows) as (run, _, db):
            with patch.object(overview, 'execute', side_effect=lambda q, **kw: run(q, limit=kw['limit'])) as call:
                result = overview.overview.__wrapped__()
                self.assertEqual([row['observed_at'] for row in result['recent']], list(range(119, 107, -1)))
                self.assertEqual(call.call_count, 1)

    def test_single_call_lists_and_cross_source_pagination(self):
        rows = [('mari.records.slack.message', {'record_id': 'slack', 'observed_at': 9}), ('mari.records.mari.document', {'record_id': 'doc', 'observed_at': 3})]
        for kind in ('fact', 'decision'):
            rows.extend(('mari.records.' + source + '.' + kind, {'record_id': 'same'}) for source in ('mari', 'agent'))
        with fixture(rows) as (run, _, db):
            def execute(query, parameters=None, **kwargs):
                return run(query, parameters, limit=kwargs.get('limit', 1000))
            with patch.object(overview, 'execute', side_effect=execute) as call:
                self.assertEqual([r['record_id'] for r in overview.overview.__wrapped__()['recent']], ['slack', 'doc'])
                self.assertEqual(call.call_count, 1)
            for module in (facts, decisions):
                with patch.object(module, 'execute', side_effect=execute) as call:
                    first = module.records.__wrapped__(limit=1, cursor=None)
                    self.assertEqual(call.call_count, 1)
                    second = module.records.__wrapped__(limit=1, cursor=first['next_cursor'])
                    self.assertEqual([first['records'][0]['source'], second['records'][0]['source']], ['agent', 'mari'])
                    self.assertFalse(second['has_more'])
            with patch.object(records, 'execute', side_effect=execute) as call:
                result = records.records.__wrapped__(q='', limit=40, cursor=None, kind=None, summary=True, source=[], owner=[], status=[], content_type=[], days=None, sort='newest')
                self.assertEqual([r['record_id'] for r in result['records']], ['slack', 'doc'])
                self.assertTrue(all(' UNION ALL ' not in c.args[0] for c in call.call_args_list))
            with patch.object(projections.reader, 'execute', side_effect=execute) as call:
                library = projections.page.__wrapped__('library')
                self.assertEqual(library['records'], [])
                self.assertEqual(library['metrics']['documents'], 2)
                self.assertEqual(call.call_count, 2)
            self.assertEqual(db.execute('SELECT count(*) FROM duckdb_views() WHERE NOT internal').fetchone()[0], 0)

if __name__ == '__main__': unittest.main()
