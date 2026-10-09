from pathlib import Path
from apps.sdk.screen import create_screen
from .lineage import router as lineage_router
from fastapi import APIRouter
from .lineage import lineage
links_router=APIRouter()
@links_router.get("/api/links")
def links(focal:str):
    result=lineage(focal,30)
    return {"rows":result["edges"],"truncated":result["has_more"]}

app=create_screen('lineage',[lineage_router,links_router],Path(__file__).parent/"web/dist")
