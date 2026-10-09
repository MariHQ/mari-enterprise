"""Workflow reads use each execution source's trajectory and step tables."""
import base64
import json
from fastapi import APIRouter, HTTPException, Query
from apps.base.db import execute, hydrate, graph_snapshot
from apps.base.catalog.graph import projection, page_limit

router = APIRouter()
EXECUTIONS = {'AxTrajectory': 'AxStep', 'AgentTrajectory': 'AgentStep', 'SubstrateTrajectory': 'SubstrateStep'}

@router.get('/api/trajectories')
@graph_snapshot
def trajectories(cursor: str | None = None, limit: int = Query(25, ge=1, le=100),
                 status: str | None = None, actor: str | None = None):
    parameters = {'status': status, 'actor': actor}
    predicate = "($status IS NULL OR r.status=$status) AND ($actor IS NULL OR r.actor_id=$actor)"
    position = None
    if cursor:
        try:
            position = json.loads(base64.urlsafe_b64decode(cursor+'='*(-len(cursor)%4)))
            if position['status'] != status or position['actor'] != actor: raise ValueError()
            if type(position['at']) is not int or not isinstance(position['id'], str) or position['type'] not in EXECUTIONS: raise ValueError()
        except (ValueError, TypeError, KeyError):
            raise HTTPException(400, 'Invalid trajectory cursor') from None
        parameters.update(at=position['at'], id=position['id'])
    branches = []
    for label in EXECUTIONS:
        where = predicate
        if position:
            comparison = '>=' if label > position['type'] else '>'
            where += f' AND (r.observed_at<$at OR (r.observed_at=$at AND r.record_id{comparison}$id))'
        branches.append(f'MATCH (r:{label}) WHERE '+where+' RETURN '+projection(label)+
                        ' ORDER BY r.observed_at DESC,r.record_id LIMIT '+page_limit(limit+1))
    result = execute(' UNION ALL '.join(branches), parameters, limit=(limit+1)*len(EXECUTIONS))
    rows = [hydrate(row) for row in result['rows']]
    rows.sort(key=lambda row: (-row['observed_at'], row['record_id'], row['node_type']))
    more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = None
    if more:
        last = rows[-1]
        next_cursor = base64.urlsafe_b64encode(json.dumps({'at': last['observed_at'], 'id': last['record_id'],
            'type': last['node_type'], 'status': status, 'actor': actor}).encode()).decode().rstrip('=')
    return {'records': rows, 'next_cursor': next_cursor, 'has_more': more}

@router.get('/api/trajectory')
@graph_snapshot
def trajectory(id: str = Query(min_length=1, max_length=512), node_type: str = Query()):
    if node_type not in EXECUTIONS: raise HTTPException(400, 'Unknown trajectory node type')
    rows = execute(f'MATCH (r:{node_type}) WHERE r.record_id=$id RETURN '+projection(node_type)+' LIMIT 1', {'id': id})['rows']
    if not rows: raise HTTPException(404, 'Trajectory not found')
    run = hydrate(rows[0])
    step_ids = run['properties'].get('step_ids') or []
    step_type = EXECUTIONS[node_type]
    steps = execute(f'MATCH (r:{step_type}) WHERE r.record_id IN $ids RETURN '+projection(step_type)+
                    ' ORDER BY r.ordinal,r.record_id LIMIT 101', {'ids': step_ids}, limit=101)['rows'] if step_ids else []
    return {'record': run, 'steps': [hydrate(row) for row in steps[:100]], 'steps_truncated': len(steps)>100}
