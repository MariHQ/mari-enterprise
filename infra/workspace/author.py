#!/usr/bin/env python3
"""Author and publish an app using a native AX task and durable workspace."""
import argparse
import io
import json
import re
import tarfile
from pathlib import Path

import yaml
from client import ROOT, ax, ax_rpc, grpc, execute, code
from bootstrap import prepare, secret

IMAGE = 'localhost:5001/mari/workspace@sha256:231b33b80fcef4cf9b238607423b2a6ab99b45d50617e5172cdbb8743009bf4e'


def upload(actor, files):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w:gz') as archive:
        for name, contents in files.items():
            data = contents.encode() if isinstance(contents, str) else contents
            item = tarfile.TarInfo(name); item.size = len(data)
            archive.addfile(item, io.BytesIO(data))
    if execute(actor, ['tar', 'xzf', '-', '-C', '/workspace/mari'], buffer.getvalue()):
        raise RuntimeError('Workspace upload failed')


def initialize(name, repository, image, slack=False):
    import subprocess
    from github_auth import github_environment, load_token
    check=subprocess.run(['git','ls-remote','--exit-code',repository,'refs/heads/main'],
                         env=github_environment(load_token()),capture_output=True)
    if check.returncode: raise ValueError('Archive must have a main branch and shared token access; no workspace was created')
    workspace, task = list(yaml.safe_load_all((ROOT/'apps/sources/workspace/task.yaml').read_text()))
    for item in (workspace, task): item['metadata']['name'] = name
    workspace['spec']['git'][0].update(name=name, repo=repository, dir='apps/'+name)
    task['spec']['workspaces'][0]['name'] = name
    task['spec']['image'] = image
    task['spec']['env'] = [{'name':'MARI_APP_ID','value':name},
        {'name':'MARI_STATIC_DIR','value':f'/workspace/mari/apps/{name}/web/dist'},
        {'name':'TEMPORAL_TASK_QUEUE','value':'mari-app-'+name},
        {'name':'MARI_APP_WORKER_ENABLED','value':'false'}]
    # Requirements are installed into the durable app directory, surviving resume.
    task['spec']['command'][2] = task['spec']['command'][2].replace(
        'exec python -m uvicorn', 'export PYTHONPATH="/workspace/mari/apps/${MARI_APP_ID}/.deps:${PYTHONPATH}"\nexec python -m uvicorn')
    bindings = {'ORCHID_GRAPH': 'temporal', 'TEMPORAL_TASK_QUEUE': 'mari-app-'+name,
                'MARI_APP_WORKER_ENABLED': 'false'}
    if slack:
        credentials = secret('mari-worker')
        bindings.update({key: credentials[key] for key in ('SLACK_BOT_TOKEN', 'SLACK_TEAM_ID')})
    prepare(name, image, [workspace, task], bindings)
    instructions = (ROOT/'apps/sources/AGENTS.md').read_text().replace('sources', name)
    instructions += '\n'+Path(__file__).with_name('AUTHORING.md').read_text()
    upload(name, {f'apps/{name}/AGENTS.md': instructions, 'AGENTS.md': instructions,
                  f'apps/{name}/.gitignore': '.deps/\n__pycache__/\nweb/dist/\nnode_modules\n.env*\n',
                  f'apps/{name}/app.json': json.dumps({'id':name,'name':name.replace('-',' ').capitalize(),
                    'description':'','routes':['/'+name],'icon':'app','methods':['GET','HEAD']}, indent=2),
                  f'apps/{name}/workspace/task.yaml': yaml.safe_dump_all([workspace,task])})
    if slack:
        references={f'reference/temporal/{p}.py':(ROOT/f'temporal/{p}.py').read_bytes()
                    for p in ('connectors','discovery','schedules','evidence','ontology')}
        references['reference/normalizer.py']=(ROOT/'vendor/mari-kit-runtime/src/mari_kit/ingestion.py').read_bytes()
        upload(name,references)
    if execute(name,['sh','-ec', 'test -e apps/base/web/node_modules || ln -s /opt/mari-web/node_modules apps/base/web/node_modules; test -e mari-design/components || ln -s ../vendor/mari-design/components mari-design/components']):
        raise RuntimeError('Workspace dependencies unavailable')


def install_tools(name):
    import os, subprocess
    binary=ROOT/'.artifacts/ax-linux-arm64'
    if not binary.exists():
        subprocess.run(['go','build','-o',str(binary),'./cmd/ax'],
            cwd=Path.home()/'sub/ax',check=True,
            env=dict(os.environ,GOTOOLCHAIN='auto',GOOS='linux',GOARCH='arm64',CGO_ENABLED='0'))
    files={'tools/ax':binary.read_bytes(),
           'tools/CAPABILITIES.md':Path(__file__).with_name('CAPABILITIES.md').read_bytes()}
    for filename in ('client.py','github_auth.py'):
        files['infra/workspace/'+filename]=Path(__file__).with_name(filename).read_bytes()
    for filename in ('ax_pb2.py','ax_pb2_grpc.py','guest_pb2.py','guest_pb2_grpc.py'):
        files['.artifacts/workspace-proto/'+filename]=(Path(__file__).with_name('protocol')/filename).read_bytes()
    upload(name,files)
    if execute(name,['sh','-ec','chmod +x tools/ax; python -m pip install --quiet --root-user-action=ignore --target /workspace/agent/tools/python grpcio==1.76.0 protobuf==6.33.6']):
        raise RuntimeError('Agent tools installation failed')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('name');parser.add_argument('--repo')
    parser.add_argument('--prompt');parser.add_argument('--prompt-file',type=Path)
    parser.add_argument('--image',default=IMAGE);parser.add_argument('--budget',type=float,default=10)
    parser.add_argument('--slack',action='store_true',help='Bind existing Slack credentials')
    parser.add_argument('--phase',choices=['all','init','code'],default='all')
    args=parser.parse_args()
    if '@sha256:' not in args.image: parser.error('Use a pinned toolchain image')
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,47}',args.name): parser.error('Use a DNS-label app ID')
    if args.phase in ('all','init'):
        if not args.repo or not re.fullmatch(r'https://github.com/MariHQ/mari-app-[a-z0-9-]+(?:\.git)?',args.repo):
            parser.error('Supply an initialized MariHQ app repository accessible to the shared token')
        initialize(args.name,args.repo,args.image,args.slack)
        install_tools(args.name)
    if args.phase in ('all','code'):
        prompt=args.prompt_file.read_text() if args.prompt_file else args.prompt
        if not prompt: parser.error('Supply --prompt or --prompt-file')
        from browser import ensure_browser
        ensure_browser()
        prompt+='\nRead tools/CAPABILITIES.md. Complete implementation, tests, serving, native AX app registration, browser checks and direct Git archiving yourself. Do not leave publication or verification for the host assistant. Record your actual checks and limitations.'
        if code(args.name,prompt,args.budget): raise SystemExit('Agent did not complete; inspect its workspace and continue with --phase code')



if __name__=='__main__': main()
