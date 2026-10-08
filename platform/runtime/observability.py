"""Project Temporal state into knowledge events. UI reads the resulting lake graph."""
import asyncio
import hashlib
import json
from datetime import datetime, timedelta, timezone
from temporalio import activity, workflow
from knowledge.mappings import topic_for
from temporalio.common import RetryPolicy


@workflow.defn
class ObserveTemporal:
    @workflow.run
    async def run(self, request: dict):
        steady = workflow.patched('observer-stable-run-v1')
        while True:
            known = await workflow.execute_activity('observe_temporal', request,
                start_to_close_timeout=timedelta(minutes=4), heartbeat_timeout=timedelta(seconds=60),
                retry_policy=RetryPolicy(maximum_attempts=3))
            await workflow.sleep(timedelta(minutes=5))
            request = {'known': known}
            if not steady or workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(request)


def event_for(identity, kind, title, properties):
    from knowledge.records import KnowledgeChange
    revision=hashlib.sha256(json.dumps(properties,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return KnowledgeChange(table=topic_for('temporal',kind),record_id=identity,event_id=identity+':'+revision,operation='upsert',
        kind=kind,source='temporal',title=title,properties=properties,actor='temporal-observer'),revision


def edge_for(source, relation, target):
    identity='temporal:edge:'+hashlib.sha256(json.dumps([source,relation,target]).encode()).hexdigest()
    return event_for(identity,'edge',relation,{'from_id':source,'to_id':target,'relation':relation})


def iso(value):return value.isoformat() if value else None


@activity.defn
async def observe_temporal(request:dict):
    import os
    from temporalio.client import Client
    from knowledge.ingestion import publish_changes
    c=await Client.connect(os.getenv('TEMPORAL_ADDRESS','temporal:7233'))
    previous=request.get('known',{}); known={}; changes=[]
    def emit(item):
        event,revision=item
        if known.get(event.record_id,previous.get(event.record_id))!=revision:changes.append(event)
        known[event.record_id]=revision
    scheduled_runs={}
    for provider, variable in (('github','GITHUB_REPOSITORIES'),('slack','SLACK_CHANNELS')):
        targets=[]
        identity='temporal:connector:'+provider
        for target in filter(None,os.getenv(variable,'').split(',')) if provider != 'slack' else []:
            workflow_id='poll-sync-'+provider+'-'+hashlib.sha256(target.encode()).hexdigest()[:12]
            targets.append({'target':target,'workflow_id':workflow_id,'interval_seconds':900})
            emit(event_for('temporal:workflow:'+workflow_id,'temporal_workflow','SourceSync',{'workflow_id':workflow_id,'workflow_type':'SourceSync'}))
            emit(edge_for(identity,'polls','temporal:workflow:'+workflow_id))
        if targets:
            emit(event_for(identity,'temporal_connector',provider,{
                'provider':provider,'mode':'polling','targets':targets}))
        emit(event_for('connector:webhook:'+provider,'webhook_connector',provider+' signed webhook',{
            'provider':provider,'mode':'webhook','endpoint':'/hooks/'+provider}))
    async for schedule in await c.list_schedules():
        activity.heartbeat('Reading schedules')
        d=await c.get_schedule_handle(schedule.id).describe()
        action=d.schedule.action
        target='temporal:workflow:'+getattr(action,'id',schedule.id)
        emit(event_for(target,'temporal_workflow',getattr(action,'workflow','Workflow'),
            {'workflow_id':getattr(action,'id',schedule.id),'workflow_type':getattr(action,'workflow','Workflow')}))
        identity='temporal:schedule:'+schedule.id
        emit(event_for(identity,'temporal_schedule',schedule.id,{
            'schedule_id':schedule.id,'paused':d.schedule.state.paused,
            'note':d.schedule.state.note,
            'retired':schedule.id.startswith('sync-') and d.schedule.state.paused,
            'interval_seconds':[int(i.every.total_seconds()) for i in d.schedule.spec.intervals],
            'next_run':iso(d.info.next_action_times[0]) if d.info.next_action_times else None,
            'actions':d.info.num_actions,'overlap_skipped':d.info.num_actions_skipped_overlap,
            'recent_runs':[{'workflow_id':a.action.workflow_id,'scheduled_at':iso(a.scheduled_at)} for a in d.info.recent_actions]}))
        emit(edge_for(identity,'schedules',target))
        for action_run in d.info.recent_actions:
            scheduled_runs[action_run.action.workflow_id]=identity
    cutoff=(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()
    count=0; observed_runs=set()
    async for run in c.list_workflows(query=f'WorkflowType != "ObserveTemporal" AND (ExecutionStatus="Running" OR StartTime>="{cutoff}")',limit=1000):
        if run.workflow_type == 'ObserveTemporal':
            continue
        activity.heartbeat('Reading workflow states'); count+=1
        wid='temporal:workflow:'+run.id
        emit(event_for(wid,'temporal_workflow',run.workflow_type,{'workflow_id':run.id,'workflow_type':run.workflow_type}))
        identity='temporal:run:'+run.run_id; observed_runs.add(identity)
        properties={'workflow_id':run.id,'run_id':run.run_id,'workflow_type':run.workflow_type,
            'status':run.status.name,'started_at':iso(run.start_time),'finished_at':iso(run.close_time),
            'duration_seconds':(run.close_time-run.start_time).total_seconds() if run.close_time else None}
        if run.status.name=='RUNNING' and run.workflow_type in ('MineKnowledge','SourceSync'):
            from temporalio.service import RPCError
            from temporalio.client import WorkflowQueryFailedError
            try:
                properties['phase']=await c.get_workflow_handle(run.id,run_id=run.run_id).query('state',rpc_timeout=timedelta(seconds=3))
            except (RPCError, WorkflowQueryFailedError):
                pass  # Old workers may not have this query; retain the actual Temporal status.
        if run.workflow_type=='SourceSync' and run.status.name=='FAILED':
            from temporalio.client import WorkflowHistoryEventFilterType
            history=await c.get_workflow_handle(run.id,run_id=run.run_id).fetch_history(
                event_filter_type=WorkflowHistoryEventFilterType.CLOSE_EVENT,rpc_timeout=timedelta(seconds=3))
            for event in history.events:
                if event.HasField('workflow_execution_failed_event_attributes'):
                    failure=event.workflow_execution_failed_event_attributes.failure
                    while failure.HasField('cause'):failure=failure.cause
                    # Connectors supply sanitized permanent failure messages, never response bodies.
                    properties['error']=failure.message[:500]
        emit(event_for(identity,'temporal_run',run.workflow_type,properties))
        emit(edge_for(identity,'run_of',wid))
        emit(edge_for(wid,'has_run',identity))
        if run.id in scheduled_runs:
            emit(edge_for(scheduled_runs[run.id],'started',identity))
        if run.status.name=='RUNNING':
            # Source/target are not credentials and are already operator configuration.
            desc=await c.get_workflow_handle(run.id,run_id=run.run_id).describe()
            pending=desc.raw_description.pending_activities
            for a in pending:
                aid=identity+':activity:'+a.activity_id
                emit(event_for(aid,'temporal_activity',a.activity_type.name,{
                    'activity_id':a.activity_id,'activity_type':a.activity_type.name,
                    'state':a.state,'attempt':a.attempt,'workflow_id':run.id,'run_id':run.run_id,
                    'error':a.last_failure.message[:500] if a.HasField('last_failure') else None}))
                emit(edge_for(identity,'has_activity',aid))
    from knowledge.records import KnowledgeChange
    for identity in previous:
        if ':activity:' in identity and identity.split(':activity:')[0] in observed_runs and identity not in known:
            parent=identity.split(':activity:')[0]
            for retired in (identity,edge_for(parent,'has_activity',identity)[0].record_id):
                changes.append(KnowledgeChange(table=topic_for('temporal','edge' if retired.startswith('temporal:edge:') else 'temporal_activity'),record_id=retired,event_id='retire:'+hashlib.sha256((retired+activity.info().workflow_run_id+activity.info().activity_id).encode()).hexdigest(),
                    operation='delete',kind='edge' if retired.startswith('temporal:edge:') else 'temporal_activity',source='temporal',actor='temporal-observer'))
    # Configured connector inventory is complete; removed connectors are explicit retractions.
    for identity in previous:
        if identity.startswith('temporal:connector:') and identity != 'temporal:connector:slack' and identity not in known:
            parts=identity.split(':')
            retired_ids=[identity]
            if len(parts)==4:
                provider,key=parts[2:]
                retired_ids.append(edge_for(identity,'polls','temporal:workflow:poll-sync-'+provider+'-'+key)[0].record_id)
            for retired in retired_ids:
                changes.append(KnowledgeChange(table=topic_for('temporal','edge' if retired.startswith('temporal:edge:') else 'temporal_connector'),record_id=retired,event_id='retire:'+hashlib.sha256((retired+activity.info().workflow_run_id+activity.info().activity_id).encode()).hexdigest(),
                    operation='delete',kind='edge' if retired.startswith('temporal:edge:') else 'temporal_connector',source='temporal',actor='temporal-observer'))
    # Disappearance from a bounded visibility window is NOT deletion of history.
    # The watermark describes the last changed projection, not a clock heartbeat.
    if changes or 'temporal:observation' not in previous:
        emit(event_for('temporal:observation','temporal_observation','Temporal status projection',{
            'observed_at':datetime.now(timezone.utc).isoformat(),'workflow_count':count,
            'window_hours':24,'limit':1000,'possibly_truncated':count==1000}))
    else:
        known['temporal:observation'] = previous['temporal:observation']
    if changes:
        await asyncio.to_thread(publish_changes,changes)
    return known
