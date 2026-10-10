#!/usr/bin/env python3
"""One-time native serving-template promotion after workspace seeding."""
import json
import hashlib
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import yaml
from client import PROTO, grpc, ax, ax_rpc
from google.protobuf.json_format import MessageToDict


def promote(names, image=None):
    source=Path(os.getenv('SUBSTRATE_SOURCE',str(Path.home()/'sub/substrate')))/'pkg/proto/ateapipb'
    subprocess.run([sys.executable,'-m','grpc_tools.protoc','-I',str(source),
                    '--python_out='+str(PROTO),'--grpc_python_out='+str(PROTO),str(source/'ateapi.proto')],check=True)
    import ateapi_pb2 as ate
    import ateapi_pb2_grpc as rpc
    k=['kubectl','--context',os.getenv('SUBSTRATE_CONTEXT','kind-agent-substrate')]
    bundles=json.loads(subprocess.check_output(k+['get','clustertrustbundles','-l','podcert.ate.dev/canarying=live','-o','json']))
    roots=''.join(b['spec']['trustBundle'] for b in bundles['items'] if b['spec']['signerName']=='servicedns.podcert.ate.dev/identity').encode()
    if not roots: raise RuntimeError('Substrate serving certificate trust bundle missing')
    # This is a kubectl argument list, not a credential literal.
    credential_command=k+['-n','ate-system','create','token','ate-client','--audience=api.ate-system.svc','--duration=10m'] # gitleaks:allow
    token=subprocess.check_output(credential_command,text=True).strip()
    with socket.socket() as sock: sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    forward=subprocess.Popen(k+['-n','ate-system','port-forward','svc/api',f'{port}:443'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        credentials=grpc.composite_channel_credentials(grpc.ssl_channel_credentials(roots),grpc.access_token_call_credentials(token))
        with grpc.secure_channel(f'127.0.0.1:{port}',credentials,options=[('grpc.ssl_target_name_override','api.ate-system.svc')]) as channel:
            grpc.channel_ready_future(channel).result(timeout=20)
            api=rpc.ControlStub(channel)
            for name in names:
                ref=ate.ObjectRef(atespace='mari',name=name)
                actor=api.GetActor(ate.GetActorRequest(actor=ref),timeout=15)
                template=api.GetActorTemplate(ate.GetActorTemplateRequest(actor_template=actor.actor_template),timeout=15)
                with grpc.insecure_channel(os.getenv('AX_ENDPOINT','localhost:18080')) as ax_channel:
                    ax_api=ax_rpc.AXStub(ax_channel)
                    task=ax_api.GetTask(ax.GetTaskRequest(atespace='mari',name=name),timeout=15)
                    task.ClearField('status');task.metadata.ClearField('creation_timestamp')
                    workspaces=[ax_api.GetWorkspace(ax.GetWorkspaceRequest(atespace='mari',name=w.name),timeout=15)
                                for w in task.spec.workspaces]
                identity=hashlib.sha256(task.SerializeToString()+b''.join(w.SerializeToString() for w in workspaces)+(image or '').encode()+b'ready-timeout-300').hexdigest()[:8]
                target=name+'-ready-'+identity
                if template.metadata.name==target:
                    print(name+': already uses app readiness');continue
                new=ate.ActorTemplate();new.CopyFrom(template)
                new.ClearField('status');new.ClearField('metadata')
                new.metadata.atespace='mari';new.metadata.name=target
                if image: new.containers[0].image=image
                new.containers[0].readyz.http_get.path='/healthz';new.containers[0].readyz.http_get.port=8080
                new.containers[0].readyz.timeout_seconds=300
                new.snapshots_config.on_resume.from_data=ate.RESUME_SOURCE_COLD_BOOT
                # A template's empty golden/bootstrap sandbox needs only tool access.
                # Normal data resumes cold-boot with source present and probe the app.
                for env in new.containers[0].env:
                    if env.name=='AX_TASK_YAML':
                        env.value=yaml.safe_dump(MessageToDict(task))
                    elif env.name=='AX_WORKSPACES_YAML':
                        env.value=yaml.safe_dump_all([MessageToDict(w) for w in workspaces])
                try: api.CreateActorTemplate(ate.CreateActorTemplateRequest(actor_template=new),timeout=30)
                except grpc.RpcError as error:
                    if error.code()!=grpc.StatusCode.ALREADY_EXISTS: raise
                deadline=time.monotonic()+180
                while actor.status.state==ate.ACTOR_STATE_RESUMING:
                    if time.monotonic()>deadline: raise TimeoutError('Actor is still resuming; retry when it settles')
                    time.sleep(2);actor=api.GetActor(ate.GetActorRequest(actor=ref),timeout=15)
                if actor.status.state==ate.ACTOR_STATE_CRASHED:
                    api.RevertActor(ate.RevertActorRequest(actor=ref),timeout=180)
                elif actor.status.state!=ate.ACTOR_STATE_SUSPENDED:
                    api.SuspendActor(ate.SuspendActorRequest(actor=ref),timeout=180)
                actor=api.GetActor(ate.GetActorRequest(actor=ref),timeout=15)
                actor.actor_template.CopyFrom(ate.ObjectRef(atespace='mari',name=new.metadata.name))
                api.UpdateActor(ate.UpdateActorRequest(actor=actor),timeout=30)
                print(name+': workspace retained; native readiness now probes the app on port 8080')
    finally:
        forward.terminate();forward.wait(timeout=10)

if __name__=='__main__': promote(sys.argv[1:] or ['lineage'])
