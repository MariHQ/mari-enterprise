#!/usr/bin/env python3
"""Seed app workspaces once; native AX prepares repositories, Substrate runs them."""
import argparse
from copy import deepcopy
import base64
import io
import json
from pathlib import Path
import subprocess
import tarfile
import time
import yaml
from google.protobuf.json_format import ParseDict
from client import ROOT, AUTH_PROGRAM, ax, ax_rpc, execute, grpc
from github_auth import load_token


def secret(name):
    data=json.loads(subprocess.check_output(['kubectl','--context','docker-desktop','-n','stack',
                                            'get','secret',name,'-o','json']))
    return {k:base64.b64decode(v).decode() for k,v in data['data'].items()}


def documents(name, image, manifests=None):
    workspace,task=deepcopy(manifests) if manifests else list(yaml.safe_load_all((ROOT/f'apps/{name}/workspace/task.yaml').read_text()))
    runtime=secret('mari-runtime');catalog=secret('orchid-catalog')
    if runtime.get('MARI_STORAGE')!='postgres': raise ValueError('This deployment uses PostgreSQL bindings')
    env={k:runtime[k] for k in ('MARI_APP_GRANT_SECRET','MARI_KNOWLEDGE_PROJECT_ID','MARI_STORAGE','MARI_POSTGRES_DSN') if k in runtime}
    env.update(MARI_APP_ID=name,ORCHID_GRAPH=name.replace('-','_'),ORCHID_CATALOG_CLIENT_ID='admin',
               ORCHID_CATALOG_CLIENT_SECRET=catalog['admin.secret'],ORCHID_CATALOG_URL='http://host.docker.internal:30182',
               KAFKA_BOOTSTRAP_SERVERS='host.docker.internal:30993',SCHEMA_REGISTRY_URL='http://host.docker.internal:30881',
               TEMPORAL_ADDRESS='host.docker.internal:30733',MARI_STATIC_DIR=f'/workspace/mari/apps/{name}/web/dist',
               GIT_TERMINAL_PROMPT='0')
    env['MARI_POSTGRES_DSN']=env['MARI_POSTGRES_DSN'].replace('postgres.stack.svc:5432','host.docker.internal:30432')
    task['spec']['image']=image
    task['spec']['env']=[{'name':k,'value':v} for k,v in env.items()]
    return workspace,task


def support_files(actor):
    archive=io.BytesIO()
    def keep(item):
        if any(p in ('node_modules','__pycache__','.git','.venv','.preview','dist') for p in Path(item.name).parts): return None
        item.uid=item.gid=0;item.uname=item.gname='root'
        return item
    with tarfile.open(fileobj=archive,mode='w:gz') as tar:
        for path in ('vendor/mari-design/components',):
            tar.add(ROOT/path,arcname=path,filter=keep)
        for path in ('design-system/SKILL.md','BRAND-STYLE-GUIDE.md'):
            tar.add(ROOT.parent/'mari-design'/path,arcname='mari-design/'+path,filter=keep)
    if execute(actor,['tar','xzf','-','--no-same-owner','-C','/workspace/mari'],archive.getvalue()):
        raise RuntimeError('Support file upload failed')


def prepare(name, image, manifests=None, bindings=None):
    workspace,task=documents(name,image,manifests)
    if bindings:
        env={e["name"]:e["value"] for e in task["spec"]["env"]}
        env.update(bindings)
        task["spec"]["env"]=[{"name":k,"value":v} for k,v in env.items()]
    with grpc.insecure_channel('localhost:18080') as channel:
        api=ax_rpc.AXStub(channel)
        try: api.GetTask(ax.GetTaskRequest(atespace='mari',name=name),timeout=15)
        except grpc.RpcError as error:
            if error.code()!=grpc.StatusCode.NOT_FOUND: raise
        else: raise RuntimeError(name+' already exists; refusing to reseed it')
        api.UpdateWorkspace(ax.UpdateWorkspaceRequest(workspace=ParseDict(workspace,ax.Workspace())),timeout=20)
        api.UpdateTask(ax.UpdateTaskRequest(task=ParseDict(task,ax.Task())),timeout=30)
        deadline=time.monotonic()+300
        while api.GetTask(ax.GetTaskRequest(atespace='mari',name=name),timeout=15).status.phase!='Running':
            if time.monotonic()>deadline: raise TimeoutError(name+': AX task did not become ready')
            time.sleep(2)
    # Use AX's native repository setup with a credential that exists only in this process.
    program=AUTH_PROGRAM+'\n'+'''request=json.load(sys.stdin)
subprocess.run(['/usr/local/bin/ax-task-runner-bin','--prepare-only',
                '--state-dir=/workspace/agent/ax'],env=github_environment(request['token']),check=True)
for name in request['repositories']:
 path='/workspace/mari/apps/'+name
 for args in (['switch','-C','main','--track','origin/main'],['config','user.name','Mari '+request['app']+' agent'],
              ['config','user.email',request['app']+'@agents.mari.local'],['config','push.autoSetupRemote','true']):
  subprocess.run(['git','-C',path]+args,check=True)
'''
    if execute(name,['python','-c',program],json.dumps({'token':load_token(),'app':name,
                                                     'repositories':[r['name'] for r in workspace['spec']['git']]}).encode()):
        raise RuntimeError(name+': native repository setup failed')
    support_files(name)


def bootstrap(name, image):
    prepare(name,image)
    setup=f'''set -eu
test -e apps/base/web/node_modules || ln -s /opt/mari-web/node_modules apps/base/web/node_modules
test -e mari-design/components || ln -s ../vendor/mari-design/components mari-design/components
cp apps/{name}/AGENTS.md AGENTS.md
node apps/base/web/build.mjs build apps/{name}
touch /workspace/agent/app-ready
'''
    if execute(name,['sh','-ec',setup]): raise RuntimeError(name+': workspace build failed')
    from ready import promote
    promote([name],image=image)
    # Demand-routing now waits for the actual app, not the bootstrap health server.
    if execute(name,['python','-c',"import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/healthz').status)"]):
        raise RuntimeError(name+': app did not become healthy')
    print(name+': native AX repositories prepared; workspace app is serving',flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apps',nargs='+');parser.add_argument('--image',required=True)
    args=parser.parse_args()
    if '@sha256:' not in args.image: parser.error('Supply a pinned toolchain image')
    known={a['id'] for a in json.loads((ROOT/'container/apps.json').read_text())['apps']}
    if not set(args.apps)<=known: parser.error('Use registered app IDs')
    for name in args.apps: bootstrap(name,args.image)


if __name__=='__main__': main()
