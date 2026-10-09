"""Mari's original write commands, authenticated by container grants."""
import os
import json
from typing import Any, Literal
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from apps.sdk.data import reader
from apps.sdk.data.ingestion import publish_changes
from apps.sdk.data.records import KnowledgeChange, command_id
from apps.sdk.runtime import authenticated
router=APIRouter()
def scope(): return os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1')
def actor_identity(claims=Depends(authenticated)): return claims['sub']

class WriteInput(BaseModel):
    table:str=Field(min_length=1,max_length=249,pattern=r'^[a-zA-Z0-9._-]+$')
    record_id:str=Field(min_length=1,max_length=512)
    kind:str='document'
    source:str='mari'
    title:str=''
    text:str=''
    url:str=''
    properties:dict[str,Any]=Field(default_factory=dict)
    expected_revision:str|None=None


def publish(body:WriteInput,request_id:str,actor:str,operation='upsert'):
    if not request_id or len(request_id)>128:raise HTTPException(400,'An Idempotency-Key is required')
    if body.expected_revision:
        rows=reader.execute('SELECT event_id FROM graph_records WHERE record_id=$id',{'id':body.record_id},table=body.table)['rows']
        if not rows:raise HTTPException(409,'This record no longer exists')
        existing=rows[0]
        if existing['event_id']!=body.expected_revision:raise HTTPException(409,'This record changed; reload before editing')
    # Revision checking catches already-visible stale edits. Concurrent accepted
    # commands are ordered by Kafka, not a cross-system compare-and-swap.
    event=KnowledgeChange(**body.model_dump(exclude={'expected_revision'}),project_id=scope(),actor=actor,
        operation=operation,event_id=command_id(scope(),actor,request_id,{'operation':operation,**body.model_dump()}))
    from apps.sdk.data.changes import attributed_changes
    try:receipts=publish_changes(attributed_changes(event))
    except Exception:raise HTTPException(503,'Change was not acknowledged; retry with the same Idempotency-Key') from None
    return {'status':'accepted','event_id':event.event_id,'record_id':event.record_id,'applied':False,'receipts':receipts}


@router.post('/api/records',status_code=202)
def save(body:WriteInput,actor:str=Depends(actor_identity),idempotency_key:str=Header(default='')):
    return publish(body,idempotency_key,actor)


@router.delete('/api/record',status_code=202)
def retract(id:str,table:str,actor:str=Depends(actor_identity),idempotency_key:str=Header(default='')):
    return publish(WriteInput(table=table,record_id=id),idempotency_key,actor,'delete')


class EdgeInput(BaseModel):
    from_id:str=Field(min_length=1,max_length=512)
    to_id:str=Field(min_length=1,max_length=512)
    relation:str=Field(min_length=1,max_length=128)


@router.post('/api/edges',status_code=202)
def add_edge(body:EdgeInput,actor:str=Depends(actor_identity),idempotency_key:str=Header(default='')):
    import hashlib
    endpoints=reader.execute('SELECT record_id FROM graph_records WHERE record_id IN ($a,$b)',
        {'a':body.from_id,'b':body.to_id})['rows']
    if {r['record_id'] for r in endpoints}!={body.from_id,body.to_id}:
        raise HTTPException(422,'Both edge endpoints must exist in the graph')
    identity='edge:'+hashlib.sha256(json.dumps([scope(),body.from_id,body.relation,body.to_id]).encode()).hexdigest()
    return publish(WriteInput(table='mari.records.mari.edge',record_id=identity,source='mari',kind='edge',title=body.relation,
        properties=body.model_dump()),idempotency_key,actor)


