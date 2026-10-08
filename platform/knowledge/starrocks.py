"""Alternative OrchidDB execution adapter using a read-only StarRocks account.

StarRocks owns an Iceberg external catalog; each query gets project-scoped
relations. Catalog registration is an operator task, never exposed by this API.
"""
import json
import os
import re
from contextlib import contextmanager
import sqlglot
from sqlglot import exp
from .query import validate_read, graph_schema, COLUMNS, LakeQuery
from .mappings import route_for, accepts, HISTORY_NAMESPACE


def lower(query,parameters,project,input_dialect='duckdb',locations=None):
    tree=validate_read(query,input_dialect)
    prefix=os.getenv('STARROCKS_ICEBERG_DATABASE','lake.mari')
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*',prefix):
        raise ValueError('Invalid StarRocks Iceberg database')
    locations=LakeQuery()._mapped_locations() if locations is None else locations
    catalog=prefix.split('.')[0]
    def relation(view):
        parts=[]
        for namespace,name,_ in locations:
            route=route_for(name)
            if route is None or (namespace==HISTORY_NAMESPACE)!=(view=='history'):continue
            if not accepts(view,*route):continue
            columns=','.join("'"+name.replace("'","''")+"' AS `table`" if col=='table' else '`'+col+'`' for col,_ in COLUMNS)
            quoted='.'.join('`'+v.replace('`','``')+'`' for v in (catalog,namespace,name))
            parts.append(f'SELECT {columns} FROM {quoted}')
        return ' UNION ALL '.join(parts) or 'SELECT '+','.join(f'CAST(NULL AS {typ}) AS `{col}`' for col,typ in COLUMNS)+' WHERE false'
    # StarRocks chooses CTE reuse itself; DuckDB's materialization hint is not portable.
    for cte in tree.find_all(exp.CTE):cte.set('materialized',None)
    ctes={cte.alias for cte in tree.find_all(exp.CTE)}
    for table in list(tree.find_all(exp.Table)):
        if table.name in ctes:continue
        name=table.name
        knowledge=relation('records')
        graph=knowledge+' UNION ALL '+relation('operations')
        if name=='links':
            edges=(f"SELECT project_id, record_id, get_json_string(properties,'$.from_id') AS from_id, "
                "get_json_string(properties,'$.to_id') AS to_id, get_json_string(properties,'$.relation') AS relation, "
                f"title, properties, observed_at FROM ({graph}) AS graph_records WHERE kind='edge' "
                "UNION ALL SELECT project_id, concat(record_id,':thread'), record_id, "
                "get_json_string(properties,'$.thread_root'), 'discussed', title, properties, observed_at "
                f"FROM ({graph}) AS graph_records WHERE source='slack' "
                "AND get_json_string(properties,'$.thread_root') IS NOT NULL "
                "AND get_json_string(properties,'$.thread_root')<>record_id")
            inner=sqlglot.parse_one("SELECT record_id, from_id, to_id, relation, title, properties, observed_at "
                                   f"FROM ({edges}) AS projected_links",read='starrocks')
        elif name=='graph_records':
            inner=sqlglot.parse_one(f'SELECT * FROM ({graph}) AS graph_records',read='starrocks')
        elif name=='records':
            inner=sqlglot.parse_one(knowledge,read='starrocks')
        else:
            inner=sqlglot.parse_one(relation(name),read='starrocks')
        inner=inner.where(exp.column('project_id').eq(exp.convert(project)))
        table.replace(inner.subquery(table.alias_or_name))
    for parameter in list(tree.find_all(exp.Parameter, exp.Placeholder)):
        if parameter.name not in parameters:raise ValueError('Missing query parameter: '+parameter.name)
        parameter.replace(exp.convert(parameters[parameter.name]))
    return tree.sql(dialect='starrocks')


class StarRocksQuery:
    def execute(self,query,parameters=None,language='sql',project='1',limit=1000,physical_table=None):
        import pymysql
        from orchiddb import Connection,StarRocksEngine
        params=parameters or {}
        locations=LakeQuery()._mapped_locations()
        if physical_table is not None:locations=[r for r in locations if r[1]==physical_table]
        connection=pymysql.connect(host=os.environ['STARROCKS_HOST'],port=int(os.getenv('STARROCKS_PORT','9030')),
            user=os.environ['STARROCKS_USER'],password=os.environ['STARROCKS_PASSWORD'],
            connect_timeout=10,read_timeout=25,write_timeout=10,autocommit=True)
        try:
            with connection.cursor() as cursor:cursor.execute('SET query_timeout=20')
            if language=='sql':
                with connection.cursor() as cursor:
                    cursor.execute(lower(query,params,project,locations=locations))
                    columns=[d[0] for d in cursor.description];rows=cursor.fetchmany(limit+1)
                    return {'rows':[dict(zip(columns,row)) for row in rows[:limit]],'truncated':len(rows)>limit}
            class ScopedEngine(StarRocksEngine):
                @contextmanager
                def query_arrow(self,compiled,batch_size=1024):
                    from dataclasses import replace
                    guarded=replace(compiled,sql=lower(compiled.sql,{},project,'starrocks',locations=locations))
                    with super().query_arrow(guarded,batch_size) as reader:yield reader
            with Connection(ScopedEngine(connection),graph_schema()) as graph:
                with graph.query(query,language=language,parameters=params) as reader:
                    rows=[]
                    for batch in reader:
                        rows.extend(batch.to_pylist())
                        if len(rows)>limit:break
                    return {'rows':rows[:limit],'truncated':len(rows)>limit}
        finally:connection.close()
