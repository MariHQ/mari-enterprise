#!/usr/bin/env python3
"""Install Mari runtime Secrets from the ignored local environment; never log values."""
import argparse
import base64
import json
from pathlib import Path
import secrets
import shlex
import subprocess
import yaml

ROOT=Path(__file__).resolve().parents[1]
K=['kubectl','--context','kind-orchid-stack','-n','stack']
def existing(name):
    result=subprocess.run(K+['get','secret',name,'--ignore-not-found','-o','json'],check=True,text=True,capture_output=True)
    if not result.stdout.strip():return {}
    return {key:base64.b64decode(value).decode() for key,value in json.loads(result.stdout).get('data',{}).items()}
def apply(name,values):
    document={'apiVersion':'v1','kind':'Secret','metadata':{'name':name,'namespace':'stack'},'type':'Opaque','stringData':values}
    subprocess.run(K+['apply','-f','-'],input=json.dumps(document),text=True,check=True,stdout=subprocess.DEVNULL)

def maintenance_allowlist():
    declaration=yaml.safe_load((ROOT/'flink/ingestion.yaml').read_text())
    targets=declaration['targets'];topics=declaration['topics']
    if set(targets)!={'current','history'} or {t['namespace'] for t in targets.values()}!={'mari_streams','mari_history'}:
        raise ValueError('Compaction is restricted to Mari current/history namespaces')
    if not topics or len(topics)!=len(set(topics)) or any(not topic.startswith('mari.records.') for topic in topics):
        raise ValueError('Compaction requires the explicit Mari topic inventory')
    return ','.join(targets[mode]['namespace']+'.'+topic for mode in ('current','history') for topic in topics)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin',default='http://mari-container.stack.127.0.0.1.sslip.io:8084')
    args=parser.parse_args()
    allowlist=maintenance_allowlist()
    polaris=existing('polaris')
    if not polaris.get('credential'):
        raise ValueError('Existing polaris Secret must contain credential')
    runtime=existing('mari-runtime')
    for key in ('MARI_SESSION_SECRET','MARI_APP_GRANT_SECRET'):runtime.setdefault(key,secrets.token_urlsafe(48))
    runtime['MARI_PUBLIC_ORIGIN']=args.origin
    apply('mari-runtime',runtime)
    worker=existing('mari-worker')
    allow={'GITHUB_TOKEN','GITHUB_REPOSITORIES','SLACK_BOT_TOKEN','SLACK_TEAM_ID','SLACK_CHANNELS','MARI_KNOWLEDGE_PROJECT_ID','AX_MINER_IMAGE','CLAUDE_CODE_OAUTH_TOKEN'}
    path=ROOT/'temporal/.env'
    if path.exists():
        for number,line in enumerate(path.read_text().splitlines(),1):
            line=line.strip()
            if not line or line.startswith('#'):continue
            key,separator,value=line.removeprefix('export ').partition('=')
            if key.strip() not in allow:continue
            parsed=shlex.split(value,comments=True)
            if not separator or len(parsed)>1:raise ValueError('Invalid environment assignment at line '+str(number))
            worker[key.strip()]=parsed[0] if parsed else ''
    worker.update({'TEMPORAL_ADDRESS':'temporal.stack.svc:7233','TEMPORAL_NAMESPACE':'default','TEMPORAL_TASK_QUEUE':'mari','KAFKA_BOOTSTRAP_SERVERS':'kafka-kafka-bootstrap.stack.svc:9092','ORCHID_GRAPH':'decisions'})
    # Maintenance is explicitly limited to the declaration; paid model execution remains opt-in.
    for key in ('DECISION_MINING_ENABLED','AX_OBSERVATION_ENABLED'):worker.setdefault(key,'false')
    worker.update({'ICEBERG_COMPACTION_ENABLED':'true','ICEBERG_COMPACTION_MINUTES':'15',
                   'ICEBERG_MAINTENANCE_TABLES':allowlist})
    apply('mari-iceberg-catalog',{'ICEBERG_REST_URI':'http://polaris.stack.svc:8181/api/catalog',
          'ICEBERG_WAREHOUSE':'lake','ICEBERG_OAUTH_SCOPE':'PRINCIPAL_ROLE:ALL',
          'ICEBERG_CREDENTIAL':polaris['credential']})
    apply('mari-worker',worker)
    print('Mari runtime/worker Secrets configured; credential values were not logged.')

if __name__=='__main__':main()
