from fastapi import APIRouter
from apps.sdk.data.reader import execute, hydrate
from apps.sdk.graph import projection, DOCUMENTS
router=APIRouter()

@router.get('/api/overview')
def overview():
    rows=execute("MATCH (r:Record) WHERE "+DOCUMENTS+" AND r.kind <> 'edge' RETURN "+projection(text="substring(r.text,0,400)")+" ORDER BY r.observed_at DESC, r.record_id LIMIT 12")['rows']
    return {'recent':[hydrate(row) for row in rows]}
