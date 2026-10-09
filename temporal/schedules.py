"""Daily bounded polling, with the next cursor persisted in the Schedule action."""
from datetime import timedelta
from temporalio import activity, workflow
from temporalio.common import RetryPolicy

POLL_ACTIVITIES={'sync_source','discover_slack','observe_temporal','observe_ax'}


@workflow.defn
class ScheduledPoll:
    @workflow.run
    async def run(self, request:dict):
        name=request['activity']
        if name not in POLL_ACTIVITIES:raise ValueError('Unsupported scheduled poll')
        result=await workflow.execute_activity(name,request.get('state',{}),
            start_to_close_timeout=timedelta(minutes=30),heartbeat_timeout=timedelta(seconds=60),
            retry_policy=RetryPolicy(maximum_attempts=3))
        state=dict(request.get('state',{}))
        if name=='sync_source':state['known']=result['known']
        elif name=='observe_ax':state.update(result)
        else:state['known']=result
        await workflow.execute_activity('persist_poll_cursor',
            {**request,'state':state,'previous_state':request.get('state',{}),'completed_run':workflow.info().run_id},
            start_to_close_timeout=timedelta(seconds=30),retry_policy=RetryPolicy(maximum_attempts=5))
        return {'status':'completed','activity':name}


async def register_poll(client, identity, name, state, paused=False):
    import os
    from temporalio.client import (Schedule,ScheduleActionStartWorkflow,ScheduleSpec,
        ScheduleIntervalSpec,SchedulePolicy,ScheduleOverlapPolicy,ScheduleState,ScheduleAlreadyRunningError,ScheduleUpdate)
    if name not in POLL_ACTIVITIES:raise ValueError('Unsupported scheduled poll')
    observing=name=='observe_temporal'
    interval=timedelta(minutes=5) if observing else timedelta(days=1)
    try:
        await client.create_schedule(identity,Schedule(
            action=ScheduleActionStartWorkflow(ScheduledPoll.run,
                {'schedule_id':identity,'activity':name,'state':state},id=identity,
                task_queue=os.getenv('TEMPORAL_TASK_QUEUE','mari')),
            spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=interval)]),
            policy=SchedulePolicy(overlap=ScheduleOverlapPolicy.SKIP),
            state=ScheduleState(paused=paused)),trigger_immediately=observing and not paused)
    except ScheduleAlreadyRunningError:
        if observing:
            def refresh_interval(input):
                schedule=input.description.schedule
                if [i.every for i in schedule.spec.intervals]==[interval]:return None
                schedule.spec.intervals=[ScheduleIntervalSpec(every=interval)]
                return ScheduleUpdate(schedule=schedule)
            await client.get_schedule_handle(identity).update(refresh_interval)


@activity.defn
async def persist_poll_cursor(request:dict):
    import os
    from temporalio.client import Client,ScheduleUpdate
    client=await Client.connect(os.environ['TEMPORAL_ADDRESS'],namespace=os.getenv('TEMPORAL_NAMESPACE','default'))
    def update(input):
        schedule=input.description.schedule
        previous=schedule.action.args[0]
        # Described arguments are Payloads; decode before the synchronous update below.
        if previous.get('completed_run')==request['completed_run']:return None
        if previous.get('activity')!=request['activity'] or previous.get('state')!=request.get('previous_state',previous.get('state')):
            raise ValueError('Scheduled poll cursor changed concurrently')
        schedule.action.args=[{k:v for k,v in request.items() if k!='previous_state'}]
        return ScheduleUpdate(schedule=schedule)
    async def decoded_update(input):
        from temporalio.api.common.v1 import Payload
        action=input.description.schedule.action
        if action.args and isinstance(action.args[0],Payload):
            action.args=await client.data_converter.decode(action.args)
        return update(input)
    await client.get_schedule_handle(request['schedule_id']).update(decoded_update)
