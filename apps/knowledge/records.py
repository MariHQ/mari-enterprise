"""Knowledge content queries against explicit source topic nodes."""
import base64
import hashlib
import json
import time
from typing import Literal
from fastapi import APIRouter, HTTPException, Query
from apps.base.db import execute, hydrate, graph_snapshot
from apps.base.catalog.graph import projection, page_limit
from apps.base.catalog.nodes import fields_for, label_for_table, topic_for_label

router = APIRouter()
# Source and content filters choose tables before executing any query.
CONTENT = {
    'MariDocument': ('mari', 'document', 'Documents'),
    'SlackMessage': ('slack', 'message', 'Conversations'),
    'SlackThread': ('slack', 'thread', 'Conversations'),
    'GithubDocument': ('github', 'document', 'Documents'),
    'GithubFile': ('github', 'file', 'Documents'),
    'GithubIssue': ('github', 'issue', 'Issues'),
    'GithubPullRequest': ('github', 'pull_request', 'Pull requests'),
    'GithubComment': ('github', 'comment', 'Conversations'),
}

@router.get('/api/records')
@graph_snapshot
def records(q: str = Query('', max_length=500), limit: int = Query(100, ge=1, le=1000), cursor: str | None = Query(None, max_length=8000),
            kind: str | None = None, summary: bool = False, source: list[str] = Query([]), owner: list[str] = Query([]),
            status: list[str] = Query([]), content_type: list[str] = Query([]), days: int | None = Query(None, ge=1, le=36500),
            sort: Literal['newest', 'title'] = 'newest'):
    if q.strip() not in ('', '*'):
        raise HTTPException(409, 'Content search is not configured for these source tables')
    signature = hashlib.sha256(json.dumps([kind, source, owner, status, content_type, days, sort], sort_keys=True).encode()).hexdigest()
    since = int(time.time()) - days * 86400 if days else None
    position = None
    if cursor:
        try:
            position = json.loads(base64.urlsafe_b64decode(cursor + '=' * (-len(cursor) % 4)))
            if position['signature'] != signature or position['node_type'] not in CONTENT or not isinstance(position['id'], str) or not isinstance(position['value'], str if sort == 'title' else int): raise ValueError()
            since = position['since']
        except (ValueError, TypeError, KeyError):
            raise HTTPException(400, 'Invalid cursor for these filters') from None
    branches = []
    params = {}
    for label, (provider, record_kind, category) in CONTENT.items():
        if kind and kind != record_kind: continue
        if source and provider not in {s.lower() for s in source}: continue
        if content_type and category not in content_type: continue
        fields = fields_for(label)
        clauses = []
        if owner: clauses.append('r.actor IN $owners'); params['owners'] = owner
        if status:
            column = 'status' if 'status' in fields else 'state' if 'state' in fields else None
            if column is None: continue
            clauses.append('r.' + column + ' IN $statuses'); params['statuses'] = status
        if since is not None: clauses.append('r.observed_at >= $since'); params['since'] = since
        key = "coalesce(toLower(r.title),'')" if sort == 'title' else 'r.observed_at'
        if position:
            comparison = '>=' if label > position['node_type'] else '>'
            clauses.append('(' + key + (' > ' if sort == 'title' else ' < ') + '$position OR (' + key + '=$position AND r.record_id ' + comparison + ' $identity))')
            params.update(position=position['value'], identity=position['id'])
        where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
        # Listing uses only the fields consumed by the original knowledge screen.
        columns = ['record_id', 'event_id', 'kind', 'source', 'title', 'actor', 'observed_at']

        projection_text = ', '.join('r.' + name + ' AS ' + name for name in columns)
        projection_text += ', ' + ('substring(r.text,0,400)' if summary else 'r.text') + ' AS text'
        projection_text += ', ' + ('r.status' if 'status' in fields else 'r.state' if 'state' in fields else 'null') + ' AS status'
        projection_text += ', ' + ('r.tags' if 'tags' in fields else 'null') + ' AS tags'
        projection_text += ", '" + label + "' AS node_type"
        branches.append('MATCH (r:' + label + ')' + where + ' RETURN ' + projection_text + ' ORDER BY ' + key + (' ASC' if sort == 'title' else ' DESC') + ', r.record_id LIMIT ' + page_limit(limit + 1))
    # Keep heterogeneous source properties typed; merge only bounded pages.
    rows = [row for query in branches for row in execute(query, params, limit=limit + 1)['rows']]
    rows.sort(key=lambda row: ((row.get('title') or '').lower() if sort == 'title' else -row['observed_at'], row['record_id'], row['node_type']))
    more = len(rows) > limit; rows = rows[:limit]
    next_cursor = None
    if more:
        last = rows[-1]
        next_cursor = base64.urlsafe_b64encode(json.dumps({'signature': signature, 'value': (last.get('title') or '').lower() if sort == 'title' else last['observed_at'], 'id': last['record_id'], 'node_type': last['node_type'], 'since': since}).encode()).decode().rstrip('=')
    return {'records': [hydrate(row) for row in rows], 'has_more': more, 'next_cursor': next_cursor}

@router.get('/api/records/{record_id:path}')
def record(record_id: str, table: str):
    try: label = label_for_table(table)
    except ValueError: raise HTTPException(422, 'Unknown content table') from None
    rows = execute('MATCH (r:' + label + ') WHERE r.record_id=$id RETURN ' + projection(label) + ' LIMIT 1', {'id': record_id}, table=table)['rows']
    if not rows: raise HTTPException(404, 'Record not found')
    return hydrate(rows[0])

@router.get('/api/record')
def current(id: str, table: str): return record(id, table)

@router.get('/api/history')
def history(id: str, table: str):
    from apps.base.catalog.history import source_history
    return source_history(id,table)
