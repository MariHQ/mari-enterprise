"""Workflows write routes and revision queries, owned by this application."""
import json
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, model_validator
from apps.base import db as reader
from apps.base.commands import WriteInput as BaseWriteInput, publish_change, actor_identity, scope
router=APIRouter()

WriteInput=BaseWriteInput

def current_revision(body):
    from apps.base.catalog.nodes import label_for_table
    label=label_for_table(body.table)
    rows=reader.execute(f'MATCH (r:{label}) WHERE r.record_id=$id RETURN r.event_id AS event_id LIMIT 1',{'id':body.record_id},table=body.table)['rows']
    return rows[0]['event_id'] if rows else None

def publish(body:WriteInput,request_id:str,actor:str,operation='upsert'):
    if body.table not in {f'mari.records.{source}.{kind}' for source in ('ax','agent','substrate') for kind in ('trajectory','step')}:
        raise HTTPException(422,'Workflows writes require a trajectory or step table')
    return publish_change(body,request_id,actor,operation,revision_lookup=current_revision)

@router.post('/api/records',status_code=202)
def save(body:WriteInput,actor:str=Depends(actor_identity),idempotency_key:str=Header(default='')):
    return publish(body,idempotency_key,actor)


@router.delete('/api/record',status_code=202)
def retract(id:str,table:str,actor:str=Depends(actor_identity),idempotency_key:str=Header(default='')):
    from apps.base.ingestion.mappings import route_for
    from apps.base.catalog.provision import topics
    route=route_for(table)
    if table not in topics() or route is None:raise HTTPException(422,'Unknown ingestion table')
    return publish(WriteInput(table=table,record_id=id,source=route[0],kind=route[1]),idempotency_key,actor,'delete')
