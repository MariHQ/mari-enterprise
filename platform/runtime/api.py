import asyncio
import hmac
import json
import os
import time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field
from temporalio.client import Client

from knowledge.api import search_evidence
from knowledge.api import router as knowledge_router, current_evidence
from knowledge.auth import authenticated


@asynccontextmanager
async def lifespan(app):
    app.state.temporal = await Client.connect(os.getenv("TEMPORAL_ADDRESS", "temporal:7233"))
    yield


app = FastAPI(title="Mari execution and knowledge services", lifespan=lifespan)
app.include_router(knowledge_router)


@app.get("/healthz")
def health():
    return {"service": "knowledge-ingestion", "knowledge": "orchiddb", "executor": "agent-substrate"}


@app.get("/api/status", dependencies=[Depends(authenticated)])
async def status():
    checks = {}
    async with httpx.AsyncClient(timeout=4) as client:
        for name, url in {"knowledge-api": os.environ["KNOWLEDGE_API_URL"]+"/healthz",
                          "flink": "http://mari-knowledge-lake-rest:8081/overview",
                          "agent-substrate": os.getenv("SUBSTRATE_ROUTER", "http://atenet-router.ate-system.svc.cluster.local") + "/readyz"}.items():
            try:
                headers = {"ate-target-actor": os.getenv("SUBSTRATE_MINER_TARGET", "mari/miner")} if name == "agent-substrate" else {"Authorization":"Bearer "+os.environ["MARI_SERVICE_TOKEN"]}
                r = await client.get(url, headers=headers)
                checks[name] = "ready" if r.is_success else "unavailable"
            except httpx.HTTPError:
                checks[name] = "unavailable"
    try:
        await app.state.temporal.service_client.check_health()
        checks["temporal"] = "ready"
    except Exception:
        checks["temporal"] = "unavailable"
    return {"services": checks, "mode": "local single-workspace", "extractor": "rules-v1"}


class RunInput(BaseModel):
    query: str = Field(default="*", min_length=1, max_length=500)


@app.post("/api/runs", status_code=202, dependencies=[Depends(authenticated)])
async def start_run(body: RunInput):
    from .workflows import MineKnowledge
    run_id = "mine-" + uuid.uuid4().hex
    await app.state.temporal.start_workflow(MineKnowledge.run, {"run_id": run_id, "query": body.query},
                                            id=run_id, task_queue="mari")
    return {"run_id": run_id}


@app.get("/api/runs", dependencies=[Depends(authenticated)])
async def runs():
    return await lake_records("kind='workflow'")


@app.get("/api/knowledge", dependencies=[Depends(authenticated)])
async def knowledge():
    return await lake_records("source='agent' AND kind<>'workflow'")


async def lake_records(where):
    async with httpx.AsyncClient(timeout=25) as client:
        result=await client.post(os.environ['KNOWLEDGE_API_URL']+'/api/query',
            headers={'Authorization':'Bearer '+os.environ['MARI_SERVICE_TOKEN']},
            json={'query':'SELECT * FROM records WHERE '+where+' ORDER BY observed_at DESC LIMIT 1000'})
        if not result.is_success:raise HTTPException(503,'Knowledge API unavailable')
        return [{**row,**json.loads(row.get('properties') or '{}')} for row in result.json()['rows']]


class ReviewInput(BaseModel):
    approved: bool
    note: str = Field(default="", max_length=2000)


@app.post("/api/runs/{run_id}/review", dependencies=[Depends(authenticated)])
async def review(run_id: str, body: ReviewInput):
    handle=app.state.temporal.get_workflow_handle(run_id)
    try: state=await handle.query('state')
    except Exception: raise HTTPException(404,'Run not found or not active') from None
    if state!='awaiting_review':raise HTTPException(409,'Run is not awaiting review')
    await handle.signal('review',body.model_dump())
    return {'accepted':True}
