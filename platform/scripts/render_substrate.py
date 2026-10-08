#!/usr/bin/env python3
"""Render the pinned upstream Substrate into a Flux release, replacing local storage with AWS."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import yaml

ROOT=Path(__file__).resolve().parents[3]
REV='672533541dbfcd29084e4de2475267088bda3651'


def main():
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();source=a.source.resolve();out=a.output.resolve()
    def run(cmd,**kw):
        result = subprocess.run(cmd,cwd=source,text=True,**kw)
        if result.returncode:
            if result.stderr: print(result.stderr)
            result.check_returncode()
        return result
    actual=run(['git','rev-parse','HEAD'],capture_output=True).stdout.strip()
    if actual!=REV:raise RuntimeError(f'Substrate must be pinned to {REV}')
    raw=run(['kubectl','kustomize','manifests/ate-install/kind','--load-restrictor','LoadRestrictionsNone'],capture_output=True).stdout
    docs=list(yaml.safe_load_all(raw))
    for filename in ('postgres/postgres.yaml', 'atenet-egress.yaml', 'sandboxconfig-validation.yaml'):
        docs += list(yaml.safe_load_all((source/'manifests/ate-install'/filename).read_text()))
    kept=[]
    for d in docs:
        if not d:continue
        meta=d['metadata'];name=meta['name'];ns=meta.get('namespace','')
        if 'rustfs' in name or ns=='otel-system' or (d['kind']=='Namespace' and name=='otel-system'):continue
        # Retain the shared telemetry config with exporters disabled in this small local cluster.
        if d['kind']=='ConfigMap' and name=='ate-otel-config':
            d['data'].update({'OTEL_TRACES_EXPORTER':'none','OTEL_METRICS_EXPORTER':'none','OTEL_LOGS_EXPORTER':'none'})
        template=d.get('spec',{}).get('template',{}).get('spec',{})
        for c in template.get('containers',[]):
            if ns=='ate-system' and d['kind'] in ('Deployment','DaemonSet'):
                requests=c.setdefault('resources',{}).setdefault('requests',{})
                requests.setdefault('cpu','100m');requests.setdefault('memory','128Mi')
            env=c.get('env',[])
            if any(e['name']=='ATE_STORAGE_BACKEND' for e in env):
                c['env']=[e for e in env if not e['name'].startswith('AWS_')]
                c.setdefault('envFrom',[]).append({'secretRef':{'name':'aws-s3'}})
            if name=='atenet-router' and c.get('name')=='atenet-router':
                c.setdefault('args',[]).extend(['--route-timeout=5m','--drain-timeout=5m'])
                template['terminationGracePeriodSeconds']=330
            if name=='ate-api-server':
                if 'livenessProbe' in c:
                    c['livenessProbe'].update(timeoutSeconds=5,failureThreshold=6)
                    c['startupProbe']={**c['livenessProbe'],'initialDelaySeconds':0,'periodSeconds':10,'failureThreshold':30}
                if 'readinessProbe' in c:c['readinessProbe']['timeoutSeconds']=5
            # Local resource footprint, without changing sandbox limits.
            if name=='ate-api-server':d['spec']['replicas']=1
        kept.append(d)
    def replace_version(value):
        if isinstance(value,str):return value.replace('${SUBSTRATE_VERSION_SUFFIX}','67253354').replace('${SUBSTRATE_VERSION}','67253354')
        if isinstance(value,list):return [replace_version(v) for v in value]
        if isinstance(value,dict):return {k:replace_version(v) for k,v in value.items()}
        return value
    rendered=yaml.safe_dump_all(replace_version(kept),sort_keys=False)
    # ko resolves immutable image digests in the local registry. All source stays upstream.
    env={**os.environ,'GOTOOLCHAIN':'auto','KO_DOCKER_REPO':'localhost:5001','KO_DEFAULTPLATFORMS':'linux/arm64'}
    flags=run(['make','-s','ldflags'],capture_output=True).stdout.strip()
    result=run(['./hack/run-tool.sh','ko','resolve','-f','-',f'--ldflags={flags}'],input=rendered,capture_output=True,env=env)
    (out/'substrate-system').mkdir(parents=True,exist_ok=True)
    (out/'substrate-system'/'resources.yaml').write_text(result.stdout)
    (out/'substrate-crds').mkdir(parents=True,exist_ok=True)
    crds=[]
    for f in sorted((source/'manifests/ate-install/generated').glob('*.yaml')):
        crds.extend(yaml.safe_load_all(f.read_text()))
    (out/'substrate-crds'/'resources.yaml').write_text(yaml.safe_dump_all(crds,sort_keys=False))
    # Runtime config and the dedicated worker pool are operator-owned resources.
    worker_image=run(['./hack/run-tool.sh','ko','build',f'--ldflags={flags}','./cmd/ateom-gvisor'],capture_output=True,env=env).stdout.strip()
    (out/'agent').mkdir(parents=True,exist_ok=True)
    deployment_path=ROOT/'.platform-state/deployment.json'
    workspace=json.loads(deployment_path.read_text()).get('substrate_workspace',{}) if deployment_path.exists() else {}
    pool_name=workspace.get('pool','mari-agents')
    pool={'apiVersion':'ate.dev/v1alpha1','kind':'WorkerPool','metadata':{'name':pool_name,'namespace':'mari-platform','labels':{'workload':pool_name}},'spec':{'replicas':1,'workerImage':worker_image,'template':{'nodeSelector':{'ate.dev/substrate-version':'67253354'},'resources':{'requests':{'cpu':'100m','memory':'512Mi'},'limits':{'cpu':'1','memory':'1536Mi'}}}}}
    sandbox=list(yaml.safe_load_all((source/'manifests/ate-install/sandboxconfig-gvisor.yaml').read_text()))
    (out/'agent'/'resources.yaml').write_text(yaml.safe_dump_all(sandbox+[pool],sort_keys=False))
    for stage in ('substrate-crds','substrate-system','agent'):
        (out/stage/'kustomization.yaml').write_text(yaml.safe_dump({'apiVersion':'kustomize.config.k8s.io/v1beta1','kind':'Kustomization','resources':['resources.yaml']}))
    (out/'THIRD_PARTY_NOTICES.txt').write_text('Agent Substrate '+REV+'\nCopyright 2026 Google LLC. Apache-2.0.\n'+(source/'LICENSE').read_text())
    print('Rendered pinned Substrate into '+str(out))


if __name__=='__main__':main()
