from pathlib import Path
from fastapi import APIRouter
from apps.base.runtime import Manifest, create_app
from .workflows import router as router_0
from .writes import router as router_1

from apps.base.catalog.statistics import router as statistics_router
router=APIRouter()
router.include_router(statistics_router)
router.include_router(router_0)
router.include_router(router_1)
app=create_app(Manifest(name='workflows'),router,Path(__file__).parent/'web/dist',api_prefix='')
