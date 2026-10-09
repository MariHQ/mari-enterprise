"""Contextual extraction and deterministic provenance; model calls stay in AX."""
import asyncio
import os
from datetime import datetime,timezone,timedelta
from temporalio import activity,workflow
from temporalio.common import RetryPolicy
with workflow.unsafe.imports_passed_through():
    from mari_kit.ontology import VERSION,context_key,identity
    from .evidence import query_records,SOURCE_CONTENT,current_evidence
    from apps.base.catalog.graph import projection
    from apps.base.ingestion.records import KnowledgeChange,command_id
    from apps.base.ingestion.ingestion import publish_changes


def event(kind,key,text='',properties=None,title='',source='agent',operation='upsert',url=''):
    properties=properties or {}
    project=os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1')
    return KnowledgeChange(table=f'mari.records.{source}.{kind}',project_id=project,record_id=key,
        event_id=command_id(project,'ontology',key,{'text':text,'properties':properties,'operation':operation}),
        source=source,kind=kind,operation=operation,title=title or kind,text=text,properties=properties,actor='ontology',url=url)

async def matching(label,predicate,parameters):
    rows=[];after=''
    while True:
        page=await query_records(f'MATCH (r:{label}) WHERE ({predicate}) AND r.record_id>$after RETURN '+projection(label)+' ORDER BY r.record_id LIMIT 100', {**parameters,'after':after},limit=100)
        rows.extend(page)
        if len(page)<100:return rows
        after=page[-1]['record_id']

async def context(source):
    p=source['properties'];label=source['node_type']
    if label=='SlackMessage':
        rows=await matching(label,'r.thread_root=$root',{'root':p.get('thread_root') or source['source_id']})
        return sorted(rows,key=lambda r:r['properties'].get('message_ts') or r['source_id'])
    if label in ('GithubIssue','GithubPullRequest','GithubComment'):
        number=p.get('parent_number') if label=='GithubComment' else p.get('number')
        if number:
            args={'repo':p['repository'],'number':number};rows=[]
            for kind in ('GithubIssue','GithubPullRequest','GithubComment'):
                rows.extend(await matching(kind,'r.repository=$repo AND r.'+('parent_number' if kind=='GithubComment' else 'number')+'=$number',args))
            return sorted(rows,key=lambda r:(r['node_type']=='GithubComment',r['properties'].get('created_at') or '',r['source_id']))
    return [source]

@activity.defn
async def next_context(request):
    from .worker import retrieve_unmined
    seeds=await retrieve_unmined({**request,'miner_version':VERSION})
    if not seeds:return None
    records=await context(seeds[0])
    return {'context_id':context_key(seeds[0]),'evidence':records or [seeds[0]]}

@activity.defn
async def reconcile_claims():
    """Catch source deletions/edits even when there is no new content to mine."""
    count=0
    for label in ('AgentFact','AgentDecision'):
        after=''
        while True:
            rows=await query_records(f"MATCH (r:{label}) WHERE r.record_id>$after AND r.status <> 'stale' RETURN "+projection(label)+' ORDER BY r.record_id LIMIT 100',{'after':after},limit=100)
            sources={};current={}
            for row in rows:
                for e in row['properties'].get('evidence') or []:
                    if e.get('source_node_type') in SOURCE_CONTENT:sources.setdefault(e['source_node_type'],set()).add(e['source_id'])
            for source,ids in sources.items():current.update(await current_evidence(list(ids),node_type=source))
            changes=[]
            for row in rows:
                p=row['properties']
                if any(current.get(e['source_id'],{}).get('event_id')!=e['evidence_id'] for e in p.get('evidence') or []):
                    changes.append(event(row['kind'],row['record_id'],row['text'],{**p,'status':'stale','review_note':'Source evidence changed or was deleted; review required.'},row['title'],url=row['url']))
            if changes:await asyncio.to_thread(publish_changes,changes)
            count+=len(changes);activity.heartbeat('Checked source revisions')
            if len(rows)<100:break
            after=rows[-1]['record_id']
    return count

