import sys, json, importlib
sys.path.insert(0,str(__import__('pathlib').Path(__file__).resolve().parents[3]))
from pathlib import Path
from types import SimpleNamespace
from contextlib import nullcontext,contextmanager
from unittest.mock import patch
import duckdb,pyarrow as pa,pyarrow.parquet as pq
from apps.sdk.provision import definitions
from apps.sdk.catalog_lake import bind,LazyViews
from apps.sdk.data import reader
from apps.sdk.data.query import validate_read
from orchiddb import Connection,DuckDBEngine
from apps.sdk.graph import JSON_PROPERTIES
rows=[]
def record(id,kind='document',source='mari',props=None,at=1):
 rows.append(dict(project_id='1',record_id=id,event_id=id+':1',operation='upsert',kind=kind,source=source,title=id,text='hello',url='',properties=json.dumps(props or {}),actor='demo',observed_at=at,kafka_offset=at,kafka_partition=0))
record('doc');record('fact','fact',props={'supporting_record_ids':['doc']});record('connector','temporal_connector','temporal',{'targets':[{'workflow_id':'wf'}]})
record('temporal:observation','temporal_observation','temporal',{'observed_at':1});record('run','temporal_run','temporal',{'workflow_id':'wf','run_id':'rid','status':'RUNNING','started_at':'2026-01-02'})
record('run-old','temporal_run','temporal',{'workflow_id':'wf','run_id':'old','status':'COMPLETED','started_at':'2026-01-01'})
record('activity','temporal_activity','temporal',{'run_id':'rid','error':'failed'});record('schedule','temporal_schedule','temporal',{'recent_runs':[{'workflow_id':'wf'}]})
record('trajectory','trajectory','agent',{'status':'done','step_ids':['step']});record('step','step','agent',{'ordinal':1});record('issue','issue','github')
pq.write_table(pa.Table.from_pylist(rows),'/tmp/records.parquet')
table=SimpleNamespace(current_snapshot=lambda:SimpleNamespace(summary={'total-records':str(len(rows))}),metadata_location='/tmp/records.parquet',metadata=SimpleNamespace(table_uuid='uuid',current_schema_id=0))
physical={(ns,'mari.records.mari.document'):table for ns in ['mari_streams','mari_history']}
objects=definitions(physical);schema={'tables':[],'nodes':[],'edges':[],'source_metadata':[]}
for obj in objects.values():
 if obj['kind']=='dataset':schema['tables'].append({'name':obj['table'],'columns':[{k:v for k,v in c.items() if k!='field_id'} for c in obj['columns']]})
 if obj['kind']=='entity':schema['nodes'].append(obj['mapping'])
 if obj['kind']=='relationship':schema['edges'].append(obj['mapping'])
db=duckdb.connect()
class LocalFiles:
 def execute(self,q):return db.execute(q.replace('iceberg_scan(', 'read_parquet('))
with patch('pyiceberg.catalog.load_catalog',return_value=SimpleNamespace(load_table=lambda _:table)), patch('apps.sdk.catalog_lake.snapshot_source',return_value="read_parquet('/tmp/records.parquet')"):
 views=LazyViews(LocalFiles());bind(views,{'objects':objects},'1')
 for name in views.statements:views.ensure(name)
class CheckedEngine(DuckDBEngine):
 @contextmanager
 def query_arrow(self,compiled,batch_size=1024):
  try:validate_read(compiled.sql,tables={table['name'] for table in schema['tables']})
  except Exception as e: print('SQL VALIDATION FAILURE',e,compiled.sql);raise
  with super().query_arrow(compiled,batch_size) as result:yield result
with Connection(CheckedEngine(db),schema) as g:
 def execute(query,parameters=None,language='cypher',project='1',limit=1000,physical_table=None):
  assert language=='cypher'
  try:
   with g.query(query,parameters=parameters or {},language='cypher') as results:
    output=[row for batch in results for row in batch.to_pylist()]
    return {'rows':output[:limit],'truncated':len(output)>limit}
  except Exception as e:print('QUERY FAILED',query,parameters);raise
 with patch.object(reader.engine,'execute',side_effect=execute),patch.object(reader.engine,'session',return_value=nullcontext()),patch.object(reader.engine,'manifest',return_value={'schema':schema,'revision':1}):
  tests=[('overview',lambda:importlib.import_module('apps.overview.overview').overview()),('lineage',lambda:importlib.import_module('apps.lineage.lineage').lineage('fact',30)),('sources',lambda:importlib.import_module('apps.sources.connectors').connectors()),('operations',lambda:importlib.import_module('apps.scheduled-tasks.operations').operations()),('trajectories',lambda:importlib.import_module('apps.workflows.workflows').trajectories(None,25,None,None)),('trajectory',lambda:importlib.import_module('apps.workflows.workflows').trajectory('trajectory')),('projection',lambda:importlib.import_module('apps.sdk.projection').read(['fact'],True)),('records',lambda:reader.records('',10,None,None,True,[],[],[],[],None,'newest'))]
  for name,call in tests:
   result=call()
   if name=='lineage':
    assert {r['record_id'] for r in result['records']}=={'fact','doc'}
    assert len(result['edges'])==1 and result['edges'][0]['relation']=='supported_by'
    Path('/tmp/mari-lineage-fixture.json').write_text(json.dumps(result))
   if name=='sources':
    ids={r['record_id'] for r in result['records']}
    assert {'connector','run','activity'} <= ids and 'run-old' not in ids
   if name=='operations':assert 'run-old' not in {r['record_id'] for r in result['records']}
   if name=='trajectory':assert [r['record_id'] for r in result['steps']]==['step']
   if name=='projection':assert result['metrics']['documents']==2
   print('PASS',name)
  for sort in ['newest','title']:
   first=reader.records('',1,None,None,True,[],[],[],[],None,sort)
   second=reader.records('',1,first['next_cursor'],None,True,[],[],[],[],None,sort)
   assert first['records'][0]['record_id']!=second['records'][0]['record_id']
  import asyncio
  from temporal import evidence,worker
  with patch.object(evidence,'engine',reader.engine):
   assert asyncio.run(evidence.current_evidence(['doc']))['doc']['record_id']=='doc'
   assert [r['record_id'] for r in asyncio.run(evidence.query_records(worker.UNMINED_CYPHER,{'seen':[]}))]==['issue']
  print('PASS cursor paging and Temporal evidence')
