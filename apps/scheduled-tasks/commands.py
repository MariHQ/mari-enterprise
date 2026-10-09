import os
from typing import Literal
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from apps.base.runtime import authenticated
def actor_identity(claims=Depends(authenticated)):return claims['sub']
router=APIRouter()

class ScheduleCommand(BaseModel):
    operation: Literal['pause','resume','trigger','interval']
    minutes: int | None = Field(default=None,ge=5,le=10080)


@router.post('/api/temporal/schedules/{schedule_id}',status_code=202)
async def schedule_command(schedule_id:str, body:ScheduleCommand, actor:str=Depends(actor_identity)):
    from temporalio.client import Client, ScheduleUpdate, ScheduleIntervalSpec, ScheduleSpec
    from datetime import timedelta
    from temporalio.service import RPCError, RPCStatusCode
    # Commands go to Temporal. The page's statistics always read the lake projection.
    if body.operation=='interval' and body.minutes is None:
        raise HTTPException(400,'An interval is required')
    try:
        client=await Client.connect(os.getenv('TEMPORAL_ADDRESS','temporal.stack.svc:7233'), namespace=os.getenv('TEMPORAL_NAMESPACE', 'default'))
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

