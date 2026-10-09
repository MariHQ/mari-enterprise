from pathlib import Path
from apps.sdk.screen import create_screen
from .connectors import router as connectors_router
app=create_screen('sources',[connectors_router],Path(__file__).parent/"web/dist")
