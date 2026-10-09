"""Temporal starts one deterministic Kubernetes Job for each catalog maintenance pass."""
import hashlib
import os
import re
from .catalog import catalog_properties, maintenance_tables
from datetime import timedelta
from temporalio import activity, workflow
from temporalio.common import RetryPolicy


@workflow.defn
class CompactIceberg:
    @workflow.run
    async def run(self,request:dict):
        return await workflow.execute_activity('compact_iceberg',
            {**request,'run_id':workflow.info().run_id},start_to_close_timeout=timedelta(hours=2),
            heartbeat_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(initial_interval=timedelta(seconds=30),maximum_attempts=3))


def job_spec(request):
    table=request.get('table')
    maintenance_tables(table)
    if table is not None and not re.fullmatch(r'[a-zA-Z_][a-zA-Z_0-9]*\.[a-zA-Z0-9_.-]+',table):
        raise ValueError('Invalid table')
    name='iceberg-compact-'+hashlib.sha256(((table or 'all')+request['run_id']).encode()).hexdigest()[:20]
    return {'apiVersion':'batch/v1','kind':'Job','metadata':{'name':name,'namespace':os.getenv('MARI_JOB_NAMESPACE','stack')},'spec':{
        'backoffLimit':2,'activeDeadlineSeconds':6600,'ttlSecondsAfterFinished':300,
        'template':{'metadata':{'labels':{'app':'iceberg-compaction'}},'spec':{'restartPolicy':'Never',
        'automountServiceAccountToken':False,'containers':[{'name':'rewrite','image':os.environ['COMPACTION_IMAGE'],
            'args':[table] if table else [],'env':[{'name':'ICEBERG_MAINTENANCE_TABLES','value':','.join(maintenance_tables(table))}],'envFrom':[{'secretRef':{'name':os.getenv('COMPACTION_AWS_SECRET','aws-credentials')}},{'secretRef':{'name':os.getenv('COMPACTION_CATALOG_SECRET','mari-iceberg-catalog')}}],
            'resources':{'requests':{'cpu':'500m','memory':'1Gi'},'limits':{'cpu':'2','memory':'3Gi'}}}]}}}}


def maintenance_required(request):
    """Inspect manifests only; do not start Spark for an empty/healthy catalog."""
    import json
    from pyiceberg.catalog import load_catalog
    from .rewrite import needs_maintenance
    catalog=load_catalog('mari',**catalog_properties())
    candidates=[tuple(value.split('.', 1)) for value in maintenance_tables(request.get('table'))]
    for identifier in candidates:
        table=catalog.load_table(identifier)
        snapshot=table.current_snapshot()
        if snapshot is None:continue
        data=small=deletes=0
        manifests=snapshot.manifests(table.io)
        for manifest in manifests:
            for entry in manifest.fetch_manifest_entry(table.io,discard_deleted=True):
                f=entry.data_file
                if f.content==0:
                    data+=1;small+=int(f.file_size_in_bytes<67108864)
                else:deletes+=1
        if needs_maintenance(data,small,deletes,len(manifests)):return True
    return False


@activity.defn
async def compact_iceberg(request:dict):
    import httpx
    import asyncio
    from pathlib import Path
    if not await asyncio.to_thread(maintenance_required,request):
        return {'table':request.get('table','all'),'status':'skipped','reason':'No maintenance needed'}
    token=Path('/var/run/secrets/kubernetes.io/serviceaccount/token').read_text()
    ca='/var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
    job=job_spec(request);name=job['metadata']['name']
    base='https://kubernetes.default.svc/apis/batch/v1/namespaces/'+job['metadata']['namespace']+'/jobs'
    async with httpx.AsyncClient(verify=ca,headers={'Authorization':'Bearer '+token},timeout=30) as client:
        response=await client.post(base,json=job)
        if response.status_code!=409:response.raise_for_status()
        # Retry attaches to the same Job; it cannot launch a concurrent rewrite.
        while True:
            response=await client.get(base+'/'+name);response.raise_for_status();status=response.json().get('status',{})
            if status.get('succeeded'):return {'table':request.get('table','all'),'job':name,'status':'completed'}
            if any(c.get('type')=='Failed' and c.get('status')=='True' for c in status.get('conditions',[])):
                raise RuntimeError('Compaction Job failed; inspect '+name)
            activity.heartbeat({'job':name,'table':request.get('table','all')})
            await asyncio.sleep(10)
