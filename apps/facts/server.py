from pathlib import Path
from apps.sdk.screen import create_screen

app=create_screen('facts',[],Path(__file__).parent/"web/dist")
