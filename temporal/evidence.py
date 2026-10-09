"""Worker-owned evidence reads through embedded OrchidDB, without an API server."""
import asyncio
import json
import os
from apps.sdk.catalog_lake import CatalogLake
from apps.sdk.data.records import hydrate
from apps.sdk.graph import projection, DOCUMENTS

engine = CatalogLake()


async def query_records(cypher, parameters=None, limit=1000):
    result = await asyncio.to_thread(engine.execute, cypher, parameters, project=os.getenv('MARI_KNOWLEDGE_PROJECT_ID', '1'), limit=limit)
    return [hydrate(row) for row in result['rows']]


async def search_evidence(query):
    # Preserve the previous supported retrieval contract; do not invent ranked search.
    if query.startswith('source_id:'):
        identity = json.loads(query[len('source_id:'):])
        if not isinstance(identity, str) or not identity:
            raise ValueError('Invalid record identity')
        return await query_records('MATCH (r:Record) WHERE '+DOCUMENTS+' AND r.record_id=$id RETURN '+projection(), {'id':identity})
    if query.strip() not in ('', '*'):
        raise ValueError('Evidence search requires a published search mapping; use * or source_id:<JSON string>')
    return await query_records('MATCH (r:Record) WHERE '+DOCUMENTS+' RETURN '+projection()+' ORDER BY r.observed_at DESC,r.record_id LIMIT 100', limit=100)


async def current_evidence(source_ids):
    identities = list(dict.fromkeys(source_ids))
    result = {}
    for offset in range(0, len(identities), 100):
        rows = await query_records('MATCH (r:Record) WHERE '+DOCUMENTS+' AND r.record_id IN $ids RETURN '+projection(), {'ids':identities[offset:offset+100]})
        result.update((row['record_id'], row) for row in rows)
    return result
