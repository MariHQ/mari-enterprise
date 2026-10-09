"""Small, separately requested aggregates over Kafka-emitted run records."""
import time
from fastapi import APIRouter
from apps.base.db import execute,graph_snapshot,hydrate
from .graph import projection
router=APIRouter()

@router.get('/api/run-statistics/recent')
@graph_snapshot
def recent_runs():
    return {'records':[hydrate(row) for row in execute('MATCH (r:AgentRun) RETURN '+projection('AgentRun')+' ORDER BY r.observed_at DESC,r.record_id LIMIT 25')['rows']]}

@router.get('/api/run-statistics')
@graph_snapshot
def run_statistics():
    since=int(time.time())-7*86400
    row=execute('''MATCH (r:AgentRun) WHERE r.observed_at >= $since RETURN count(r) AS runs,
        sum(CASE WHEN r.status='failed' THEN 1 ELSE 0 END) AS failed,
        sum(CASE WHEN r.deferred=true THEN 1 ELSE 0 END) AS deferred,
        sum(r.input_tokens) AS input_tokens,sum(r.output_tokens) AS output_tokens,
        sum(r.cache_read_tokens) AS cache_read_tokens,sum(r.cache_creation_tokens) AS cache_creation_tokens,
        sum(r.cost_usd) AS cost_usd,sum(r.source_count) AS sources,sum(r.candidate_count) AS candidates,
        sum(r.duration_ms) AS duration_ms''',{'since':since})['rows'][0]
    return {k:v or 0 for k,v in row.items()}
