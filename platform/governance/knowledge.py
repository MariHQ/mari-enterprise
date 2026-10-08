"""Mari's read boundary: authenticated HTTP only, never a local database fallback."""
import os
from urllib.parse import quote

import httpx
from fastapi import HTTPException, Request, Response

GET_PATHS = {'records', 'search', 'overview', 'operations', 'connectors', 'lineage', 'telemetry/search', 'trajectories', 'trajectory'}
POST_PATHS = {'query', 'retrieve'}


def connection():
    url = os.environ.get('KNOWLEDGE_API_URL', '').rstrip('/')
    token = os.environ.get('MARI_SERVICE_TOKEN', '')
    if not url or not token:
        raise HTTPException(503, 'Knowledge API connection is not configured')
    return url, {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}


def send(method, path, **kwargs):
    url, headers = connection()
    try:
        return httpx.request(method, url + '/api/' + path, headers=headers, timeout=40, **kwargs)
    except httpx.RequestError:
        raise HTTPException(503, 'Knowledge API unavailable; no local fallback was used') from None


def payload(response):
    try:
        data = response.json()
    except ValueError:
        raise HTTPException(502, 'Knowledge API returned an invalid response') from None
    if response.is_error:
        raise HTTPException(response.status_code, data.get('detail', 'Knowledge query failed'))
    return data


def execute(query, parameters=None, language='sql', limit=1000, table=None):
    return payload(send('POST', 'query', json={
        'query': query, 'parameters': parameters or {}, 'language': language,
        'limit': limit, 'table': table,
    }))


def record(identity):
    return payload(send('GET', 'records/' + quote(identity, safe='')))


async def forward(path: str, request: Request):
    allowed = path in GET_PATHS or path.startswith('records/')
    if (request.method == 'GET' and not allowed) or (request.method == 'POST' and path not in POST_PATHS):
        raise HTTPException(404, 'Unknown Knowledge API read route')
    # Preserve upstream validation and query errors without hiding them as empty data.
    from starlette.concurrency import run_in_threadpool
    body = await request.body()
    response = await run_in_threadpool(send, request.method, path,
                                      params=list(request.query_params.multi_items()),
                                      content=body)
    return Response(response.content, status_code=response.status_code,
                    media_type='application/json')
