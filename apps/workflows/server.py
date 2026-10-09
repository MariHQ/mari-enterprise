from pathlib import Path
from apps.sdk.screen import create_screen
from .workflows import router as workflows_router
app=create_screen('workflows',[workflows_router],Path(__file__).parent/"web/dist")
