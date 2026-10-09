"""Bind catalog-declared Flink current/history tables to original Mari projections."""
from contextlib import contextmanager
import json
import sqlglot
from sqlglot import exp
from contextvars import ContextVar
from concurrent.futures import ThreadPoolExecutor
from threading import local
from apps.sdk.graph import JSON_PROPERTIES
from apps.sdk.iceberg_files import snapshot_source
import os
import tempfile
from threading import BoundedSemaphore, Timer
import duckdb
import httpx
from apps.sdk.data.query import COLUMNS, validate_read, PROVENANCE_LINKS_SQL, MINING_LINKS_SQL
from apps.sdk.data.mappings import KINDS
from apps.sdk.data.relationships import RELATIONSHIP_LINKS_SQL


def literal(value): return "'"+str(value).replace("'", "''")+"'"


def catalog_manifest():
    origin=os.getenv('ORCHID_CATALOG_URL','http://orchid-catalog.stack.svc:8182').rstrip('/')
    scope=os.getenv('ORCHID_SCOPE','mari')
    graph=os.getenv('ORCHID_GRAPH',os.environ.get('MARI_APP_ID','sources').replace('-','_'))
    with httpx.Client(timeout=20) as client:
        token=client.post(f'{origin}/v1/{scope}/oauth/tokens',data={'grant_type':'client_credentials','client_id':os.getenv('ORCHID_CATALOG_CLIENT_ID','admin'),'client_secret':os.environ['ORCHID_CATALOG_CLIENT_SECRET'],'scope':'PRINCIPAL_ROLE:ALL'})
        token.raise_for_status()
        result=client.get(f'{origin}/v1/{scope}/graphs/{graph}/resolve',headers={'Authorization':'Bearer '+token.json()['access_token']})
        result.raise_for_status()
        return result.json()['manifest']


