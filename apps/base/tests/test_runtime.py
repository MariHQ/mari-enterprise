import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import zipfile

from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from apps.sdk.runtime import Manifest, authenticated, create_app
from validate_wheel import validate


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'MARI_APP_GRANT_SECRET':'s'*48},clear=True)
        self.env.start();self.addCleanup(self.env.stop)
        self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
        static=Path(self.directory.name)/'static';static.mkdir();(static/'index.html').write_text('APP SHELL')
        (Path(self.directory.name)/'secret.txt').write_text('PRIVATE')
        router=APIRouter()
        @router.get('/read')
        def read(claims=Depends(authenticated)):return {'sub':claims['sub']}
        @router.get('/forgot-dependency')
        def other():return {'protected':True}
        self.client=TestClient(create_app(Manifest(name='next-screen'),router,static))

    def token(self,**overrides):
        claims={'iss':'mari-container','aud':'next-screen','sub':'demo','project':'1','exp':int(time.time())+180,**overrides}
        body=base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip('=')
        signature=hmac.new(('s'*48).encode(),body.encode(),hashlib.sha256).hexdigest()
        return {'Authorization':'Bearer '+body+'.'+signature}

    def test_new_routes_are_protected_without_opt_in(self):
        self.assertEqual(self.client.get('/api/forgot-dependency').status_code,401)
        self.assertEqual(self.client.get('/api/forgot-dependency',headers=self.token()).status_code,200)
        self.assertEqual(self.client.get('/api/read',headers=self.token()).json(),{'sub':'demo'})

    def test_wrong_app_expired_wrong_project_and_issuer(self):
        for changes in ({'aud':'sources'},{'exp':time.time()-1},{'project':'other'},{'iss':'untrusted'},{'exp':time.time()+600}):
            self.assertEqual(self.client.get('/api/read',headers=self.token(**changes)).status_code,401)

    def test_static_health_and_unknown_routes(self):
        self.assertEqual(self.client.get('/healthz').json()['app'],'next-screen')
        self.assertEqual(self.client.get('/nested/page').text,'APP SHELL')
        self.assertEqual(self.client.get('/assets/missing.js').status_code,404)
        self.assertEqual(self.client.get('/api/missing').status_code,404)
        self.assertNotIn('PRIVATE',self.client.get('/%2e%2e/secret.txt').text)


class WheelTests(unittest.TestCase):
    def wheel(self,directory,tag,catalog=True):
        path=Path(directory)/'orchiddb.whl'
        with zipfile.ZipFile(path,'w') as archive:
            archive.writestr('orchiddb.dist-info/WHEEL','Wheel-Version: 1.0\nTag: '+tag+'\n')
            archive.writestr('orchiddb/CORE_REVISION','test')
            archive.writestr('orchiddb/native/liborchiddb_compiler.so','test')
            if catalog:archive.writestr('orchiddb/catalog.py','test')
        return path

    def test_rejects_macos_wrong_arch_and_old_api(self):
        with tempfile.TemporaryDirectory() as directory:
            for tag,catalog in [('py3-none-macosx_11_0_arm64',True),('py3-none-linux_x86_64',True),('py3-none-linux_aarch64',False)]:
                with self.assertRaises(ValueError):validate(self.wheel(directory,tag,catalog),'linux/arm64')
            validate(self.wheel(directory,'py3-none-linux_aarch64'),'linux/arm64')


if __name__=='__main__':unittest.main()
