"""App-owned queries against the two concrete decision tables."""
import base64
import json
from fastapi import APIRouter, HTTPException, Query
from apps.base.db import execute, hydrate, graph_snapshot
from apps.base.catalog.graph import projection, page_limit
from apps.base.catalog.nodes import label_for_table, topic_for_label, fields_for

router = APIRouter()
LABELS = ('MariDecision', 'AgentDecision')

@router.get('/api/records')
@graph_snapshot
def records(limit: int = Query(40, ge=1, le=1000), cursor: str | None = Query(None, max_length=8000)):
    position = None
    if cursor:
        try:
            position = json.loads(base64.urlsafe_b64decode(cursor + '=' * (-len(cursor) % 4)))
            if position['kind'] != 'decision' or type(position['observed_at']) is not int or not isinstance(position['id'], str) or position['node_type'] not in LABELS:
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            raise HTTPException(400, 'Invalid decision cursor') from None
    branches = []
    fields = ['record_id', 'kind', 'source', 'text', 'observed_at', 'context', 'status', 'source_label', 'owner_ids', 'decided_at', 'affected_record_ids']
    for label in LABELS:
        params = {}
        where = ''
        if position:
            params = {'at': position['observed_at'], 'id': position['id']}
            comparison = '>=' if label > position['node_type'] else '>'
            where = ' WHERE r.observed_at < $at OR (r.observed_at = $at AND r.record_id ' + comparison + ' $id)'
        columns = ', '.join('r.' + field + ' AS ' + field for field in fields if field in fields_for(label))
        branches.append('MATCH (r:' + label + ')' + where + ' RETURN ' + columns + ", '" + label + "' AS node_type" + ' ORDER BY r.observed_at DESC, r.record_id LIMIT ' + page_limit(limit + 1))
    rows = execute(' UNION ALL '.join(branches), params, limit=(limit + 1) * len(LABELS))['rows']
    rows.sort(key=lambda row: (-row['observed_at'], row['record_id'], row['node_type']))
    more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = None
    if more:
        last = rows[-1]
        next_cursor = base64.urlsafe_b64encode(json.dumps({'kind': 'decision', 'observed_at': last['observed_at'], 'id': last['record_id'], 'node_type': last['node_type']}).encode()).decode().rstrip('=')
    return {'records': [hydrate(row) for row in rows], 'has_more': more, 'next_cursor': next_cursor}

@router.get('/api/records/{record_id:path}')
def record(record_id: str, table: str):
    try:
        label = label_for_table(table)
        if label not in LABELS: raise ValueError()
    except ValueError:
        raise HTTPException(422, 'Invalid decision table') from None
    rows = execute('MATCH (r:' + label + ') WHERE r.record_id=$id RETURN ' + projection(label) + ' LIMIT 1', {'id': record_id}, table=table)['rows']
    if not rows: raise HTTPException(404, 'Record not found')
    return hydrate(rows[0])

@router.get('/api/record')
def current(id: str, table: str):
    return record(id, table)
