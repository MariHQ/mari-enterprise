from fastapi import APIRouter, HTTPException
from apps.sdk.data.reader import execute, hydrate, graph_snapshot
from apps.sdk.graph import projection, LATEST_RUN
router=APIRouter()

@router.get('/api/operations')
@graph_snapshot
def operations():
    observation=execute("MATCH (r:Observation) WHERE r.record_id='temporal:observation' RETURN "+projection(text="''")+" LIMIT 1")['rows']
    if not observation:
        raise HTTPException(409,'GRAPH_REQUIREMENTS:Temporal status has not reached the knowledge graph yet.')
    schedules=[hydrate(row) for row in execute('MATCH (r:Schedule) RETURN '+projection(text="''")+' ORDER BY r.record_id LIMIT 101',limit=101)['rows']]
    workflow_ids=[]
    for schedule in schedules[:100]:
        recent=schedule['properties'].get('recent_runs') or []
        if recent and recent[-1].get('workflow_id'):workflow_ids.append(recent[-1]['workflow_id'])
    scheduled=execute('MATCH (r:Run) WHERE r.workflow_id IN $ids AND '+LATEST_RUN+' RETURN '+projection(text="''")+' LIMIT 100',{'ids':workflow_ids},limit=100)['rows'] if workflow_ids else []
    recent=execute('MATCH (r:Run) WHERE '+LATEST_RUN+' RETURN '+projection(text="''")+' ORDER BY r.started_at DESC,r.record_id LIMIT 101',limit=101)['rows']
    records={row['record_id']:row for row in schedules[:100]}
    for row in scheduled+recent[:100]+observation:records[row['record_id']]=hydrate(row)
    return {'records':list(records.values()),'observed_at':hydrate(observation[0])['properties'].get('observed_at'),'truncated':len(schedules)>100 or len(recent)>100}
