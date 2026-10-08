"""Read-only Knowledge API; owns lake queries on behalf of Mari and other consumers."""
import os
from fastapi import Depends, FastAPI
from .auth import authenticated
from .reader import router

app = FastAPI(title='Mari Knowledge API · OrchidDB', dependencies=[Depends(authenticated)])
app.include_router(router)
from .views import router as views_router
app.include_router(views_router)
from knowledge.lineage import router as lineage_router
app.include_router(lineage_router)
from knowledge.connectors_view import router as connectors_router
app.include_router(connectors_router)

@app.get('/healthz')
def health():
    return {'service':'knowledge-api','engine':'orchiddb','backend':os.getenv('KNOWLEDGE_BACKEND','duckdb'),'read_only':True}
