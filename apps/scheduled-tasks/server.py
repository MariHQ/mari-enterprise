from pathlib import Path
from apps.sdk.screen import create_screen
from .operations import router as operations_router
from apps.sdk.temporal_commands import router as temporal_router
app=create_screen('scheduled-tasks',[operations_router,temporal_router],Path(__file__).parent/"web/dist")
