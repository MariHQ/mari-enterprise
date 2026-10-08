from __future__ import annotations
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import time
from typing import Any, Literal
from urllib.parse import quote
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from . import knowledge as reader
from knowledge.ingestion import publish_changes
from knowledge.records import KnowledgeChange, command_id

app=FastAPI(title='Mari governance application server')
COOKIE='mari_governance'


def scope():return os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1')
def owner():return os.getenv('MARI_OWNER_EMAIL','owner@mari.local')

def signature(value):
    key=os.environ.get('MARI_SESSION_SECRET','')
    if len(key)<32:raise HTTPException(503,'Governance session secret is not configured')
    return hmac.new(key.encode(),value.encode(),hashlib.sha256).hexdigest()


def authenticated(request:Request):
    cookie=request.cookies.get(COOKIE,'')
    try:
        issued,nonce,sig=cookie.split('.')
        if not 0<=time.time()-int(issued)<=28800 or not hmac.compare_digest(sig,signature(issued+'.'+nonce)):
            raise ValueError()
    except (ValueError,TypeError):raise HTTPException(401,'Sign in to Mari') from None
    project=request.headers.get('X-Mari-Project',scope())
    if project not in (scope(),'platform'):raise HTTPException(403,'Unknown project')
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('Origin')
        expected=os.getenv('MARI_PUBLIC_ORIGIN',str(request.base_url).rstrip('/'))
        if origin and origin!=expected:raise HTTPException(403,'Cross-origin write refused')
    return owner()


class Credentials(BaseModel):
    email:str
    password:str


@app.post('/auth/login')
def login(body:Credentials,response:Response):
    password=os.getenv('MARI_OWNER_PASSWORD','')
    if not password:raise HTTPException(503,'Owner credentials are not configured')
    if not (hmac.compare_digest(body.email.encode(),owner().encode()) and hmac.compare_digest(body.password.encode(),password.encode())):
        raise HTTPException(401,'Email or password is incorrect')
    value=str(int(time.time()))+'.'+secrets.token_hex(16)
    response.set_cookie(COOKIE,value+'.'+signature(value),httponly=True,samesite='strict',
                        secure=os.getenv('MARI_COOKIE_SECURE','true')=='true',max_age=28800)
    return {'ok':True}


@app.post('/auth/logout')
def logout(response:Response):
    response.delete_cookie(COOKIE);return {'ok':True}


@app.get('/auth/me')
def me(request:Request):
    try:email=authenticated(request)
    except HTTPException as error:
        if error.status_code!=401:raise
        return {'user':None,'bypassEnabled':False,'registrationEnabled':False}
    project={'id':int(scope()),'slug':'platform','name':'Mari platform','role':'admin','capabilities':['read','write']}
    return {'user':{'id':'owner','name':'Owner','email':email,'role':'admin','initials':'M','tint':0,'provider':'local'},
            'projects':[project],'activeProject':project,'bypassEnabled':False,'registrationEnabled':False}


@app.get('/api/links',dependencies=[Depends(authenticated)])
def links(focal:str=Query(min_length=1,max_length=2048),limit:int=Query(30,ge=1,le=100)):
    result=reader.payload(reader.send('GET', 'lineage', params={'focal': focal, 'limit': limit}))
    return {'rows':result['edges'],'truncated':result['has_more']}


@app.get('/healthz')
def health():return {'service':'mari-governance','knowledge_store':'iceberg','writes':'kafka','query_engine':'orchiddb','query_mode':'knowledge-api','backend':os.getenv('KNOWLEDGE_BACKEND','duckdb')}


@app.get('/api/record',dependencies=[Depends(authenticated)])
def record(id:str):return reader.record(id)


@app.get('/api/history',dependencies=[Depends(authenticated)])
def history(id:str,table:str):
    return reader.execute('SELECT * FROM history WHERE record_id=$id ORDER BY stream_offset DESC LIMIT 100',{'id':id},table=table)


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
    from .changes import attributed_changes
    try:receipts=publish_changes(attributed_changes(event))
    except Exception:raise HTTPException(503,'Change was not acknowledged; retry with the same Idempotency-Key') from None
    return {'status':'accepted','event_id':event.event_id,'record_id':event.record_id,'applied':False,'receipts':receipts}


