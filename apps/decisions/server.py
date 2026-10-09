from pathlib import Path
from apps.sdk.screen import create_screen

from apps.sdk.temporal_commands import router as temporal_router
app=create_screen('decisions',[temporal_router],Path(__file__).parent/"web/dist")
