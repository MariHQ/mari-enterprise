"""Boundary checks for typed identity and source-filtered app queries."""
import unittest
from unittest.mock import patch
from apps.facts import facts
from apps.decisions import decisions
from apps.knowledge import records

class ContentQueries(unittest.TestCase):
    def test_cursor_retains_equal_ids_from_each_table(self):
        for module, kind in ((facts, 'fact'), (decisions, 'decision')):
            with self.subTest(kind=kind):
                rows = [{'record_id': 'same', 'observed_at': 100, 'kind': kind, 'source': source, 'text': source, 'title': source, 'event_id': source} for source in ('mari', 'agent')]
                def execute(query, parameters=None, **kwargs):
                    if ' UNION ALL ' in query:
                        result = []
                        for branch in query.split(' UNION ALL '):
                            result.extend(execute(branch, parameters)['rows'])
                        return {'rows': result}
                    source = 'mari' if 'Mari' + kind.title() in query else 'agent'
                    result = [{**row, 'node_type': ('Mari' if source == 'mari' else 'Agent') + kind.title()} for row in rows if row['source'] == source]
                    if parameters and 'at' in parameters:
                        result = [row for row in result if row['observed_at'] < parameters['at'] or (row['observed_at'] == parameters['at'] and (row['record_id'] >= parameters['id'] if '>=' in query else row['record_id'] > parameters['id']))]
                    return {'rows': result}
                with patch.object(module, 'execute', side_effect=execute):
                    first = module.records.__wrapped__(limit=1, cursor=None)
                    second = module.records.__wrapped__(limit=1, cursor=first['next_cursor'])
                    self.assertEqual([first['records'][0]['source'], second['records'][0]['source']], ['agent', 'mari'])
                    self.assertFalse(second['has_more'])
                    self.assertEqual(module.record('same', 'mari.records.mari.' + kind)['source'], 'mari')

    def test_knowledge_filters_choose_tables_before_querying(self):
        with patch.object(records, 'execute', return_value={'rows': []}) as execute:
            records.records.__wrapped__(q='', limit=40, cursor=None, kind=None, summary=True, source=['Slack'], owner=[], status=[], content_type=['Conversations'], days=None, sort='newest')
            self.assertEqual(execute.call_count, 2)
            for call in execute.call_args_list:
                self.assertIn('Slack', call.args[0])
                self.assertNotIn('source_group', call.args[0])
                self.assertNotIn('content_type', call.args[0])

    def test_detail_targets_only_requested_table(self):
        with patch.object(records, 'execute', return_value={'rows': [{'record_id': 'one', 'source': 'slack', 'kind': 'message'}]}) as execute:
            records.record('one', 'mari.records.slack.message')
            self.assertEqual(execute.call_count, 1)
            self.assertIn('MATCH (r:SlackMessage)', execute.call_args.args[0])
            self.assertEqual(execute.call_args.kwargs['table'], 'mari.records.slack.message')

if __name__ == '__main__': unittest.main()
