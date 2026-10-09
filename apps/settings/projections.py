from fastapi import APIRouter,HTTPException
from apps.sdk.projection import read
router=APIRouter()
KINDS={'preferences': ['preferences'], 'settings-general': ['project', 'configuration'], 'settings-members': ['principal', 'project'], 'settings-models': ['model_provider', 'model', 'configuration'], 'settings-api-keys': ['service_principal'], 'settings-audit-log': ['change'], 'settings-design': ['presentation']}
@router.get('/api/pages/{page_id}')
def page(page_id:str):
    if page_id not in KINDS:raise HTTPException(404,'Unknown page')
    return read(KINDS[page_id],metrics=page_id in ('library','insights'))
