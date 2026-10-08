#!/usr/bin/env python3
"""Publish an immutable manifest release to S3 and ask Flux to reconcile it."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

from provision_s3 import ROOT, STATE, private_write


def main():
    from local_env import load_local_env
    load_local_env()
    p=argparse.ArgumentParser();p.add_argument('--context',required=True);p.add_argument('--stages',default='operators,substrate-crds,infrastructure,streaming,substrate-system,agent,apps');p.add_argument('--kubeconfig');p.add_argument('--release',type=Path,required=True)
    a=p.parse_args();cloud=json.loads((STATE/'cloud.json').read_text());release=a.release.resolve()
    kubectl=['kubectl','--context',a.context]+(['--kubeconfig',a.kubeconfig] if a.kubeconfig else [])
    def apply(obj):
        subprocess.run(kubectl+['apply','--server-side','--field-manager=mari-bootstrap','-f','-'],input=json.dumps(obj),text=True,check=True,stdout=subprocess.DEVNULL)
    # Fail before uploading if the target cluster is unavailable.
    subprocess.run(kubectl+['get','nodes','--request-timeout=10s'],check=True)
    for ns in ('mari-platform','ate-system','flux-system'):
        apply({'apiVersion':'v1','kind':'Namespace','metadata':{'name':ns}})
    # Local clusters share CPU with image builds. Avoid a probe-driven restart
    # loop while keeping health checks enabled and bounded.
    for controller in ('source-controller','kustomize-controller','helm-controller'):
        patch={'spec':{'template':{'spec':{'containers':[{'name':'manager',
            'livenessProbe':{'timeoutSeconds':10,'failureThreshold':6},
            'readinessProbe':{'timeoutSeconds':5,'failureThreshold':6},
            'startupProbe':{'httpGet':{'path':'/healthz','port':'healthz'},
                'timeoutSeconds':5,'periodSeconds':10,'failureThreshold':30}}]}}}}
        subprocess.run(kubectl+['-n','flux-system','patch','deployment',controller,
            '--type=strategic','-p',json.dumps(patch)],check=True,stdout=subprocess.DEVNULL)
    aws_values={'AWS_ACCESS_KEY_ID':cloud['access_key'],'AWS_SECRET_ACCESS_KEY':cloud['secret_key'],'AWS_REGION':cloud['region'],'AWS_DEFAULT_REGION':cloud['region'],'S3_BUCKET':cloud['bucket']}
    for ns in ('mari-platform','ate-system'):
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'aws-s3','namespace':ns},'stringData':aws_values})
    apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'mari-source-s3','namespace':'flux-system'},'stringData':{'accesskey':cloud['access_key'],'secretkey':cloud['secret_key']}})
    config_path=STATE/'app-secrets.json'
    if not config_path.exists():
        pwd=secrets.token_hex(24)
        private_write(config_path,{'DB_PASSWORD':pwd,'MARI_SERVICE_TOKEN':secrets.token_urlsafe(32),'GITHUB_WEBHOOK_SECRET':secrets.token_urlsafe(32),'SLACK_SIGNING_SECRET':secrets.token_urlsafe(32)})
    app_values=json.loads(config_path.read_text())
    for key in ('GITHUB_WEBHOOK_SECRET','SLACK_SIGNING_SECRET'):
        if os.getenv(key):app_values[key]=os.environ[key]
    private_write(config_path,app_values)
    apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'platform-secrets','namespace':'mari-platform'},'stringData':app_values})
    from platform_config import load_platform
    platform=load_platform(ROOT/'mari/platform/config/platform.json')
    governance_path=STATE/'governance-secrets.json'
    if not governance_path.exists():
        private_write(governance_path,{'MARI_OWNER_EMAIL':'owner@mari.local','MARI_OWNER_PASSWORD':secrets.token_urlsafe(24),'MARI_SESSION_SECRET':secrets.token_urlsafe(48)})
    apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'governance-secrets','namespace':'mari-platform'},'stringData':json.loads(governance_path.read_text())})
    from urllib.parse import quote
    catalog={'type':'sql','uri':'postgresql+psycopg://mari:'+quote(app_values['DB_PASSWORD'],safe='')+'@postgres:5432/iceberg',
             'warehouse':'s3://'+cloud['bucket']+'/warehouse/','init_catalog_tables':'false'}
    apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'iceberg-catalog','namespace':'mari-platform'},'stringData':{
        'ICEBERG_CATALOG_PROPERTIES':json.dumps(catalog),'ICEBERG_JDBC_URI':'jdbc:postgresql://postgres:5432/iceberg',
        'ICEBERG_JDBC_USER':'mari','ICEBERG_JDBC_PASSWORD':app_values['DB_PASSWORD']}})
    if platform['knowledge']['backend']=='starrocks':
        required=('STARROCKS_HOST','STARROCKS_USER','STARROCKS_PASSWORD')
        if any(not os.getenv(key) for key in required):raise RuntimeError('StarRocks read-only connection configuration is missing')
        values={key:os.environ[key] for key in (*required,'STARROCKS_PORT','STARROCKS_ICEBERG_DATABASE') if os.getenv(key)}
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'starrocks-query','namespace':'mari-platform'},'stringData':values})
    if platform.get('cdc',{}).get('enabled'):
        required=('CDC_HOST','CDC_DATABASE','CDC_SCHEMAS','CDC_TABLES','CDC_USER','CDC_PASSWORD')
        if any(not os.getenv(key) for key in required):raise RuntimeError('Direct CDC source configuration is missing')
        values={key:os.environ[key] for key in (*required,'CDC_PORT','CDC_SLOT','CDC_PUBLICATION') if os.getenv(key)}
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'cdc-source','namespace':'mari-platform'},'stringData':values})
    vectors=platform['vectors']
    if vectors['enabled']:
        key=os.getenv(vectors['api_key_env'],'')
        if not key:raise RuntimeError('Configured embedding API key environment variable is missing')
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'embedding-provider','namespace':'mari-platform'},'stringData':{
            'EMBEDDING_URL':vectors['endpoint'],'EMBEDDING_MODEL':vectors['model'],'EMBEDDING_MODE':vectors['mode'],
            'EMBEDDING_API_KEY':key,'EMBEDDING_TOPICS':','.join(vectors['topics'])}})
    if os.getenv('OPENAI_API_KEY'):
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'model-secrets','namespace':'mari-platform'},'stringData':{'OPENAI_API_KEY':os.environ['OPENAI_API_KEY']}})
    if os.getenv('CLAUDE_CODE_OAUTH_TOKEN'):
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'claude-subscription','namespace':'mari-platform'},'stringData':{'CLAUDE_CODE_OAUTH_TOKEN':os.environ['CLAUDE_CODE_OAUTH_TOKEN']}})
    connector_values={key:os.environ[key] for key in ('GITHUB_TOKEN','GITHUB_REPOSITORIES','SLACK_BOT_TOKEN','SLACK_TEAM_ID','SLACK_CHANNELS') if os.getenv(key)}
    if connector_values:
        apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':'connector-secrets','namespace':'mari-platform'},'stringData':connector_values})
    digest=hashlib.sha256()
    files=sorted(f for f in release.rglob('*') if f.is_file())
    for f in files:digest.update(str(f.relative_to(release)).encode()+b'\0'+f.read_bytes())
    revision=digest.hexdigest()[:16];prefix=f'flux/releases/{revision}'
    subprocess.run(['aws','--profile',cloud['profile'],'s3','sync',str(release),f's3://{cloud["bucket"]}/{prefix}/','--only-show-errors'],check=True)
    apply({'apiVersion':'source.toolkit.fluxcd.io/v1','kind':'Bucket','metadata':{'name':'mari-platform','namespace':'flux-system'},'spec':{'interval':'1m','provider':'aws','bucketName':cloud['bucket'],'endpoint':f's3.{cloud["region"]}.amazonaws.com','region':cloud['region'],'prefix':prefix+'/','secretRef':{'name':'mari-source-s3'}}})
    stages={'operators':[], 'substrate-crds':[], 'infrastructure':[],
            'streaming':['operators','infrastructure'], 'substrate-system':['substrate-crds'],
            'agent':['substrate-system'], 'apps':['streaming','infrastructure','agent']}
    for stage,deps in stages.items():
        if stage not in a.stages.split(','): continue
        if not (release/stage/'kustomization.yaml').exists():raise RuntimeError(f'Missing release stage {stage}')
        spec={'interval':'5m','timeout':'15m','retryInterval':'30s','path':f'./{prefix}/{stage}',
              'sourceRef':{'kind':'Bucket','name':'mari-platform'},'prune':True,'wait':True,
              'dependsOn':[{'name':'mari-'+d} for d in deps],
              'postBuild':{'substitute':{'S3_BUCKET':cloud['bucket'],'AWS_REGION':cloud['region']}}}
        if stage == 'apps':
            spec['healthCheckExprs']=[{'apiVersion':'flink.apache.org/v1beta1','kind':'FlinkDeployment','current':"status.lifecycleState == 'SUSPENDED' || (has(status.jobStatus) && status.jobStatus.state == 'RUNNING' && status.lifecycleState == 'STABLE')"}]
        if stage in ('substrate-crds','substrate-system','streaming'):
            spec.pop('postBuild',None) # preserve upstream shell and Kafka env-provider expressions
        if stage in ('substrate-crds','substrate-system','infrastructure'):
            spec['prune']=False # never remove durable storage or cluster CRDs during local iteration
        apply({'apiVersion':'kustomize.toolkit.fluxcd.io/v1','kind':'Kustomization','metadata':{'name':'mari-'+stage,'namespace':'flux-system'},'spec':spec})
    deployment_path = STATE/'deployment.json'
    deployment = json.loads(deployment_path.read_text()) if deployment_path.exists() else {}
    deployment.update({'context':a.context,'kubeconfig':a.kubeconfig,'revision':revision,'bucket':cloud['bucket']})
    private_write(deployment_path, deployment)
    print(f'Flux release {revision} published to s3://{cloud["bucket"]}/{prefix}/')
    print('Observe: kubectl --context '+a.context+' -n flux-system get kustomizations')


if __name__=='__main__':main()
