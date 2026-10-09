from pathlib import Path
from fastapi import APIRouter
from apps.base.runtime import Manifest, create_app
from .projections import router as router_0
from .records import router as router_1
from .writes import router as router_2

router=APIRouter()
router.include_router(router_0)
router.include_router(router_1)
router.include_router(router_2)
app=create_app(Manifest(name='knowledge'),router,Path(__file__).parent/'web/dist',api_prefix='')
