#!/usr/bin/env python3
"""Create missing Substrate authority secrets without replacing existing keys."""
import argparse
import os
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[3]
def main():
    p=argparse.ArgumentParser();p.add_argument('--context',required=True);p.add_argument('--kubeconfig',type=Path,required=True);p.add_argument('--source',type=Path,required=True);a=p.parse_args()
    kubeconfig=str(a.kubeconfig.resolve());k=['kubectl','--context',a.context,'--kubeconfig',kubeconfig]
    def exists(kind,name,ns=None):
        args=k+(['-n',ns] if ns else [])+['get',kind,name]
        return subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False).returncode==0
    for ns in ('ate-system','podcertificate-controller-system'):
        if not exists('namespace',ns):subprocess.run(k+['create','namespace',ns],check=True)
    cli=[str(ROOT/'.platform-tools/kubectl-ate'),'--context',a.context,'--kubeconfig',kubeconfig,'admin']
    pools=[('ate-system','actor-id-jwt-pool','make-jwt-pool',['--key-id=1']),('ate-system','actor-id-ca-pool','make-ca-pool',['--ca-id=1']),('ate-system','egress-mitm-ca-pool','make-ca-pool',['--ca-id=1','--key-type=ECDSAP256']),('podcertificate-controller-system','service-dns-ca-pool','make-ca-pool',['--ca-id=1']),('podcertificate-controller-system','pod-identity-ca-pool','make-ca-pool',['--ca-id=1'])]
    for ns,name,command,flags in pools:
        if not exists('secret',name,ns):subprocess.run(cli+[command,'--name='+name,'--secret-namespace='+ns,*flags],check=True)
    env={**os.environ,'KUBECONFIG':kubeconfig,'KUBECTL_CONTEXT':a.context,'NO_DEV_ENV':'true','ATE_INSTALL_KIND':'true','GOTOOLCHAIN':'auto'}
    subprocess.run(['./hack/install-ate.sh','--create-actor-id-ca-certs-secret','--create-api-server-env-vars','--create-api-authentication-config'],cwd=a.source.resolve(),env=env,check=True)
    print('Substrate bootstrap complete; existing signing keys preserved')
if __name__=='__main__':main()
