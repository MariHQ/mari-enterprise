"""One evidence-freshness gate for human approval of extracted claims."""
from fastapi import HTTPException
from apps.base.catalog.graph import projection
from apps.base.catalog.relationships import CONTENT
from apps.base.ingestion.records import hydrate

def check_approval(body,execute):
    if body.source!='agent' or body.kind not in ('fact','decision'):return
    if body.properties.get('status') not in ('approved','ratified','verified'):return
    citations=body.properties.get('evidence') or []
    if not citations:raise HTTPException(409,'Extracted knowledge requires source evidence before approval')
    for citation in citations:
        label=citation.get('source_node_type')
        if label not in CONTENT:raise HTTPException(409,'Evidence has no valid source type; extract again')
        rows=execute(f'MATCH (r:{label}) WHERE r.record_id=$id RETURN r.event_id AS event_id,r.text AS text LIMIT 1',{'id':citation['source_id']})['rows']
        if not rows or rows[0]['event_id']!=citation['evidence_id']:
            raise HTTPException(409,'Source evidence changed or was deleted; extract and review again')
        if not citation.get('quote') or citation['quote'] not in rows[0]['text']:raise HTTPException(409,'Citation does not match its source')

def invalidate(source_id,revision,execute,publish,project='1'):
    """Called for source changes, including deletes. Never calls an LLM."""
    from .records import KnowledgeChange,command_id
    changes=[]
    for label in ('AgentFact','AgentDecision'):
        after=''
        while True:
            rows=execute(f'MATCH (r:{label}) WHERE $id IN r.supporting_record_ids AND r.record_id>$after RETURN '+projection(label)+' ORDER BY r.record_id LIMIT 100',{'id':source_id,'after':after})['rows']
            for raw in rows:
                row=hydrate(raw);p=row['properties']
                if p.get('status')=='stale':continue
                if any(e['source_id']==source_id and e['evidence_id']!=revision for e in p.get('evidence') or []):
                    properties={**p,'status':'stale','review_note':'Source evidence changed or was deleted; review required.'}
                    changes.append(KnowledgeChange(table=row['table'],project_id=project,record_id=row['record_id'],
                        event_id=command_id(project,'evidence',source_id+':'+str(revision),{'id':row['record_id'],'properties':properties}),
                        kind=row['kind'],source=row['source'],operation='upsert',title=row['title'],text=row['text'],url=row['url'],properties=properties,actor='evidence'))
            if len(rows)<100:break
            after=rows[-1]['record_id']
    if changes:publish(changes)
