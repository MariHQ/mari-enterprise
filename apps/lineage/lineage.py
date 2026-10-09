"""Catalog-directed, bounded neighborhoods of a selected concrete node."""
import json
from fastapi import APIRouter, HTTPException, Query
from apps.base.db import execute, hydrate, graph_snapshot, engine
router=APIRouter()


def identifier(value):
    return '`'+value.replace('`','``')+'`'


def catalog_description():
    manifest=engine.manifest();schema=manifest['schema']
    tables={t['name']:{c['name']:c['data_type'] for c in t['columns']} for t in schema.get('tables',[])}
    def properties(item):
        types=tables.get(item.get('table'),{})
        return [{'name':name,'type':types.get(column,'string')} for name,column in item.get('properties',{}).items()]
    edges=[{'label':e['label'],'source':e['source_label'],'target':e['target_label'],'properties':properties(e)} for e in schema.get('edges',[])]
    edges.extend({'label':e['name'],'source':e['source'],'target':e['target'],'properties':[]} for e in schema.get('computed_relationships',[]))
    return {'revision':manifest.get('revision'),'nodes':[{'label':n['label'],'properties':properties(n)} for n in schema.get('nodes',[])],'edges':edges}


def node_projection(node,alias='r'):
    return ', '.join(alias+'.'+identifier(p['name'])+' AS '+identifier(p['name']) for p in node['properties'])


@router.get('/api/lineage/catalog')
def catalog():return catalog_description()


@router.get('/api/lineage')
@graph_snapshot
def lineage(focal: str | None = Query(None,min_length=1,max_length=2048),node_type: str | None = Query(None),relation: str | None = Query(None),limit: int = Query(30,ge=1,le=100)):
    metadata=catalog_description()
    nodes={n['label']:n for n in metadata['nodes']}
    if focal is None:
        # Primary navigation opens a real assertion and its provenance.
        for label in ('AgentDecision','AgentFact','MariDecision','MariFact','GithubPullRequest','SlackMessage','GithubFile','MariDocument'):
            if label not in nodes:continue
            recent=execute('MATCH (r:'+identifier(label)+') RETURN r.record_id AS record_id ORDER BY r.observed_at DESC,r.record_id LIMIT 1')['rows']
            if recent:
                focal=recent[0]['record_id'];node_type=label
                break
    result={'records':[],'edges':[],'has_more':False,'limit':limit,'focal':focal,'node_type':node_type,'catalog':metadata}
    if focal is None:return result
    if node_type not in nodes:raise HTTPException(422,'Select the focal node type from the catalog')
    rows=execute('MATCH (r:'+identifier(node_type)+') WHERE r.record_id=$id RETURN '+node_projection(nodes[node_type])+' LIMIT 1',{'id':focal})['rows']
    if not rows:raise HTTPException(404,'Selected lineage node not found')
    records={(node_type,focal):hydrate(rows[0])};edges=[]
    available=[e for e in metadata['edges'] if node_type in (e['source'],e['target'])]
    if relation is not None:
        available=[e for e in available if e['label']==relation]
        if not available:raise HTTPException(422,'Relationship does not connect this node type')
    branches=[]
    neighbor_types={e['target'] if e['source']==node_type else e['source'] for e in available}
    # A self-type edge can be read in either direction. Every branch names both endpoints.
    fields=list(dict.fromkeys(p['name'] for label in sorted(neighbor_types) for p in nodes[label]['properties']))
    for edge in available:
        directions=[]
        if edge['source']==node_type:directions.append(('out',edge['target']))
        if edge['target']==node_type:directions.append(('in',edge['source']))
        for direction,neighbor_type in directions:
            native={p['name'] for p in nodes[neighbor_type]['properties']}
            projected=', '.join(('n.'+identifier(field) if field in native else 'null')+' AS '+identifier(field) for field in fields)
            arrow='-[e:'+identifier(edge['label'])+']->' if direction=='out' else '<-[e:'+identifier(edge['label'])+']-'
            index=len(branches)
            query='MATCH (f:'+identifier(node_type)+')'+arrow+'(n:'+identifier(neighbor_type)+') WHERE f.record_id=$id RETURN DISTINCT '+projected+', '+str(index)+' AS branch ORDER BY record_id LIMIT '+str(limit+1)
            branches.append((query,direction,neighbor_type,edge['label']))
    if branches:
        # Neighbor properties can share names but have different native types.
        neighbors=[row for branch in branches for row in execute(branch[0],{'id':focal},limit=limit+1)['rows']]
        seen=set()
        for row in neighbors:
            _,direction,neighbor_type,relation_label=branches[row.pop('branch')]
            neighbor=row['record_id']
            source,target=((node_type,focal),(neighbor_type,neighbor)) if direction=='out' else ((neighbor_type,neighbor),(node_type,focal))
            edge_id=json.dumps([source,relation_label,target],separators=(',',':'))
            if edge_id in seen:continue
            seen.add(edge_id)
            if len(edges)==limit:result['has_more']=True;break
            native={p['name'] for p in nodes[neighbor_type]['properties']}
            records[(neighbor_type,neighbor)]=hydrate({k:v for k,v in row.items() if k in native})
            edges.append({'record_id':edge_id,'from_id':source[1],'from_type':source[0],'to_id':target[1],'to_type':target[0],'relation':relation_label,'observed_at':row.get('observed_at',0)})
    if 'MariPresentation' in nodes:
        position_ids={json.dumps([label,record_id,row['table']],separators=(',',':')):row for (label,record_id),row in records.items()}
        positions=execute('MATCH (p:MariPresentation) WHERE p.document_id IN $ids RETURN p.document_id AS document_id,p.x AS x,p.y AS y LIMIT '+str(len(position_ids)),{'ids':list(position_ids)},limit=len(position_ids))['rows']
        for position in positions:
            if position['x'] is not None and position['y'] is not None:
                position_ids[position['document_id']]['properties'].update(x=position['x'],y=position['y'])
    result.update(records=list(records.values()),edges=edges)
    return result
