import json
import unittest
from container.ax_protocol import ax_pb2 as ax
from container.registry import Registry, registered_app


def task(name='reports', **manifest):
    item=ax.Task(metadata=ax.ObjectMeta(name=name,atespace='mari'))
    item.spec.workspaces.add(name=name,path='/workspace/mari')
    item.spec.env.add(name='MARI_APP_REGISTRATION',value=json.dumps(
        dict(id=name,name='Reports',routes=['/reports'],**manifest)))
    return item


class RegistryTests(unittest.TestCase):
    def test_native_owner_controls_binding(self):
        app=registered_app(task())
        self.assertEqual(app.substrate.actor,'mari/reports')
        self.assertEqual(app.substrate.workspace,'reports')
        self.assertNotIn('substrate',app.public())

    def test_fork_cannot_register_parent(self):
        fork=task();fork.metadata.name='reports-fork'
        with self.assertRaises(ValueError): registered_app(fork)

    def test_endpoint_injection_rejected(self):
        with self.assertRaises(ValueError): registered_app(task(url='http://attacker'))

    def test_duplicate_routes_and_bad_manifest_ignored(self):
        registry=Registry([],loader=lambda:[task(),task('other'),task('bad',url='http://attacker')])
        self.assertEqual(list(registry.applications()),['reports'])

    def test_outage_retains_last_successful_catalog(self):
        registry=Registry([],loader=lambda:[task()])
        registry.applications();registry.expires=0
        def fail(): raise ConnectionError('AX unavailable')
        registry.loader=fail
        self.assertIn('reports',registry.applications())


if __name__=='__main__': unittest.main()
