from fastapi import APIRouter, Query
from apps.sdk.data.reader import execute, hydrate, graph_snapshot
from apps.sdk.graph import projection, page_limit
router=APIRouter()

@router.get('/api/trajectories')
def trajectories(cursor: str | None = None, limit: int = Query(25,ge=1,le=100),
                 status: str | None = None, actor: str | None = None):
    import base64
    import json
    from fastapi import HTTPException
    parameters={'limit':limit+1,'status':status,'actor':actor}
    predicate="($status IS NULL OR r.status=$status) AND ($actor IS NULL OR r.actor=$actor)"
    if cursor:
        try:
            position=json.loads(base64.urlsafe_b64decode(cursor+'='*(-len(cursor)%4)))
            if position['status']!=status or position['actor']!=actor:raise ValueError()
            if not isinstance(position['at'],int) or not isinstance(position['id'],str):raise ValueError()
        except (ValueError,TypeError,KeyError):raise HTTPException(400,'Invalid trajectory cursor') from None
        predicate+=' AND (r.observed_at<$at OR (r.observed_at=$at AND r.record_id>$id))'
        parameters.update(at=position['at'],id=position['id'])
    rows=execute('MATCH (r:Trajectory) WHERE '+predicate+' RETURN '+projection()+' ORDER BY r.observed_at DESC,r.record_id LIMIT '+page_limit(limit+1),parameters,limit=limit+1)['rows']
    more=len(rows)>limit;rows=rows[:limit]
    next_cursor=None
    if more:
        next_cursor=base64.urlsafe_b64encode(json.dumps({'at':rows[-1]['observed_at'],'id':rows[-1]['record_id'],
            'status':status,'actor':actor}).encode()).decode().rstrip('=')
    return {'records':[hydrate(row) for row in rows],'next_cursor':next_cursor,'has_more':more}


@router.get('/api/trajectory')
@graph_snapshot
def trajectory(id: str = Query(min_length=1,max_length=512)):
    from fastapi import HTTPException
    rows=execute('MATCH (r:Trajectory) WHERE r.record_id=$id RETURN '+projection()+' LIMIT 1',{'id':id})['rows']
    if not rows:raise HTTPException(404,'Trajectory not found')
    run=hydrate(rows[0]);step_ids=run['properties'].get('step_ids',[])
    steps=execute('MATCH (r:Step) WHERE r.record_id IN $ids RETURN '+projection()+' ORDER BY r.ordinal,r.record_id LIMIT 101',{'ids':step_ids},limit=101)['rows'] if step_ids else []
    return {'record':run,'steps':[hydrate(row) for row in steps[:100]],'steps_truncated':len(steps)>100}
