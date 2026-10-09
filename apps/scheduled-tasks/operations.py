from fastapi import APIRouter, Query
from apps.sdk.data.reader import execute, hydrate
router=APIRouter()

import json
from fastapi import HTTPException
@router.get('/api/operations')
def operations():
    # Keep schedule definitions and their referenced runs even when the unrelated
    # run history grows. One query/snapshot; no edges or document bodies needed.
    rows=execute("""WITH schedules AS MATERIALIZED (
        SELECT * EXCLUDE(text), '' AS text FROM temporal_schedules
        WHERE kind='temporal_schedule' ORDER BY record_id LIMIT 101
    ), schedule_ids AS (
        SELECT json_extract_string(properties,'$.recent_runs[#-1].workflow_id') AS workflow_id
        FROM schedules ORDER BY record_id LIMIT 100
    ), schedule_runs AS (
        SELECT * EXCLUDE(text), '' AS text FROM workflow_runs WHERE kind='temporal_run'
        AND json_extract_string(properties,'$.workflow_id') IN (SELECT workflow_id FROM schedule_ids)
        QUALIFY row_number() OVER (PARTITION BY json_extract_string(properties,'$.workflow_id')
            ORDER BY json_extract_string(properties,'$.started_at') DESC, observed_at DESC, record_id DESC)=1
        LIMIT 100
    ), recent_runs AS (
        SELECT * EXCLUDE(text), '' AS text FROM workflow_runs WHERE kind='temporal_run'
        QUALIFY row_number() OVER (PARTITION BY json_extract_string(properties,'$.workflow_id')
            ORDER BY json_extract_string(properties,'$.started_at') DESC, observed_at DESC, record_id DESC)=1
        ORDER BY json_extract_string(properties,'$.started_at') DESC, record_id LIMIT 101
    ), observation AS (
        SELECT * EXCLUDE(text), '' AS text FROM temporal_observations
        WHERE record_id='temporal:observation' LIMIT 1
    ) SELECT *, 'schedule' AS __section FROM schedules
      UNION ALL SELECT *, 'scheduled_run' FROM schedule_runs
      UNION ALL SELECT *, 'recent_run' FROM recent_runs
      UNION ALL SELECT *, 'observation' FROM observation""")['rows']
    watermark=next((r for r in rows if r['kind']=='temporal_observation'),None)
    if watermark is None:
        raise HTTPException(409, 'GRAPH_REQUIREMENTS:Expected Schedule → Workflow and Run → Workflow mappings. Temporal status has not reached the knowledge graph yet.')
    counts={}; records={}; truncated=False
    for row in rows:
        section=row.pop('__section', row['kind'])
        counts[section]=counts.get(section,0)+1
        if section in ('schedule','recent_run') and counts[section]>100:
            truncated=True
            continue
        records[row['record_id']]=hydrate(row)
    return {'records':list(records.values()), 'observed_at':json.loads(watermark['properties']).get('observed_at'),
            'truncated':truncated}
