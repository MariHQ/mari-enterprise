"""Read Mari's fixed Iceberg v2 schema when DuckDB cannot combine delete types.

The ordinary Iceberg extension remains the reader unless a snapshot contains both
position and equality deletes. Pin manifests to the loaded snapshot and apply v2
sequence/partition rules before any app predicate, aggregation, or limit.
"""
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import json
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
    if any(field.name in ('filename','file_row_number') for field in schema.fields):
        raise ValueError('Reserved Parquet scan metadata field name')
    if not data:
        types = {'string': 'VARCHAR', 'long': 'BIGINT', 'int': 'INTEGER'}
        return '(SELECT ' + ', '.join('CAST(NULL AS ' + types[str(f.field_type)] + ') AS ' + identifier(f.name) for f in schema.fields) + ' WHERE FALSE)'

    def scan(entries, columns, positions=False):
        paths = '[' + ','.join(literal(e.data_file.file_path) for e in entries) + ']'
        sequence = 'CASE filename ' + ' '.join('WHEN ' + literal(e.data_file.file_path) + ' THEN ' + str(e.sequence_number) for e in entries) + " ELSE error('Unrecognized Iceberg file path') END"
        partition = 'CASE filename ' + ' '.join('WHEN ' + literal(e.data_file.file_path) + ' THEN ' + literal(json.dumps(tuple(e.data_file.partition))) for e in entries) + " ELSE error('Unrecognized Iceberg file path') END"
        return 'SELECT ' + columns + ', filename AS __path, ' + sequence + ' AS __seq, ' + partition + ' AS __partition FROM read_parquet(' + paths + ', hive_partitioning=false, filename=true' + (', file_row_number=true' if positions else '') + ')'

    # Each physical file is scanned once. A separate subquery per data/delete
    # pair would cause quadratic remote reads as Flink adds checkpoints.
    columns = ', '.join(identifier(field.name) for field in schema.fields)
    ctes = ['mari_data AS (' + scan(data, columns + ', file_row_number AS __pos', True) + ')']
    conditions = []
    equality = defaultdict(list)
    positional = []
    for entry in deletes:
        if entry.data_file.content == DataFileContent.POSITION_DELETES:
            positional.append(entry)
        else:
            equality[tuple(sorted(entry.data_file.equality_ids))].append(entry)
    for number, (ids, entries) in enumerate(equality.items()):
        name = 'mari_equality_' + str(number)
        keys = ', '.join(identifier(fields[i].name) for i in ids)
        ctes.append(name + ' AS MATERIALIZED (' + scan(entries, keys) + ')')
        match = ' AND '.join('d.' + identifier(fields[i].name) + ' IS NOT DISTINCT FROM x.' + identifier(fields[i].name) for i in ids)
        conditions.append('NOT EXISTS (SELECT 1 FROM ' + name + ' x WHERE x.__seq > d.__seq AND x.__partition = d.__partition AND ' + match + ')')
    if positional:
        ctes.append('mari_positions AS MATERIALIZED (' + scan(positional, 'file_path, pos') + ')')
        conditions.append('NOT EXISTS (SELECT 1 FROM mari_positions x WHERE x.__seq >= d.__seq AND x.__partition = d.__partition AND x.file_path = d.__path AND x.pos = d.__pos)')
    return '(WITH ' + ', '.join(ctes) + ' SELECT ' + ', '.join('d.' + identifier(f.name) for f in schema.fields) + ' FROM mari_data d' + (' WHERE ' + ' AND '.join(conditions) if conditions else '') + ')'
