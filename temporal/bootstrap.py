"""Explicitly register Mari jobs on the shared Temporal service; provision no infrastructure."""
import asyncio
import hashlib
import os
from datetime import timedelta

from temporalio.client import (
    Client, Schedule, ScheduleActionStartWorkflow, ScheduleAlreadyRunningError,
    ScheduleIntervalSpec, ScheduleSpec, SchedulePolicy, ScheduleOverlapPolicy,
)
from temporalio.exceptions import WorkflowAlreadyStartedError

from .workflows import MineKnowledge, SourceSync
from .schedules import register_poll


async def schedule():
    # Disabled means no connection, schedule edits, or workflow starts.
    if os.getenv('TEMPORAL_JOBS_ENABLED', 'false') != 'true':
        return
    compaction_enabled = os.getenv('ICEBERG_COMPACTION_ENABLED', 'false') == 'true'
    compaction_minutes = int(os.getenv('ICEBERG_COMPACTION_MINUTES', '1440'))
    if compaction_enabled:
        from temporal.maintenance.catalog import maintenance_tables
        maintenance_tables()
        if compaction_minutes <= 0:
            raise ValueError('ICEBERG_COMPACTION_MINUTES must be positive')
    client = await Client.connect(os.getenv('TEMPORAL_ADDRESS', 'temporal.stack.svc:7233'),
                                  namespace=os.getenv('TEMPORAL_NAMESPACE', 'default'))
    queue = os.getenv('TEMPORAL_TASK_QUEUE', 'mari')

    async def register(identity, workflow, request, minutes):
        try:
            await client.create_schedule(identity, Schedule(
                action=ScheduleActionStartWorkflow(workflow.run, request, id=identity, task_queue=queue),
                spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(minutes=minutes))]),
                policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP)))
        except ScheduleAlreadyRunningError:
            # Shared Temporal: preserve operator cadence, pause state, and history.
            pass

    async def start(workflow, request, identity):
        try:
            await client.start_workflow(workflow.run, request, id=identity, task_queue=queue)
        except WorkflowAlreadyStartedError:
            pass

    from .observability import ObserveTemporal
    await register_poll(client,'observe-temporal','observe_temporal',{})
    if os.getenv('DECISION_MINING_ENABLED', 'false') == 'true':
        from .ontology import ExtractOntology
        await register('mine-decisions-daily', ExtractOntology,
                       {'budget_usd':float(os.getenv('MINING_RUN_BUDGET_USD','5')),
                        'context_budget_usd':float(os.getenv('MINING_CONTEXT_BUDGET_USD','2')),
                        'max_contexts':int(os.getenv('MINING_MAX_CONTEXTS','20'))},1440)
    if compaction_enabled:
        from temporal.maintenance.compaction import CompactIceberg
        await register('compact-iceberg-maintenance', CompactIceberg, {},
                       compaction_minutes)
    elif os.getenv('MARI_STORAGE','iceberg')=='postgres':
        from temporalio.service import RPCError,RPCStatusCode
        try:await client.get_schedule_handle('compact-iceberg-maintenance').pause(note='Iceberg storage is disabled')
        except RPCError as error:
            if error.status!=RPCStatusCode.NOT_FOUND:raise
    if os.getenv('SLACK_BOT_TOKEN'):
        from .discovery import DiscoverSlack
        await register_poll(client,'discover-slack','discover_slack',{})
    if os.getenv('AX_OBSERVATION_ENABLED', 'false') == 'true':
        from .ax_observability import ObserveAX
        await register_poll(client,'observe-ax','observe_ax',{})
    for target in filter(None, (s.strip() for s in os.getenv('GITHUB_REPOSITORIES', '').split(','))):
        identity = 'poll-sync-github-' + hashlib.sha256(target.encode()).hexdigest()[:12]
        await register_poll(client,identity,'sync_source',{'source':'github','target':target})


def setup():
    asyncio.run(schedule())


if __name__ == '__main__':
    setup()
