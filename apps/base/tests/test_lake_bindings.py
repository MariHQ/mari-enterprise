"""Exercise native Cypher against physical tables, including typed edges/isolation."""
from contextlib import contextmanager
from types import SimpleNamespace
import unittest
import duckdb
from orchiddb import Connection, DuckDBEngine
from apps.base.catalog.engine import physical_schema
from apps.base.catalog.nodes import label_for
from apps.base.catalog.provision import definitions, topics
from apps.base.catalog.schema import columns, sql_type

@contextmanager
def fixture(rows=()):
    db=duckdb.connect(config={'threads':2})
    db.execute("ATTACH ':memory:' AS lake")
    db.execute('CREATE SCHEMA lake.mari')
    physical={}
    for topic in topics():
        fields=columns(topic)
        db.execute('CREATE TABLE lake.mari."'+topic+'" ('+','.join('"'+name+'" '+sql_type(t) for name,t in fields.items())+')')
        physical[('mari',topic)]=SimpleNamespace(schema=lambda:SimpleNamespace(find_field=lambda n:SimpleNamespace(field_id=1)),metadata=SimpleNamespace(table_uuid=topic,current_schema_id=0))
    for topic,row in rows:
        fields=columns(topic)
        source,kind=topic.split('.')[-2:]
        values={'project_id':'1','event_id':row['record_id']+':1','source':source,'kind':kind,'title':row['record_id'],'text':'','url':'','actor':'demo','observed_at':1,**row}
        db.execute('INSERT INTO lake.mari."'+topic+'" VALUES ('+','.join('?' for n in fields)+')',[values.get(n) for n in fields])
    objects=definitions(physical)
    schema={'tables':[],'nodes':[],'edges':[],'computed_relationships':[]}
    for obj in objects.values():
        if obj['kind']=='dataset':schema['tables'].append({'name':obj['table'],'columns':[{k:v for k,v in c.items() if k!='field_id'} for c in obj['columns']]})
        if obj['kind']=='entity':schema['nodes'].append(obj['mapping'])
        if obj['kind']=='computed_relationship':schema['computed_relationships'].append(obj['mapping'])
    manifest={'objects':objects,'schema':schema,'revision':1}
    try:
        with Connection(DuckDBEngine(db),physical_schema(manifest,'1')) as graph:
            def execute(query,parameters=None,language='cypher',project='1',limit=1000,physical_table=None):
                assert language=='cypher'
                with graph.query(query,parameters=parameters or {},language='cypher') as batches:
                    result=[r for batch in batches for r in batch.to_pylist()]
                return {'rows':result[:limit],'truncated':len(result)>limit}
            yield execute,manifest,db
    finally:db.close()

class BindingsTests(unittest.TestCase):
    def test_concrete_node_reads_only_its_table_and_project(self):
        with fixture([
            ('mari.records.mari.fact',{'record_id':'same','text':'visible'}),
            ('mari.records.agent.fact',{'record_id':'same','text':'other source'}),
            ('mari.records.mari.fact',{'record_id':'same','project_id':'other','text':'private'}),
        ]) as (run,_,db):
            # Dropping an unrelated declared table proves this query never reads it.
            db.execute('DROP TABLE lake.mari."mari.records.slack.message"')
            self.assertEqual(run('MATCH (f:MariFact) RETURN f.record_id AS id, f.text AS text')['rows'],[{'id':'same','text':'visible'}])
            self.assertEqual(db.execute('SELECT count(*) FROM duckdb_views() WHERE NOT internal').fetchone()[0],0)

    def test_typed_relationship_matches_reference_and_project(self):
        with fixture([
            ('mari.records.agent.trajectory',{'record_id':'run','step_ids':['step']}),
            ('mari.records.agent.step',{'record_id':'step','ordinal':1}),
            ('mari.records.agent.step',{'record_id':'step','project_id':'other','ordinal':2}),
            ('mari.records.ax.step',{'record_id':'step','ordinal':3}),
        ]) as (run,_,__):
            rows=run('MATCH (t:AgentTrajectory)-[:AgentTrajectory_has_step_AgentStep]->(s:AgentStep) WHERE t.record_id = $id RETURN s.record_id AS id, s.ordinal AS ordinal',{'id':'run'})['rows']
            self.assertEqual(rows,[{'id':'step','ordinal':1}])

    def test_one_entity_per_topic_and_only_explicit_endpoints(self):
        with fixture() as (_,manifest,__):
            nodes=manifest['schema']['nodes']
            self.assertEqual({n['label'] for n in nodes},{label_for(t) for t in topics()})
            self.assertEqual(len(nodes),len(topics()))
            self.assertTrue(all(n['id']==['project_id','record_id'] for n in nodes))
            supports=[e for e in manifest['schema']['computed_relationships'] if 'supported_by' in e['name']]
            self.assertTrue(supports)
            self.assertTrue(all(e['target']=='AgentEvidence' for e in supports))

if __name__=='__main__':unittest.main()
