"""Embedded OrchidDB over directly attached Iceberg tables. No views or graph data copies."""
from contextlib import contextmanager
from contextvars import ContextVar
from copy import deepcopy
import os
import time
from functools import lru_cache
import duckdb
import httpx
from orchiddb import Connection,DuckDBEngine,PostgresEngine
from .catalog_config import catalog_properties

def quote(value):return '"'+str(value).replace('"','""')+'"'
def literal(value):return "'"+str(value).replace("'","''")+"'"

def catalog_manifest():
    # Reuse immutable published manifests briefly; do not perform OAuth on every card.
    return _catalog_manifest(os.getenv('ORCHID_GRAPH',os.getenv('MARI_APP_ID','sources').replace('-','_')), int(time.monotonic()//30))

@lru_cache(maxsize=4)
def _catalog_manifest(graph, epoch):
    base=os.getenv('ORCHID_CATALOG_URL','http://orchid-catalog.stack.svc:8182').rstrip('/')+'/v1/'+os.getenv('ORCHID_SCOPE','mari')
    with httpx.Client(timeout=20) as c:
        r=c.post(base+'/oauth/tokens',data={'grant_type':'client_credentials','client_id':os.getenv('ORCHID_CATALOG_CLIENT_ID','admin'),'client_secret':os.environ['ORCHID_CATALOG_CLIENT_SECRET'],'scope':'PRINCIPAL_ROLE:ALL'});r.raise_for_status()
        r=c.get(base+'/graphs/'+graph+'/resolve',headers={'Authorization':'Bearer '+r.json()['access_token']});r.raise_for_status()
        return r.json()['manifest']

def physical_schema(manifest,project):
    schema=deepcopy(manifest['schema'])
    definitions=[o.get('definition',o) for o in manifest['objects'].values()]
    if os.getenv('MARI_STORAGE','iceberg')=='postgres':
        names={d['table']:quote('mari')+'.'+quote(d['description']) for d in definitions if d.get('kind')=='dataset'}
    else:
        datasets={d['table']:d['iceberg'] for d in definitions if d.get('kind')=='dataset' and 'iceberg' in d}
        names={name:'.'.join(quote(n) for n in ['lake',*p['namespace'],p['table']]) for name,p in datasets.items()}
    for table in schema['tables']:
        if table['name'] not in names:raise ValueError('Catalog dataset must name a physical Iceberg table')
        table['name']=names[table['name']];table.pop('engine',None)
    for node in schema['nodes']:
        node['table']=names[node['table']]
        # Native OrchidDB filtered-source mapping enforces project isolation directly.
        node['source_query']='SELECT * FROM '+node['table']+' WHERE project_id='+literal(project)
    for edge in schema.get('edges',[]):
        edge['table']=names[edge['table']]
        edge['source_query']='SELECT * FROM '+edge['table']+' WHERE project_id='+literal(project)
    schema.update(engines={},execution_engine=None,source_metadata=[])
    return schema

def attach_lake(db):
    db.execute('LOAD cache_httpfs');db.execute('LOAD iceberg')
    db.execute('CREATE SECRET mari_s3 (TYPE s3, PROVIDER credential_chain)')
    p=catalog_properties();client,secret=p['credential'].split(':',1)
    db.execute('CREATE SECRET mari_polaris (TYPE iceberg, CLIENT_ID '+literal(client)+', CLIENT_SECRET '+literal(secret)+', OAUTH2_SCOPE '+literal(p['scope'])+', OAUTH2_SERVER_URI '+literal(p['uri'].rstrip('/')+'/v1/oauth/tokens')+')')
    db.execute('ATTACH '+literal(p['warehouse'])+' AS lake (TYPE iceberg, ENDPOINT '+literal(p['uri'])+", SECRET 'mari_polaris', ACCESS_DELEGATION_MODE 'none', READ_ONLY)")

@lru_cache(maxsize=1)
def postgres_pool():
    from psycopg_pool import ConnectionPool
    return ConnectionPool(os.environ['MARI_POSTGRES_DSN'],min_size=1,max_size=4,timeout=10,
        kwargs={'options':'-c statement_timeout=30000 -c default_transaction_read_only=on'})

class KnowledgeGraph:
    def __init__(self):self.active=ContextVar('mari_graph',default=None)
    def manifest(self):
        active=self.active.get()
        return active[2] if active else catalog_manifest()
    @contextmanager
    def session(self,project='1'):
        active=self.active.get()
        if active:
            if active[0]!=project:raise ValueError('Cannot change project within a query session')
            yield active[1];return
        manifest=catalog_manifest()
        if os.getenv('MARI_STORAGE','iceberg')=='postgres':
            with postgres_pool().connection() as db:
                with db.transaction():
                    db.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
                    with Connection(PostgresEngine(db),physical_schema(manifest,project)) as graph:
                        yield from self._session(graph,manifest,project)
            return
        with duckdb.connect(config={'memory_limit':'512MB','threads':2,'extension_directory':os.getenv('DUCKDB_EXTENSION_DIRECTORY','/opt/mari/duckdb')}) as db:
            attach_lake(db)
            with Connection(DuckDBEngine(db),physical_schema(manifest,project)) as graph:
                yield from self._session(graph,manifest,project)
    def _session(self,graph,manifest,project):
                def run(query,parameters=None,limit=1000):
                    with graph.query(query,parameters=parameters or {},language='cypher') as batches:
                        rows=[]
                        for batch in batches:
                            rows.extend(batch.to_pylist())
                            if len(rows)>limit:break
                    return {'rows':rows[:limit],'truncated':len(rows)>limit}
                token=self.active.set((project,run,manifest))
                try:yield run
                finally:self.active.reset(token)
    def execute(self,query,parameters=None,language='cypher',project='1',limit=1000,physical_table=None):
        if language!='cypher':raise ValueError('App reads require Cypher')
        with self.session(project) as run:return run(query,parameters,limit)

# Compatibility for existing app imports; backend selection is deployment-owned.
IcebergGraph=KnowledgeGraph
