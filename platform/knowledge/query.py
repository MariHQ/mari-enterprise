"""Read-only OrchidDB sessions over lake snapshots; no local record database."""
from __future__ import annotations
from contextlib import contextmanager
import json
import os
from threading import Timer, BoundedSemaphore
from queue import LifoQueue, Empty
import duckdb
import sqlglot
from sqlglot import exp
from .mappings import KINDS, NAMESPACE, HISTORY_NAMESPACE, route_for, accepts
from .relationships import RELATIONSHIP_LINKS_SQL

COLUMNS = [('project_id','VARCHAR'),('record_id','VARCHAR'),('event_id','VARCHAR'),
    ('operation','VARCHAR'),('kind','VARCHAR'),('source','VARCHAR'),('title','VARCHAR'),
    ('text','VARCHAR'),('url','VARCHAR'),('properties','VARCHAR'),('actor','VARCHAR'),
    ('observed_at','BIGINT'),('stream_offset','BIGINT'),('table','VARCHAR')]
TABLES = {'records', 'history', 'links', 'operations', 'graph_records'} | set(KINDS)
KNOWLEDGE_ROWS = "source <> 'temporal' AND kind NOT IN ('workflow','mining_receipt')"


# Current-record provenance is computed rather than independently persisted, so
# retractions cannot leave stale connector/run links behind.
PROVENANCE_LINKS_SQL = """SELECT record_id || ':connector' AS record_id,
    json_extract_string(properties,'$.connector_id') AS from_id, record_id AS to_id,
    'ingested' AS relation, title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.connector_id') IS NOT NULL
    UNION ALL SELECT record_id || ':ingestion-run',
    json_extract_string(properties,'$.ingestion_run_id'), record_id,
    'produced', title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.ingestion_run_id') IS NOT NULL
    UNION ALL SELECT record_id || ':author', json_extract_string(properties,'$.author_record_id'),
    record_id, 'authored', title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.author_record_id') IS NOT NULL
    UNION ALL SELECT record_id || ':collection', json_extract_string(properties,'$.collection_id'),
    record_id, 'contains', title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.collection_id') IS NOT NULL"""


MINING_LINKS_SQL = """SELECT candidate.record_id || ':source', candidate.record_id,
    evidence.record_id, 'derived_from', candidate.title, candidate.properties, candidate.observed_at
    FROM graph_records candidate JOIN graph_records evidence
    ON evidence.record_id=json_extract_string(candidate.properties,'$.source_id')
    AND evidence.event_id=json_extract_string(candidate.properties,'$.evidence_id')
    WHERE candidate.source='agent' AND candidate.kind NOT IN ('edge','workflow','mining_receipt')
    UNION ALL SELECT candidate.record_id || ':execution', execution.record_id,
    candidate.record_id, 'produced', candidate.title, candidate.properties, candidate.observed_at
    FROM graph_records candidate JOIN graph_records execution
    ON execution.record_id='run:' || json_extract_string(candidate.properties,'$.run_id')
    AND execution.kind='workflow' AND execution.source='agent'
    WHERE candidate.source='agent' AND candidate.kind NOT IN ('edge','workflow','mining_receipt')"""


def validate_read(query: str, dialect='duckdb'):
    statements = sqlglot.parse(query, read=dialect)
    if len(statements) != 1 or not isinstance(statements[0], (exp.Select, exp.Union, exp.Intersect, exp.Except)):
        raise ValueError('Only a single read-only query is allowed')
    tree = statements[0]
    forbidden = (exp.Insert, exp.Update, exp.Delete, exp.Create, exp.Drop, exp.Command, exp.Into)
    if any(isinstance(node, forbidden) for node in tree.walk()):
        raise ValueError('Knowledge API is read-only')
    ctes = {cte.alias for cte in tree.find_all(exp.CTE)}
    for table in tree.find_all(exp.Table):
        if not isinstance(table.this, exp.Identifier) or table.name not in TABLES | ctes or table.db or table.catalog:
            raise ValueError('Queries may only read registered knowledge views')
    # Unknown functions include query(), read_parquet(), http and extension hooks.
    allowed = {'json_extract', 'json_extract_string', 'json_array_length', 'json_contains',
               'json_each', 'regexp_matches', 'epoch', 'to_timestamp', 'list_contains'}
    for function in tree.find_all(exp.Anonymous):
        if function.name.lower() not in allowed:
            raise ValueError(f'Function is not available: {function.name}')
    return tree


