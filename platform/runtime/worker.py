import asyncio
import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
from temporalio import activity
from temporalio.client import Client
from temporalio.worker import Worker

from knowledge.records import KnowledgeChange, command_id
from knowledge.mappings import topic_for
from knowledge.ingestion import publish_changes
from knowledge.api import search_evidence, current_evidence
from .workflows import MineKnowledge, SourceSync
from .observability import ObserveTemporal, observe_temporal
from .discovery import DiscoverSlack, discover_slack
from .ax_observability import ObserveAX, observe_ax
from knowledge.connectors import sync_source
from maintenance.compaction import CompactIceberg, compact_iceberg


@activity.defn
async def retrieve(request: dict):
    return await search_evidence(request["query"])


UNMINED_SQL = """SELECT r.* FROM records r
WHERE NOT list_contains($seen,r.event_id) AND r.source IN ('slack','github') AND r.kind <> 'edge' AND r.text <> ''
AND NOT EXISTS (
 SELECT 1 FROM mining_receipts receipt WHERE receipt.kind='mining_receipt'
 AND receipt.source='agent'
 AND json_extract_string(receipt.properties,'$.miner_version')='decisions-extract-v2'
 AND json_extract_string(receipt.properties,'$.source_id')=r.record_id
 AND json_extract_string(receipt.properties,'$.source_revision')=r.event_id
)
ORDER BY r.observed_at, r.record_id LIMIT 20"""


@activity.defn
async def retrieve_unmined(request: dict):
    async with httpx.AsyncClient(timeout=40) as client:
        response=await client.post(os.environ['KNOWLEDGE_API_URL'].rstrip('/')+'/api/query',
            json={'query':UNMINED_SQL,'limit':20,'parameters':{'seen':request.get('seen',[])}},
            headers={'Authorization':'Bearer '+os.environ['MARI_SERVICE_TOKEN']})
        response.raise_for_status()
        return [{**row,'source_id':row['record_id']} for row in response.json()['rows']]


@activity.defn
def mark_mined(request: dict):
    # Acknowledge only revisions whose extraction and candidate publication succeeded.
    # Retrying is idempotent. Projection lag may repeat work, never skip unseen data.
    for item in request['evidence']:
        identity='mining-receipt:'+hashlib.sha256(item['source_id'].encode()).hexdigest()
        publish_record(identity,'mining_receipt','',
            {'source_id':item['source_id'],'source_revision':item['event_id'],'run_id':request['run_id'],'miner_version':'decisions-extract-v2'},
            identity+':'+item['event_id'])


@activity.defn
async def execute_substrate(request: dict):
    from .ax_miner import run_miner
    candidates=await run_miner(request)
    if not isinstance(candidates,list) or len(candidates)>1000:raise ValueError('Invalid miner output')
    evidence={item['source_id']:item for item in request['evidence']}
    for candidate in candidates:
        if candidate.get('kind')!='decision' or not candidate.get('text'):raise ValueError('Invalid decision')
        citations=candidate.get('evidence',[])
        if not citations:raise ValueError('Decision has no evidence')
        for citation in citations:
            original=evidence[citation['source_id']]
            if citation['evidence_id']!=original['event_id'] or not citation['quote'] or citation['quote'] not in original['text']:
                raise ValueError('Miner returned ungrounded evidence')
    return candidates


def publish_record(identity, kind, text, properties, event_key):
    event=KnowledgeChange(table=topic_for('agent',kind),event_id=command_id('1','temporal',event_key,{'id':identity,'properties':properties,'text':text}),
        record_id=identity,operation='upsert',kind=kind,source='agent',title=properties.get('title',kind),
        text=text,properties=properties,actor='temporal')
    publish_changes([event])


@activity.defn
def set_status(request: dict):
    publish_record('run:'+request['run_id'],'workflow','',
        {**request,'execution_ids':['temporal:run:'+activity.info().workflow_run_id]},
        request['run_id']+':'+request['status'])


@activity.defn
def save_candidates(request: dict):
    for c in request['candidates']:
        key=request['run_id']+':'+c['candidate_id']
        publish_record(key,c['kind'],c['text'],{**c,'run_id':request['run_id'],'status':'pending'},key+':pending')


@activity.defn
async def record_review(request: dict):
    state='expired' if request.get('expired') else 'approved' if request['approved'] else 'rejected'
    candidates=request['candidates']
    current=await current_evidence([c['source_id'] for c in candidates] +
        [request['run_id']+':'+c['candidate_id'] for c in candidates])
    def save():
        for c in candidates:
            existing=current.get(request['run_id']+':'+c['candidate_id'])
            if existing and existing.get('properties',{}).get('status') not in (None,'pending'):
                # A human may already have reviewed this candidate individually.
                # Expiring the batch must not reverse that recorded decision.
                continue
            evidence=current.get(c['source_id'])
            valid=evidence and evidence['event_id']==c['evidence_id']
            key=request['run_id']+':'+c['candidate_id']
            publish_record(key,c['kind'],c['text'],{**c,'run_id':request['run_id'],
                'status':state if valid else 'superseded','review_note':request.get('note',''),
                'review_ids':[key+':review']},key+':review')
            publish_record(key+':review','review',request.get('note',''), {
                'record_ids':[key], 'status':state if valid else 'superseded',
                'source_id':c['source_id'], 'evidence_id':c['evidence_id'],
                'run_id':request['run_id'], 'expired':bool(request.get('expired')),
            },key+':review-record')
    await asyncio.to_thread(save)


async def main():
    client = await Client.connect(os.getenv("TEMPORAL_ADDRESS", "temporal:7233"))
    with ThreadPoolExecutor(max_workers=8) as pool:
        workers = [Worker(client, task_queue=queue, workflows=[MineKnowledge, SourceSync, CompactIceberg, ObserveTemporal, DiscoverSlack, ObserveAX],
            activities=[observe_ax, discover_slack, observe_temporal, compact_iceberg, sync_source, retrieve, retrieve_unmined, mark_mined, execute_substrate, save_candidates, record_review, set_status],
            activity_executor=pool, max_concurrent_activities=8)
            for queue in dict.fromkeys(os.getenv('TEMPORAL_TASK_QUEUES','mari').split(',')) if queue]
        await asyncio.gather(*(worker.run() for worker in workers))


if __name__ == "__main__":
    asyncio.run(main())
