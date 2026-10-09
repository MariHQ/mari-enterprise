"""Keep scheduled maintenance within the explicit local-cluster budget."""
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

MARI=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(MARI))
from temporal.maintenance.compaction import job_spec, maintenance_required
from temporal.maintenance.rewrite import MIN_SMALL_FILES, maintain, needs_maintenance


class CompactionBudgetTests(unittest.TestCase):
    @patch.dict(os.environ, {'ICEBERG_MAINTENANCE_TABLES':'mari_streams.mari.records.mari.document',
                            'COMPACTION_IMAGE':'example@sha256:test'}, clear=True)
    def test_job_resource_budget_and_launch_configuration(self):
        container=job_spec({'run_id':'budget'})['spec']['template']['spec']['containers'][0]
        self.assertEqual(container['resources'],{'requests':{'cpu':'100m','memory':'512Mi'},'limits':{'cpu':'1','memory':'1536Mi'}})
        dockerfile=(MARI/'temporal/maintenance/Dockerfile').read_text()
        command=json.loads(next(line.removeprefix('ENTRYPOINT ') for line in dockerfile.splitlines() if line.startswith('ENTRYPOINT ')))
        self.assertEqual(command[command.index('--master')+1],'local[1]')
        self.assertEqual(command[command.index('--driver-memory')+1],'512m')
        self.assertLess(command.index('--driver-memory'),command.index('/opt/spark/rewrite.py'))
        self.assertTrue({'spark.sql.shuffle.partitions=2','spark.default.parallelism=1','spark.ui.enabled=false'}.issubset(command))

    def test_small_file_delete_and_manifest_batch_thresholds(self):
        self.assertEqual(MIN_SMALL_FILES,8)
        self.assertFalse(needs_maintenance(7,7,0,7))
        self.assertTrue(needs_maintenance(8,8,0,1))
        self.assertFalse(needs_maintenance(1,1,1,1))
        self.assertTrue(needs_maintenance(1,1,8,1))
        self.assertFalse(needs_maintenance(1,1,0,15))
        self.assertTrue(needs_maintenance(1,1,0,16))

    @patch.dict(os.environ, {'ICEBERG_MAINTENANCE_TABLES':'mari_streams.mari.records.mari.document'}, clear=True)
    def test_preflight_uses_the_shared_batch_threshold(self):
        files=[SimpleNamespace(data_file=SimpleNamespace(content=0,file_size_in_bytes=100)) for _ in range(7)]
        manifest=SimpleNamespace(fetch_manifest_entry=lambda *a,**kw:files)
        table=SimpleNamespace(io=None,current_snapshot=lambda:SimpleNamespace(manifests=lambda io:[manifest]))
        with patch('pyiceberg.catalog.load_catalog') as load:
            load.return_value.load_table.return_value=table
            self.assertFalse(maintenance_required({}))
            files.append(files[0])
            self.assertTrue(maintenance_required({}))

    def test_rewriter_uses_metadata_without_spark_count_jobs(self):
        spark=Mock()
        with patch.dict(sys.modules, {'dangling':SimpleNamespace(remove_obsolete_deletes=lambda *args:0)}), patch('temporal.maintenance.rewrite.file_stats',return_value=(8,8,1,1)):
            self.assertTrue(maintain(spark,'mari_streams.mari.records.mari.document'))
        spark.sql.assert_called_once()
        sql=spark.sql.call_args.args[0]
        self.assertIn("'min-input-files','8'",sql)
        self.assertIn("'delete-file-threshold','1'",sql)
        self.assertIn("'max-concurrent-file-group-rewrites','1'",sql)

    def test_table_that_becomes_healthy_launches_no_spark_job(self):
        spark=Mock()
        with patch.dict(sys.modules, {'dangling':SimpleNamespace(remove_obsolete_deletes=lambda *args:0)}), patch('temporal.maintenance.rewrite.file_stats',return_value=(1,1,1,2)):
            self.assertFalse(maintain(spark,'mari_streams.mari.records.mari.document'))
        spark.sql.assert_not_called()

    @patch.dict(os.environ, {'ICEBERG_MAINTENANCE_TABLES':'mari_streams.a,mari_streams.b', 'COMPACTION_IMAGE':'example@sha256:test'}, clear=True)
    def test_only_preflight_candidates_reach_spark(self):
        container=job_spec({'run_id':'selection'},['mari_streams.b'])['spec']['template']['spec']['containers'][0]
        self.assertEqual(container['env'][0]['value'],'mari_streams.b')
        for selected in ([],['other.table']):
            with self.assertRaises(ValueError):job_spec({'run_id':'selection'},selected)
