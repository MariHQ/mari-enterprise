"""Destination queries owned by the destinations application."""
from fastapi import APIRouter, HTTPException
from apps.base import db as reader
from apps.base.catalog.graph import projection
router=APIRouter()

@router.get('/api/pages/{page_id}')
def page(page_id:str):
    if page_id!='publish':raise HTTPException(404,'Unknown page')
    rows=reader.execute('MATCH (r:MariDestination) RETURN '+projection('MariDestination')+' ORDER BY r.observed_at DESC,r.record_id LIMIT 101',limit=101)['rows']
    return {'records':[reader.hydrate(r) for r in rows[:100]],'truncated':len(rows)>100}
