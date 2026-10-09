"""Sources-specific read routes; hosting and authentication come from Mari's base."""
import asyncio
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from apps.sdk.runtime import authenticated, create_app, Manifest

manifest = Manifest(name='sources')
TOPICS = ('mari.records.temporal.temporal_connector', 'mari.records.temporal.webhook_connector')
router = APIRouter()
QUERY = '''MATCH (r:Record)
WHERE r.project_id = $project AND r.source = $source AND r.kind = $kind AND r.record_id > $after
RETURN r.record_id AS id, r.properties AS properties, r.observed_at AS observed_at
ORDER BY r.record_id LIMIT 101'''


@router.get('/status')
async def status(claims=Depends(authenticated)):
    from apps.sdk.orchid import query_pages
    parameters = [{'project': claims['project'], 'after': '', 'source': 'temporal',
                   'kind': topic.rsplit('.', 1)[1]} for topic in TOPICS]
    try:
        pages = await asyncio.to_thread(query_pages, QUERY, parameters)
    except Exception:
        # Do not expose catalog URLs, physical SQL, or credential details.
        raise HTTPException(503, 'Source configuration is unavailable from OrchidDB') from None
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


app = create_app(manifest, router, Path(__file__).parent/'dist')
