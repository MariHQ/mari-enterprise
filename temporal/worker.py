import asyncio
import hashlib
import os
import time
from concurrent.futures import ThreadPoolExecutor

from temporalio import activity
from temporalio.client import Client
from temporalio.worker import Worker

from apps.base.ingestion.records import KnowledgeChange, command_id
from apps.base.ingestion.mappings import topic_for
from apps.base.ingestion.ingestion import publish_changes
from .evidence import search_evidence, current_evidence, query_records, SOURCE_CONTENT
from apps.base.catalog.graph import projection
from .workflows import MineKnowledge, SourceSync
from .schedules import ScheduledPoll, persist_poll_cursor
from .observability import ObserveTemporal, observe_temporal
from .discovery import DiscoverSlack, discover_slack
from .ax_observability import ObserveAX, observe_ax
from temporal.connectors import sync_source
from temporal.maintenance.compaction import CompactIceberg, compact_iceberg


@activity.defn
async def retrieve(request: dict):
    return await search_evidence(request["query"])


@activity.defn
async def retrieve_unmined(request: dict):
    from .evidence import engine
    from apps.base.ingestion.records import hydrate
    def read():
      rows=[]
      with engine.session(os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1')) as run:
       for label in SOURCE_CONTENT:
        query = f"""MATCH (r:{label})
WHERE NOT r.event_id IN $seen AND r.text <> ''
AND NOT EXISTS {{
 MATCH (receipt:AgentMiningReceipt)
 WHERE receipt.miner_version=$version AND receipt.source_id=r.record_id AND receipt.source_revision=r.event_id
}}
RETURN """+projection(label)+" ORDER BY r.observed_at,r.record_id LIMIT 20"
        rows.extend({**hydrate(row),'source_id':row['record_id']} for row in run(query,{'seen':request.get('seen',[]),'version':request.get('miner_version','decisions-extract-v2')},limit=20)['rows'])
      rows.sort(key=lambda row:(row['observed_at'],row['record_id'],row['node_type']))
      return rows[:20]
    return await asyncio.to_thread(read)


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
        # Carry the source's concrete table identity in Temporal history for review.
        candidate['source_node_type'] = evidence[candidate['source_id']]['node_type']
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
        properties = {name:value for name,value in c.items() if name != 'source_node_type'}
        publish_record(key,c['kind'],c['text'],{**properties,'run_id':request['run_id'],'status':'pending'},key+':pending')


@activity.defn
async def record_review(request: dict):
    state='expired' if request.get('expired') else 'approved' if request['approved'] else 'rejected'
    candidates=request['candidates']
    from collections import defaultdict
    identities = defaultdict(list)
    for candidate in candidates:
        identities[candidate.get('source_node_type')].append(candidate['source_id'])
    current = {}
    for node_type, source_ids in identities.items():
        current.update(await current_evidence(source_ids, node_type=node_type))
    current.update(await current_evidence([request['run_id']+':'+c['candidate_id'] for c in candidates], node_type='AgentDecision'))
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
            properties = {name:value for name,value in c.items() if name != 'source_node_type'}
            publish_record(key,c['kind'],c['text'],{**properties,'run_id':request['run_id'],
                'status':state if valid else 'superseded','review_note':request.get('note',''),
                'review_ids':[key+':review']},key+':review')
            publish_record(key+':review','review',request.get('note',''), {
                'record_ids':[key], 'status':state if valid else 'superseded',
                'source_id':c['source_id'], 'evidence_id':c['evidence_id'],
                'run_id':request['run_id'], 'expired':bool(request.get('expired')),
            },key+':review-record')
    await asyncio.to_thread(save)


async def main():
    from .ontology import ExtractOntology,next_context,extract_context,reconcile_claims
    client = await Client.connect(os.getenv("TEMPORAL_ADDRESS", "temporal.stack.svc:7233"), namespace=os.getenv("TEMPORAL_NAMESPACE", "default"))
    with ThreadPoolExecutor(max_workers=8) as pool:
        workers = [Worker(client, task_queue=queue, workflows=[ExtractOntology,ScheduledPoll, MineKnowledge, SourceSync, CompactIceberg, ObserveTemporal, DiscoverSlack, ObserveAX],
            activities=[reconcile_claims,next_context,extract_context,persist_poll_cursor, observe_ax, discover_slack, observe_temporal, compact_iceberg, sync_source, retrieve, retrieve_unmined, mark_mined, execute_substrate, save_candidates, record_review, set_status],
            activity_executor=pool, max_concurrent_activities=8)
            for queue in dict.fromkeys(os.getenv('TEMPORAL_TASK_QUEUES',os.getenv('TEMPORAL_TASK_QUEUE','mari')).split(',')) if queue]
        await asyncio.gather(*(worker.run() for worker in workers))


if __name__ == "__main__":
    asyncio.run(main())
