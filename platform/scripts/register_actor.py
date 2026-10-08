#!/usr/bin/env python3
"""Register the immutable miner template and actor in Agent Substrate."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import yaml
ROOT=Path(__file__).resolve().parents[3]
def main():
    p=argparse.ArgumentParser();p.add_argument('--wait',type=int,default=300);a=p.parse_args()
    state=ROOT/'.platform-state';deployment=json.loads((state/'deployment.json').read_text())
    env={**os.environ,'KUBECONFIG':str(ROOT/deployment['kubeconfig'])}
    cli=[str(ROOT/'.platform-tools/kubectl-ate'),'--context',deployment['context']]
    def call(args,**kw):return subprocess.run(cli+args,env=env,text=True,capture_output=True,**kw)
    def ensure(args):
        r=call(args)
        if r.returncode and 'AlreadyExists' not in r.stderr:raise RuntimeError(r.stderr)
    cloud=json.loads((state/'cloud.json').read_text());images=json.loads((state/'images.json').read_text())
    actor_name='miner'
    workspace=deployment.get('substrate_workspace',{})
    space=workspace.get('space','mari')
    pool=workspace.get('pool','mari-agents')
    template=yaml.safe_load((ROOT/'mari/platform/substrate'/'actor-template.yaml').read_text())
    template['metadata']['atespace']=space
    template['workerSelector']['matchLabels']['workload']=pool
    image=images['localhost:5001/mari-miner:local'];template['containers'][0]['image']=image
    name=actor_name+'-'+hashlib.sha256(json.dumps(template,sort_keys=True).encode()).hexdigest()[:12]
    template['metadata']['name']=name
    template['snapshotsConfig']['storageLocation']='gs://'+cloud['bucket']+'/'+workspace.get('storage_prefix','substrate/mari/')
    path=state/'actor-template.yaml';path.write_text(yaml.safe_dump(template))
    ensure(['create','atespace',space]);ensure(['create','actor-template','-f',str(path)])
    deadline=time.time()+a.wait
    while time.time()<deadline:
        r=call(['get','actor-template',name,'-a',space,'-o','yaml'])
        if r.returncode:raise RuntimeError(r.stderr)
        data=yaml.safe_load(r.stdout)
        templates=data.get('actorTemplates',[])
        if templates and templates[0].get('status',{}).get('goldenSnapshotStatus',{}).get('goldenSnapshot',{}).get('snapshotUri'):
            break
        time.sleep(3)
    else:raise RuntimeError('Miner golden snapshot did not become ready; inspect actor-template '+name)
    ensure(['create','actor',actor_name,'--template='+name,'-a',space])
    r=call(['get','actor',actor_name,'-a',space,'-o','yaml'])
    actor=yaml.safe_load(r.stdout)['actors'][0]
    if actor['actorTemplate']['name']!=name:
        raise RuntimeError('Existing miner uses another immutable template; explicitly migrate or recreate it before registering this version')
    r=call(['resume','actor',actor_name,'-a',space],timeout=a.wait)
    if r.returncode:raise RuntimeError(r.stderr)
    print('Substrate actor registered: '+space+'/'+actor_name+' (template '+name+')')
if __name__=='__main__':main()
