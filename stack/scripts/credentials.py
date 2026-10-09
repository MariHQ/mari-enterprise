#!/usr/bin/env python3
"""Create local secrets once; refresh AWS SSO credentials without logging values."""
import base64,hashlib,json,os,pathlib,secrets,subprocess
os.umask(0o077)
ROOT=pathlib.Path(__file__).resolve().parents[1]
DIR=ROOT/'.local';DIR.mkdir(exist_ok=True)
K=['kubectl','--context','docker-desktop']
def run(args,**kw):return subprocess.run(args,check=True,text=True,**kw)
def apply(doc):run(K+['apply','-f','-'],input=json.dumps(doc),stdout=subprocess.DEVNULL)
def secret(name,data,namespace='stack'):
 apply({'apiVersion':'v1','kind':'Secret','metadata':{'name':name,'namespace':namespace},'type':'Opaque','stringData':data})
for ns in ['stack','flux-system']:
 apply({'apiVersion':'v1','kind':'Namespace','metadata':{'name':ns}})
f=DIR/'credentials.json'
if f.exists():values=json.loads(f.read_text())
else:
 values={'postgres':{'password':secrets.token_urlsafe(32)}}
 key=DIR/'polaris.key';pub=DIR/'polaris.pub'
 run(['openssl','genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:2048','-out',str(key)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 run(['openssl','pkey','-in',str(key),'-pubout','-out',str(pub)],stdout=subprocess.DEVNULL)
 client=secrets.token_urlsafe(32)
 values['polaris']={'signing.key':key.read_text(),'signing.pub':pub.read_text(),'bootstrap-credential':'POLARIS,root,'+client,'client-id':'root','client-secret':client,'credential':'root:'+client}
 admin=secrets.token_urlsafe(32)
 config={'default':{'mode':'internal','internal':{'issuer':'orchid-catalog','audience':'orchid-catalog','token_lifetime_seconds':3600,'signing':{'type':'symmetric','key_file':'/run/secrets/signing.key'},'clients':[{'client_id':'admin','secret_sha256':hashlib.sha256(admin.encode()).hexdigest(),'principal':{'subject':'admin','roles':['service_admin'],'admin':True}}]}}}
 values['orchid-catalog']={'signing.key':secrets.token_urlsafe(48),'auth.json':json.dumps(config),'admin.secret':admin,'database-url':'postgres://stack:'+values['postgres']['password']+'@postgres:5432/orchid_catalog'}
 f.write_text(json.dumps(values))
for name,data in values.items():secret(name,data)
aws=json.loads(subprocess.check_output(['aws','configure','export-credentials','--profile','personal','--format','process'],text=True))
a={'AWS_ACCESS_KEY_ID':aws['AccessKeyId'],'AWS_SECRET_ACCESS_KEY':aws['SecretAccessKey'],'AWS_SESSION_TOKEN':aws.get('SessionToken',''),'AWS_REGION':'us-east-1'}
for ns in ['stack']:secret('aws-credentials',a,ns)
(DIR/'aws-expiration.txt').write_text(aws.get('Expiration','unknown'))
print('Credentials ready. AWS expiration: '+aws.get('Expiration','unknown'))
