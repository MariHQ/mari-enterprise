"""Real native OrchidDB/Postgres contract; fixture writes roll back."""
import os,unittest
from unittest.mock import patch
from apps.base.catalog.schema import columns,core
from apps.base.catalog.provision import definitions
from apps.base.catalog.engine import physical_schema
from orchiddb import Connection,PostgresEngine

@unittest.skipUnless(os.getenv('MARI_TEST_POSTGRES_DSN'),'Set MARI_TEST_POSTGRES_DSN')
class PostgresStorageTests(unittest.TestCase):
    def test_typed_evidence_edges_lists_and_project_isolation(self):
        import psycopg
        with psycopg.connect(os.environ['MARI_TEST_POSTGRES_DSN']) as db:
            try:
                db.execute('CREATE SCHEMA IF NOT EXISTS mari')
                topics=['mari.records.agent.fact','mari.records.agent.evidence','mari.records.agent.entity','mari.records.slack.message']
                objects=definitions({('mari',topic):None for topic in topics})
                schema={'tables':[],'nodes':[],'edges':[],'computed_relationships':[]}
                for obj in objects.values():
                    if obj['kind']=='dataset':schema['tables'].append({'name':obj['table'],'columns':obj['columns']})
                    if obj['kind']=='entity':schema['nodes'].append(obj['mapping'])
                    if obj['kind']=='computed_relationship':schema['computed_relationships'].append(obj['mapping'])
                for topic in topics:
                    fields=[]
                    for name,t in columns(topic).items():
                        t=core(t);sql='jsonb' if isinstance(t,dict) else {'string':'text','long':'bigint','double':'double precision','boolean':'boolean','int':'int'}[t]
                        if isinstance(t,dict) and t['type']=='array' and t['items']=='string':sql='text[]'
                        fields.append('"'+name+'" '+sql)
                    db.execute('CREATE TABLE mari."'+topic+'" ('+','.join(fields)+')')
                db.execute('''INSERT INTO mari."mari.records.agent.fact" (project_id,record_id,text,supporting_evidence_ids,evidence) VALUES
                    ('1','f','Uses Postgres',ARRAY['e'],'[{"source_id":"s","evidence_id":"v1","quote":"Use Postgres.","source_node_type":"SlackMessage","snapshot_id":"e"}]'),
                    ('other','f','Private',ARRAY['e'],'[]')''')
                db.execute('''INSERT INTO mari."mari.records.agent.evidence" (project_id,record_id,source_id,source_revision,source_node_type) VALUES ('1','e','s','v1','SlackMessage')''')
                db.execute('''INSERT INTO mari."mari.records.slack.message" (project_id,record_id,event_id,text) VALUES ('1','s','v1','Use Postgres.')''')
                physical=physical_schema({'objects':objects,'schema':schema},'1')
                if os.getenv('MARI_TEST_SCALAR_ID')=='true':
                    for node in physical['nodes']:node['id']='record_id'
                class DiagnosticEngine(PostgresEngine):
                    def query_arrow(self,query,batch_size=65536):
                        if os.getenv('MARI_TEST_SQL')=='true':print(query.sql)
                        return super().query_arrow(query,batch_size)
                with Connection(DiagnosticEngine(db),physical) as graph:
                    with graph.query('MATCH (f:AgentFact)-[:AgentFact_supported_by_AgentEvidence]->(e:AgentEvidence)-[:AgentEvidence_revision_of_SlackMessage]->(s:SlackMessage) RETURN f.text AS claim,s.text AS source,f.evidence AS evidence',language='cypher') as batches:
                        rows=[r for b in batches for r in b.to_pylist()]
                    self.assertEqual(len(rows),1)
                    self.assertEqual(rows[0]['claim'],'Uses Postgres')
                    self.assertEqual(rows[0]['evidence'][0]['quote'],'Use Postgres.')
            finally:db.rollback()

if __name__=='__main__':
    with patch.dict(os.environ,{'MARI_STORAGE':'postgres'}):unittest.main()