@activity.defn
async def extract_context(request):
    from .ax_miner import run_miner
    records=request['evidence'];run_id=request['run_id'];started=datetime.now(timezone.utc).isoformat()
    props={'status':'running','workflow_run_id':'temporal:run:'+activity.info().workflow_run_id,
        'started_at':started,'miner_version':VERSION,'source_count':len(records),'context_count':1}
    await asyncio.to_thread(publish_changes,[event('run',run_id,properties=props,title='Extract knowledge')])
    try:
        result=await run_miner({**request,'miner_version':VERSION})
        stats={k:v for k,v in result.get('stats',{}).items() if k!='cache_hits'}
        props.update(stats,status=result['status'],completed_at=datetime.now(timezone.utc).isoformat(),
            candidate_count=len(result.get('candidates',[])),deferred=result['status']!='completed',error=result.get('error'))
        if result['status']!='completed':
            await asyncio.to_thread(publish_changes,[event('run',run_id,properties=props,title='Extract knowledge')])
            return {**props,'budget_used_usd':result.get('budget_used_usd',request['budget_usd'])}
        changes=[]
        sources={r['source_id']:r for r in records}
        for row in records:
            p=row['properties'];snapshot='evidence:'+identity(row['node_type'],row['source_id'],row['event_id'])
            changes.append(event('evidence',snapshot,row['text'],{'source_id':row['source_id'],'source_revision':row['event_id'],
                'source_node_type':row['node_type'],'connector_id':p.get('connector_id'),'ingestion_run_id':p.get('ingestion_run_id')},row['title'],url=row['url']))
        for node in result.get('entities',[]):
            changes.append(event('entity',node['record_id'],properties={k:v for k,v in node.items() if k not in ('record_id','title')},title=node['title']))
        ids=set()
        for candidate in result['candidates']:
            if candidate['kind'] not in ('fact','decision') or not candidate.get('evidence'):raise ValueError('Invalid ontology candidate')
            for citation in candidate['evidence']:
                src=sources[citation['source_id']]
                if citation['source_node_type']!=src['node_type'] or citation['evidence_id']!=src['event_id'] or not citation['quote'].strip() or citation['quote'] not in src['text']:raise ValueError('Invalid ontology evidence')
            key=candidate['kind']+':'+candidate['candidate_id'];ids.add(key)
            properties={k:v for k,v in candidate.items() if k not in ('kind','text','title','url')}
            changes.append(event(candidate['kind'],key,candidate['text'],{**properties,'run_id':run_id,'status':'pending'},candidate['title'],url=candidate.get('url','')))
        # Re-extraction replaces this context's candidate set. Keep old assertions as stale history.
        for label in ('AgentFact','AgentDecision'):
            for old in await matching(label,'r.context_id=$context',{'context':request['context_id']}):
                if old['record_id'] not in ids and old['properties'].get('status')!='stale':
                    changes.append(event(old['kind'],old['record_id'],old['text'],{**old['properties'],'status':'stale','review_note':'No longer supported by the current context.'},old['title'],url=old['url']))
        # Check context revisions again after model execution; never acknowledge a stale read.
        fresh={}
        for label in {r['node_type'] for r in records}:
            fresh.update(await current_evidence([r['source_id'] for r in records if r['node_type']==label],node_type=label))
        valid=all(fresh.get(r['source_id'],{}).get('event_id')==r['event_id'] for r in records)
        if not valid:
            props.update(status='deferred',deferred=True,error='Sources changed during extraction; awaiting the next pass.')
            changes=[e.model_copy(update={'properties':{**e.properties,'status':'stale'}}) if e.kind in ('fact','decision') else e for e in changes]
        await asyncio.to_thread(publish_changes,changes)
        if valid:
            receipts=[event('mining_receipt','mining-receipt:'+identity(r['node_type'],r['source_id']),properties={
                'source_id':r['source_id'],'source_node_type':r['node_type'],'source_revision':r['event_id'],
                'context_id':request['context_id'],'run_id':run_id,'miner_version':VERSION}) for r in records]
            await asyncio.to_thread(publish_changes,receipts)
        await asyncio.to_thread(publish_changes,[event('run',run_id,properties=props,title='Extract knowledge')])
        return props
    except Exception:
        props.update(status='failed',error='Extraction failed; sources were not acknowledged.',completed_at=datetime.now(timezone.utc).isoformat())
        await asyncio.to_thread(publish_changes,[event('run',run_id,properties=props,title='Extract knowledge')])
        raise

@workflow.defn
class ExtractOntology:
    @workflow.run
    async def run(self,request):
        await workflow.execute_activity('reconcile_claims',start_to_close_timeout=timedelta(minutes=5),heartbeat_timeout=timedelta(minutes=1),retry_policy=RetryPolicy(maximum_attempts=3))
        seen=[];spent=0.0;budget_used=0.0;count=0;deferred=0
        budget=float(request.get('budget_usd',5));maximum=int(request.get('max_contexts',20))
        for _ in range(maximum):
            if budget-budget_used<0.10:break
            batch=await workflow.execute_activity('next_context',{'seen':seen},start_to_close_timeout=timedelta(minutes=2),retry_policy=RetryPolicy(maximum_attempts=3))
            if not batch:return {'status':'completed' if not deferred else 'deferred','contexts':count,'cost_usd':spent,'deferred':deferred}
            result=await workflow.execute_activity('extract_context',{**batch,'run_id':'run:'+workflow.info().run_id+':'+identity(batch['context_id'])[:16],
                'budget_usd':min(float(request.get('context_budget_usd',2)),budget-budget_used)},
                start_to_close_timeout=timedelta(minutes=25),heartbeat_timeout=timedelta(minutes=1),retry_policy=RetryPolicy(maximum_attempts=1))
            spent+=result.get('cost_usd',0);budget_used+=result.get('budget_used_usd',result.get('cost_usd',0));count+=1;deferred+=int(result.get('deferred',False))
            seen.extend(r['event_id'] for r in batch['evidence'])
        return {'status':'budget_or_batch_limit','contexts':count,'cost_usd':spent,'deferred':deferred}
