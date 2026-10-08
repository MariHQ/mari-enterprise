"""Sources web backend. Read-only, independently deployable on Knative."""
import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

import httpx
import yaml
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse

app = FastAPI(title='Mari Sources')
MANIFEST = Path(os.getenv('MARI_APP_MANIFEST', str(Path(__file__).parent.parent / 'mari.yaml')))
TOPICS = tuple(yaml.safe_load(MANIFEST.read_text())['reads']['topics'])
QUERY = '''MATCH (r:Record)
WHERE r.source = $source AND r.kind = $kind AND r.record_id > $after
RETURN r.record_id AS id, r.properties AS properties, r.observed_at AS observed_at
ORDER BY r.record_id LIMIT 101'''


def authenticated(authorization: str = Header(default='')):
    try:
        token = authorization.removeprefix('Bearer ')
        body, sig = token.split('.')
        secret = os.environ['MARI_APP_GRANT_SECRET']
        if len(secret) < 32:
            raise ValueError()
        expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError()
        claims = json.loads(base64.urlsafe_b64decode(body + '=' * (-len(body) % 4)))
        now = time.time()
        if claims['aud'] != 'sources' or claims['project'] != os.getenv('MARI_KNOWLEDGE_PROJECT_ID', '1') or not claims['sub'] or not now < claims['exp'] <= now + 300:
            raise ValueError()
        return claims
    except (KeyError, ValueError, TypeError):
        raise HTTPException(401, 'Open Sources from Mari to sign in') from None


@app.get('/healthz')
def health():
    return {'app': 'sources', 'read_only': True}


@app.get('/api/status', dependencies=[Depends(authenticated)])
async def status():
    url = os.environ.get('KNOWLEDGE_API_URL', '').rstrip('/')
    token = os.environ.get('MARI_SERVICE_TOKEN', '')
    if not url or not token:
        raise HTTPException(503, 'Knowledge API binding is missing')
    async with httpx.AsyncClient(timeout=35, headers={'Authorization': 'Bearer ' + token}) as client:
        async def read(topic):
            response = await client.post(url + '/api/query', json={
                'language': 'cypher', 'table': topic, 'query': QUERY,
                'parameters': {'after': '', 'source': 'temporal', 'kind': topic.rsplit('.', 1)[1]}, 'limit': 101,
            })
            if response.is_error:
                if response.status_code == 400:
                    raise HTTPException(502, 'Source configuration query was rejected by the Knowledge API')
                raise HTTPException(503, 'Knowledge API could not read source configuration')
            return response.json()['rows']
        try:
            pages = await asyncio.gather(*(read(topic) for topic in TOPICS))
        except httpx.RequestError:
            raise HTTPException(503, 'Knowledge API unavailable') from None
    sources, warnings = [], []
    for topic, rows in zip(TOPICS, pages):
        if len(rows) > 100:
            warnings.append('Only the first 100 source configurations are shown for ' + topic)
        for row in rows[:100]:
            properties = row['properties']
            p = json.loads(properties) if isinstance(properties, str) else properties
            provider = p.get('provider')
            if provider not in ('github', 'slack'):
                continue
            name = 'GitHub' if provider == 'github' else 'Slack'
            common = {'provider': provider, 'observedAt': row['observed_at'], 'mode': p.get('mode', 'polling')}
            if p.get('mode') == 'webhook':
                sources.append({**common, 'id': row['id'], 'name': name + ' · Signed webhook', 'endpoint': p.get('endpoint')})
            else:
                targets = p.get('targets', [])
                for target in targets[:100]:
                    label = target.get('name') or target.get('target', '')
                    sources.append({**common, 'id': row['id'] + ':' + target['target'],
                                    'name': name + ' · ' + label, 'target': target['target'],
                                    'intervalSeconds': target.get('interval_seconds'), 'discovery': p.get('discovery')})
                if len(targets) > 100:
                    warnings.append(name + ': only the first 100 polling targets are shown.')
                if not targets:
                    warnings.append(name + ' needs Connector → polling Workflow targets to display collection details.')
    for provider in ('github', 'slack'):
        if not any(s['provider'] == provider for s in sources):
            warnings.append(provider.title() + ' needs a Connector record for polling or a signed Webhook.')
    return {'sources': sources, 'warnings': warnings}


static = Path(os.getenv('MARI_STATIC_DIR', str(Path(__file__).parent / 'dist'))).resolve()


@app.get('/{path:path}', include_in_schema=False)
def web(path: str):
    target = (static / path).resolve()
    if not target.is_relative_to(static) or not target.is_file():
        target = static / 'index.html'
    if not target.is_file():
        raise HTTPException(503, 'Sources web build is missing')
    return FileResponse(target)
