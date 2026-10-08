"""Idempotent registration; retries readiness and fails with a useful error."""
import asyncio
import json
import os
import time
from datetime import timedelta
from pathlib import Path

import boto3
import httpx
from botocore.config import Config
from confluent_kafka.admin import AdminClient, NewTopic
from temporalio.client import (Client, Schedule, ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError, ScheduleIntervalSpec, ScheduleSpec,
    SchedulePolicy, ScheduleOverlapPolicy, ScheduleUpdate)

from .workflows import MineKnowledge, SourceSync


def retry(fn):
    for attempt in range(120):
        try:
            return fn()
        except Exception:
            if attempt == 119:
                raise
            time.sleep(2)


def setup():
    # Storage and Kafka topics are provisioned by AWS tooling and Strimzi.
    s3 = boto3.client("s3")
    retry(lambda: s3.head_bucket(Bucket=os.environ["S3_BUCKET"]))
    if os.getenv('QUICKWIT_MANAGE_INDEX','false')=='true':
        with httpx.Client(timeout=10) as client:
            retry(lambda: client.get("http://quickwit:7280/health/readyz").raise_for_status())
            if client.get("http://quickwit:7280/api/v1/indexes/telemetry").status_code==404:
                config=json.loads(Path('config/index.json').read_text())
                config['index_uri']='s3://'+os.environ['S3_BUCKET']+'/search/telemetry'
                client.post('http://quickwit:7280/api/v1/indexes',json=config).raise_for_status()
            existing=client.get('http://quickwit:7280/api/v1/indexes/telemetry');existing.raise_for_status()
            source=json.loads(Path('config/source.json').read_text())
            if source['source_id'] not in {s['source_id'] for s in existing.json()['sources']}:
                client.post('http://quickwit:7280/api/v1/indexes/telemetry/sources',json=source).raise_for_status()
    asyncio.run(schedule())


async def schedule():
    client = await Client.connect("temporal:7233")
    jobs_enabled = os.getenv('TEMPORAL_JOBS_ENABLED', 'true') == 'true'
    from maintenance.compaction import CompactIceberg
    async def upsert_schedule(identity, definition):
        try:
            await client.create_schedule(identity, definition)
        except ScheduleAlreadyRunningError:
            await client.get_schedule_handle(identity).update(
                lambda current: ScheduleUpdate(schedule=Schedule(
                    action=definition.action, spec=definition.spec if identity == "mine-decisions-daily" else current.description.schedule.spec,
                    state=current.description.schedule.state, policy=definition.policy)))

    from .observability import ObserveTemporal
    from temporalio.exceptions import WorkflowAlreadyStartedError
    if jobs_enabled:
        try:
            await client.start_workflow(ObserveTemporal.run, {}, id='observe-temporal', task_queue='mari')
        except WorkflowAlreadyStartedError:
            pass

    enabled = os.getenv('ICEBERG_COMPACTION_ENABLED','true')=='true'
    identity='compact-iceberg-maintenance'
    async for existing in await client.list_schedules():
        if existing.id == 'mine-knowledge-hourly' or existing.id.startswith('sync-') or (existing.id.startswith('compact-') and existing.id!=identity):
            await client.get_schedule_handle(existing.id).delete()
        elif existing.id==identity and not enabled:
            await client.get_schedule_handle(existing.id).pause(note='Disabled by platform configuration')
    if enabled:
        await upsert_schedule(identity, Schedule(
            action=ScheduleActionStartWorkflow(CompactIceberg.run,{},id='iceberg-maintenance',task_queue='mari'),
            spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(minutes=int(os.getenv("ICEBERG_COMPACTION_MINUTES","15"))))]),
            policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP)))
    await upsert_schedule("mine-decisions-daily", Schedule(
        action=ScheduleActionStartWorkflow(MineKnowledge.run, {"query": "*", "incremental": True, "miner_version": "decisions-extract-v2"},
            id="scheduled-mine", task_queue="mari"),
        spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(days=1))]),
        # Individual candidate reviews do not keep the daily extraction workflow open.
        policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP)))
    from .discovery import DiscoverSlack
    if jobs_enabled:
        try:
            await client.start_workflow(DiscoverSlack.run, {}, id='discover-slack', task_queue='mari')
        except WorkflowAlreadyStartedError:
            pass
    if jobs_enabled and os.getenv('AX_OBSERVATION_ENABLED','false')=='true':
        from .ax_observability import ObserveAX
        try:
            await client.start_workflow(ObserveAX.run, {}, id='observe-ax', task_queue='mari')
        except WorkflowAlreadyStartedError:
            pass
    import hashlib
    for source, variable in (("github", "GITHUB_REPOSITORIES"),):
        for target in filter(None, os.getenv(variable, "").split(",")):
            schedule_id = "sync-" + source + "-" + hashlib.sha256(target.encode()).hexdigest()[:12]
            # Each connector carries only identity/fingerprint checkpoints in
            # Temporal, then continues as new. No source-state Postgres table.
            from temporalio.exceptions import WorkflowAlreadyStartedError
            from temporalio.service import RPCError, RPCStatusCode
            try:
                await client.get_schedule_handle(schedule_id).delete()
            except RPCError as error:
                if error.status!=RPCStatusCode.NOT_FOUND:raise
            if jobs_enabled:
                try:
                    await client.start_workflow(SourceSync.run,{"source":source,"target":target},
                        id='poll-'+schedule_id,task_queue='mari')
                except WorkflowAlreadyStartedError:pass
    if jobs_enabled:
        for identity in ('compact-iceberg-maintenance', 'mine-decisions-daily'):
            if identity == 'compact-iceberg-maintenance' and not enabled:
                continue
            description = await client.get_schedule_handle(identity).describe()
            if description.schedule.state.paused:
                await client.get_schedule_handle(identity).unpause(note='Resumed by platform configuration')
    if not jobs_enabled:
        async for existing in await client.list_schedules():
            await client.get_schedule_handle(existing.id).pause(note='Temporal jobs disabled by operator')


if __name__ == "__main__":
    setup()
