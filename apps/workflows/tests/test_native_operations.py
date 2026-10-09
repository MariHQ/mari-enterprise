"""Execute app queries against native OrchidDB with physical typed tables."""
import importlib
from unittest import TestCase
from unittest.mock import patch
import duckdb
from orchiddb import Connection, DuckDBEngine
from apps.base.catalog.nodes import topic_for_label
from apps.base.catalog.schema import columns, sql_type, orchid_type


class NativeOperations(TestCase):
    def test_typed_lists_and_latest_runs(self):
        labels = ['TemporalConnector','TemporalObservation','TemporalRun','TemporalActivity','TemporalSchedule',
                  'AxTrajectory','AgentTrajectory','SubstrateTrajectory']
        schema = {'tables': [], 'nodes': [], 'edges': []}
        db = duckdb.connect()
        for label in labels:
            fields = columns(topic_for_label(label))
            db.execute('CREATE TABLE '+label+' ('+','.join('"'+n+'" '+sql_type(t) for n,t in fields.items())+')')
            schema['tables'].append({'name': label, 'columns': [{'name':n,'data_type':orchid_type(t)} for n,t in fields.items()]})
            schema['nodes'].append({'label':label,'table':label,'id':['project_id','record_id'],'properties':{n:n for n in fields}})
        def insert(label, identity, **properties):
            topic = topic_for_label(label)
            fields = columns(topic)
            source,kind = topic.split('.')[-2:]
            values = {'project_id':'1','record_id':identity,'event_id':identity+':1','source':source,'kind':kind,'observed_at':1,**properties}
            db.execute('INSERT INTO '+label+' VALUES ('+','.join('?' for _ in fields)+')',[values.get(n) for n in fields])
        insert('TemporalConnector','connector',targets=[{'workflow_id':'one','target':'general'}, {'workflow_id':'two','target':'random'}])
        insert('TemporalSchedule','schedule',recent_runs=[{'workflow_id':'one'}, {'workflow_id':'two'}])
        for identity,wid,started in [('old','one','1'),('new','one','2'),('tie','one','2'),('second','two','1'),('unrelated','three','3')]:
            insert('TemporalRun',identity,workflow_id=wid,started_at=started,status='COMPLETED')
        for label,source in [('AxTrajectory','ax'),('AgentTrajectory','agent'),('SubstrateTrajectory','substrate')]:
            insert(label,source,observed_at={'ax':1,'agent':3,'substrate':2}[source],status='running')
        sources=importlib.import_module('apps.sources.connectors')
        schedules=importlib.import_module('apps.scheduled-tasks.operations')
        workflows=importlib.import_module('apps.workflows.workflows')
        with Connection(DuckDBEngine(db),schema) as graph:
            def execute(query, parameters=None, limit=1000, **kwargs):
                with graph.query(query,parameters=parameters or {},language='cypher') as batches:
                    rows=[r for batch in batches for r in batch.to_pylist()]
                return {'rows':rows[:limit]}
            with patch.object(sources,'execute',side_effect=execute) as calls:
                result=sources.connectors.__wrapped__()
                self.assertEqual({r['record_id'] for r in result['records']},{'connector','tie','second'})
                self.assertEqual(calls.call_count,3)
            with patch.object(schedules,'execute',side_effect=execute) as calls:
                result=schedules.operations.__wrapped__()
                self.assertEqual(calls.call_count,4)
                self.assertIn('schedule',{r['record_id'] for r in result['records']})
            with patch.object(workflows,'execute',side_effect=execute) as calls:
                result=workflows.trajectories.__wrapped__(limit=2)
                self.assertEqual([r['record_id'] for r in result['records']],['agent','substrate'])
                self.assertEqual(calls.call_count,1)
                result=workflows.trajectories.__wrapped__(limit=2,cursor=result['next_cursor'])
                self.assertEqual([r['record_id'] for r in result['records']],['ax'])
        db.close()
