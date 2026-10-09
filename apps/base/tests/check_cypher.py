"""Run app query integration tests against the installed Orchid release; no network."""
import unittest

MODULES = [
    'apps.base.tests.test_lake_bindings',
    'apps.knowledge.tests.test_content_native',
    'apps.lineage.tests.test_queries',
    'apps.settings.tests.test_queries',
    'apps.insights.tests.test_queries',
    'apps.workflows.tests.test_queries',
    'apps.workflows.tests.test_native_operations',
]
if __name__ == '__main__':
    suite=unittest.defaultTestLoader.loadTestsFromNames(MODULES)
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not result.wasSuccessful())
