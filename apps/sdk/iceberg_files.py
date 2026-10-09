"""Read Mari's fixed Iceberg v2 schema when DuckDB cannot combine delete types.

The ordinary Iceberg extension remains the reader unless a snapshot contains both
position and equality deletes. Pin manifests to the loaded snapshot and apply v2
sequence/partition rules before any app predicate, aggregation, or limit.
"""
from concurrent.futures import ThreadPoolExecutor
from pyiceberg.manifest import DataFileContent, FileFormat
from pyiceberg.transforms import IdentityTransform


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def identifier(value):
    return '"' + value.replace('"', '""') + '"'


def snapshot_source(table):
    snapshot = table.current_snapshot()
    summary = snapshot.summary if snapshot else None
    if not summary or not (int(summary.get('total-position-deletes', '0')) and int(summary.get('total-equality-deletes', '0'))):
        return 'iceberg_scan(' + literal(table.metadata_location) + ')'
    return manifest_source(table, snapshot)


def manifest_source(table, snapshot=None):
    """Narrow, fail-closed adapter for the schema created by Mari SchemaApply."""
    snapshot = snapshot or table.current_snapshot()
    if table.metadata.format_version != 2 or len(table.metadata.schemas) != 1:
        raise ValueError('Mixed-delete reads require Mari Iceberg v2 without schema evolution')
    schema = table.schema()
    fields = {field.field_id: field for field in schema.fields}
    if any(str(field.field_type) not in ('string', 'long', 'int') for field in fields.values()):
        raise ValueError('Unsupported mixed-delete field type')
    specs = table.specs()
    if len(specs) != 1:
        raise ValueError('Mixed-delete reads do not support partition spec evolution')
    for spec in specs.values():
        if any(not isinstance(f.transform, IdentityTransform) or f.source_id not in fields for f in spec.fields):
            raise ValueError('Mixed-delete reads require identity partitions')
    manifests = list(snapshot.manifests(table.io))
    with ThreadPoolExecutor(max_workers=4) as pool:
        entries = [entry for batch in pool.map(lambda m: m.fetch_manifest_entry(table.io, discard_deleted=True), manifests) for entry in batch]
    data = []; deletes = []
    for entry in entries:
        file = entry.data_file
        if entry.sequence_number is None or entry.sequence_number < 0:
            raise ValueError('Missing Iceberg data sequence number')
        if file.file_format != FileFormat.PARQUET or file.spec_id not in specs:
            raise ValueError('Unsupported Iceberg data file format or partition spec')
        if len(tuple(file.partition)) != len(specs[file.spec_id].fields):
            raise ValueError('Invalid Iceberg partition tuple')
        if file.content == DataFileContent.DATA:
            data.append(entry)
        elif file.content in (DataFileContent.POSITION_DELETES, DataFileContent.EQUALITY_DELETES):
            if file.content == DataFileContent.EQUALITY_DELETES and (not file.equality_ids or any(i not in fields for i in file.equality_ids)):
                raise ValueError('Unknown Iceberg equality field ID')
            deletes.append(entry)
        else:
            raise ValueError('Unsupported Iceberg file content')
    columns = ', '.join('d.' + identifier(field.name) for field in schema.fields)
    parts = []
    for entry in data:
        file = entry.data_file
        conditions = []
        for removal in deletes:
            delete = removal.data_file
            same_partition = file.spec_id == delete.spec_id and tuple(file.partition) == tuple(delete.partition)
            global_equality = delete.content == DataFileContent.EQUALITY_DELETES and not specs[delete.spec_id].fields
            if not (same_partition or global_equality):
                continue
            if delete.content == DataFileContent.EQUALITY_DELETES:
                if removal.sequence_number <= entry.sequence_number:
                    continue
                match = ' AND '.join('d.' + identifier(fields[i].name) + ' IS NOT DISTINCT FROM x.' + identifier(fields[i].name) for i in delete.equality_ids)
            else:
                if removal.sequence_number < entry.sequence_number:
                    continue
                match = 'x.file_path = ' + literal(file.file_path) + ' AND x.pos = d.file_row_number'
            conditions.append('NOT EXISTS (SELECT 1 FROM read_parquet(' + literal(delete.file_path) + ', hive_partitioning=false) x WHERE ' + match + ')')
        parts.append('SELECT ' + columns + ' FROM read_parquet(' + literal(file.file_path) + ', hive_partitioning=false, file_row_number=true) d' + (' WHERE ' + ' AND '.join(conditions) if conditions else ''))
    if not parts:
        types = {'string': 'VARCHAR', 'long': 'BIGINT', 'int': 'INTEGER'}
        parts = ['SELECT ' + ', '.join('CAST(NULL AS ' + types[str(f.field_type)] + ') AS ' + identifier(f.name) for f in schema.fields) + ' WHERE FALSE']
    return '(' + ' UNION ALL '.join(parts) + ')'
