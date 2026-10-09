"""Physical Iceberg delete semantics using tiny local Parquet files."""
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq
from pyiceberg.manifest import DataFileContent, FileFormat
from pyiceberg.partitioning import PartitionSpec, PartitionField
from pyiceberg.schema import Schema
from pyiceberg.transforms import IdentityTransform, BucketTransform
from pyiceberg.types import NestedField, StringType

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from apps.sdk.iceberg_files import manifest_source, snapshot_source


class IcebergDeleteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = duckdb.connect()
        self.addCleanup(self.db.close)
        self.entries = []
        self.schema = Schema(
            NestedField(1, 'project_id', StringType(), required=True),
            NestedField(2, 'record_id', StringType()),
            NestedField(3, 'title', StringType()),
        )
        self.spec = PartitionSpec(PartitionField(1, 1000, IdentityTransform(), 'project_id'), spec_id=0)
        self.summary = {'total-position-deletes': '1', 'total-equality-deletes': '1'}
        self.manifest = SimpleNamespace(fetch_manifest_entry=self.fetch_entries)
        self.snapshot = SimpleNamespace(summary=self.summary, manifests=lambda io: [self.manifest])
        self.table = SimpleNamespace(
            io=object(), schema=lambda: self.schema, spec=lambda: self.spec,
            specs=lambda: {0: self.spec}, current_snapshot=lambda: self.snapshot,
            metadata=SimpleNamespace(format_version=2, schemas=[self.schema], current_schema_id=0),
            metadata_location='/unused/metadata.json',
        )

    def fetch_entries(self, io, discard_deleted):
        self.assertIs(io, self.table.io)
        self.assertTrue(discard_deleted)
        return self.entries

    def file(self, rows, content=DataFileContent.DATA, sequence=1, partition=('1',), equality_ids=None):
        path = Path(self.temp.name) / (str(len(self.entries)) + "'file.parquet")
        # Explicit strings keep an all-null equality key from becoming an Arrow null type.
        if content == DataFileContent.POSITION_DELETES:
            arrow_schema = pa.schema([('file_path', pa.string()), ('pos', pa.int64())])
        elif content == DataFileContent.EQUALITY_DELETES:
            names = [self.schema.find_field(i).name for i in equality_ids]
            arrow_schema = pa.schema([(name, pa.string()) for name in names])
        else:
            arrow_schema = pa.schema([(field.name, pa.string()) for field in self.schema.fields])
        pq.write_table(pa.Table.from_pylist(rows, schema=arrow_schema), path)
        entry = SimpleNamespace(sequence_number=sequence, data_file=SimpleNamespace(
            file_path=str(path), file_format=FileFormat.PARQUET, spec_id=0,
            partition=partition, content=content, equality_ids=equality_ids,
        ))
        self.entries.append(entry)
        return entry

    def row(self, identity='a', title='old', project='1'):
        return dict(project_id=project, record_id=identity, title=title)

    def rows(self):
        return self.db.execute('SELECT * FROM ' + manifest_source(self.table) + ' ORDER BY title').fetchall()

    def test_newer_equality_removes_old_but_same_sequence_preserves_replacement(self):
        self.file([self.row()], sequence=1)
        self.file([self.row(title='replacement')], sequence=2)
        self.file([{'project_id': '1', 'record_id': 'a'}], DataFileContent.EQUALITY_DELETES, sequence=2, equality_ids=[1, 2])
        self.assertEqual(self.rows(), [('1', 'a', 'replacement')])

    def test_same_sequence_position_delete_uses_physical_zero_based_row(self):
        data = self.file([self.row('first'), self.row('second'), self.row('third')], sequence=3)
        self.file([{'file_path': data.data_file.file_path, 'pos': 1}], DataFileContent.POSITION_DELETES, sequence=3)
        relation = manifest_source(self.table)
        rows = self.db.execute("SELECT record_id FROM " + relation + " WHERE record_id != 'first'").fetchall()
        self.assertEqual(rows, [('third',)])

    def test_wrong_partition_does_not_apply_either_delete_kind(self):
        data = self.file([self.row()], sequence=1)
        self.file([{'project_id': '1', 'record_id': 'a'}], DataFileContent.EQUALITY_DELETES, sequence=2, partition=('other',), equality_ids=[1, 2])
        self.file([{'file_path': data.data_file.file_path, 'pos': 0}], DataFileContent.POSITION_DELETES, sequence=2, partition=('other',))
        self.assertEqual(self.rows(), [('1', 'a', 'old')])

    def test_mixed_deletes_remove_both_targets(self):
        data = self.file([self.row('equality'), self.row('position'), self.row('keep')], sequence=1)
        self.file([{'project_id': '1', 'record_id': 'equality'}], DataFileContent.EQUALITY_DELETES, sequence=2, equality_ids=[1, 2])
        self.file([{'file_path': data.data_file.file_path, 'pos': 1}], DataFileContent.POSITION_DELETES, sequence=1)
        self.assertEqual(self.rows(), [('1', 'keep', 'old')])

    def test_equality_delete_is_null_safe(self):
        self.file([self.row(None), self.row('keep')], sequence=1)
        self.file([{'record_id': None}], DataFileContent.EQUALITY_DELETES, sequence=2, equality_ids=[2])
        self.assertEqual(self.rows(), [('1', 'keep', 'old')])

    def test_rejects_evolved_or_nonidentity_partition_specs(self):
        original = self.table.specs
        self.table.specs = lambda: {0: self.spec, 1: PartitionSpec(spec_id=1)}
        with self.assertRaisesRegex(ValueError, 'partition spec evolution'):
            manifest_source(self.table)
        self.table.specs = lambda: {0: PartitionSpec(PartitionField(1, 1000, BucketTransform(8), 'bucket'), spec_id=0)}
        with self.assertRaisesRegex(ValueError, 'identity partitions'):
            manifest_source(self.table)
        self.table.specs = original
        self.file([self.row()]).data_file.spec_id = 99
        with self.assertRaisesRegex(ValueError, 'partition spec'):
            manifest_source(self.table)

    def test_rejects_missing_sequence_unknown_equality_ids_and_formats(self):
        data = self.file([self.row()], sequence=None)
        with self.assertRaisesRegex(ValueError, 'sequence number'):
            manifest_source(self.table)
        data.sequence_number = 1
        data.data_file.file_format = FileFormat.AVRO
        with self.assertRaisesRegex(ValueError, 'format'):
            manifest_source(self.table)
        data.data_file.file_format = FileFormat.PARQUET
        delete = self.file([{'record_id': 'a'}], DataFileContent.EQUALITY_DELETES, sequence=2, equality_ids=[2])
        delete.data_file.equality_ids = [999]
        with self.assertRaisesRegex(ValueError, 'equality field ID'):
            manifest_source(self.table)

    def test_optional_summary_cannot_bypass_delete_handling(self):
        for summary in [self.summary, {'total-position-deletes':'0'}, {}, None]:
            self.snapshot.summary = summary
            with patch('apps.sdk.iceberg_files.manifest_source', return_value='(SELECT 1)') as reader:
                self.assertEqual(snapshot_source(self.table), '(SELECT 1)')
                reader.assert_called_once_with(self.table, self.snapshot)


if __name__ == '__main__':
    unittest.main()
