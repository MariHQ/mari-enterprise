#!/usr/bin/env python3
"""Thin client for native AX guest I/O and Substrate snapshot forks (no controller)."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
PROTO = ROOT / '.artifacts/workspace-proto'
if not (PROTO / 'guest_pb2.py').exists():
    PROTO.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, '-m', 'grpc_tools.protoc', '-I', str(ROOT/'infra/ax/proto'),
                    '--python_out='+str(PROTO), '--grpc_python_out='+str(PROTO),
                    str(ROOT/'infra/ax/proto/guest.proto'), str(ROOT/'infra/ax/proto/ax.proto')], check=True)
sys.path.insert(0, str(PROTO))
import grpc
import guest_pb2 as guest
import guest_pb2_grpc as guest_rpc
import ax_pb2 as ax
import ax_pb2_grpc as ax_rpc
from google.protobuf.duration_pb2 import Duration
from github_auth import load_token

AUTH_PROGRAM = Path(__file__).with_name('github_auth.py').read_text()


def activate(actor):
    """Let native HTTP activation finish before a guest command or snapshot."""
    metadata = (('ate-target-actor', 'mari/'+actor),)
    router = os.getenv('SUBSTRATE_ROUTER', 'localhost:18081')
    # Native HTTP activation waits for readiness; cold gRPC calls can fail before dispatch.
    request = urllib.request.Request('http://'+router+'/readyz', headers=dict(metadata))
    deadline = time.monotonic() + 360
    while True:
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                if response.status != 200: raise RuntimeError('Actor guest services are not ready')
            return
        except urllib.error.HTTPError as error:
            # The router can time out while native cold activation continues.
            # Retry only this read; never replay a guest process invocation.
            if error.code not in (503, 504) or time.monotonic() >= deadline:
                raise
            time.sleep(2)


def execute(actor, command, data=None, timeout=1800):
    """Route directly through Substrate, which resumes the actor on demand."""
    activate(actor)
    metadata = (('ate-target-actor', 'mari/'+actor),)
    router = os.getenv('SUBSTRATE_ROUTER', 'localhost:18081')
    with grpc.insecure_channel(router) as channel:
        api = guest_rpc.ProcessServiceStub(channel)
        process = api.StartProcess(guest.StartProcessRequest(command=command, cwd='/workspace/mari',
                    stdin=data is not None, timeout=Duration(seconds=timeout)), metadata=metadata, timeout=180)
        if data is not None:
            def chunks():
                for offset in range(0, len(data), 65536):
                    yield guest.WriteProcessInputRequest(process_id=process.process_id, data=data[offset:offset+65536])
                yield guest.WriteProcessInputRequest(process_id=process.process_id, close=True)
            api.WriteProcessInput(chunks(), metadata=metadata, timeout=180)
        return follow_process(api, process.process_id, metadata, timeout)


def follow_process(api, process_id, metadata, timeout):
    """Reconnect a read-only output stream; never replay the started command."""
    offsets = [0, 0]
    deadline = time.monotonic()+timeout+30
    while time.monotonic()<deadline:
        try:
            for output in api.StreamProcessOutput(guest.StreamProcessOutputRequest(
                    process_id=process_id, follow=True, stdout_offset=offsets[0], stderr_offset=offsets[1]),
                    metadata=metadata, timeout=min(240, max(1,deadline-time.monotonic()))):
                sys.stdout.buffer.write(output.stdout); sys.stdout.buffer.flush()
                sys.stderr.buffer.write(output.stderr); sys.stderr.buffer.flush()
                offsets[0] += len(output.stdout); offsets[1] += len(output.stderr)
                if output.HasField('exit'): return output.exit.exit_code
            raise RuntimeError('Guest stream ended without an exit status: '+process_id)
        except grpc.RpcError as error:
            if error.code() not in (grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.DEADLINE_EXCEEDED): raise
            time.sleep(1)
    raise TimeoutError('Guest process output deadline exceeded: '+process_id)


def fork(parent, child):
    """Native suspend → tag → create; AX adopts the new actor without copying files."""
    import re
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,47}', child) or child == parent:
        raise ValueError('Choose a distinct DNS-label fork name')
    ate = [os.getenv('ATE_CLI', str(Path.home()/'sub/bin/kubectl-ate')),
           '--context', os.getenv('SUBSTRATE_CONTEXT', 'kind-agent-substrate')]
    def native(*args, capture=False):
        return subprocess.run(ate+list(args), check=True, text=True,
                              stdout=subprocess.PIPE if capture else None).stdout
    def call(method, request):
        with grpc.insecure_channel(os.getenv('AX_ENDPOINT', 'localhost:18080')) as channel:
            return getattr(ax_rpc.AXStub(channel), method)(request, timeout=30)
    task = call('GetTask', ax.GetTaskRequest(atespace='mari', name=parent))
    try:
        call('GetTask', ax.GetTaskRequest(atespace='mari', name=child))
    except grpc.RpcError as error:
        if error.code() != grpc.StatusCode.NOT_FOUND: raise
    else:
        raise ValueError('Fork task already exists; refusing to overwrite it')
    # A just-updated template must run before its snapshot can seed that template.
    activate(parent)
    call('SuspendTask', ax.SuspendTaskRequest(atespace='mari', name=parent))
    try:
        deadline = time.monotonic()+180
        while True:
            state = json.loads(native('get','actor',parent,'-a','mari','-o','json',capture=True))
            if state['status']['state'] == 'ACTOR_STATE_SUSPENDED': break
            if time.monotonic() > deadline: raise TimeoutError('Source did not stay suspended; stop its traffic and retry')
            time.sleep(2)
        tag = child+'-'+str(int(time.time()))
        native('create','tag',tag,'-a','mari','--actor',parent)
        template = state['actorTemplate']
        native('create','actor',child,'-a','mari','--template',template['atespace']+'/'+template['name'],'--tag',tag)
        child_task = ax.Task(); child_task.CopyFrom(task)
        child_task.metadata.name = child; child_task.metadata.ClearField('creation_timestamp')
        child_task.ClearField('status'); child_task.spec.suspend = True
        # Publish a cold-boot fork template before its first activation. Inherited
        # production workers must never briefly consume their parent's queue.
        retained = [e for e in child_task.spec.env if e.name != 'MARI_APP_REGISTRATION']
        del child_task.spec.env[:]; child_task.spec.env.extend(retained)
        for env in child_task.spec.env:
            if env.name == 'MARI_APP_WORKER_ENABLED': env.value = 'false'
            elif env.name == 'TEMPORAL_TASK_QUEUE': env.value = 'mari-app-'+child
        repositories = []
        for index, binding in enumerate(child_task.spec.workspaces):
            workspace = call('GetWorkspace', ax.GetWorkspaceRequest(atespace='mari', name=binding.name))
            if not workspace.spec.git: continue
            workspace.metadata.name = child if index == 0 else child+'-'+str(index)
            workspace.metadata.ClearField('creation_timestamp')
            for repo in workspace.spec.git:
                repo.branch = 'workspaces/'+child
                repositories.append(str(Path(binding.path)/repo.dir))
            call('UpdateWorkspace', ax.UpdateWorkspaceRequest(workspace=workspace))
            binding.name = workspace.metadata.name
        call('UpdateTask', ax.UpdateTaskRequest(task=child_task))
        from ready import promote
        promote([child])
        call('ResumeTask', ax.ResumeTaskRequest(atespace='mari', name=child))
    finally:
        call('ResumeTask', ax.ResumeTaskRequest(atespace='mari', name=parent))
    if repositories:
        deadline = time.monotonic()+180
        while True:
            child_state = json.loads(native('get','actor',child,'-a','mari','-o','json',capture=True))
            if child_state['status']['state'] == 'ACTOR_STATE_RUNNING': break
            if time.monotonic() > deadline: raise TimeoutError('Fork exists but has not become ready')
            time.sleep(2)
        program = """import json,sys,subprocess
