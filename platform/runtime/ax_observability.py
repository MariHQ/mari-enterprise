"""Pull AX tasks and existing harness traces; publish only changed projections."""
import asyncio
import hashlib
import json
import os
from datetime import timedelta
from temporalio import activity, workflow
from temporalio.common import RetryPolicy


@workflow.defn
class ObserveAX:
    @workflow.run
    async def run(self, request: dict):
        while True:
            request=await workflow.execute_activity('observe_ax',request,
                start_to_close_timeout=timedelta(minutes=10),heartbeat_timeout=timedelta(seconds=45),
                retry_policy=RetryPolicy(maximum_attempts=3))
            await workflow.sleep(timedelta(minutes=5))
            if workflow.info().is_continue_as_new_suggested():workflow.continue_as_new(request)


# Read existing harness files inside an AX sandbox. No shell, network requests,
# source execution, or writes. Bound work and output even for a large workspace.
READ_TRACES = r'''
import json,os,sys
roots=json.loads(sys.argv[1]);offsets=json.loads(sys.argv[2]);rows=[];next_offsets=dict(offsets);unsupported=0;budget=1048576
for root in roots:
 for base,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=[d for d in dirs if d not in ('.git','node_modules') and not os.path.islink(os.path.join(base,d))]
  for name in sorted(files):
   path=os.path.join(base,name)
   if not name.endswith('.jsonl') or os.path.islink(path):continue
   size=os.path.getsize(path);start=offsets.get(path,0)
   if size<start:start=0
   if budget<=0:break
   with open(path,'rb') as f:
    f.seek(start)
    while budget>0:
     pos=f.tell();line=f.readline(min(budget,65537))
     if not line or not line.endswith(b'\n'):break
     budget-=len(line)
     try:item=json.loads(line)
     except (ValueError,UnicodeError):unsupported+=1;next_offsets[path]=f.tell();continue
     # Mari's existing external observation contract.
     trace=item.get('trace') if isinstance(item,dict) else None
     if isinstance(trace,list):
      rows.append({'key':path+':'+str(pos),'prompt':str(item.get('prompt',''))[:2000],
       'model':str(item.get('model',''))[:256],'trace':trace[:100]})
     else:unsupported+=1
     next_offsets[path]=f.tell()
  if budget<=0:break
 if budget<=0:break
print(json.dumps({'observations':rows,'offsets':next_offsets,'unsupported':unsupported}))
'''


def normalized_observation(item, identity, actor, started):
    from mari_components.trajectories import normalize_steps, rework_count
    from knowledge.records import KnowledgeChange, command_id
    steps=normalize_steps(event for event in item['trace'] if isinstance(event,dict))
    step_ids=[identity+':step:'+str(s.ordinal) for s in steps]
    props={'actor_id':actor,'prompt':item['prompt'],'model':item['model'],'status':'observed',
        'started_at':started,'finished_at':None,'step_count':len(steps),
        'failure_count':sum(not s.ok for s in steps),'rework_count':rework_count(steps),
        'step_ids':step_ids,'trace_available':True}
    def change(key,kind,title,properties):
        return KnowledgeChange(table='mari.records.ax.'+kind,record_id=key,
            event_id=command_id('1',actor,key,properties),operation='upsert',source='ax',kind=kind,
            title=title[:2000],actor=actor,properties=properties)
    result=[change(identity,'trajectory',item['prompt'] or actor,props)]
    for step,key in zip(steps,step_ids):
        result.append(change(key,'step',step.tool,{
            'ordinal':step.ordinal,'tool':step.tool,'action_family':step.action_family,
            'args':dict(step.arguments),'summary':step.summary,'ok':step.ok,
            'status':'completed' if step.ok else 'failed','run_ids':[identity]}))
    return result


