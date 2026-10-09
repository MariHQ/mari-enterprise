"""Embeddable read-only knowledge routes shared by Mari and service consumers."""
import base64
import hashlib
import json
import logging
import os
import time
from typing import Any, Literal
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from .records import hydrate
from apps.sdk.graph import projection, page_limit, DOCUMENTS
from functools import wraps

router=APIRouter()
from apps.sdk.catalog_lake import CatalogLake
engine=CatalogLake()


class QueryInput(BaseModel):
    language: Literal['cypher']='cypher'
    query: str=Field(min_length=1,max_length=20000)
    parameters: dict[str,Any]=Field(default_factory=dict)
    limit: int=Field(default=1000,ge=1,le=1000)
    table: str | None = Field(default=None, min_length=1, max_length=249, pattern=r'^[a-zA-Z0-9._-]+$')


def execute(query,parameters=None,language='cypher',limit=1000,table=None):
    try:
        return engine.execute(query,parameters,language,os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1'),limit,physical_table=table)
    except ValueError as error:
        raise HTTPException(400,str(error)) from None
    except Exception:
        logging.exception('Knowledge query failed')
        raise HTTPException(503,'Knowledge query unavailable; no stale local copy was returned') from None


def graph_snapshot(function):
    """Keep bounded multi-step graph reads on one resolved catalog and lake snapshot."""
    @wraps(function)
    def wrapped(*args,**kwargs):
        with engine.session(os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1')):
            return function(*args,**kwargs)
    return wrapped


@router.post('/api/query')
def query(body:QueryInput):
    return execute(body.query,body.parameters,body.language,body.limit,body.table)


SEARCH_REQUIREMENT = 'GRAPH_REQUIREMENTS:Search needs an OrchidDB catalog mapping Query → search matches → Record, including score and snippet. The active graph exposes Record and RELATED only; no search-capable edge is registered.'


@router.get('/api/records')
def records(q:str=Query('',max_length=500),limit:int=Query(100,ge=1,le=1000),cursor:str|None=Query(None,max_length=8000),
            kind:str|None=None,summary:bool=False,source:list[str]=Query([]),owner:list[str]=Query([]),
            status:list[str]=Query([]),content_type:list[str]=Query([]),days:int|None=Query(None,ge=1,le=36500),
            sort:Literal['newest','title']='newest'):
    if q.strip() not in ('','*'):raise HTTPException(409,SEARCH_REQUIREMENT)
    where=DOCUMENTS+" AND r.kind <> 'edge' AND ($kind IS NULL OR r.kind=$kind) AND (size($sources)=0 OR r.source_group IN $sources) AND (size($owners)=0 OR r.owner_name IN $owners) AND (size($statuses)=0 OR r.status IN $statuses) AND (size($types)=0 OR r.content_type IN $types) AND ($since IS NULL OR r.observed_at >= $since)"
    signature=hashlib.sha256(json.dumps([kind,source,owner,status,content_type,days,sort],sort_keys=True).encode()).hexdigest()
    since=int(time.time())-days*86400 if days else None
    params={'kind':kind,'sources':source,'owners':owner,'statuses':status,'types':content_type}
    key="coalesce(toLower(r.title),'')" if sort=='title' else 'r.observed_at'
    if cursor:
        try:
            position=json.loads(base64.urlsafe_b64decode(cursor+'='*(-len(cursor)%4)))
            if position['signature']!=signature:raise ValueError()
            value=position['value'];identity=position['id'];since=position['since']
            if not isinstance(identity,str) or not isinstance(value,str if sort=='title' else int):raise ValueError()
        except (ValueError,TypeError,KeyError):raise HTTPException(400,'Invalid cursor for these filters') from None
        where+=f" AND ({key} {'>' if sort=='title' else '<'} $position OR ({key}=$position AND r.record_id>$identity))"
        params.update(position=value,identity=identity)
    params['since']=since
    columns=projection(text="substring(r.text,0,400)" if summary else None)
    order=key+(' ASC' if sort=='title' else ' DESC')+', r.record_id'
    # A single page plus one lookahead row. No corpus count, offset scan or facet enumeration.
    rows=execute('MATCH (r:Record) WHERE '+where+' RETURN '+columns+' ORDER BY '+order+' LIMIT '+page_limit(limit+1),
                 params,limit=limit+1)['rows']
    more=len(rows)>limit;rows=rows[:limit]
    next_cursor=None
    if more:
        last=rows[-1]
        position={'signature':signature,'value':(last.get('title') or '').lower() if sort=='title' else last['observed_at'],'id':last['record_id'],'since':since}
        next_cursor=base64.urlsafe_b64encode(json.dumps(position).encode()).decode().rstrip('=')
    return {'records':[hydrate(row) for row in rows],'has_more':more,'next_cursor':next_cursor}


@router.get('/api/records/{record_id:path}')
def record(record_id:str):
    rows=execute('MATCH (r:Record) WHERE r.record_id=$id RETURN '+projection(),{'id':record_id})['rows']
    if not rows:raise HTTPException(404,'Record not found')
    return hydrate(rows[0])


@router.get('/api/search')
def search(q:str=Query('*',max_length=500)):
    # Backwards compatibility is confined to the server; Quickwit is telemetry-only.
    if q.startswith('source_id:'):
        try: identity=json.loads(q[len('source_id:'):])
        except ValueError:raise HTTPException(400,'Invalid record identity') from None
        rows=execute('MATCH (r:Record) WHERE '+DOCUMENTS+' AND r.record_id=$id RETURN '+projection(),{'id':identity})['rows']
        return {'hits':[hydrate(row) for row in rows]}
    if q.strip() not in ('','*'):raise HTTPException(409,SEARCH_REQUIREMENT)
    rows=execute('MATCH (r:Record) WHERE '+DOCUMENTS+' RETURN '+projection()+' ORDER BY r.observed_at DESC, r.record_id LIMIT 100')['rows']
    return {'hits':[hydrate(row) for row in rows]}



class RetrievalInput(BaseModel):
    query:str=Field(min_length=1,max_length=8000)
    limit:int=Field(default=10,ge=1,le=100)


@router.post('/api/retrieve')
def retrieve(body:RetrievalInput):
    raise HTTPException(409,'GRAPH_REQUIREMENTS:Vector retrieval needs a published graph search mapping')


@router.get('/api/telemetry/search')
def telemetry_search(q:str=Query(min_length=1,max_length=500),limit:int=Query(50,ge=1,le=100)):
    if os.getenv('QUICKWIT_ENABLED','false')!='true':raise HTTPException(503,'Telemetry search is not enabled')
    import httpx
    try:
        with httpx.Client(timeout=15) as client:
            result=client.post(os.environ['QUICKWIT_URL'].rstrip('/')+'/api/v1/telemetry/search',json={'query':q,'max_hits':limit})
            result.raise_for_status();return result.json()
    except httpx.HTTPError:raise HTTPException(503,'Telemetry search unavailable') from None


