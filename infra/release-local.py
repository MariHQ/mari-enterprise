#!/usr/bin/env python3
"""Publish existing Mari images/manifests to the local stack registry; --apply activates Flux."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import yaml

ROOT=Path(__file__).resolve().parents[1]
STACK=ROOT/'stack'
K=['kubectl','--context','docker-desktop']
def run(args,**kwargs):return subprocess.run([str(arg) for arg in args],check=True,**kwargs)
def output(args):return subprocess.check_output([str(arg) for arg in args],text=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--state-uri',default='file:///var/lib/mari-flink',help='Shared checkpoint/savepoint/HA directory; file PVC or s3 URI')
    parser.add_argument('--reset-state',action='store_true',help='Start a fresh Kafka replay when switching storage backends')
    args=parser.parse_args()
    revision=output(['git','-C',ROOT,'rev-parse','--short=12','HEAD']).strip()
    apps=json.loads((ROOT/'container/apps.json').read_text())['apps']
    names=['app-base',*[app['id'] for app in apps if app.get('runtime')!='substrate'],'container','ingestion','temporal','compaction']
    # Validate every prebuilt image before publishing any part of the release.
    images={name:json.loads(output(['docker','image','inspect','mari-'+name+':local']))[0] for name in names}
    base_layers=images['app-base']['RootFS']['Layers']
    for name in names:
        if name not in ('ingestion','compaction') and images[name]['RootFS']['Layers'][:len(base_layers)]!=base_layers:
            raise ValueError(name+' does not inherit the current shared base; rebuild it first')
    refs={}
    for name in names:
        tag='localhost:5001/mari/'+name+':'+revision
        run(['docker','tag','mari-'+name+':local',tag])
        run(['docker','push',tag],stdout=subprocess.DEVNULL)
        digests=json.loads(output(['docker','image','inspect',tag]))[0]['RepoDigests']
        refs['mari-'+name+':local']=next(d for d in digests if d.startswith('localhost:5001/mari/'+name+'@'))
    release=ROOT/'.artifacts/flux'/revision
    release.mkdir(parents=True,exist_ok=True)
    def replace_images(value):
        if isinstance(value,dict):
            # The worker launches compaction Jobs, so its image reference lives in an env value.
            if value.get('name')=='COMPACTION_IMAGE' and 'value' in value:
                return {**value,'value':refs.get(value['value'],value['value'])}
            return {k:refs.get(v,v) if k=='image' and isinstance(v,str) else replace_images(v) for k,v in value.items()}
        if isinstance(value,list):return [replace_images(v) for v in value]
        return value
    stages=list(yaml.safe_load_all((ROOT/'flux/stages.yaml').read_text()))
    for stage in stages:
        path=stage['spec']['path'].removeprefix('./')
        documents=list(yaml.safe_load_all(output(K+['kustomize',ROOT/path])))
        for document in documents:
            if document and document.get('kind')=='FlinkDeployment':
                spec=document['spec'];config=spec['flinkConfiguration'];base=args.state_uri.rstrip('/')
                for key,leaf in [('state.checkpoints.dir','checkpoints'),('state.savepoints.dir','savepoints'),('high-availability.storageDir','ha')]:config[key]=base+'/'+leaf
                spec['job']['upgradeMode']='stateless' if args.reset_state else 'savepoint'
                if args.reset_state:spec['restartNonce']=int(__import__('time').time())
        destination=release/path;destination.mkdir(parents=True,exist_ok=True)
        (destination/'resources.yaml').write_text(yaml.safe_dump_all([replace_images(d) for d in documents],sort_keys=False))
        (destination/'kustomization.yaml').write_text('resources:\n- resources.yaml\n')
        stage['spec']['sourceRef']={'kind':'OCIRepository','name':'mari'}
        stage['spec']['suspend']=False
    root=release/'root';root.mkdir(exist_ok=True)
    (root/'resources.yaml').write_text(yaml.safe_dump_all(stages,sort_keys=False))
    (root/'kustomization.yaml').write_text('resources:\n- resources.yaml\n')
    digest=hashlib.sha256(b''.join(p.read_bytes() for p in sorted(release.rglob('*.yaml')))).hexdigest()
    run([STACK/'bin/flux','push','artifact','oci://localhost:5001/mari/manifests:'+revision,'--path='+str(release),'--source=local://mari','--revision='+revision+'@sha256:'+digest,'--insecure-registry'])
    ip='host.docker.internal'
    bootstrap=[{'apiVersion':'source.toolkit.fluxcd.io/v1','kind':'OCIRepository','metadata':{'name':'mari','namespace':'flux-system'},'spec':{'interval':'1m','url':'oci://'+ip+':5001/mari/manifests','ref':{'tag':revision},'insecure':True}},
               {'apiVersion':'kustomize.toolkit.fluxcd.io/v1','kind':'Kustomization','metadata':{'name':'mari','namespace':'flux-system'},'spec':{'suspend':False,'interval':'2m','path':'./root','sourceRef':{'kind':'OCIRepository','name':'mari'},'prune':False,'wait':False}}]
    path=ROOT/'.artifacts/mari-bootstrap.yaml';path.write_text(yaml.safe_dump_all(bootstrap,sort_keys=False))
    if args.apply:run(K+['apply','-f',path])
    print('Published local release '+revision+('; Flux activated' if args.apply else '; review '+str(path)+' before applying'))

if __name__=='__main__':main()
