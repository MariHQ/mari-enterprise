"""Bounded Cypher neighborhoods over the published Mari graph."""
from fastapi import APIRouter, HTTPException, Query
from apps.sdk.data.reader import execute, hydrate, graph_snapshot, engine
from apps.sdk.graph import projection
router=APIRouter()


def catalog_description():
    manifest=engine.manifest()
    schema=manifest['schema']
    tables={table['name']:{c['name']:c['data_type'] for c in table['columns']} for table in schema.get('tables',[])}
    def properties(item):
        types=tables.get(item['table'],{})
        return [{'name':name,'type':types.get(column,'string')} for name,column in item.get('properties',{}).items()]
    return {'revision':manifest.get('revision'),
            'nodes':[{'label':node['label'],'properties':properties(node)} for node in schema.get('nodes',[])],
            'edges':[{'label':edge['label'],'source':edge.get('source_label'),'target':edge.get('target_label'),'properties':properties(edge)} for edge in schema.get('edges',[])]}


@router.get('/api/lineage/catalog')
def catalog():
    return catalog_description()


@router.get('/api/lineage')
@graph_snapshot
def lineage(focal: str | None = Query(None,min_length=1,max_length=2048), limit: int = Query(30,ge=1,le=100)):
    metadata=catalog_description()
    if focal is None:
        seed=execute("MATCH (r:Record) WHERE r.kind <> 'edge' RETURN r.record_id AS record_id ORDER BY r.observed_at DESC,r.record_id LIMIT 1")['rows']
        if not seed:return {'records':[],'edges':[],'has_more':False,'limit':limit,'focal':None,'catalog':metadata}
        focal=seed[0]['record_id']
    focal_rows=execute('MATCH (r:Record) WHERE r.record_id=$id AND r.kind <> \'edge\' RETURN '+projection(text="''")+' LIMIT 1',{'id':focal})['rows']
    if not focal_rows:raise HTTPException(404,'Selected lineage record not found')
    edges=execute('MATCH (f:Record)-[e]-(n:Record) WHERE f.record_id=$id RETURN DISTINCT e.record_id AS record_id, e.observed_at AS observed_at, e.from_id AS from_id, e.to_id AS to_id, e.relation AS relation ORDER BY record_id LIMIT '+str(limit+1),{'id':focal},limit=limit+1)['rows']
    more=len(edges)>limit;edges=edges[:limit]
    identities=sorted({value for edge in edges for value in (edge['from_id'],edge['to_id'])}-{focal})
    rows=execute('MATCH (r:Record) WHERE r.record_id IN $ids AND r.kind <> \'edge\' RETURN '+projection(text="''"),{'ids':identities},limit=2*limit)['rows'] if identities else []
    return {'records':[hydrate(row) for row in focal_rows+rows],'edges':edges,'has_more':more,'limit':limit,'focal':focal,'catalog':metadata}
