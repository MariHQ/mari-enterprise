"""Read the actual Slack Iceberg table through DuckDB's native Iceberg reader."""
import json,os,time
import duckdb
from pyiceberg.catalog import load_catalog

def query():
    started=time.monotonic()
    catalog=load_catalog('mari',type='rest',uri=os.getenv('ICEBERG_REST_URI','http://polaris.stack.svc:8181/api/catalog'),warehouse=os.getenv('ICEBERG_WAREHOUSE','lake'),credential=os.environ['ICEBERG_CREDENTIAL'],scope='PRINCIPAL_ROLE:ALL')
    table=catalog.load_table(('mari','mari.records.slack.message'))
    if table.current_snapshot() is None:raise RuntimeError('Slack table has no committed snapshot yet')
    with duckdb.connect(config={'threads':1,'memory_limit':'256MB','extension_directory':os.getenv('DUCKDB_EXTENSION_DIRECTORY','/opt/mari/duckdb')}) as db:
        db.execute('LOAD cache_httpfs')
        db.execute('LOAD iceberg')
        db.execute('CREATE SECRET (TYPE s3, PROVIDER credential_chain)')
        source="iceberg_scan('"+table.metadata_location.replace("'","''")+"')"
        sql='SELECT channel_id, message_ts, author_id, text FROM '+source+' ORDER BY message_ts DESC LIMIT 5'
        rows=db.execute(sql).fetchall();columns=[d[0] for d in db.description]
        count=db.execute('SELECT count(*) FROM '+source).fetchone()[0]
        print(json.dumps({'table':'mari.mari.records.slack.message','snapshot_id':table.current_snapshot().snapshot_id,'columns':[f.name for f in table.schema().fields],'query':sql,'total_rows':count,'rows':[dict(zip(columns,r)) for r in rows],'seconds':round(time.monotonic()-started,3)},ensure_ascii=False,default=str),flush=True)
if __name__=='__main__':query()
