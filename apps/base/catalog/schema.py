"""Read the checked-in per-topic producer schemas for catalog registration."""
import json,os
from pathlib import Path
BASE={'project_id','record_id','event_id','kind','source','title','text','url','actor','observed_at'}
def schema_dir():return Path(os.getenv('MARI_SCHEMA_DIR',str(Path(__file__).resolve().parents[1]/'schemas')))
def schema(topic):return json.loads((schema_dir()/(topic+'.avsc')).read_text())
def core(t):return next(x for x in t if x!='null') if isinstance(t,list) else t
def sql_type(t):
 t=core(t)
 if isinstance(t,str):return {'string':'VARCHAR','long':'BIGINT','int':'INTEGER','boolean':'BOOLEAN','double':'DOUBLE','float':'FLOAT','bytes':'BLOB'}[t]
 if t['type']=='array':return sql_type(t['items'])+'[]'
 if t['type']=='map':return 'MAP(VARCHAR,'+sql_type(t['values'])+')'
 if t['type']=='record':return 'STRUCT('+','.join('"'+f['name']+'" '+sql_type(f['type']) for f in t['fields'])+')'
 raise ValueError('Unsupported declared Avro type')
def orchid_type(t):
 t=core(t)
 if isinstance(t,str):return {'string':'string','long':'int64','int':'int32','boolean':'boolean','double':'float64','float':'float32','bytes':'binary'}[t]
 if t['type']=='array':return 'list:'+orchid_type(t['items'])
 if t['type']=='record':return 'struct:'+json.dumps({f['name']:orchid_type(f['type']) for f in t['fields']},separators=(',',':'))
 return 'json'
def columns(topic):return {f['name']:f['type'] for f in schema(topic)['fields']}
