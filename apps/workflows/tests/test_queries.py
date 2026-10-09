"""Typed workflow identities and pagination must not mix source tables."""
from unittest import TestCase
from unittest.mock import patch
from apps.workflows import workflows


def row(source, identity='same-id', at=100):
    return dict(source=source, kind='trajectory', record_id=identity, observed_at=at, event_id='event', step_ids=['step-1'])


class WorkflowQueries(TestCase):
    def test_cursor_keeps_same_id_from_another_source(self):
        def initial(query, *args, **kwargs):
            return {'rows': [row('agent'), row('ax')]}
        with patch.object(workflows, 'execute', side_effect=initial) as execute:
            first = workflows.trajectories.__wrapped__(limit=1)
            self.assertEqual(execute.call_count, 1)
        self.assertEqual(first['records'][0]['node_type'], 'AgentTrajectory')
        calls = []
        def subsequent(query, parameters, **kwargs):
            calls.append((query, parameters))
            return {'rows': [row('ax')] if ':AxTrajectory)' in query else []}
        with patch.object(workflows, 'execute', side_effect=subsequent):
            second = workflows.trajectories.__wrapped__(limit=1, cursor=first['next_cursor'])
        self.assertEqual(second['records'][0]['node_type'], 'AxTrajectory')
        self.assertTrue(any(':AxTrajectory)' in q and 'r.record_id>=$id' in q for q, _ in calls))
        self.assertTrue(any(':AgentTrajectory)' in q and 'r.record_id>$id' in q for q, _ in calls))

    def test_detail_reads_only_its_trajectory_and_step_types(self):
        with patch.object(workflows, 'execute', side_effect=[{'rows': [row('ax')]}, {'rows': []}]) as execute:
            workflows.trajectory.__wrapped__(id='same-id', node_type='AxTrajectory')
        queries = [call.args[0] for call in execute.call_args_list]
        self.assertIn('MATCH (r:AxTrajectory)', queries[0])
        self.assertIn('MATCH (r:AxStep)', queries[1])
        self.assertEqual(execute.call_args_list[1].args[1], {'ids': ['step-1']})