def bind(database, manifest, project, physical_table=None, namespace_filter=None):
    """Only published physical table references determine what an app can read."""
    from pyiceberg.catalog import load_catalog
    from apps.sdk.catalog_config import catalog_properties
    current_parts=[];history_parts=[];empty_parts={}
    objects=manifest['objects']
    definitions=objects.values() if isinstance(objects,dict) else objects
    selected=[]
    for obj in definitions:
        definition=obj.get('definition',obj)
        iceberg=definition.get('iceberg')
        if not iceberg: continue
        namespace=iceberg['namespace']
        if namespace not in (['mari_streams'],['mari_history']):
            raise ValueError('Unexpected Mari dataset namespace')
        if namespace_filter is not None and namespace != [namespace_filter]:continue
        topic=iceberg['table']
        if physical_table is not None and topic!=physical_table:continue
        selected.append(definition)
    # Resolve each table once per request; independent catalog clients avoid shared
    # authentication/session mutation while bounding metadata concurrency.
    clients=local()
    def load(definition):
        if not hasattr(clients,'catalog'):
            clients.catalog=load_catalog('mari', **catalog_properties())
        iceberg=definition['iceberg']
        table=clients.catalog.load_table((*iceberg['namespace'],iceberg['table']))
        return table,snapshot_source(table)
    with ThreadPoolExecutor(max_workers=8) as pool:
        tables=list(pool.map(load,selected))
    for definition,(table,source) in zip(selected,tables):
        iceberg=definition['iceberg'];namespace=iceberg['namespace'];topic=iceberg['table']
        if str(table.metadata.table_uuid)!=iceberg['table_uuid']:
            raise ValueError('Published Iceberg table identity changed')
        columns=[]
        for name,typ in COLUMNS:
            if name=='stream_offset': value='kafka_offset'
            elif name=='table':value=literal(topic)
            else:value='"'+name+'"'
            columns.append(f'{value} AS "{name}"')
        columns += [("try_cast(json_extract_string(properties,'$.ordinal') AS BIGINT)" if name=="ordinal" else "json_extract_string(properties,'$."+name+"')")+" AS \""+name+"\"" for name in JSON_PROPERTIES]
        columns += ["lower(split_part(source,':',1)) AS source_group", "coalesce(nullif(actor,''),'Unknown owner') AS owner_name",
                    "CASE WHEN kind IN ('pr','pull_request') THEN 'Pull requests' WHEN kind IN ('message','thread','slack_message') THEN 'Conversations' ELSE 'Documents' END AS content_type",
                    "to_json(list_value(project_id,"+literal(topic)+",record_id,event_id))::VARCHAR AS event_key"]
        snapshot=table.current_snapshot()
        empty=snapshot is None or (snapshot.summary is not None and snapshot.summary.get('total-records')=='0')
        if empty:
            # Fresh tables have no data files. Bind their declared types without
            # repeatedly opening empty Iceberg metadata and manifests in S3.
            types={'string':'VARCHAR','int64':'BIGINT','int32':'INTEGER'}
            source='(SELECT '+','.join('CAST(NULL AS '+types[c['data_type']]+') AS "'+c['name']+'"' for c in definition['columns'])+' WHERE FALSE)'
        projection='SELECT '+','.join(columns)+' FROM '+source+' WHERE project_id='+literal(project)
        alias=definition.get('table')
        if alias:
            database.execute('CREATE TEMP VIEW "'+alias.replace('"','""')+'" AS '+projection)
        if empty:
            empty_parts.setdefault(namespace[0],projection)
        else:
            (history_parts if namespace==['mari_history'] else current_parts).append(projection)
    if not current_parts and 'mari_streams' in empty_parts:current_parts.append(empty_parts['mari_streams'])
    if not history_parts and 'mari_history' in empty_parts:history_parts.append(empty_parts['mari_history'])
    if not current_parts and namespace_filter != 'mari_history' or not history_parts and namespace_filter != 'mari_streams':
        raise ValueError('Current and history datasets must be published before app reads')
    if history_parts:database.execute('CREATE TEMP VIEW history AS '+ ' UNION ALL '.join(history_parts))
    if not current_parts:return
    database.execute('CREATE TEMP VIEW graph_records AS '+ ' UNION ALL '.join(current_parts))
    # Flink maintains current rows and deduplicates history by event identity.
    database.execute('CREATE TEMP VIEW records AS SELECT * FROM graph_records WHERE source <> \'temporal\' AND kind NOT IN (\'workflow\',\'mining_receipt\',\'principal\',\'change\',\'review\',\'collection\',\'trajectory\',\'step\')')
    database.execute('CREATE TEMP VIEW operations AS SELECT * FROM graph_records WHERE source = \'temporal\' OR kind IN (\'workflow\',\'mining_receipt\',\'principal\',\'change\',\'review\',\'collection\',\'trajectory\',\'step\')')
    for view,kinds in KINDS.items():
        database.execute(f'CREATE TEMP VIEW "{view}" AS SELECT * FROM graph_records WHERE kind IN ('+','.join(literal(k) for k in kinds)+')')
    database.execute("""CREATE TEMP VIEW links AS SELECT record_id,
        json_extract_string(properties,'$.from_id') AS from_id,
        json_extract_string(properties,'$.to_id') AS to_id,
        json_extract_string(properties,'$.relation') AS relation, title, properties, observed_at
        FROM graph_records WHERE kind='edge' UNION ALL """+PROVENANCE_LINKS_SQL+' UNION ALL '+MINING_LINKS_SQL+' UNION ALL '+RELATIONSHIP_LINKS_SQL)
    from apps.sdk.provision import RELATIONS
    for relation in RELATIONS:
        database.execute(f'CREATE TEMP VIEW edge_{relation} AS SELECT * FROM links WHERE relation='+literal(relation))



class LazyViews:
    """Bind only the views referenced by compiled Cypher, not every screen's views."""
    def __init__(self,database,resolver=None,materialize=True):
        self.database=database;self.statements={};self.ready=set()
        self.resolver=resolver;self.materialize=materialize

    def prepare(self,names):
        if self.resolver:self.resolver(names)

    def execute(self,statement):
        prefix,_,_=statement.partition(' AS ')
        name=prefix.removeprefix('CREATE TEMP VIEW ').strip('"').replace('""','"')
        self.statements[name]=statement

    def ensure(self,name):
        if name in self.ready or name not in self.statements:return
        statement=self.statements[name]
        for table in sqlglot.parse_one(statement,read='duckdb').find_all(exp.Table):
            if table.name!=name:self.ensure(table.name)
        # A graph traversal references Record repeatedly. Read its project-scoped
        # snapshot once per request instead of rescanning S3 for every edge arm.
        if self.materialize and name in ('graph_records','links'):
            statement=statement.replace('CREATE TEMP VIEW','CREATE TEMP TABLE',1)
        self.database.execute(statement)
        self.ready.add(name)


