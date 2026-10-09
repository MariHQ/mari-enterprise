#!/usr/bin/env python3
"""Verify live catalog resolution without displaying authentication credentials."""
import hashlib,json,pathlib,urllib.request,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
secret=json.loads((root/'.local/credentials.json').read_text())['orchid-catalog']['admin.secret']
base='http://127.0.0.1:8182/v1/lake'
form=urllib.parse.urlencode({'grant_type':'client_credentials','client_id':'admin','client_secret':secret,'scope':'PRINCIPAL_ROLE:ALL'}).encode()
with urllib.request.urlopen(urllib.request.Request(base+'/oauth/tokens',form,{'Content-Type':'application/x-www-form-urlencoded'})) as r:token=json.load(r)['access_token']
for topic in ['cdc.public.customers','cdc.public.smoke_dynamic','events.smoke']:
 graph='t_'+hashlib.sha256(topic.encode()).hexdigest()[:20]
 with urllib.request.urlopen(urllib.request.Request(base+'/graphs/'+graph+'/resolve',headers={'Authorization':'Bearer '+token})) as r:manifest=json.load(r)['manifest']
 definitions=[o['definition'] for o in manifest['objects'].values()]
 assert any('iceberg' in d for d in definitions)
 if topic.startswith('cdc.'):
  assert any(d.get('connector')=='postgres' for d in definitions)
  assert any(d.get('adapter')=='postgres' for d in definitions)
 if topic.endswith('smoke_dynamic'):
  assert any(any(c['name']=='extra' for c in d.get('columns',[])) for d in definitions)
 print(f'PASS Orchid resolved {topic}: revision {manifest["revision"]}')
