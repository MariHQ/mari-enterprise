"""Connector cards read Temporal connector, run, and activity tables."""
from fastapi import APIRouter
from apps.base.db import execute, hydrate

router = APIRouter()
LIMIT = 100
from apps.base.catalog.graph import projection

from apps.base.db import graph_snapshot

@router.get('/api/connectors')
@graph_snapshot
def connectors():
    rows=[hydrate(row) for row in execute("MATCH (r:TemporalConnector) RETURN "+projection('TemporalConnector', text="''")+" ORDER BY r.record_id LIMIT 101",limit=101)['rows']]
    rows += [hydrate(row) for row in execute("MATCH (r:TemporalObservation) WHERE r.record_id='temporal:observation' RETURN "+projection('TemporalObservation', text="''")+" LIMIT 1")['rows']]
    observation = next((row for row in rows if row['record_id'] == 'temporal:observation'), None)
    configs = sorted((row for row in rows if row['kind'] == 'temporal_connector'), key=lambda row: row['record_id'])
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
    latest_query = ('MATCH (r:TemporalRun) WHERE r.workflow_id IN $ids '
        'WITH r.workflow_id AS wid,max(r.started_at) AS latest '
        'MATCH (r:TemporalRun) WHERE r.workflow_id=wid AND r.started_at=latest '
        'WITH wid,max(r.record_id) AS latest_id '
        'MATCH (r:TemporalRun) WHERE r.workflow_id=wid AND r.record_id=latest_id '
        'RETURN '+projection('TemporalRun', text="''")+' LIMIT 100')
    runs = [hydrate(row) for row in execute(latest_query, {'ids': workflow_ids}, limit=100)['rows']] if workflow_ids else []
    records.extend(runs)
    run_ids=[r['properties'].get('run_id') for r in runs if r['properties'].get('status')=='RUNNING']
    activities=[hydrate(row) for row in execute('MATCH (r:TemporalActivity) WHERE r.run_id IN $ids AND r.error IS NOT NULL RETURN '+projection('TemporalActivity', text="''")+' ORDER BY r.observed_at DESC,r.record_id LIMIT 101',{'ids':run_ids},limit=101)['rows']] if run_ids else []
    truncated |= len(activities) > LIMIT
    records.extend(activities[:LIMIT])
    return {'records': records, 'observed_at': observation['properties'].get('projection_observed_at', '') if observation else '', 'truncated': truncated}