class CatalogLake:
    def __init__(self):
        self.slots=BoundedSemaphore(2)
        self.active=ContextVar('mari_graph_session',default=None)

    @contextmanager
    def session(self, project='1', physical_table=None, materialize=True):
        existing=self.active.get()
        if existing is not None:
            if existing[0] != (project,physical_table): raise ValueError('Cannot change scope inside a graph session')
            yield existing[1]
            return
        if not self.slots.acquire(timeout=2): raise RuntimeError('Query capacity is busy')
        database=None; timer=None; token=None; temporary=None
        try:
            manifest=catalog_manifest()
            temporary=tempfile.TemporaryDirectory(prefix='mari-lake-')
            database=duckdb.connect(config={'temp_directory':temporary.name,'max_temp_directory_size':'1GB','memory_limit':'512MB','threads':4,'extension_directory':os.getenv('DUCKDB_EXTENSION_DIRECTORY',os.path.expanduser('~/.duckdb/extensions'))})
            database.execute("CREATE SECRET mari_s3 (TYPE s3, PROVIDER credential_chain)")
            database.execute("LOAD iceberg; SET enable_http_metadata_cache=true; SET parquet_metadata_cache=true; SET disabled_optimizers='statistics_propagation'")
            prepared=set()
            objects=manifest['objects']
            definitions=objects.values() if isinstance(objects,dict) else objects
            history_names={'history'} | {obj.get('definition',obj).get('table') for obj in definitions if obj.get('definition',obj).get('iceberg',{}).get('namespace')==['mari_history']}
            def resolve(names):
                needed={'mari_history' if name in history_names else 'mari_streams' for name in names}
                for namespace in sorted(needed-prepared):
                    bind(views,manifest,project,physical_table,namespace)
                    prepared.add(namespace)
            views=LazyViews(database,resolve,materialize)
            from orchiddb import Connection, DuckDBEngine
            class ReadOnlyEngine(DuckDBEngine):
                @contextmanager
                def query_arrow(self, compiled, batch_size=1024):
                    tree=validate_read(compiled.sql, tables={table['name'] for table in manifest['schema']['tables']})
                    nonlocal timer
                    names={table.name for table in tree.find_all(exp.Table)}
                    views.prepare(names)
                    if timer is None:
                        timer=Timer(60,database.interrupt);timer.start()
                    for name in names:views.ensure(name)
                    with super().query_arrow(compiled,batch_size) as result:
                        yield result
            # Published connectors describe storage ownership. Once bound above,
            # these tables execute in this app's embedded DuckDB engine.
            schema={**manifest['schema'],'engines':{},'execution_engine':None,'source_metadata':[]}
            schema['tables']=[{k:v for k,v in table.items() if k!='engine'} for table in schema['tables']]
            with Connection(ReadOnlyEngine(database),schema) as graph:
                def run(query,parameters=None,language='cypher',limit=1000):
                    # SQL is restricted to internal storage bindings. Public reads use Cypher.
                    if language!='cypher': raise ValueError('Mari reads require Cypher')
                    with graph.query(query,parameters=parameters or {},language='cypher') as result:
                        rows=[]
                        for batch in result:
                            rows.extend(batch.to_pylist())
                            if len(rows)>limit: break
                    return {'rows':rows[:limit],'truncated':len(rows)>limit}
                token=self.active.set(((project,physical_table),run,manifest))
                yield run
        finally:
            if token is not None:self.active.reset(token)
            if timer:timer.cancel();timer.join()
            if database:database.close()
            if temporary:temporary.cleanup()
            self.slots.release()

    def manifest(self):
        active=self.active.get()
        return active[2] if active is not None else catalog_manifest()

    def execute(self, query, parameters=None, language='cypher', project='1', limit=1000, physical_table=None):
        with self.session(project,physical_table) as run:
            return run(query,parameters,language,limit)
