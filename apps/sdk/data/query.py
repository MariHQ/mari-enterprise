"""Read-only OrchidDB sessions over lake snapshots; no local record database."""
from __future__ import annotations
from contextlib import contextmanager
import json
import os
from threading import Timer, BoundedSemaphore
from queue import LifoQueue, Empty
import duckdb
import sqlglot
from sqlglot import exp
from .mappings import KINDS, NAMESPACE, HISTORY_NAMESPACE, route_for, accepts
from .relationships import RELATIONSHIP_LINKS_SQL

COLUMNS = [('project_id','VARCHAR'),('record_id','VARCHAR'),('event_id','VARCHAR'),
    ('operation','VARCHAR'),('kind','VARCHAR'),('source','VARCHAR'),('title','VARCHAR'),
    ('text','VARCHAR'),('url','VARCHAR'),('properties','VARCHAR'),('actor','VARCHAR'),
    ('observed_at','BIGINT'),('stream_offset','BIGINT'),('table','VARCHAR')]
TABLES = {'records', 'history', 'links', 'operations', 'graph_records'} | set(KINDS)
KNOWLEDGE_ROWS = "source <> 'temporal' AND kind NOT IN ('workflow','mining_receipt')"


# Current-record provenance is computed rather than independently persisted, so
# retractions cannot leave stale connector/run links behind.
PROVENANCE_LINKS_SQL = """SELECT record_id || ':connector' AS record_id,
    json_extract_string(properties,'$.connector_id') AS from_id, record_id AS to_id,
    'ingested' AS relation, title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.connector_id') IS NOT NULL
    UNION ALL SELECT record_id || ':ingestion-run',
    json_extract_string(properties,'$.ingestion_run_id'), record_id,
    'produced', title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.ingestion_run_id') IS NOT NULL
    UNION ALL SELECT record_id || ':author', json_extract_string(properties,'$.author_record_id'),
    record_id, 'authored', title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.author_record_id') IS NOT NULL
    UNION ALL SELECT record_id || ':collection', json_extract_string(properties,'$.collection_id'),
    record_id, 'contains', title, properties, observed_at FROM graph_records
    WHERE kind <> 'edge' AND json_extract_string(properties,'$.collection_id') IS NOT NULL"""


MINING_LINKS_SQL = """SELECT candidate.record_id || ':source', candidate.record_id,
    evidence.record_id, 'derived_from', candidate.title, candidate.properties, candidate.observed_at
    FROM graph_records candidate JOIN graph_records evidence
    ON evidence.record_id=json_extract_string(candidate.properties,'$.source_id')
    AND evidence.event_id=json_extract_string(candidate.properties,'$.evidence_id')
    WHERE candidate.source='agent' AND candidate.kind NOT IN ('edge','workflow','mining_receipt')
    UNION ALL SELECT candidate.record_id || ':execution', execution.record_id,
    candidate.record_id, 'produced', candidate.title, candidate.properties, candidate.observed_at
    FROM graph_records candidate JOIN graph_records execution
    ON execution.record_id='run:' || json_extract_string(candidate.properties,'$.run_id')
    AND execution.kind='workflow' AND execution.source='agent'
    WHERE candidate.source='agent' AND candidate.kind NOT IN ('edge','workflow','mining_receipt')"""


def validate_read(query: str, dialect='duckdb', tables=None):
    statements = sqlglot.parse(query, read=dialect)
    if len(statements) != 1 or not isinstance(statements[0], (exp.Select, exp.Union, exp.Intersect, exp.Except)):
        raise ValueError('Only a single read-only query is allowed')
    tree = statements[0]
    forbidden = (exp.Insert, exp.Update, exp.Delete, exp.Create, exp.Drop, exp.Command, exp.Into)
    if any(isinstance(node, forbidden) for node in tree.walk()):
        raise ValueError('Knowledge API is read-only')
    ctes = {cte.alias for cte in tree.find_all(exp.CTE)}
    for table in tree.find_all(exp.Table):
        if not isinstance(table.this, exp.Identifier) or table.name not in (TABLES if tables is None else set(tables)) | ctes or table.db or table.catalog:
            raise ValueError('Queries may only read registered knowledge views')
    # Unknown functions include query(), read_parquet(), http and extension hooks.
    allowed = {'json_extract', 'json_extract_string', 'json_array_length', 'json_contains',
               'json_each', 'regexp_matches', 'epoch', 'to_timestamp', 'list_contains'}
    for function in tree.find_all(exp.Anonymous):
        if function.name.lower() not in allowed:
            raise ValueError(f'Function is not available: {function.name}')
    return tree