from pathlib import Path
request=json.load(sys.stdin)
for path in request['repositories']:
 subprocess.run(['git','-C',path,'switch','-c',request['branch']],check=True)
 subprocess.run(['git','-C',path,'config','push.autoSetupRemote','true'],check=True)
with Path('/workspace/mari/AGENTS.md').open('a') as out:
 out.write('\\nThis fork archives directly to branch '+request['branch']+'. No PR is required.\\n')
"""
        if execute(child,['python','-c',program],json.dumps({'repositories':repositories,'branch':'workspaces/'+child}).encode()):
            raise RuntimeError('Fork exists, but archive branches need repair before coding')
    print(json.dumps({'actor':'mari/'+child,'parent':'mari/'+parent,'source_tag':tag,
                      'workspace':'/workspace/mari','owner_agent':'mari/'+child}))


def code(actor, prompt, budget):
    """Run the installed coding harness with persistent context and transient auth."""
    import base64
    token = os.getenv('CLAUDE_CODE_OAUTH_TOKEN')
    if not token:
        record = json.loads(subprocess.check_output(['kubectl','--context','docker-desktop','-n','stack',
                                                     'get','secret','mari-worker','-o','json']))
        token = base64.b64decode(record['data']['CLAUDE_CODE_OAUTH_TOKEN']).decode()
    program = AUTH_PROGRAM + "\n" + """import json,sys,os,subprocess,time
