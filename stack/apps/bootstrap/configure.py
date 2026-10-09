import json,os,urllib.request,urllib.parse,urllib.error,time

def request(url,data=None,token=None,method=None,form=False):
 body=None if data is None else (urllib.parse.urlencode(data) if form else json.dumps(data)).encode()
 headers={'Content-Type':'application/x-www-form-urlencoded' if form else 'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(url,body,headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=20) as r:
   body=r.read();return json.loads(body) if body else {}
 except urllib.error.HTTPError as e:
  if e.code==409:return {}
  raise RuntimeError(f'{method or "POST"} {url}: {e.code}: {e.read().decode()}') from None
pol='http://polaris:8181'
token=request(pol+'/api/catalog/v1/oauth/tokens',{'grant_type':'client_credentials','client_id':'root','client_secret':os.environ['POLARIS_SECRET'],'scope':'PRINCIPAL_ROLE:ALL'},form=True)['access_token']
location='s3://'+os.environ['S3_BUCKET']+'/warehouse'
request(pol+'/api/management/v1/catalogs',{'catalog':{'name':'lake','type':'INTERNAL','readOnly':False,'properties':{'default-base-location':location},'storageConfigInfo':{'storageType':'S3','allowedLocations':[location],'region':'us-east-1'}}},token)
request(pol+'/api/management/v1/principal-roles/service_admin/catalog-roles/lake',{'catalogRole':{'name':'catalog_admin'}},token,method='PUT')
for privilege in ['TABLE_READ_DATA','TABLE_WRITE_DATA']:
 request(pol+'/api/management/v1/catalogs/lake/catalog-roles/catalog_admin/grants',{'grant':{'type':'catalog','privilege':privilege}},token,method='PUT')
print('Polaris lake catalog configured.')
