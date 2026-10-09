"""Shared command validation and Kafka delivery; no app routes or Cypher."""
import logging
import os
from typing import Any
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError, model_validator
from apps.base.runtime import authenticated
from apps.base.ingestion.ingestion import publish_changes
from apps.base.ingestion.records import KnowledgeChange, command_id
from apps.base.ingestion.changes import attributed_changes

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

    @model_validator(mode='after')
    def declared_destination(self):
        from apps.base.catalog.provision import topics
        if self.table not in topics() or self.table != 'mari.records.'+self.source+'.'+self.kind:
            raise ValueError('Record source and kind must match a declared ingestion topic')
        return self


def publish_change(body,request_id,actor,operation='upsert',*,revision_lookup):
    if not request_id or len(request_id)>128:raise HTTPException(400,'An Idempotency-Key is required')
    if body.expected_revision:
        revision=revision_lookup(body)
        if revision is None:raise HTTPException(409,'This record no longer exists')
        if revision!=body.expected_revision:raise HTTPException(409,'This record changed; reload before editing')
    if operation=='upsert':
        from apps.base.ingestion.evidence import check_approval
        from apps.base.db import execute
        check_approval(body,execute)
    # Kafka orders concurrent accepted commands; this check catches visible stale edits.
    try:
        event=KnowledgeChange(**body.model_dump(exclude={'expected_revision'}),project_id=scope(),actor=actor,
            operation=operation,event_id=command_id(scope(),actor,request_id,{'operation':operation,**body.model_dump()}))
    except ValidationError:
        raise HTTPException(422,'Record does not satisfy the ingestion schema') from None
    changes=[]
    if operation=='upsert' and body.kind in ('fact','decision') and body.properties.get('status') in ('approved','ratified','verified'):
        review_id='review:'+event.event_id
        review=KnowledgeChange(table='mari.records.'+body.source+'.review',project_id=scope(),record_id=review_id,
            event_id=review_id,source=body.source,kind='review',operation='upsert',actor=actor,
            properties={'record_ids':[body.record_id],'status':'approved'})
        event=event.model_copy(update={'properties':{**event.properties,'review_ids':[*(event.properties.get('review_ids') or []),review_id]}})
        changes.append(review)
    try:receipts=publish_changes([*attributed_changes(event),*changes])
    except ValueError:
        raise HTTPException(422,'Record columns do not match the registered topic schema') from None
    except Exception:
        logging.exception('Kafka command delivery failed')
        raise HTTPException(503,'Change was not acknowledged; retry with the same Idempotency-Key') from None
    return {'status':'accepted','event_id':event.event_id,'record_id':event.record_id,'applied':False,'receipts':receipts}
