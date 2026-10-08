#!/usr/bin/env python3
"""Build, publish and reconcile the platform on an explicitly selected cluster."""
import argparse
import os
from pathlib import Path
import subprocess
import sys
import json
import time
ROOT=Path(__file__).resolve().parents[3]
def main():
    from platform_config import load_platform
    load_platform(ROOT/"mari/platform/config/platform.json")
    from local_env import load_local_env
    load_local_env()
    p=argparse.ArgumentParser();p.add_argument('--context',required=True);p.add_argument('--kubeconfig',required=True);p.add_argument('--substrate-source',type=Path,required=True);p.add_argument('--orchiddb-wheel',type=Path,required=True)
    a=p.parse_args();source=a.substrate_source.resolve();kubeconfig=str(Path(a.kubeconfig).resolve())
    import hashlib, shutil, tempfile
    wheel=a.orchiddb_wheel.resolve()
    pins=json.loads((ROOT/'mari/platform/config/orchiddb.json').read_text())['wheels']
    if not any(wheel.name==pin['file'] and hashlib.sha256(wheel.read_bytes()).hexdigest()==pin['sha256'] for pin in pins.values()):
        raise RuntimeError('OrchidDB wheel does not match the pinned artifact')
    def run(cmd,**kw):subprocess.run(cmd,check=True,cwd=ROOT,**kw)
    k=['kubectl','--kubeconfig',kubeconfig,'--context',a.context]
    run(k+['get','nodes','--request-timeout=10s'])
    if not (ROOT/'.platform-state/cloud.json').exists():run([sys.executable,'mari/platform/scripts/provision_s3.py'])
    run([str(ROOT/'.platform-tools/flux'),'--kubeconfig',kubeconfig,'--context',a.context,'install','--components=source-controller,kustomize-controller,helm-controller'])
    for name,dockerfile in [('mari-runtime','mari/platform/Dockerfile'),('mari-flink','mari/platform/flink/Dockerfile'),('mari-ax-miner','mari/platform/ax/Miner.Dockerfile'),('mari-compaction','mari/platform/maintenance/Dockerfile')]:
        tag='localhost:5001/'+name+':local'
        run(['docker','build','-f',dockerfile,'-t',tag,'.']);run(['docker','push',tag])
    with tempfile.TemporaryDirectory(prefix='mari-orchid-') as temp:
        shutil.copy2(wheel,temp)
        run(['docker','build','--build-context','orchiddb-wheel='+temp,'-f','mari/platform/knowledge/Dockerfile','-t','localhost:5001/mari-knowledge:local','.'])
        run(['docker','push','localhost:5001/mari-knowledge:local'])
        run(['docker','build','-f','mari/deploy/Dockerfile.governance','-t','localhost:5001/mari-governance:local','.'])
        run(['docker','push','localhost:5001/mari-governance:local'])
    subprocess.run(['go','build','-o',str(ROOT/'.platform-tools/kubectl-ate'),'./cmd/kubectl-ate'],cwd=source,env={**os.environ,'GOTOOLCHAIN':'auto'},check=True)
    run([sys.executable,'mari/platform/scripts/release.py'])
    run([sys.executable,'mari/platform/scripts/render_substrate.py','--source',str(source),'--output','.platform-state/release'])
    run([sys.executable,'mari/platform/scripts/bootstrap_substrate.py','--context',a.context,'--kubeconfig',kubeconfig,'--source',str(source)])
    run([sys.executable,'mari/platform/scripts/reconcile.py','--context',a.context,'--kubeconfig',kubeconfig,'--release','.platform-state/release'])
    deadline=time.time()+1200
    last_report=0
    while time.time()<deadline:
        resources=json.loads(subprocess.check_output(k+['-n','flux-system','get','kustomizations','-o','json']))['items']
        pending=[]
        for item in resources:
            if not item['metadata']['name'].startswith('mari-'):continue
            ready=any(c['type']=='Ready' and c['status']=='True' and c.get('observedGeneration')==item['metadata']['generation'] for c in item.get('status',{}).get('conditions',[]))
            if not ready:pending.append(item['metadata']['name'])
        if len(resources)>=7 and not pending:break
        if time.time()-last_report>30:print('Waiting for Flux: '+', '.join(pending),flush=True);last_report=time.time()
        time.sleep(5)
    else:raise RuntimeError('Flux stages did not become ready; inspect their status and workload logs')
    print('Platform deployed; the decision miner is managed by AX. Run make open, then make demo.')
if __name__=='__main__':main()
