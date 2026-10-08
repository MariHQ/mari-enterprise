#!/usr/bin/env python3
"""Publish the Sources app and optional shared Knative installation through Flux.

Uses the existing local platform target. No schedules or collector writes.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import yaml

APP = Path(__file__).resolve().parent
ROOT = APP.parents[2]


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--install-serving', action='store_true')
    args = parser.parse_args()
    manifest = yaml.safe_load((APP/'mari.yaml').read_text())
    if manifest['topics']:
        raise SystemExit('Sources is read-only and must not own producer topics')
    if len(set(manifest['reads']['topics'])) != len(manifest['reads']['topics']):
        raise SystemExit('Duplicate read topic')
    state = ROOT/'.platform-state'
    cloud = json.loads((state/'cloud.json').read_text())
    kubectl = ['kubectl', '--kubeconfig', str(state/'kubeconfig')]
    def apply(obj):
        run(kubectl+['apply','-f','-'],input=json.dumps(obj),text=True)
    existing = subprocess.run(kubectl+['-n','mari-platform','get','secret','sources-app-auth','-o','json'],capture_output=True)
    if existing.returncode:
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'sources-app-auth','namespace':'mari-platform'},
               'stringData':{'MARI_APP_GRANT_SECRET':secrets.token_urlsafe(48)}})
    image='localhost:5001/mari-sources:local'
    run(['docker','build','-f',str(APP/'Dockerfile'),'-t',image,str(ROOT/'mari')])
    run(['docker','push',image])
    info=json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]
    digest=next(d for d in info['RepoDigests'] if d.startswith('localhost:5001/mari-sources@'))
    with tempfile.TemporaryDirectory() as tmp:
        release=Path(tmp)
        shutil.copytree(APP/'deploy',release/'app')
        p=release/'app/service.yaml';p.write_text(p.read_text().replace(image,digest))
        stages=[]
        managed_serving = subprocess.run(kubectl+['-n','flux-system','get','kustomization','mari-serving-core'], capture_output=True).returncode == 0
        if args.install_serving or managed_serving:
            shutil.copytree(ROOT/'mari/platform/deploy/knative',release/'knative')
            stages=[('serving-crds','knative/crds',[]),('serving-core','knative/core',['serving-crds']),('serving-network','knative/network',['serving-core'])]
        stages.append(('sources','app',['serving-network'] if args.install_serving or managed_serving else []))
        checksum=hashlib.sha256()
        for f in sorted(release.rglob('*')):
            if f.is_file():checksum.update(str(f.relative_to(release)).encode()+f.read_bytes())
        prefix='apps/sources/'+checksum.hexdigest()[:16]
        run(['aws','--profile',cloud['profile'],'s3','sync',tmp,'s3://'+cloud['bucket']+'/'+prefix+'/','--only-show-errors'])
        apply({'apiVersion':'source.toolkit.fluxcd.io/v1','kind':'Bucket','metadata':{'name':'mari-sources','namespace':'flux-system'},'spec':{
            'interval':'1m','provider':'aws','bucketName':cloud['bucket'],'endpoint':'s3.'+cloud['region']+'.amazonaws.com',
            'region':cloud['region'],'prefix':prefix+'/','secretRef':{'name':'mari-source-s3'}}})
        for name,path,deps in stages:
            apply({'apiVersion':'kustomize.toolkit.fluxcd.io/v1','kind':'Kustomization','metadata':{'name':'mari-'+name,'namespace':'flux-system'},'spec':{
                'interval':'5m','retryInterval':'30s','timeout':'10m','path':'./'+prefix+'/'+path,
                'sourceRef':{'kind':'Bucket','name':'mari-sources'},'prune':name=='sources','wait':True,
                'dependsOn':[{'name':'mari-'+dep} for dep in deps]}})
    print('Sources release published. Flux owns the rollout; no polling jobs changed.')

if __name__=='__main__':main()
