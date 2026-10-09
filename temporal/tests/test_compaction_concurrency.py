"""A competing Flink commit must not restart a whole compaction pass."""
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from temporal.maintenance.rewrite import rewrite_manifests


def java_failure(name='ValidationException', message=None):
    error = RuntimeError('Spark procedure failed')
    error.java_exception = SimpleNamespace(
        getClass=lambda: SimpleNamespace(getName=lambda: 'org.apache.iceberg.exceptions.' + name),
        getMessage=lambda: message or 'Deleted manifest s3://bucket/table/metadata/old.avro could not be found in the latest snapshot 123',
    )
    return error


class ManifestConcurrencyTests(unittest.TestCase):
    def test_refreshes_and_replans_only_manifest_action(self):
        spark = Mock()
        spark.sql.side_effect = [java_failure(), Mock()]
        self.assertTrue(rewrite_manifests(spark, '`mari`.`mari`.`mari.records.mari.document`', '`mari`.`mari.records.mari.document`'))
        self.assertEqual(spark.sql.call_count, 2)
        spark.catalog.refreshTable.assert_called_once_with('`mari`.`mari`.`mari.records.mari.document`')
        self.assertTrue(all('rewrite_manifests' in call.args[0] for call in spark.sql.call_args_list))

    def test_busy_table_defers_after_three_attempts(self):
        spark = Mock()
        spark.sql.side_effect = [java_failure(), java_failure(), java_failure()]
        self.assertFalse(rewrite_manifests(spark, 'identifier', 'procedure_table'))
        self.assertEqual(spark.sql.call_count, 3)
        self.assertEqual(spark.catalog.refreshTable.call_count, 2)

    def test_unknown_commits_other_validation_and_runtime_errors_propagate(self):
        for failure in (
            java_failure('CommitStateUnknownException'),
            java_failure(message='Cannot commit: required data files are missing'),
            RuntimeError('authentication failed'),
        ):
            with self.subTest(failure=failure):
                spark = Mock()
                spark.sql.side_effect = failure
                with self.assertRaises(RuntimeError):
                    rewrite_manifests(spark, 'identifier', 'procedure_table')
                spark.sql.assert_called_once()
                spark.catalog.refreshTable.assert_not_called()
