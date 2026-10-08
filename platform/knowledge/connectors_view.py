"""Connector cards from one bounded operational-projection query and snapshot."""
from fastapi import APIRouter, HTTPException
from .reader import execute, hydrate

router = APIRouter()
LIMIT = 100
# Materialize configuration once. Subsequent CTEs touch only configured workflow
# IDs and their latest active run; the request owns one query deadline/session.
QUERY = """WITH initial AS MATERIALIZED (
    SELECT * EXCLUDE(text), '' AS text FROM (SELECT * FROM connector_configurations UNION ALL SELECT * FROM temporal_observations)
    WHERE kind IN ('temporal_connector','webhook_connector') OR record_id='temporal:observation'
    ORDER BY (record_id='temporal:observation') DESC, record_id LIMIT $config_limit
), configuration AS (
    SELECT * FROM initial WHERE kind IN ('temporal_connector','webhook_connector')
    ORDER BY record_id LIMIT $limit
), targets AS (
    SELECT unnest(json_extract_string(properties,'$.targets[*].workflow_id')) AS workflow_id FROM configuration
    UNION SELECT json_extract_string(properties,'$.workflow_id') AS workflow_id FROM configuration
), selected_targets AS (
    SELECT workflow_id FROM targets WHERE workflow_id IS NOT NULL ORDER BY workflow_id LIMIT $limit
), runs AS MATERIALIZED (
    SELECT * EXCLUDE(text), '' AS text FROM workflow_runs
    WHERE kind='temporal_run' AND json_extract_string(properties,'$.workflow_id') IN (SELECT workflow_id FROM selected_targets)
    QUALIFY row_number() OVER (PARTITION BY json_extract_string(properties,'$.workflow_id')
        ORDER BY json_extract_string(properties,'$.started_at') DESC, observed_at DESC, record_id DESC)=1
    LIMIT $limit
), activities AS (
    SELECT * EXCLUDE(text), '' AS text FROM workflow_activities
    WHERE kind='temporal_activity' AND json_extract_string(properties,'$.run_id') IN (
        SELECT json_extract_string(properties,'$.run_id') FROM runs WHERE json_extract_string(properties,'$.status')='RUNNING'
    ) AND json_extract_string(properties,'$.error') IS NOT NULL
    ORDER BY observed_at DESC, record_id LIMIT $activity_limit
)
SELECT * FROM initial UNION ALL SELECT * FROM runs UNION ALL SELECT * FROM activities"""

@router.get('/api/connectors')
def connectors():
    rows = [hydrate(row) for row in execute(QUERY, {'limit': LIMIT, 'config_limit': LIMIT + 2, 'activity_limit': LIMIT + 1})['rows']]
    observation = next((row for row in rows if row['record_id'] == 'temporal:observation'), None)
    if observation is None:
        raise HTTPException(409, 'GRAPH_REQUIREMENTS:Expected Connector → polling Workflow or signed Webhook, and Workflow → Run. Connector status has not reached the knowledge graph yet.')
    configs = sorted((row for row in rows if row['kind'] in ('temporal_connector','webhook_connector')), key=lambda row: row['record_id'])
    if not configs:
        raise HTTPException(409, 'GRAPH_REQUIREMENTS:Expected Connector → polling Workflow or signed Webhook. A status watermark is present, but no connector configuration has reached the graph.')
    truncated = len(configs) > LIMIT
    records = configs[:LIMIT]
    targets = []
    for record in records:
        properties = record['properties']
        if record['kind'] == 'webhook_connector':
            continue
        choices = properties.get('targets')
        choices = choices if isinstance(choices, list) else [properties.copy()]
        for target in choices:
            if isinstance(target, dict):
                targets.append((record, target))
        properties['targets'] = []
    # Match the SQL target ordering so every displayed target can have its run.
    targets.sort(key=lambda item: (str(item[1].get('workflow_id', '')), item[0]['record_id'], str(item[1].get('target', ''))))
    truncated |= len(targets) > LIMIT
    for record, target in targets[:LIMIT]:
        record['properties']['targets'].append(target)
    records.extend(row for row in rows if row['kind'] == 'temporal_run')
    activities = [row for row in rows if row['kind'] == 'temporal_activity']
    truncated |= len(activities) > LIMIT
    records.extend(activities[:LIMIT])
    return {'records': records, 'observed_at': observation['properties'].get('observed_at'), 'truncated': truncated}
