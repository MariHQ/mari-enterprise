"""Detail reads require the selected node's physical topic table."""
from fastapi import APIRouter, HTTPException
from apps.base.db import execute, hydrate
from apps.base.catalog.graph import projection
from apps.base.catalog.nodes import label_for_table
router=APIRouter()

@router.get('/api/records/{record_id:path}')
def record(record_id:str,table:str):
    try:label=label_for_table(table)
    except ValueError as error:raise HTTPException(422,str(error)) from None
    rows=execute('MATCH (r:'+label+') WHERE r.record_id=$id RETURN '+projection(label)+' LIMIT 1',{'id':record_id},table=table)['rows']
    if not rows:raise HTTPException(404,'Record not found')
    return hydrate(rows[0])

@router.get('/api/record')
def current(id:str,table:str):return record(id,table)

@router.get('/api/history')
def history(id:str,table:str):
    from apps.base.catalog.history import source_history
    return source_history(id,table)
