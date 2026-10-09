"""Scheduled task status reads only Temporal's typed operational tables."""
from fastapi import APIRouter
from apps.base.db import execute, hydrate, graph_snapshot
from apps.base.catalog.graph import projection

router = APIRouter()

@router.get('/api/operations')
@graph_snapshot
def operations():
    observation = execute("MATCH (r:TemporalObservation) WHERE r.record_id='temporal:observation' RETURN "+projection('TemporalObservation', text="''")+" LIMIT 1")['rows']
    schedules = [hydrate(row) for row in execute('MATCH (r:TemporalSchedule) RETURN '+projection('TemporalSchedule', text="''")+' ORDER BY r.record_id LIMIT 101', limit=101)['rows']]
    workflow_ids = set()
    for schedule in schedules[:100]:
        recent = schedule['properties'].get('recent_runs') or []
        if recent and recent[-1].get('workflow_id'): workflow_ids.add(recent[-1]['workflow_id'])
    latest_query = ('MATCH (r:TemporalRun) WHERE r.workflow_id IN $ids '
        'WITH r.workflow_id AS wid,max(r.started_at) AS latest '
        'MATCH (r:TemporalRun) WHERE r.workflow_id=wid AND r.started_at=latest '
        'WITH wid,max(r.record_id) AS latest_id '
        'MATCH (r:TemporalRun) WHERE r.workflow_id=wid AND r.record_id=latest_id '
        'RETURN '+projection('TemporalRun', text="''")+' LIMIT 100')
    scheduled = execute(latest_query, {'ids': sorted(workflow_ids)}, limit=100)['rows'] if workflow_ids else []
    recent = execute('MATCH (r:TemporalRun) RETURN '+projection('TemporalRun', text="''")+' ORDER BY r.started_at DESC,r.record_id DESC LIMIT 101', limit=101)['rows']
    records = {row['record_id']: row for row in schedules[:100]}
    for row in scheduled+recent[:100]: records[row['record_id']] = hydrate(row)
    return {'records': list(records.values()), 'observed_at': observation[0].get('projection_observed_at', '') if observation else '',
            'truncated': len(schedules)>100 or len(recent)>100}
