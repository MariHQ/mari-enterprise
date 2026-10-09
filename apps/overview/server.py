from pathlib import Path
from apps.sdk.screen import create_screen
from .overview import router as overview_router
app=create_screen('overview',[overview_router],Path(__file__).parent/"web/dist")
