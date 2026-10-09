"""Acknowledged Kafka writes; normalized records only, no source archive/outbox."""
import json
import os
from confluent_kafka import Producer
from .records import TOPIC, KnowledgeChange, from_evidence, command_id
from .mappings import topic_for


def publish_changes(changes: list[KnowledgeChange]):
    from .avro import publish_rows
    import json
    from .avro import registry
    rows=[]
    for change in changes:
        key={'project_id':change.project_id,'record_id':change.record_id}
        row=None
        if change.operation!='delete':
            row=change.model_dump(exclude={'version','table','operation','properties'})
            for name,value in change.properties.items():
                if name in row and row[name]!=value:raise ValueError('Conflicting source column: '+name)
                row[name]=value
            schema=json.loads(registry().get_latest_version(change.table+'-value').schema.schema_str)
            unknown=set(row)-{f['name'] for f in schema['fields']}
            if unknown:raise ValueError('Unregistered columns for '+change.table+': '+', '.join(sorted(unknown)))
        rows.append((change.table,key,row))
    return publish_rows(rows)


def publish_events(evidence, *, connector_id=None, run_id=None):
    changes = []
    for event in evidence:
        change = from_evidence(event)
        if change.operation == 'upsert':
            # These identities come from the actual executing ingress path, not
            # inferred source text. Retractions remain content-free.
            provenance = {}
            if connector_id:
                provenance['connector_id'] = connector_id
            if run_id:
                provenance['ingestion_run_id'] = 'temporal:run:' + run_id
            properties = {**change.properties, **provenance}
            entities = []
            if change.source == 'slack':
                team, channel = properties.get('team_id'), properties.get('channel_id')
                if team and channel:
                    entities.append(('collection', 'slack:channel:'+team+':'+channel, channel, 'collection_id'))
                if team and properties.get('author_id'):
                    entities.append(('principal', 'slack:user:'+team+':'+properties['author_id'], properties['author_id'], 'author_record_id'))
            elif change.source == 'github':
                if properties.get('repository'):
                    entities.append(('collection', 'github:repository:'+properties['repository'], properties['repository'], 'collection_id'))
                if properties.get('author_id'):
                    entities.append(('principal', 'github:user:'+properties['author_id'], properties['author_id'], 'author_record_id'))
            for kind, identity, title, reference in entities:
                properties[reference] = identity
                # Stable entity revisions avoid manufacturing changes on every poll.
                changes.append(KnowledgeChange(table=topic_for(change.source,kind),
                    event_id=command_id(change.project_id,change.source,identity,{'title':title}),
                    record_id=identity,project_id=change.project_id,operation='upsert',
                    kind=kind,source=change.source,title=title,actor=change.source))
            change = change.model_copy(update={'properties': properties})
        changes.insert(0,change)
    return publish_changes(changes)
