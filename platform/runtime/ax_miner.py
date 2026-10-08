"""Launch the decision extractor in AX's existing Substrate guest service."""
import asyncio
import json
import os
import grpc
from temporalio import activity

async def run_miner(request):
    import ax_pb2 as ax, ax_pb2_grpc as arpc
    import guest_pb2 as guest, guest_pb2_grpc as grpc_guest
    from google.protobuf.duration_pb2 import Duration
    token=os.environ.get('CLAUDE_CODE_OAUTH_TOKEN')
    if not token:raise RuntimeError('Configure CLAUDE_CODE_OAUTH_TOKEN for the Claude subscription miner')
    image=os.environ['AX_MINER_IMAGE']
    endpoint=os.getenv('AX_ENDPOINT','ax-server.ax-system.svc.cluster.local:8080')
    space=os.getenv('AX_MINER_ATESPACE','opendots');name='decision-miner'
    async with grpc.aio.insecure_channel(endpoint) as channel:
        client=arpc.AXStub(channel)
        try:task=await client.GetTask(ax.GetTaskRequest(atespace=space,name=name),timeout=10)
        except grpc.aio.AioRpcError as error:
            if error.code()!=grpc.StatusCode.NOT_FOUND:raise
            task=None
        if task is None or task.spec.image!=image:
            task=await client.UpdateTask(ax.UpdateTaskRequest(task=ax.Task(api_version='ax.io/v1alpha1',kind='Task',
                metadata=ax.ObjectMeta(atespace=space,name=name),spec=ax.TaskSpec(image=image,debug=True,
                resources=ax.ResourceReqs(limits=ax.ResourceList(cpu='1',memory='1Gi'))))),timeout=15)
        if task.spec.suspend:await client.ResumeTask(ax.ResumeTaskRequest(atespace=space,name=name),timeout=15)
        for _ in range(90):
            activity.heartbeat('Waiting for AX decision miner')
            task=await client.GetTask(ax.GetTaskRequest(atespace=space,name=name),timeout=10)
            if task.status.worker_ip:break
            await asyncio.sleep(2)
        else:raise RuntimeError('AX decision miner did not become ready')
    router=os.getenv('SUBSTRATE_ROUTER','http://atenet-router.ate-system.svc.cluster.local').removeprefix('http://')
    if ':' not in router:router+=':80'
    metadata=(('ate-target-actor',space+'/'+(task.status.actor or name)),)
    async with grpc.aio.insecure_channel(router) as channel:
        process_api=grpc_guest.ProcessServiceStub(channel)
        process=await process_api.StartProcess(guest.StartProcessRequest(command=['python3','/app/decision_miner.py'],
            stdin=True,timeout=Duration(seconds=1200)),metadata=metadata,timeout=15)
        data=json.dumps({**request,'claude_oauth_token':token,'model':os.getenv('CLAUDE_MINER_MODEL','sonnet')}).encode()
        async def chunks():
            for offset in range(0,len(data),65536):
                yield guest.WriteProcessInputRequest(process_id=process.process_id,data=data[offset:offset+65536])
            yield guest.WriteProcessInputRequest(process_id=process.process_id,close=True)
        await process_api.WriteProcessInput(chunks(),metadata=metadata,timeout=30)
        output=bytearray();code=None
        async def heartbeat():
            while True:
                activity.heartbeat('Claude Code decision extraction in AX')
                await asyncio.sleep(20)
        heart=asyncio.create_task(heartbeat())
        try:
            async for chunk in process_api.StreamProcessOutput(guest.StreamProcessOutputRequest(
                process_id=process.process_id,follow=True),metadata=metadata,timeout=1220):
                output.extend(chunk.stdout)
                if len(output)>2_000_000:raise ValueError('Miner output exceeded size limit')
                if chunk.HasField('exit'):code=chunk.exit.exit_code
        finally:
            heart.cancel()
        if code!=0:raise RuntimeError('AX decision miner failed; no revisions were acknowledged')
        return json.loads(output)['candidates']
