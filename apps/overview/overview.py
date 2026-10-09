from fastapi import APIRouter, Query
from apps.sdk.data.reader import execute, hydrate
router=APIRouter()

@router.get('/api/overview')
def overview():
    # Operational observations are not user documents or knowledge changes.
    predicate = "kind NOT IN ('edge','workflow','mining_receipt') AND source <> 'temporal'"
    recent = execute("SELECT * EXCLUDE(text), substring(text,1,400) AS text FROM records WHERE " + predicate + " ORDER BY observed_at DESC, record_id LIMIT 12")['rows']
    return {'recent': [hydrate(row) for row in recent]}


