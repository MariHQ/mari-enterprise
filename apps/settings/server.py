from pathlib import Path
from fastapi import APIRouter
from apps.base.runtime import Manifest, create_app
from .projections import router as router_0
from .writes import router as router_1

router=APIRouter()
router.include_router(router_0)
router.include_router(router_1)
app=create_app(Manifest(name='settings'),router,Path(__file__).parent/'web/dist',api_prefix='')
