"""Offline contracts for using shared infrastructure without provisioning it."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

MARI = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(MARI))
from temporal.maintenance.catalog import catalog_properties, maintenance_tables, spark_catalog_properties
from temporal.maintenance.compaction import job_spec
from temporal import bootstrap


class CatalogTests(unittest.TestCase):
    @patch.dict(os.environ, {}, clear=True)
    def test_polaris_used_by_both_clients(self):
        self.assertEqual(catalog_properties()['uri'], 'http://polaris.stack.svc:8181/api/catalog')
        self.assertEqual(catalog_properties()['warehouse'], 'lake')
        self.assertEqual(spark_catalog_properties()['type'], 'rest')
        self.assertNotIn('jdbc.user', spark_catalog_properties())

    @patch.dict(os.environ, {'ICEBERG_CATALOG_PROPERTIES': '{"type":"sql"}'}, clear=True)
    def test_rejects_old_catalog(self):
        with self.assertRaises(ValueError):
            catalog_properties()

    @patch.dict(os.environ, {}, clear=True)
    def test_no_catalog_wide_maintenance_by_default(self):
        with self.assertRaises(ValueError):
            maintenance_tables()
        with self.assertRaises(ValueError):
            job_spec({'run_id': 'test'})

    @patch.dict(os.environ, {'ICEBERG_MAINTENANCE_TABLES': 'events.t_123,events.t_456',
                            'MARI_JOB_NAMESPACE': 'jobs', 'COMPACTION_IMAGE': 'example@sha256:test',
                            'COMPACTION_AWS_SECRET': 'aws-runtime',
                            'COMPACTION_CATALOG_SECRET': 'polaris-runtime'}, clear=True)
    def test_job_retries_and_allowlist(self):
        request = {'run_id': 'same-run', 'table': 'events.t_123'}
        job = job_spec(request)
        self.assertEqual(job['metadata']['name'], job_spec(request)['metadata']['name'])
        self.assertEqual(job['metadata']['namespace'], 'jobs')
        container = job['spec']['template']['spec']['containers'][0]
        self.assertEqual(container['env'][0]['value'], 'events.t_123')
        self.assertEqual(container['envFrom'][1]['secretRef']['name'], 'polaris-runtime')
        with self.assertRaises(ValueError):
            job_spec({'run_id': 'test', 'table': 'cdc.someone_elses_table'})


class RegistrationTests(unittest.IsolatedAsyncioTestCase):
    @patch.dict(os.environ, {}, clear=True)
    async def test_disabled_registration_does_not_connect(self):
        with patch.object(bootstrap.Client, 'connect', new_callable=AsyncMock) as connect:
            await bootstrap.schedule()
            connect.assert_not_awaited()

    @patch.dict(os.environ, {'TEMPORAL_JOBS_ENABLED': 'true', 'ICEBERG_COMPACTION_ENABLED': 'true'}, clear=True)
    async def test_invalid_maintenance_does_not_start_other_jobs(self):
        with patch.object(bootstrap.Client, 'connect', new_callable=AsyncMock) as connect:
            with self.assertRaises(ValueError):
                await bootstrap.schedule()
            connect.assert_not_awaited()

    @patch.dict(os.environ, {'TEMPORAL_JOBS_ENABLED': 'true', 'DECISION_MINING_ENABLED': 'true',
                            'TEMPORAL_ADDRESS': 'shared:7233', 'TEMPORAL_NAMESPACE': 'mari-test',
                            'TEMPORAL_TASK_QUEUE': 'mari-test'}, clear=True)
    async def test_existing_schedule_is_not_modified(self):
        from temporalio.client import ScheduleAlreadyRunningError
        client = AsyncMock()
        client.create_schedule.side_effect = ScheduleAlreadyRunningError()
        with patch.object(bootstrap.Client, 'connect', new_callable=AsyncMock, return_value=client) as connect:
            await bootstrap.schedule()
        connect.assert_awaited_once_with('shared:7233', namespace='mari-test')
        client.get_schedule_handle.assert_not_called()
        client.list_schedules.assert_not_called()
        self.assertEqual(client.create_schedule.call_args.args[0], 'mine-decisions-daily')
        self.assertEqual(client.create_schedule.call_args.args[1].action.task_queue, 'mari-test')


if __name__ == '__main__':
    unittest.main()
