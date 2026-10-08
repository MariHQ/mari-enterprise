"""Attribution records for accepted governance writes; no source-content copies."""
import hashlib
from knowledge.records import KnowledgeChange


def attributed_changes(event):
    principal_id = 'principal:' + hashlib.sha256(event.actor.encode()).hexdigest()
    principal = KnowledgeChange(table='mari.records.mari.principal',
        record_id=principal_id, event_id=principal_id, project_id=event.project_id,
        operation='upsert', source='mari', kind='principal', title=event.actor,
        actor=event.actor, properties={})
    change = KnowledgeChange(table='mari.records.mari.change',
        record_id='change:'+event.event_id, event_id=event.event_id,
        project_id=event.project_id, operation='upsert', source='mari', kind='change',
        title=event.operation, actor=event.actor, observed_at=event.observed_at,
        properties={'record_ids':[event.record_id], 'actor_ids':[principal_id],
                    'table':event.table, 'operation':event.operation, 'revision':event.event_id})
    return [event, principal, change]
