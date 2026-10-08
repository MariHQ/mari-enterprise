"""Acknowledged Kafka writes; normalized records only, no source archive/outbox."""
import json
import os
from confluent_kafka import Producer
from .records import TOPIC, KnowledgeChange, from_evidence, command_id
from .mappings import topic_for


def publish_changes(changes: list[KnowledgeChange]):
    if not changes:
        return []
    producer = Producer({'bootstrap.servers': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'mari-kafka-kafka-bootstrap:9092'),
                         'enable.idempotence': True, 'acks': 'all', 'delivery.timeout.ms': 15000})
    errors, receipts = [], []
    def delivered(error, message):
        if error:
            errors.append(error)
        else:
            receipts.append({'topic': message.topic(), 'partition': message.partition(), 'offset': message.offset()})
    for change in changes:
        producer.produce(change.table, key=change.key,
                         value=change.model_dump_json(), on_delivery=delivered)
        producer.poll(0)
    if producer.flush(20) or errors:
        raise RuntimeError('Kafka did not acknowledge ingestion; retry with the same delivery ID')
    return receipts


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
