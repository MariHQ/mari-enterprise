from fastapi import APIRouter,HTTPException
from apps.sdk.projection import read
router=APIRouter()
KINDS={'insights': ['change', 'temporal_run']}
@router.get('/api/pages/{page_id}')
def page(page_id:str):
    if page_id not in KINDS:raise HTTPException(404,'Unknown page')
    return read(KINDS[page_id],metrics=page_id in ('library','insights'))
