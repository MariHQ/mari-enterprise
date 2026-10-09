#!/usr/bin/env python3
"""Install Mari runtime Secrets from the ignored local environment; never log values."""
import argparse
import base64
import json
from pathlib import Path
import secrets
import shlex
import subprocess

ROOT=Path(__file__).resolve().parents[1]
K=['kubectl','--context','kind-orchid-stack','-n','stack']
def existing(name):
    result=subprocess.run(K+['get','secret',name,'--ignore-not-found','-o','json'],check=True,text=True,capture_output=True)
    if not result.stdout.strip():return {}
    return {key:base64.b64decode(value).decode() for key,value in json.loads(result.stdout).get('data',{}).items()}
def apply(name,values):
    document={'apiVersion':'v1','kind':'Secret','metadata':{'name':name,'namespace':'stack'},'type':'Opaque','stringData':values}
    subprocess.run(K+['apply','-f','-'],input=json.dumps(document),text=True,check=True,stdout=subprocess.DEVNULL)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--origin',default='http://mari-container.stack.127.0.0.1.sslip.io:8084')
    args=parser.parse_args()
    runtime=existing('mari-runtime')
    for key in ('MARI_SESSION_SECRET','MARI_APP_GRANT_SECRET'):runtime.setdefault(key,secrets.token_urlsafe(48))
    runtime['MARI_PUBLIC_ORIGIN']=args.origin
    apply('mari-runtime',runtime)
    worker=existing('mari-worker')
    allow={'GITHUB_TOKEN','GITHUB_REPOSITORIES','SLACK_BOT_TOKEN','SLACK_CHANNELS','MARI_KNOWLEDGE_PROJECT_ID','AX_MINER_IMAGE','CLAUDE_CODE_OAUTH_TOKEN'}
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
    # Paid model execution/maintenance require separate explicit enablement.
    for key in ('DECISION_MINING_ENABLED','ICEBERG_COMPACTION_ENABLED','AX_OBSERVATION_ENABLED'):worker.setdefault(key,'false')
    apply('mari-worker',worker)
    print('Mari runtime/worker Secrets configured; credential values were not logged.')

if __name__=='__main__':main()