from pathlib import Path
request=json.load(sys.stdin)
command=['claude','-p','Read AGENTS.md first. '+request['prompt'],'--model','sonnet',
         '--permission-mode','acceptEdits','--allowedTools','Read,Edit,Write,Bash',
         '--max-budget-usd',str(request['budget']),'--output-format','json']
if any(Path('/workspace/agent/claude/projects').glob('*/*.jsonl')): command.append('--continue')
result=subprocess.run(command,env=dict(github_environment(request['github_token']),CLAUDE_CODE_OAUTH_TOKEN=request['token'],
                      **request.get('browser',{})),
                      cwd='/workspace/mari',capture_output=True,text=True)
Path('/workspace/agent/result-'+str(time.time_ns())+'.json').write_text(result.stdout)
try:
 report=json.loads(result.stdout)
 print(report.get('result',''))
 failed=report.get('is_error',False)
except ValueError:
 print('Coding harness returned invalid JSON; inspect workspace agent output.');failed=True
sys.exit(result.returncode or int(failed))
"""
    browser = {}
    endpoint = ROOT/'.artifacts/browser-endpoint.json'
    if endpoint.exists():
        config = json.loads(endpoint.read_text())
        browser = {'MARI_BROWSER_WS_ENDPOINT':config['endpoint'],'MARI_BROWSER_ORIGIN':config['origin']}
    return execute(actor, ['python','-c',program], json.dumps({'token':token,'github_token':load_token(),
                                    'prompt':prompt,'budget':budget,'browser':browser}).encode())


def git_archive(actor, app, command):
    """Run Git in an app checkout using the same transient archive credential."""
    import re
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,47}', app):
        raise ValueError('App must be a DNS label')
    if command and command[0] == '--': command = command[1:]
    if not command: raise ValueError('Supply a Git command')
    program = AUTH_PROGRAM + "\n" + """request=json.load(sys.stdin)
sys.exit(subprocess.run(['git','-C','/workspace/mari/apps/'+request['app']]+request['command'],
                       env=github_environment(request['token'])).returncode)
"""
    return execute(actor, ['python','-c',program], json.dumps({'token':load_token(),'app':app,'command':command}).encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action',required=True)
    run = sub.add_parser('exec'); run.add_argument('actor'); run.add_argument('--stdin',action='store_true'); run.add_argument('command',nargs=argparse.REMAINDER)
    branch = sub.add_parser('fork'); branch.add_argument('parent'); branch.add_argument('child')
    agent = sub.add_parser('code'); agent.add_argument('actor'); agent.add_argument('prompt'); agent.add_argument('--budget',type=float,default=3)
    archive = sub.add_parser('git'); archive.add_argument('actor'); archive.add_argument('app'); archive.add_argument('command',nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.action == 'fork': fork(args.parent,args.child)
    elif args.action == 'code': raise SystemExit(code(args.actor,args.prompt,args.budget))
    elif args.action == 'git': raise SystemExit(git_archive(args.actor,args.app,args.command))
    else:
        command = args.command
        if command and command[0] == '--': command = command[1:]
        if not command: parser.error('Supply a command after --')
        raise SystemExit(execute(args.actor,command,sys.stdin.buffer.read() if args.stdin else None))

if __name__ == '__main__': main()
