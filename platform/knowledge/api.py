import asyncio
import json
import os
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from mari_kit.ingestion import normalize, verify_github, verify_slack
from .auth import authenticated
from .ingestion import publish_events

router = APIRouter()

@router.post("/hooks/{source}", status_code=202)
async def ingest(source: str, request: Request):
    # Bound streamed bodies as well as Content-Length; verification uses exact bytes.
    body = bytearray()
    async for part in request.stream():
        body.extend(part)
        if len(body) > 1_000_000:
            raise HTTPException(413, "Webhook exceeds 1 MB")
    body = bytes(body)
    if source == "github":
        valid = verify_github(body, request.headers.get("x-hub-signature-256", ""), os.getenv("GITHUB_WEBHOOK_SECRET", ""))
        delivery = request.headers.get("x-github-delivery", "")
    elif source == "slack":
        valid = verify_slack(body, request.headers.get("x-slack-signature", ""),
                             request.headers.get("x-slack-request-timestamp", ""), os.getenv("SLACK_SIGNING_SECRET", ""))
        delivery = ""
    else:
        raise HTTPException(404, "Unknown source")
    if not valid:
        raise HTTPException(401, "Invalid webhook signature")
    try:
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise ValueError("Object required")
        if source == "slack" and payload.get("type") == "url_verification":
            return {"challenge": payload["challenge"]}
        delivery = delivery or payload.get("event_id", "")
        evidence = normalize(source, payload, delivery, int(time.time()))
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(400, "Malformed source event") from None
    try:
        await asyncio.to_thread(publish_events, evidence, connector_id='connector:webhook:'+source)
    except Exception:
        raise HTTPException(503, "Ingestion not acknowledged; retry the same delivery") from None
    return {"accepted": len(evidence), "event_ids": [e.event_id for e in evidence]}


async def search_evidence(query):
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.get(os.environ['KNOWLEDGE_API_URL'].rstrip('/') + '/api/search',
            params={'q':query}, headers={'Authorization':'Bearer '+os.environ['MARI_SERVICE_TOKEN']})
        response.raise_for_status()
        return response.json()['hits']


async def current_evidence(source_ids):
    identities=list(dict.fromkeys(source_ids))
    if not identities:return {}
    async with httpx.AsyncClient(timeout=25) as client:
        response=await client.post(os.environ['KNOWLEDGE_API_URL'].rstrip('/')+'/api/query',
            json={'query':'SELECT * FROM records WHERE list_contains($ids,record_id)',
                  'parameters':{'ids':identities}},
            headers={'Authorization':'Bearer '+os.environ['MARI_SERVICE_TOKEN']})
        response.raise_for_status()
        from .records import hydrate
        return {row['record_id']:hydrate(row) for row in response.json()['rows']}


from pydantic import BaseModel, Field
from .records import KnowledgeChange
from .ingestion import publish_changes


@router.post('/api/changes',status_code=202,dependencies=[Depends(authenticated)])
async def changes(change:KnowledgeChange):
    if change.project_id!=os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1'):
        raise HTTPException(403,'Unknown project')
    try:receipts=await asyncio.to_thread(publish_changes,[change])
    except Exception:raise HTTPException(503,'Change not acknowledged; retry the same event ID') from None
    return {'status':'accepted','applied':False,'event_id':change.event_id,'receipts':receipts}


class TelemetryEvent(BaseModel):
    event_id:str=Field(min_length=1,max_length=256)
    timestamp:int
    service:str=Field(min_length=1,max_length=128)
    message:str=Field(max_length=64000)
    level:str=Field(default='info',max_length=32)
    trace_id:str=Field(default='',max_length=128)


@router.post('/api/telemetry',status_code=202,dependencies=[Depends(authenticated)])
async def telemetry(event:TelemetryEvent):
    from confluent_kafka import Producer
    def send():
        producer=Producer({'bootstrap.servers':os.getenv('KAFKA_BOOTSTRAP_SERVERS','mari-kafka-kafka-bootstrap:9092'),
                           'enable.idempotence':True,'delivery.timeout.ms':15000})
        errors=[]
        producer.produce('mari.telemetry',key=event.service,value=event.model_dump_json(),
                         on_delivery=lambda err,msg:errors.append(err) if err else None)
        if producer.flush(20) or errors:raise RuntimeError('Telemetry not acknowledged')
    try:await asyncio.to_thread(send)
    except Exception:raise HTTPException(503,'Telemetry not acknowledged; retry') from None
    return {'accepted':True}
