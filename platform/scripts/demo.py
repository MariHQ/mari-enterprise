#!/usr/bin/env python3
"""Verify signed connectors, governance edits, lake state and retractions end to end."""
import argparse
import hashlib
import hmac
import json
from pathlib import Path
import time
import uuid
import httpx
ROOT=Path(__file__).resolve().parents[3]


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://localhost:8082');parser.add_argument('--mari-url',default='http://localhost:8081');parser.add_argument('--wait',type=int,default=180)
    args=parser.parse_args();config=json.loads((ROOT/'.platform-state/app-secrets.json').read_text())
    owner=json.loads((ROOT/'.platform-state/governance-secrets.json').read_text());suffix=uuid.uuid4().hex[:12]
    with httpx.Client(base_url=args.mari_url,timeout=30) as mari,httpx.Client(base_url=args.url,timeout=30) as ingestion:
        mari.post('/auth/login',json={'email':owner['MARI_OWNER_EMAIL'],'password':owner['MARI_OWNER_PASSWORD']}).raise_for_status()
        def query(sql,parameters=None,language='sql'):
            result=mari.post('/api/query',json={'query':sql,'parameters':parameters or {},'language':language});result.raise_for_status();return result.json()['rows']
        def wait_for(fn,label):
            deadline=time.monotonic()+args.wait
            while time.monotonic()<deadline:
                try:
                    if fn():print('PASS:',label,flush=True);return
                except httpx.HTTPError:
                    pass
                time.sleep(3)
            raise RuntimeError('Timed out: '+label)
        def signed(source,payload):
            body=json.dumps(payload).encode()
            if source=='github':
                headers={'X-GitHub-Delivery':'fixture-'+suffix,'X-GitHub-Event':'issues','X-Hub-Signature-256':'sha256='+hmac.new(config['GITHUB_WEBHOOK_SECRET'].encode(),body,hashlib.sha256).hexdigest()}
            else:
                stamp=str(int(time.time()));headers={'X-Slack-Request-Timestamp':stamp,'X-Slack-Signature':'v0='+hmac.new(config['SLACK_SIGNING_SECRET'].encode(),b'v0:'+stamp.encode()+b':'+body,hashlib.sha256).hexdigest()}
            result=ingestion.post('/hooks/'+source,content=body,headers={'Content-Type':'application/json',**headers});result.raise_for_status();return result.json()
        title='Synthetic verification '+suffix
        slack={'type':'event_callback','team_id':'T_FIXTURE','event_id':'fixture-'+suffix,'event':{'type':'message','channel':'C_FIXTURE','ts':str(time.time()),'text':title+' — We chose Kafka for durable event delivery.'}}
        github={'action':'opened','repository':{'full_name':'mari-fixtures/platform'},'issue':{'id':int(suffix,16),'number':1,'title':title,'body':'Synthetic fixture. We chose Temporal for durable background jobs.','html_url':'https://example.invalid/fixture/'+suffix}}
        signed('github',github);signed('github',github);signed('slack',slack)
        wait_for(lambda:len(query('SELECT record_id FROM records WHERE contains(title || text,$marker)',{'marker':suffix}))==2,'signed connectors → Kafka → Flink → Iceberg → Knowledge API')
        ids=[row['record_id'] for row in query('SELECT record_id FROM records WHERE contains(title || text,$marker)',{'marker':suffix})]
        record_id='verification:'+suffix
        first=mari.post('/api/records',headers={'Idempotency-Key':suffix+'-create'},json={'record_id':record_id,'title':title,'text':'Original content'});first.raise_for_status()
        assert first.status_code==202 and first.json()['applied'] is False
        wait_for(lambda:bool(query('SELECT record_id FROM records WHERE record_id=$id',{'id':record_id})),'governance create materialized')
        revision=query('SELECT event_id FROM records WHERE record_id=$id',{'id':record_id})[0]['event_id']
        mari.post('/api/records',headers={'Idempotency-Key':suffix+'-edit'},json={'record_id':record_id,'title':title,'text':'Edited content','expected_revision':revision}).raise_for_status()
        wait_for(lambda:query('SELECT text FROM records WHERE record_id=$id',{'id':record_id})==[{'text':'Edited content'}],'edit replaces current Iceberg record')
        assert query('MATCH (r:Record) WHERE r.record_id=$id RETURN r.text AS text',{'id':record_id},'cypher')==[{'text':'Edited content'}]
        print('PASS: OrchidDB Cypher reads the edited record',flush=True)
        for identity in [record_id,*ids]:
            mari.delete('/api/record',params={'id':identity},headers={'Idempotency-Key':suffix+'-delete-'+identity}).raise_for_status()
        wait_for(lambda:not query('SELECT record_id FROM records WHERE list_contains($ids,record_id)',{'ids':[record_id,*ids]}),'retractions remove current records')
        assert query("SELECT count(*) AS n FROM history WHERE record_id=$id",{'id':record_id})==[{'n':3}]
        print('PASS: normalized history retains create/edit/retraction; duplicate delivery did not duplicate current records',flush=True)
if __name__=='__main__':main()
