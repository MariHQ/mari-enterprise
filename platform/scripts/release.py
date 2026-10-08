#!/usr/bin/env python3
"""Copy application manifests and pin local images to their pushed digests."""
import json
import hashlib
from pathlib import Path
import shutil
import subprocess
import yaml
ROOT=Path(__file__).resolve().parents[3]
def main():
    release=ROOT/'.platform-state/release';release.mkdir(parents=True,exist_ok=True)
    digests={}
    for name in ('mari-runtime','mari-flink','mari-ax-miner','mari-governance','mari-knowledge','mari-compaction'):
        tag=f'localhost:5001/{name}:local'
        details=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
        digests[tag]=next(d for d in details['RepoDigests'] if d.startswith(f'localhost:5001/{name}@'))
        # A locally built image may advertise a digest absent from the registry.
        # Refuse the release before rendering or publishing any manifests.
        subprocess.run(['docker','buildx','imagetools','inspect',digests[tag]],check=True,stdout=subprocess.DEVNULL)
    from platform_config import load_platform
    platform=load_platform(ROOT/'mari/platform/config/platform.json')
    for stage in ('operators','infrastructure','streaming','apps'):
        if (release/stage).exists():shutil.rmtree(release/stage)
        shutil.copytree(ROOT/'mari/platform/deploy'/stage,release/stage)
        for path in (release/stage).glob('*.yaml'):
            text=path.read_text()
            for tag,digest in digests.items():text=text.replace(tag,digest)
            path.write_text(text)
    # Search engines are user-managed integrations, never auto-provisioned.
    if (release/'optional').exists():shutil.rmtree(release/'optional')
    for path in (release/'apps').glob('*.yaml'):
        docs=list(yaml.safe_load_all(path.read_text()))
        for doc in docs:
            if doc and doc.get('kind')=='FlinkDeployment':
                containers=doc['spec']['podTemplate']['spec']['containers']
                env=containers[0].setdefault('env',[])
                env[:]=[e for e in env if e['name'] not in ('LAKE_TOPIC_PATTERN','LAKE_PARTITION_RULES')]
                env += [{'name':'LAKE_TOPIC_PATTERN','value':platform.get('lake',{}).get('topic_pattern',r'mari\.records\..+')}, {'name':'LAKE_PARTITION_RULES','value':json.dumps(platform.get('lake',{}).get('partition_rules',[]))}]
                doc['spec']['job']['state']=platform['flink']['state']
                if platform.get('cdc',{}).get('enabled'):
                    doc['spec']['podTemplate']['spec']['containers'][0].setdefault('envFrom',[]).append({'secretRef':{'name':'cdc-source'}})
            if not doc or doc.get('kind') not in ('Deployment','Job'):continue
            if doc['metadata']['name']=='worker':
                doc['spec']['replicas']=1 if platform.get('temporal',{}).get('enabled',True) else 0
            for container in doc['spec']['template']['spec'].get('containers',[]):
                env=container.setdefault('env',[])
                env[:]=[item for item in env if item['name'] not in ('MARI_KNOWLEDGE_PROJECT_ID','QUICKWIT_ENABLED','WEAVIATE_ENABLED','ICEBERG_COMPACTION_ENABLED','ICEBERG_COMPACTION_TABLES','ICEBERG_COMPACTION_HOURS','ICEBERG_COMPACTION_MINUTES')]
                for item in env:
                    if item['name']=='KNOWLEDGE_BACKEND':item['value']=platform['knowledge']['backend']
                if doc['metadata']['name']=='knowledge-api':
                    env += [{'name':'QUICKWIT_ENABLED','value':str(platform['quickwit']['enabled']).lower()},
                            {'name':'WEAVIATE_ENABLED','value':str(platform['vectors']['enabled']).lower()}]
                    if platform['vectors']['enabled']:
                        container.setdefault('envFrom',[]).append({'secretRef':{'name':'embedding-provider'}})
                    if platform['knowledge']['backend']=='starrocks':
                        container.setdefault('envFrom',[]).append({'secretRef':{'name':'starrocks-query'}})
                if doc['metadata']['name'] in ('knowledge-api','mari-governance'):
                    env.append({'name':'MARI_KNOWLEDGE_PROJECT_ID','value':str(platform['knowledge']['project_id'])})
                if doc['metadata']['name'] in ('worker','platform-bootstrap'):
                    env[:]=[e for e in env if e['name']!='TEMPORAL_JOBS_ENABLED']
                    env.append({'name':'TEMPORAL_JOBS_ENABLED','value':str(platform.get('temporal',{}).get('enabled',True)).lower()})
                    env += [{'name':'QUICKWIT_ENABLED','value':str(platform['quickwit']['enabled']).lower()},
                            {'name':'ICEBERG_COMPACTION_ENABLED','value':str(platform['compaction']['enabled']).lower()},
                            {'name':'ICEBERG_COMPACTION_MINUTES','value':str(platform['compaction'].get('every_minutes',15))}]
        path.write_text(yaml.safe_dump_all(docs,sort_keys=False))
    (ROOT/'.platform-state/images.json').write_text(json.dumps(digests,indent=2)+'\n')
if __name__=='__main__':main()
