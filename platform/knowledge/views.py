"""Bounded page projections over the existing OrchidDB records mapping."""
from fastapi import APIRouter, Query
from .reader import execute, hydrate

router = APIRouter()

@router.get('/api/overview')
def overview():
    # Operational observations are not user documents or knowledge changes.
    predicate = "kind NOT IN ('edge','workflow','mining_receipt') AND source <> 'temporal'"
    recent = execute("SELECT * EXCLUDE(text), substring(text,1,400) AS text FROM records WHERE " + predicate + " ORDER BY observed_at DESC, record_id LIMIT 12")['rows']
    return {'recent': [hydrate(row) for row in recent]}


@router.get('/api/trajectories')
def trajectories(cursor: str | None = None, limit: int = Query(25,ge=1,le=100),
                 status: str | None = None, actor: str | None = None):
    import base64
    import json
    from fastapi import HTTPException
    parameters={'limit':limit+1,'status':status,'actor':actor}
    predicate="($status IS NULL OR json_extract_string(properties,'$.status')=$status) AND ($actor IS NULL OR actor=$actor)"
    if cursor:
        try:
            position=json.loads(base64.urlsafe_b64decode(cursor+'='*(-len(cursor)%4)))
            if position['status']!=status or position['actor']!=actor:raise ValueError()
            if not isinstance(position['at'],int) or not isinstance(position['id'],str):raise ValueError()
        except (ValueError,TypeError,KeyError):raise HTTPException(400,'Invalid trajectory cursor') from None
        predicate+=' AND (observed_at<$at OR (observed_at=$at AND record_id>$id))'
        parameters.update(at=position['at'],id=position['id'])
    rows=execute('SELECT * FROM agent_trajectories WHERE '+predicate+' ORDER BY observed_at DESC,record_id LIMIT $limit',parameters,limit=limit+1)['rows']
    more=len(rows)>limit;rows=rows[:limit]
    next_cursor=None
    if more:
        next_cursor=base64.urlsafe_b64encode(json.dumps({'at':rows[-1]['observed_at'],'id':rows[-1]['record_id'],
            'status':status,'actor':actor}).encode()).decode().rstrip('=')
    return {'records':[hydrate(row) for row in rows],'next_cursor':next_cursor,'has_more':more}


@router.get('/api/trajectory')
def trajectory(id: str = Query(min_length=1,max_length=512)):
    from fastapi import HTTPException
    rows=execute('SELECT * FROM agent_trajectories WHERE record_id=$id LIMIT 1',{'id':id})['rows']
    if not rows:raise HTTPException(404,'Trajectory not found')
    run=hydrate(rows[0]);step_ids=run['properties'].get('step_ids',[])
    steps=execute('SELECT * FROM agent_steps WHERE list_contains($ids,record_id) ORDER BY CAST(json_extract_string(properties,\'$.ordinal\') AS INTEGER),record_id LIMIT 101',{'ids':step_ids},limit=101)['rows'] if step_ids else []
    return {'record':run,'steps':[hydrate(row) for row in steps[:100]],'steps_truncated':len(steps)>100}
