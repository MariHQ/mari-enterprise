"""Bounded one-hop neighborhoods resolved against a single lake snapshot."""
from fastapi import APIRouter, HTTPException, Query
from .reader import execute, hydrate
from .query import COLUMNS

router = APIRouter()

# Records and computed edges share one result envelope. No record body is read.
RECORD_COLUMNS = ', '.join("'' AS text" if name == 'text' else '"'+name+'"' for name, _ in COLUMNS)
EDGE_COLUMNS = ', '.join(name if name in ('record_id', 'observed_at') else f'CAST(NULL AS {kind}) AS "{name}"' for name, kind in COLUMNS)

@router.get('/api/lineage')
def lineage(focal: str = Query(min_length=1, max_length=2048), limit: int = Query(30, ge=1, le=100)):
    query = f"""WITH focal_record AS MATERIALIZED (
        SELECT {RECORD_COLUMNS} FROM graph_records
        WHERE record_id=$id AND kind <> 'edge' LIMIT 1
    ), adjacent AS MATERIALIZED (
        SELECT record_id, observed_at, from_id, to_id, relation FROM links
        WHERE (from_id=$id OR to_id=$id) AND EXISTS (SELECT 1 FROM focal_record)
        ORDER BY record_id LIMIT $lookahead
    ), visible AS MATERIALIZED (
        SELECT * FROM adjacent ORDER BY record_id LIMIT $limit
    ), endpoints AS (
        SELECT from_id AS id FROM visible UNION SELECT to_id AS id FROM visible
    ), nodes AS (
        SELECT * FROM focal_record UNION ALL
        SELECT {RECORD_COLUMNS} FROM graph_records
        WHERE kind <> 'edge' AND record_id <> $id AND record_id IN (SELECT id FROM endpoints)
    ), result AS (
        SELECT 'record' AS entry_type, *, CAST(NULL AS VARCHAR) AS from_id,
            CAST(NULL AS VARCHAR) AS to_id, CAST(NULL AS VARCHAR) AS relation FROM nodes
        UNION ALL
        SELECT 'edge', {EDGE_COLUMNS}, from_id, to_id, relation FROM visible
    ) SELECT *, EXISTS (SELECT 1 FROM adjacent LIMIT 1 OFFSET $limit) AS has_more FROM result"""
    rows = execute(query, {'id': focal, 'limit': limit, 'lookahead': limit + 1}, limit=2 * limit + 1)['rows']
    if not rows:
        raise HTTPException(404, 'Selected lineage record not found')
    records = [hydrate({name: row[name] for name, _ in COLUMNS}) for row in rows if row['entry_type'] == 'record']
    edges = [{name: row[name] for name in ('record_id', 'observed_at', 'from_id', 'to_id', 'relation')}
             for row in rows if row['entry_type'] == 'edge']
    return {'records': records, 'edges': edges, 'has_more': rows[0]['has_more'], 'limit': limit, 'focal': focal}
