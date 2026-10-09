import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
import unittest
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlsplit

import httpx
from fastapi.testclient import TestClient
from joserfc import jwt
from joserfc.jwk import RSAKey

MARI=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(MARI))
from container.config import load_config, Configuration
from container.server import create_app

ENV={'MARI_PUBLIC_ORIGIN':'http://testserver','MARI_SESSION_SECRET':'s'*48,'MARI_APP_GRANT_SECRET':'g'*48}
CSRF={'X-Mari-CSRF':'1'}


class ContainerTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,ENV,clear=True);self.env.start();self.addCleanup(self.env.stop)
        self.seen=[]
        def upstream(request):
            self.seen.append(request)
            return httpx.Response(200,json={'ok':True},headers={'set-cookie':'stolen=yes'})
        self.client=TestClient(create_app(transport=httpx.MockTransport(upstream)))

    def login(self):
        return self.client.post('/auth/login',json={'username':'demo','password':'demo'},headers=CSRF)

    def test_login_cookie_logout_and_access(self):
        self.assertEqual(self.client.get('/api/apps').status_code,401)
        self.assertEqual(self.client.get('/apps/sources/').status_code,401)
        response=self.login();self.assertEqual(response.status_code,200)
        self.assertIn('httponly',response.headers['set-cookie'].lower())
        self.assertEqual(self.client.get('/auth/me').json()['user']['sub'],'local:demo')
        self.assertIn('sources',[a['id'] for a in self.client.get('/api/apps').json()['apps']])
        self.assertEqual(self.client.post('/auth/logout',json={},headers=CSRF).status_code,200)
        self.assertEqual(self.client.get('/apps/sources/').status_code,401)

    def test_credentials_and_csrf(self):
        self.assertEqual(self.client.post('/auth/login',json={'username':'demo','password':'wrong'},headers=CSRF).status_code,401)
        self.assertEqual(self.client.post('/auth/login',json={'username':'demo','password':'demo'}).status_code,403)
        self.assertEqual(self.client.post('/auth/login',json={'username':'demo','password':'demo'},headers={**CSRF,'Origin':'https://evil.example'}).status_code,403)

    def test_injected_grant_and_no_credential_forwarding(self):
        self.login()
        response=self.client.get('/apps/sources/api/status?limit=2',headers={'Authorization':'Bearer forged','X-Mari-User':'admin'})
        self.assertEqual(response.status_code,200)
        upstream=self.seen[-1]
        self.assertNotIn('cookie',upstream.headers)
        self.assertNotIn('x-mari-user',upstream.headers)
        self.assertNotIn('stolen',response.headers.get('set-cookie',''))
        self.assertEqual(upstream.url.query,b'limit=2')
        token=upstream.headers['authorization'].removeprefix('Bearer ')
        body,sig=token.split('.')
        self.assertEqual(sig,hmac.new(('g'*48).encode(),body.encode(),hashlib.sha256).hexdigest())
        claims=json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
        self.assertEqual((claims['aud'],claims['sub'],claims['project']),('sources','local:demo','1'))
        self.assertLessEqual(claims['exp']-time.time(),180)
        # The real app validator accepts the proxy's grant and rejects tampering.
        from apps.base.runtime import validate_grant
        self.assertEqual(validate_grant('Bearer '+token, 'sources')['sub'],'local:demo')
        with self.assertRaises(Exception): validate_grant('Bearer '+token+'bad', 'sources')

    def test_static_allowlist_and_paths(self):
        self.login()
        self.assertEqual(self.client.get('/apps/unknown/').status_code,404)
        self.assertEqual(self.client.post('/apps/sources/api/status',json={}).status_code,403)
        self.assertEqual(self.client.get('/apps/sources/%252e%252e/auth/me').status_code,400)
        config=load_config();config.apps=[a for a in config.apps if a.id=='sources'];config.apps[0].enabled=False
        client=TestClient(create_app(config));client.post('/auth/login',json={'username':'demo','password':'demo'},headers=CSRF)
        self.assertEqual(client.get('/api/apps').json(),{'apps':[]})
        self.assertEqual(client.get('/apps/sources/').status_code,404)

    def test_missing_app_secret_fails_closed(self):
        self.login()
        with patch.dict(os.environ,{'MARI_APP_GRANT_SECRET':''}):
            self.assertEqual(self.client.get('/apps/sources/').status_code,503)
        self.assertFalse(self.seen)

    def test_invalid_or_duplicate_app_config(self):
        raw=json.loads((MARI/'container/apps.json').read_text())
        raw['apps'].append(dict(raw['apps'][0]))
        with self.assertRaises(ValueError): Configuration.model_validate(raw)
        raw['apps'].pop();raw['apps'][0]['url']='http://user:password@example.com'
        with self.assertRaises(ValueError): Configuration.model_validate(raw)

    def test_oidc_not_fake_enabled(self):
        self.assertFalse(self.client.get('/auth/config').json()['oidc'])
        self.assertEqual(self.client.get('/auth/oidc/login').status_code,503)


class OIDCTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{**ENV,'MARI_OIDC_ISSUER':'https://id.example','MARI_OIDC_CLIENT_ID':'mari','MARI_OIDC_CLIENT_SECRET':'provider-secret'},clear=True)
        self.env.start();self.addCleanup(self.env.stop)
        self.app=create_app();self.client=TestClient(self.app);self.remote=self.app.state.oauth.oidc
        self.remote.load_server_metadata=AsyncMock(return_value={'issuer':'https://id.example','authorization_endpoint':'https://id.example/authorize','token_endpoint':'https://id.example/token','jwks_uri':'https://id.example/keys','id_token_signing_alg_values_supported':['RS256']})
        self.key=RSAKey.generate_key(2048)
        self.remote.fetch_jwk_set=AsyncMock(return_value={'keys':[self.key.as_dict(private=False)]})

    def begin(self):
        response=self.client.get('/auth/oidc/login',follow_redirects=False)
        self.assertEqual(response.status_code,302)
        params=parse_qs(urlsplit(response.headers['location']).query)
        self.assertEqual(params['code_challenge_method'],['S256'])
        self.assertEqual(params['redirect_uri'],['http://testserver/auth/oidc/callback'])
        return params

    def token(self,params,**overrides):
        claims={'iss':'https://id.example','sub':'user-7','aud':'mari','iat':int(time.time()),'exp':int(time.time())+300,'nonce':params['nonce'][0],'name':'Ada',**overrides}
        return {'access_token':'must-stay-server-side','id_token':jwt.encode({'alg':'RS256'},claims,self.key),'token_type':'Bearer'}

    def test_verified_oidc_login_and_tokens_not_stored(self):
        params=self.begin()
        self.remote.fetch_access_token=AsyncMock(return_value=self.token(params))
        result=self.client.get('/auth/oidc/callback',params={'code':'valid','state':params['state'][0]},follow_redirects=False)
        self.assertEqual(result.headers['location'],'/')
        self.assertEqual(self.client.get('/auth/me').json()['user']['name'],'Ada')
        self.assertIn('code_verifier',self.remote.fetch_access_token.call_args.kwargs)
        cookie=self.client.cookies.get('mari_container').split('.')[0]
        session=json.loads(base64.b64decode(cookie))
        self.assertNotIn('must-stay-server-side',json.dumps(session))
        self.assertEqual(set(session),{'user','expires'})

    def test_bad_state_and_nonce_rejected(self):
        params=self.begin();self.remote.fetch_access_token=AsyncMock(return_value=self.token(params))
        result=self.client.get('/auth/oidc/callback?code=bad&state=wrong',follow_redirects=False)
        self.assertIn('auth_error',result.headers['location']);self.remote.fetch_access_token.assert_not_awaited()
        params=self.begin();self.remote.fetch_access_token=AsyncMock(return_value=self.token(params,nonce='wrong'))
        result=self.client.get('/auth/oidc/callback',params={'code':'bad','state':params['state'][0]},follow_redirects=False)
        self.assertIn('auth_error',result.headers['location'])
        self.assertEqual(self.client.get('/auth/me').status_code,401)

    def test_bad_issuer_audience_and_expiry_rejected(self):
        for overrides in ({'iss':'https://evil.example'},{'aud':'someone-else'},{'exp':int(time.time())-600}):
            params=self.begin();self.remote.fetch_access_token=AsyncMock(return_value=self.token(params,**overrides))
            result=self.client.get('/auth/oidc/callback',params={'code':'bad','state':params['state'][0]},follow_redirects=False)
            self.assertIn('auth_error',result.headers['location'])
            self.assertEqual(self.client.get('/auth/me').status_code,401)


if __name__=='__main__':unittest.main()
