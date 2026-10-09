from pathlib import Path
from apps.sdk.screen import create_screen
from .projections import router as projections_router
app=create_screen('publish',[projections_router],Path(__file__).parent/"web/dist")
