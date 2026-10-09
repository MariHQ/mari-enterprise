"""Worker-owned reads of explicit content nodes through embedded OrchidDB."""
import asyncio
import json
import os
import re
from collections import defaultdict
from apps.base.catalog.engine import IcebergGraph
from apps.base.ingestion.records import hydrate
from apps.base.catalog.graph import projection

SOURCE_CONTENT = ('MariDocument','SlackMessage', 'SlackThread', 'GithubIssue', 'GithubPullRequest', 'GithubComment', 'GithubFile', 'GithubDocument')
EVIDENCE_CONTENT = SOURCE_CONTENT
engine = IcebergGraph()


async def query_records(cypher, parameters=None, limit=1000):
    result = await asyncio.to_thread(engine.execute, cypher, parameters, project=os.getenv('MARI_KNOWLEDGE_PROJECT_ID', '1'), limit=limit)
    return [{**hydrate(row), 'source_id': row['record_id']} for row in result['rows']]


def evidence_type(identity):
    """Recognize identities emitted by the existing Slack/GitHub normalizer."""
    if not isinstance(identity, str) or not identity:
        raise ValueError('Invalid record identity')
    if re.fullmatch(r'[^/]+/[^/]+/\d+\.\d+', identity):
        return 'SlackMessage'
    parts = identity.split('/')
    if len(parts) == 4 and parts[-2] in ('issue', 'pull', 'comment'):
        return {'issue': 'GithubIssue', 'pull': 'GithubPullRequest', 'comment': 'GithubComment'}[parts[-2]]
    raise ValueError('Record identity needs an explicit node type')


async def search_evidence(query):
    if query.startswith('source_id:'):
        identity = json.loads(query[len('source_id:'):])
        label = evidence_type(identity)
        return await query_records(f'MATCH (r:{label}) WHERE r.record_id=$id RETURN '+projection(label)+' LIMIT 1', {'id':identity}, limit=1)
    if query.strip() not in ('', '*'):
        raise ValueError('Evidence search requires a published search mapping; use * or source_id:<JSON string>')
    rows = []
    for label in EVIDENCE_CONTENT:
        rows.extend(await query_records(f'MATCH (r:{label}) RETURN '+projection(label)+' ORDER BY r.observed_at DESC,r.record_id LIMIT 100', limit=100))
    rows.sort(key=lambda row: (-row['observed_at'], row['record_id'], row['node_type']))
    return rows[:100]


async def current_evidence(source_ids, node_type=None):
    if node_type is not None and node_type not in (*EVIDENCE_CONTENT, 'AgentDecision'):
        raise ValueError('Unsupported evidence node type')
    grouped = defaultdict(list)
    for identity in dict.fromkeys(source_ids):
        grouped[node_type or evidence_type(identity)].append(identity)
    result = {}
    for label, identities in grouped.items():
        for offset in range(0, len(identities), 100):
            rows = await query_records(f'MATCH (r:{label}) WHERE r.record_id IN $ids RETURN '+projection(label)+' LIMIT 100', {'ids':identities[offset:offset+100]}, limit=100)
            result.update((row['record_id'], row) for row in rows)
    return result