def graph_schema():
    columns = [{'name': name, 'data_type': 'int64' if kind == 'BIGINT' else 'string'} for name, kind in COLUMNS]
    return {'tables': [{'name':'graph_records','columns':columns},
                       {'name':'links','columns':[{'name':name,'data_type':'string'} for name in ['record_id','from_id','to_id','relation']]}],
            'nodes':[{'label':'Record','table':'graph_records','id':'record_id',
                      'properties':{name:name for name,_ in COLUMNS}}],
            'edges':[{'label':'RELATED','table':'links','id':'record_id','source':'from_id','target':'to_id',
                      'source_label':'Record','target_label':'Record','properties':{'relation':'relation'}}],
            'rdf':[{'table':'graph_records','subject':{'kind':'template','prefix':'urn:mari:record:','columns':['record_id']},
                    'predicate':{'kind':'constant','value':'urn:mari:'+name},
                    'object':{'kind':'literal','column':name}} for name in ['title','text','source','kind']]}



def _literal(value):
    return "'" + str(value).replace("'", "''") + "'"


class LakeQuery:
    def __init__(self, catalog=None):
        self.catalog = catalog
        self._slots = BoundedSemaphore(2)
        self._connections = LifoQueue(maxsize=2)
        self._bindings = {}

    def _catalog(self):
        if self.catalog is None:
            from pyiceberg.catalog import load_catalog
            # JDBC catalog shared with Flink; only table metadata is read here.
            self.catalog = load_catalog('mari', **json.loads(os.environ['ICEBERG_CATALOG_PROPERTIES']))
        return self.catalog

    def _mapped_locations(self):
        # One fresh catalog lookup; no S3 reads merely to discover tables.
        from pyiceberg.catalog.sql import SqlCatalog, IcebergTables
        from sqlalchemy import select
        catalog = self._catalog()
        if isinstance(catalog, SqlCatalog):
            statement = select(IcebergTables.table_namespace, IcebergTables.table_name,
                               IcebergTables.metadata_location).where(
                IcebergTables.catalog_name == catalog.name,
                IcebergTables.table_namespace.in_([NAMESPACE, HISTORY_NAMESPACE]))
            with catalog.engine.connect() as connection:
                return list(connection.execute(statement))
        from pyiceberg.exceptions import NoSuchNamespaceError
        result = []
        for namespace in (NAMESPACE, HISTORY_NAMESPACE):
            try: identifiers = catalog.list_tables(namespace)
            except NoSuchNamespaceError: continue
            for identifier in identifiers:
                result.append((namespace, identifier[-1], catalog.load_table(identifier).metadata_location))
        return result

    def _bind(self, database, view, definition):
        bindings = self._bindings.setdefault(database, {})
        if bindings.get(view) != definition:
            database.execute(f'CREATE OR REPLACE VIEW {view} AS {definition}')
            bindings[view] = definition

    @contextmanager
    def session(self, project, include_history=True, include_operations=False, include_records=True, include_graph=False, requested=None, physical_table=None):
        try:
            database = self._connections.get_nowait()
        except Empty:
            database = duckdb.connect(config={'memory_limit':'256MB','threads':'4', 'allow_unsigned_extensions':'false', 'extension_directory':os.getenv('DUCKDB_EXTENSION_DIRECTORY',os.path.expanduser('~/.duckdb/extensions'))})
            try:
                database.execute('LOAD iceberg'); database.execute('LOAD cache_httpfs')
                # Iceberg metadata, manifests and data/delete files have immutable
                # paths. The authoritative catalog pointer is still resolved on
                # every request below, including after updates and retractions.
                # Bound the extension cache separately from DuckDB's memory limit.
                database.execute("SET cache_httpfs_type='in_mem'")
                database.execute('SET cache_httpfs_cache_block_size=524288')
                database.execute('SET cache_httpfs_max_in_mem_cache_block_count=128')
                database.execute('SET cache_httpfs_enable_cache_validation=false')
                database.execute("SET cache_httpfs_parallel_read_mode='duckdb_task_scheduler'")
                database.execute('SET cache_httpfs_max_fanout_subrequest=4')
                database.execute('SET httpfs_connection_caching=true')
                database.execute('SET http_timeout=10'); database.execute('SET http_retries=1')
                database.execute('CREATE SECRET lake_s3 (TYPE s3, PROVIDER credential_chain)')
            except BaseException:
                database.close()
                raise
        # This deadline includes iceberg_scan binding and metadata planning, not
        # just execution. Keep immutable-file caches between reads, but resolve
        # the current catalog pointer and project-scoped views on EVERY request.
        reusable = False
        interrupted = False
        timer = Timer(30, database.interrupt); timer.daemon=True; timer.start()
        try:
            requested = set(requested or ())
            if include_records: requested.add('records')
            if include_operations: requested.add('operations')
            if include_history: requested.add('history')
            if include_graph: requested.update(('records', 'operations'))
            locations = self._mapped_locations()
            columns = ','.join('"'+name+'"' for name,_ in COLUMNS)
            empty = 'SELECT '+','.join(f'CAST(NULL AS {kind}) AS "{name}"' for name,kind in COLUMNS)+' WHERE false'
            for view in requested - {'links', 'graph_records'}:
                parts = []
                for namespace, table, metadata in locations:
                    if physical_table is not None and table != physical_table: continue
                    route = route_for(table)
                    if route is None or (namespace == HISTORY_NAMESPACE) != (view == 'history'):
                        continue
                    source, kind = route
                    if not accepts(view, source, kind): continue
                    # Route constants let DuckDB eliminate irrelevant UNION arms.
                    projection = ','.join(_literal(source)+' AS source' if name == 'source' else
                        _literal(kind)+' AS kind' if name == 'kind' else _literal(table)+' AS "table"' if name == 'table' else '"'+name+'"' for name,_ in COLUMNS)
                    parts.append(f'SELECT {projection} FROM iceberg_scan({_literal(metadata)}) WHERE project_id={_literal(project)}')
                self._bind(database, view, ' UNION ALL '.join(parts) or empty)
            if include_graph:
                self._bind(database, 'graph_records', 'SELECT * FROM records UNION ALL SELECT * FROM operations')
                self._bind(database, 'links', """SELECT record_id,
                    json_extract_string(properties,'$.from_id') AS from_id,
                    json_extract_string(properties,'$.to_id') AS to_id,
                    json_extract_string(properties,'$.relation') AS relation,
                    title, properties, observed_at FROM graph_records WHERE kind='edge'
                    UNION ALL SELECT record_id || ':thread', record_id,
                    json_extract_string(properties,'$.thread_root'), 'discussed', title, properties, observed_at
                    FROM graph_records WHERE source='slack' AND json_extract_string(properties,'$.thread_root') IS NOT NULL
                    AND json_extract_string(properties,'$.thread_root')<>record_id""" + ' UNION ALL ' + PROVENANCE_LINKS_SQL + ' UNION ALL ' + MINING_LINKS_SQL + ' UNION ALL ' + RELATIONSHIP_LINKS_SQL)
            # Iceberg UNION cardinalities can overflow DuckDB's unknown-size
            # sentinel. Disable only this pass for graph SQL/Cypher/Gremlin/SPARQL;
            # filter and projection pushdown remain enabled.
            previous = database.execute("SELECT current_setting('disabled_optimizers')").fetchone()[0]
            if include_graph:
                disabled = ','.join(dict.fromkeys(filter(None, [*previous.split(','), 'statistics_propagation'])))
                database.execute("SET disabled_optimizers=" + _literal(disabled))
            try:
                yield database
            finally:
                if include_graph:
                    database.execute("SET disabled_optimizers=" + _literal(previous))
            reusable = True
        except duckdb.InterruptException:
            interrupted = True
            raise
        finally:
            timer.cancel(); timer.join()
            if interrupted:
                # An interrupted read need not discard immutable-file caches and
                # force every retry through the same cold-read timeout. Test the
                # connection only after its interrupt timer has fully stopped.
                try:
                    database.execute('SELECT 1').fetchone()
                    reusable = True
                except Exception:
                    pass
            if reusable:self._connections.put_nowait(database)
            else:
                self._bindings.pop(database, None)
                database.close()

    def execute(self, query, parameters=None, language='sql', project='1', limit=1000, physical_table=None):
        if not self._slots.acquire(timeout=2):
            raise RuntimeError('Knowledge query capacity is busy; retry')
        try:
            return self._execute(query, parameters, language, project, limit, physical_table)
        finally:
            self._slots.release()

    def _execute(self, query, parameters=None, language='sql', project='1', limit=1000, physical_table=None):
        if os.getenv('KNOWLEDGE_BACKEND','duckdb')=='starrocks':
            from .starrocks import StarRocksQuery
            return StarRocksQuery().execute(query,parameters,language,project,limit,physical_table)
        parameters = parameters or {}
        tree = validate_read(query) if language == 'sql' else None
        requested={table.name for table in tree.find_all(exp.Table)} if tree is not None else {'graph_records'}
        include_graph=bool(requested & {'graph_records','links'})
        with self.session(project, include_history='history' in requested, include_operations='operations' in requested,
                          include_records='records' in requested, include_graph=include_graph, requested=requested & TABLES, physical_table=physical_table) as database:
            if language == 'sql':
                validate_read(query)
                cursor=database.execute(query, parameters)
                columns=[col[0] for col in cursor.description]
                rows=cursor.fetchmany(limit+1)
                return {'rows':[dict(zip(columns,row)) for row in rows[:limit]], 'truncated':len(rows)>limit}
            from orchiddb import Connection, DuckDBEngine
            class ReadOnlyEngine(DuckDBEngine):
                @contextmanager
                def query_arrow(self, compiled, batch_size=1024):
                    validate_read(compiled.sql)
                    with super().query_arrow(compiled,batch_size) as reader:
                        yield reader
            with Connection(ReadOnlyEngine(database), graph_schema()) as graph:
                with graph.query(query, parameters=parameters, language=language) as reader:
                    rows=[]
                    for batch in reader:
                        rows.extend(batch.to_pylist())
                        if len(rows)>limit: break
                    return {'rows':rows[:limit], 'truncated':len(rows)>limit}
