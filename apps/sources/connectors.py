"""Connector cards from one bounded operational-projection query and snapshot."""
from fastapi import APIRouter, HTTPException
from apps.sdk.data.reader import execute, hydrate

router = APIRouter()
LIMIT = 100
from apps.sdk.graph import projection, LATEST_RUN
from apps.sdk.data.reader import graph_snapshot

@router.get('/api/connectors')
@graph_snapshot
def connectors():
    rows=[hydrate(row) for row in execute("MATCH (r:Record) WHERE r.kind='temporal_connector' OR r.record_id='temporal:observation' RETURN "+projection(text="''")+" ORDER BY (r.record_id='temporal:observation') DESC,r.record_id LIMIT 102",limit=102)['rows']]
    observation = next((row for row in rows if row['record_id'] == 'temporal:observation'), None)
    if observation is None:
        raise HTTPException(409, 'GRAPH_REQUIREMENTS:Expected Connector → polling Workflow, and Workflow → Run. Connector status has not reached the knowledge graph yet.')
    configs = sorted((row for row in rows if row['kind'] in ('temporal_connector',)), key=lambda row: row['record_id'])
    if not configs:
        raise HTTPException(409, 'GRAPH_REQUIREMENTS:Expected Connector → polling Workflow. A status watermark is present, but no connector configuration has reached the graph.')
    truncated = len(configs) > LIMIT
    records = configs[:LIMIT]
    targets = []
    for record in records:
        properties = record['properties']
        choices = properties.get('targets')
        choices = choices if isinstance(choices, list) else [properties.copy()]
        for target in choices:
            if isinstance(target, dict):
                targets.append((record, target))
        properties['targets'] = []
    # Bound target expansion before reading the latest run for each workflow.
    targets.sort(key=lambda item: (str(item[1].get('workflow_id', '')), item[0]['record_id'], str(item[1].get('target', ''))))
    truncated |= len(targets) > LIMIT
    for record, target in targets[:LIMIT]:
        record['properties']['targets'].append(target)
    workflow_ids=sorted({str(target.get('workflow_id')) for _,target in targets[:LIMIT] if target.get('workflow_id')})
    runs=[hydrate(row) for row in execute('MATCH (r:Run) WHERE r.workflow_id IN $ids AND '+LATEST_RUN+' RETURN '+projection(text="''")+' LIMIT 100',{'ids':workflow_ids},limit=100)['rows']] if workflow_ids else []
    records.extend(runs)
    run_ids=[r['properties'].get('run_id') for r in runs if r['properties'].get('status')=='RUNNING']
    activities=[hydrate(row) for row in execute('MATCH (r:Activity) WHERE r.run_id IN $ids AND r.error IS NOT NULL RETURN '+projection(text="''")+' ORDER BY r.observed_at DESC,r.record_id LIMIT 101',{'ids':run_ids},limit=101)['rows']] if run_ids else []
    truncated |= len(activities) > LIMIT
    records.extend(activities[:LIMIT])
    return {'records': records, 'observed_at': observation['properties'].get('observed_at'), 'truncated': truncated}