@app.post('/api/records',status_code=202)
def save(body:WriteInput,actor:str=Depends(authenticated),idempotency_key:str=Header(default='')):
    return publish(body,idempotency_key,actor)


@app.delete('/api/record',status_code=202)
def retract(id:str,table:str,actor:str=Depends(authenticated),idempotency_key:str=Header(default='')):
    return publish(WriteInput(table=table,record_id=id),idempotency_key,actor,'delete')


class EdgeInput(BaseModel):
    from_id:str=Field(min_length=1,max_length=512)
    to_id:str=Field(min_length=1,max_length=512)
    relation:str=Field(min_length=1,max_length=128)


@app.post('/api/edges',status_code=202)
def add_edge(body:EdgeInput,actor:str=Depends(authenticated),idempotency_key:str=Header(default='')):
    import hashlib
    endpoints=reader.execute('SELECT record_id FROM graph_records WHERE record_id IN ($a,$b)',
        {'a':body.from_id,'b':body.to_id})['rows']
    if {r['record_id'] for r in endpoints}!={body.from_id,body.to_id}:
        raise HTTPException(422,'Both edge endpoints must exist in the graph')
    identity='edge:'+hashlib.sha256(json.dumps([scope(),body.from_id,body.relation,body.to_id]).encode()).hexdigest()
    return publish(WriteInput(table='mari.records.mari.edge',record_id=identity,source='mari',kind='edge',title=body.relation,
        properties=body.model_dump()),idempotency_key,actor)


class ScheduleCommand(BaseModel):
    operation: Literal['pause','resume','trigger','interval']
    minutes: int | None = Field(default=None,ge=5,le=10080)


@app.post('/api/temporal/schedules/{schedule_id}',status_code=202)
async def schedule_command(schedule_id:str, body:ScheduleCommand, actor:str=Depends(authenticated)):
    from temporalio.client import Client, ScheduleUpdate, ScheduleIntervalSpec, ScheduleSpec
    from datetime import timedelta
    from temporalio.service import RPCError, RPCStatusCode
    # Commands go to Temporal. The page's statistics always read the lake projection.
    if schedule_id.startswith('sync-'):
        raise HTTPException(409,'This legacy schedule was replaced by a durable polling workflow')
    if body.operation=='interval' and body.minutes is None:
        raise HTTPException(400,'An interval is required')
    try:
        client=await Client.connect(os.getenv('TEMPORAL_ADDRESS','temporal:7233'))
        handle=client.get_schedule_handle(schedule_id)
        if body.operation=='pause':await handle.pause(note='Paused by Mari owner')
        elif body.operation=='resume':await handle.unpause(note='Resumed by Mari owner')
        elif body.operation=='trigger':await handle.trigger()
        else:
            if body.minutes is None:raise HTTPException(400,'An interval is required')
            def update(value):
                value.description.schedule.spec.intervals=[ScheduleIntervalSpec(every=timedelta(minutes=body.minutes))]
                value.description.schedule.spec.calendars=[]
                value.description.schedule.spec.cron_expressions=[]
                return ScheduleUpdate(schedule=value.description.schedule)
            await handle.update(update)
    except RPCError as error:
        if error.status==RPCStatusCode.NOT_FOUND:raise HTTPException(404,'Temporal schedule not found') from None
        raise HTTPException(503,'Temporal did not acknowledge the schedule command') from None
    return {'accepted':True,'applied_to_graph':False,'operation':body.operation,'schedule_id':schedule_id}

# Forward only the Knowledge API's read surfaces; writes remain Kafka commands.
@app.api_route('/api/{path:path}', methods=['GET', 'POST'], dependencies=[Depends(authenticated)])
async def knowledge_read(path: str, request: Request):
    return await reader.forward(path, request)

static=Path(os.getenv('MARI_STATIC_DIR','/app/static'))
if static.is_dir():
    @app.get('/{path:path}',include_in_schema=False)
    def web(path:str):
        target=(static/path).resolve()
        if not target.is_relative_to(static.resolve()) or not target.is_file():target=static/'index.html'
        return FileResponse(target)
