"""Bind catalog-declared Flink current/history tables to original Mari projections."""
from contextlib import contextmanager
import json
import os
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


def bind(database, manifest, project, physical_table=None):
    """Only published physical table references determine what an app can read."""
    from pyiceberg.catalog import load_catalog
    from apps.sdk.catalog_config import catalog_properties
    catalog=load_catalog('mari', **catalog_properties())
    current_parts=[];history_parts=[]
    objects=manifest['objects']
    definitions=objects.values() if isinstance(objects,dict) else objects
    for obj in definitions:
        definition=obj.get('definition',obj)
        iceberg=definition.get('iceberg')
        if not iceberg: continue
        namespace=iceberg['namespace']
        if namespace not in (['mari_streams'],['mari_history']):
            raise ValueError('Unexpected Mari dataset namespace')
        topic=iceberg['table']
        if physical_table is not None and topic!=physical_table:continue
        table=catalog.load_table((*namespace,topic))
        if str(table.metadata.table_uuid)!=iceberg['table_uuid']:
            raise ValueError('Published Iceberg table identity changed')
        columns=[]
        for name,typ in COLUMNS:
            if name=='stream_offset': value='kafka_offset'
            elif name=='table':value=literal(topic)
            else:value='"'+name+'"'
            columns.append(f'{value} AS "{name}"')
        projection='SELECT '+','.join(columns)+' FROM iceberg_scan('+literal(table.metadata_location)+') WHERE project_id='+literal(project)
        (history_parts if namespace==['mari_history'] else current_parts).append(projection)
    if not current_parts or not history_parts: raise ValueError('Current and history datasets must be published before app reads')
    database.execute('CREATE TEMP VIEW history AS '+ ' UNION ALL '.join(history_parts))
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



class CatalogLake:
    def __init__(self): self.slots=BoundedSemaphore(2)
    def execute(self, query, parameters=None, language='sql', project='1', limit=1000, physical_table=None):
        if not self.slots.acquire(timeout=2): raise RuntimeError('Query capacity is busy')
        database=None; timer=None
        try:
            if language=='sql': validate_read(query)
            manifest=catalog_manifest()
            database=duckdb.connect(config={'memory_limit':'512MB','threads':2,'extension_directory':os.getenv('DUCKDB_EXTENSION_DIRECTORY',os.path.expanduser('~/.duckdb/extensions'))})
            timer=Timer(30,database.interrupt);timer.start()
            database.execute("CREATE SECRET mari_s3 (TYPE s3, PROVIDER credential_chain)")
            bind(database,manifest,project,physical_table)
            from orchiddb import Connection, DuckDBEngine
            class ReadOnlyEngine(DuckDBEngine):
                @contextmanager
                def query_arrow(self, compiled, batch_size=1024):
                    validate_read(compiled.sql)
                    with super().query_arrow(compiled,batch_size) as result:
                        yield result
            with Connection(ReadOnlyEngine(database),manifest['schema']) as graph:
                if language=='sql':
                    result=database.execute(query,parameters or {})
                    columns=[c[0] for c in result.description];rows=[dict(zip(columns,r)) for r in result.fetchmany(limit+1)]
                else:
                    with graph.query(query,parameters=parameters or {},language=language) as result:
                        rows=[]
                        for batch in result:
                            rows.extend(batch.to_pylist())
                            if len(rows)>limit: break
            return {'rows':rows[:limit],'truncated':len(rows)>limit}
        finally:
            if timer:timer.cancel();timer.join()
            if database:database.close()
            self.slots.release()
