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
from .query import LakeQuery
from .records import hydrate

router=APIRouter()
engine=LakeQuery()


class QueryInput(BaseModel):
    language: Literal['sql','cypher','gremlin','sparql']='sql'
    query: str=Field(min_length=1,max_length=20000)
    parameters: dict[str,Any]=Field(default_factory=dict)
    limit: int=Field(default=1000,ge=1,le=1000)
    table: str | None = Field(default=None, min_length=1, max_length=249, pattern=r'^[a-zA-Z0-9._-]+$')


def execute(query,parameters=None,language='sql',limit=1000,table=None):
    try:
        return engine.execute(query,parameters,language,os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1'),limit,physical_table=table)
    except ValueError as error:
        raise HTTPException(400,str(error)) from None
    except Exception:
        logging.exception('Knowledge query failed')
        raise HTTPException(503,'Knowledge query unavailable; no stale local copy was returned') from None


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
    type_expr="CASE WHEN kind IN ('pr','pull_request') THEN 'Pull requests' WHEN kind IN ('message','thread','slack_message') THEN 'Conversations' ELSE 'Documents' END"
    where="source <> 'temporal' AND kind NOT IN ('edge','workflow','mining_receipt') AND ($kind IS NULL OR kind=$kind) AND (len($sources)=0 OR list_contains($sources,lower(split_part(source,':',1)))) AND (len($owners)=0 OR list_contains($owners,coalesce(nullif(actor,''),'Unknown owner'))) AND (len($statuses)=0 OR list_contains($statuses, json_extract_string(properties,'status'))) AND (len($types)=0 OR list_contains($types,"+type_expr+")) AND ($since IS NULL OR observed_at >= $since)"
    signature=hashlib.sha256(json.dumps([kind,source,owner,status,content_type,days,sort],sort_keys=True).encode()).hexdigest()
    since=int(time.time())-days*86400 if days else None
    params={'kind':kind,'sources':source,'owners':owner,'statuses':status,'types':content_type}
    key="coalesce(lower(title),'')" if sort=='title' else 'observed_at'
    if cursor:
        try:
            position=json.loads(base64.urlsafe_b64decode(cursor+'='*(-len(cursor)%4)))
            if position['signature']!=signature:raise ValueError()
            value=position['value'];identity=position['id'];since=position['since']
            if not isinstance(identity,str) or not isinstance(value,str if sort=='title' else int):raise ValueError()
        except (ValueError,TypeError,KeyError):raise HTTPException(400,'Invalid cursor for these filters') from None
        where+=f" AND ({key} {'>' if sort=='title' else '<'} $position OR ({key}=$position AND record_id>$identity))"
        params.update(position=value,identity=identity)
    params['since']=since
    columns="* EXCLUDE(text), substring(text,1,400) AS text" if summary else '*'
    order=key+(' ASC' if sort=='title' else ' DESC')+', record_id'
    # A single page plus one lookahead row. No corpus count, offset scan or facet enumeration.
    rows=execute('SELECT '+columns+' FROM records WHERE '+where+' ORDER BY '+order+' LIMIT $limit',
                 {**params,'limit':limit+1},limit=limit+1)['rows']
    more=len(rows)>limit;rows=rows[:limit]
    next_cursor=None
    if more:
        last=rows[-1]
        position={'signature':signature,'value':(last.get('title') or '').lower() if sort=='title' else last['observed_at'],'id':last['record_id'],'since':since}
        next_cursor=base64.urlsafe_b64encode(json.dumps(position).encode()).decode().rstrip('=')
    return {'records':[hydrate(row) for row in rows],'has_more':more,'next_cursor':next_cursor}


@router.get('/api/records/{record_id:path}')
def record(record_id:str):
    rows=execute('SELECT * FROM records WHERE record_id=$id',{'id':record_id})['rows']
    if not rows:raise HTTPException(404,'Record not found')
    return hydrate(rows[0])


@router.get('/api/search')
def search(q:str=Query('*',max_length=500)):
    # Backwards compatibility is confined to the server; Quickwit is telemetry-only.
    if q.startswith('source_id:'):
        try: identity=json.loads(q[len('source_id:'):])
        except ValueError:raise HTTPException(400,'Invalid record identity') from None
        rows=execute('SELECT * FROM records WHERE record_id=$id',{'id':identity})['rows']
        return {'hits':[hydrate(row) for row in rows]}
    if q.strip() not in ('','*'):raise HTTPException(409,SEARCH_REQUIREMENT)
    rows=execute('SELECT * FROM records ORDER BY observed_at DESC, record_id LIMIT 100')['rows']
    return {'hits':[hydrate(row) for row in rows]}



class RetrievalInput(BaseModel):
    query:str=Field(min_length=1,max_length=8000)
    limit:int=Field(default=10,ge=1,le=100)


@router.post('/api/retrieve')
def retrieve(body:RetrievalInput):
    if os.getenv('WEAVIATE_ENABLED','false')!='true':
        raise HTTPException(503,'Vector retrieval is not enabled')
    from indexing.worker import embed,connect,collection_name
    from weaviate.classes.query import Filter
    try:
        vector=embed([body.query],input_type='query')[0]
        with connect() as client:
            results=client.collections.get(collection_name()).query.near_vector(near_vector=vector,target_vector='content',
                filters=Filter.by_property('project_id').equal(os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1')),limit=body.limit)
        identifiers=list(dict.fromkeys(obj.properties['record_id'] for obj in results.objects))
        if not identifiers:return {'records':[]}
        # Resolve records in the current lake snapshot; indexes are optional derived views.
        rows=execute('SELECT * FROM records WHERE list_contains($ids,record_id)',{'ids':identifiers})['rows']
        by_id={row['record_id']:row for row in rows}
        return {'records':[hydrate(by_id[i]) for i in identifiers if i in by_id]}
    except HTTPException:raise
    except Exception:
        logging.exception('Vector retrieval failed')
        raise HTTPException(503,'Vector retrieval unavailable') from None


@router.get('/api/telemetry/search')
def telemetry_search(q:str=Query(min_length=1,max_length=500),limit:int=Query(50,ge=1,le=100)):
    if os.getenv('QUICKWIT_ENABLED','false')!='true':raise HTTPException(503,'Telemetry search is not enabled')
    import httpx
    try:
        with httpx.Client(timeout=15) as client:
            result=client.post(os.environ['QUICKWIT_URL'].rstrip('/')+'/api/v1/telemetry/search',json={'query':q,'max_hits':limit})
            result.raise_for_status();return result.json()
    except httpx.HTTPError:raise HTTPException(503,'Telemetry search unavailable') from None


@router.get('/api/operations')
def operations():
    # Keep schedule definitions and their referenced runs even when the unrelated
    # run history grows. One query/snapshot; no edges or document bodies needed.
    rows=execute("""WITH schedules AS MATERIALIZED (
        SELECT * EXCLUDE(text), '' AS text FROM temporal_schedules
        WHERE kind='temporal_schedule' ORDER BY record_id LIMIT 101
    ), schedule_ids AS (
        SELECT json_extract_string(properties,'$.recent_runs[#-1].workflow_id') AS workflow_id
        FROM schedules ORDER BY record_id LIMIT 100
    ), schedule_runs AS (
        SELECT * EXCLUDE(text), '' AS text FROM workflow_runs WHERE kind='temporal_run'
        AND json_extract_string(properties,'$.workflow_id') IN (SELECT workflow_id FROM schedule_ids)
        QUALIFY row_number() OVER (PARTITION BY json_extract_string(properties,'$.workflow_id')
            ORDER BY json_extract_string(properties,'$.started_at') DESC, observed_at DESC, record_id DESC)=1
        LIMIT 100
    ), recent_runs AS (
        SELECT * EXCLUDE(text), '' AS text FROM workflow_runs WHERE kind='temporal_run'
        QUALIFY row_number() OVER (PARTITION BY json_extract_string(properties,'$.workflow_id')
            ORDER BY json_extract_string(properties,'$.started_at') DESC, observed_at DESC, record_id DESC)=1
        ORDER BY json_extract_string(properties,'$.started_at') DESC, record_id LIMIT 101
    ), observation AS (
        SELECT * EXCLUDE(text), '' AS text FROM temporal_observations
        WHERE record_id='temporal:observation' LIMIT 1
    ) SELECT *, 'schedule' AS __section FROM schedules
      UNION ALL SELECT *, 'scheduled_run' FROM schedule_runs
      UNION ALL SELECT *, 'recent_run' FROM recent_runs
      UNION ALL SELECT *, 'observation' FROM observation""")['rows']
    watermark=next((r for r in rows if r['kind']=='temporal_observation'),None)
    if watermark is None:
        raise HTTPException(409, 'GRAPH_REQUIREMENTS:Expected Schedule → Workflow and Run → Workflow mappings. Temporal status has not reached the knowledge graph yet.')
    counts={}; records={}; truncated=False
    for row in rows:
        section=row.pop('__section', row['kind'])
        counts[section]=counts.get(section,0)+1
        if section in ('schedule','recent_run') and counts[section]>100:
            truncated=True
            continue
        records[row['record_id']]=hydrate(row)
    return {'records':list(records.values()), 'observed_at':json.loads(watermark['properties']).get('observed_at'),
            'truncated':truncated}
