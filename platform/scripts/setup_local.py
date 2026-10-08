#!/usr/bin/env python3
"""Create the dedicated Kind cluster without touching other local clusters."""
import json
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[3]
def main():
    def run(cmd,**kw):return subprocess.run(cmd,check=True,cwd=ROOT,**kw)
    kind=str(ROOT/'.platform-tools/kind');state=ROOT/'.platform-state';state.mkdir(mode=0o700,exist_ok=True)
    clusters=subprocess.check_output([kind,'get','clusters'],text=True).splitlines()
    if 'mari-platform' not in clusters:
        run([kind,'create','cluster','--name','mari-platform','--image','kindest/node:v1.37.0','--config','mari/platform/deploy/kind.yaml','--kubeconfig',str(state/'kubeconfig')])
    else:run([kind,'export','kubeconfig','--name','mari-platform','--kubeconfig',str(state/'kubeconfig')])
    existing=subprocess.run(['docker','inspect','kind-registry'],capture_output=True,text=True)
    if existing.returncode:run(['docker','run','-d','--restart=always','-p','127.0.0.1:5001:5000','--name','kind-registry','registry:3'])
    else:
        details=json.loads(existing.stdout)[0]
        if not details['State']['Running']:run(['docker','start','kind-registry'])
    networks=json.loads(subprocess.check_output(['docker','inspect','kind-registry']))[0]['NetworkSettings']['Networks']
    if 'kind' not in networks:run(['docker','network','connect','kind','kind-registry'])
    run(['docker','exec','mari-platform-control-plane','mkdir','-p','/etc/containerd/certs.d/localhost:5001'])
    run(['docker','exec','-i','mari-platform-control-plane','tee','/etc/containerd/certs.d/localhost:5001/hosts.toml'],input='[host."http://kind-registry:5000"]\n',text=True,stdout=subprocess.DEVNULL)
    run(['kubectl','--kubeconfig',str(state/'kubeconfig'),'--context','kind-mari-platform','label','node','mari-platform-control-plane','ate.dev/substrate-version=67253354','--overwrite'])
if __name__=='__main__':main()
