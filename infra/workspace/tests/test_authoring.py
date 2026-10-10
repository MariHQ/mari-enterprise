import copy
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from bootstrap import documents


class ManifestTests(unittest.TestCase):
    def test_runtime_bindings_never_mutate_archived_manifest(self):
        public=[{'metadata':{'name':'example'}}, {'spec':{'env':[]}}]
        original=copy.deepcopy(public)
        values={'mari-runtime':{'MARI_STORAGE':'postgres','MARI_POSTGRES_DSN':'postgres.stack.svc:5432',
                               'MARI_APP_GRANT_SECRET':'test-runtime-secret'},
                'orchid-catalog':{'admin.secret':'test-catalog-secret'}}
        with patch('bootstrap.secret',side_effect=lambda key:values[key]):
            _,bound=documents('example','toolchain@sha256:test',public)
        self.assertEqual(public,original)
        self.assertIn('test-runtime-secret',[env['value'] for env in bound['spec']['env']])
        self.assertNotIn('test-runtime-secret',str(public))


class OutputStreamTests(unittest.TestCase):
    def test_reconnect_reads_from_offsets_without_restarting_command(self):
        import io
        from types import SimpleNamespace
        import client
        class Interrupted(client.grpc.RpcError):
            def code(self): return client.grpc.StatusCode.UNAVAILABLE
        calls=[]
        def stream(request,**kwargs):
            calls.append((request.stdout_offset,request.stderr_offset))
            if len(calls)==1:
                yield client.guest.ProcessOutput(stdout=b'first')
                yield client.guest.ProcessOutput(stderr=b'warning')
                raise Interrupted()
            yield client.guest.ProcessOutput(stdout=b'last')
            yield client.guest.ProcessOutput(exit=client.guest.Process(exit_code=0))
        out,err=io.BytesIO(),io.BytesIO()
        with patch('client.sys.stdout',SimpleNamespace(buffer=out)),patch('client.sys.stderr',SimpleNamespace(buffer=err)),patch('client.time.sleep'):
            result=client.follow_process(SimpleNamespace(StreamProcessOutput=stream),'existing-process',(),30)
        self.assertEqual(result,0)
        self.assertEqual(calls,[(0,0),(5,7)])
        self.assertEqual(out.getvalue(),b'firstlast')
        self.assertEqual(err.getvalue(),b'warning')

if __name__=='__main__':unittest.main()
