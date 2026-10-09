"""Decision mining command owned by the Decisions app."""
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal
router=APIRouter()
class MiningCommand(BaseModel):
    operation:Literal['trigger']
@router.post('/api/temporal/schedules/mine-decisions-daily',status_code=202)
async def mine(body:MiningCommand):
    from temporalio.client import Client
    from temporalio.service import RPCError, RPCStatusCode
    try:
        client=await Client.connect(os.getenv('TEMPORAL_ADDRESS','temporal.stack.svc:7233'),namespace=os.getenv('TEMPORAL_NAMESPACE','default'))
        await client.get_schedule_handle('mine-decisions-daily').trigger()
    except RPCError as error:
        raise HTTPException(404 if error.status==RPCStatusCode.NOT_FOUND else 503,'Decision mining schedule unavailable') from None
    return {'accepted':True,'applied_to_graph':False,'operation':'trigger','schedule_id':'mine-decisions-daily'}