async def scrape_actor(channel, target, roots, offsets):
    import guest_pb2 as pb, guest_pb2_grpc as rpc
    client=rpc.ProcessServiceStub(channel);metadata=(('ate-target-actor',target),)
    process=await client.StartProcess(pb.StartProcessRequest(command=['python3','-c',READ_TRACES,
        json.dumps(roots),json.dumps(offsets)]),metadata=metadata,timeout=15)
    output=bytearray();exit_code=None
    stream=client.StreamProcessOutput(pb.StreamProcessOutputRequest(process_id=process.process_id,follow=True),
        metadata=metadata,timeout=30)
    async for chunk in stream:
        if chunk.HasField('exit'):exit_code=chunk.exit.exit_code
        output.extend(chunk.stdout)
        if len(output)>2_000_000:
            stream.cancel();raise ValueError('Trace export exceeds bounded response')
    if exit_code!=0:raise RuntimeError('AX trace read failed')
    return json.loads(output)


@activity.defn
async def observe_ax(request: dict):
    import grpc
    import ax_pb2 as pb, ax_pb2_grpc as rpc
    from knowledge.records import KnowledgeChange, command_id
    from knowledge.ingestion import publish_changes
    previous=request.get('known',{});known=dict(previous);offsets=dict(request.get('offsets',{}))
    roots=json.loads(os.getenv('AX_TRAJECTORY_ROOTS','[]'))
    endpoints=json.loads(os.getenv('AX_ENDPOINTS','["ax-server.ax-system.svc.cluster.local:8080"]'))
    router=os.getenv('SUBSTRATE_ROUTER','http://atenet-router.ate-system.svc.cluster.local').removeprefix('http://')
    if ':' not in router:router+=':80'
    async with grpc.aio.insecure_channel(router) as guest_channel:
        for endpoint in endpoints:
            async with grpc.aio.insecure_channel(endpoint) as channel:
                client=rpc.AXStub(channel);offset=0
                while True:
                    activity.heartbeat('Reading AX task inventory')
                    page=await client.ListTasks(pb.ListTasksRequest(limit=100,offset=offset),timeout=15)
                    for task in page.tasks:
                        actor=task.metadata.atespace+'/'+(task.status.actor or task.metadata.name)
                        identity='ax:task:'+hashlib.sha256((endpoint+actor+str(task.metadata.creation_timestamp)).encode()).hexdigest()
                        created=task.metadata.creation_timestamp.ToDatetime().isoformat()+'Z'
                        props={'actor_id':actor,'task_name':task.metadata.name,'status':task.status.phase.lower(),
                            'started_at':created,'step_count':0,'failure_count':0,
                            'trace_available':False,'trace_status':'not_configured' if not roots else 'guest_access_disabled'}
                        changes=[]
                        if roots and task.spec.debug and task.status.worker_ip:
                            try:
                                data=await scrape_actor(guest_channel,actor,roots,offsets.get(identity,{}))
                                props['trace_status']='readable'
                                for item in data['observations']:
                                    key=identity+':'+hashlib.sha256(json.dumps([item['key'],item['prompt'],item['trace']],sort_keys=True).encode()).hexdigest()
                                    changes.extend(normalized_observation(item,key,actor,created))
                                # Advance after Kafka acknowledges the whole batch below.
                                next_offsets=data['offsets']
                            except (grpc.RpcError,ValueError,RuntimeError):
                                props['trace_status']='unavailable';next_offsets=None
                        else:next_offsets=None
                        event=KnowledgeChange(table='mari.records.ax.trajectory',record_id=identity,
                            event_id=command_id('1','ax',identity,props),operation='upsert',source='ax',
                            kind='trajectory',title=task.metadata.name,actor=actor,properties=props)
                        if previous.get(identity)!=event.event_id:changes.append(event)
                        if changes:await asyncio.to_thread(publish_changes,changes)
                        known[identity]=event.event_id
                        if next_offsets is not None:offsets[identity]=next_offsets
                    if len(page.tasks)<100:break
                    offset+=len(page.tasks)
    return {'known':known,'offsets':offsets}
