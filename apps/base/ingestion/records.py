"""Normalized knowledge changes shared by connectors, governance and agents.

A change is a full record replacement or a retraction. Kafka orders all changes
for a record; no SQL outbox or provider payload archive is involved.
"""
from __future__ import annotations
import hashlib
import json
import time
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

TOPIC = 'mari.knowledge'


class KnowledgeChange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: Literal[1] = 1
    table: str = Field(min_length=1, max_length=249, pattern=r'^[a-zA-Z0-9._-]+$')
    event_id: str = Field(min_length=1, max_length=256)
    record_id: str = Field(min_length=1, max_length=512)
    project_id: str = Field(default='1', min_length=1, max_length=128)
    operation: Literal['upsert', 'delete']
    kind: str = Field(default='document', min_length=1, max_length=64)
    source: str = Field(default='mari', min_length=1, max_length=64)
    title: str = Field(default='', max_length=2000)
    text: str = Field(default='', max_length=500_000)
    url: str = Field(default='', max_length=4000)
    properties: dict[str, Any] = Field(default_factory=dict)
    actor: str = Field(default='', max_length=256)
    observed_at: int = Field(default_factory=lambda: int(time.time()), ge=0)

    @model_validator(mode='after')
    def bounded_properties(self):
        if len(json.dumps(self.properties, allow_nan=False).encode()) > 64_000:
            raise ValueError('Record properties exceed 64 KB')
        from apps.base.catalog.relationships import REFERENCES
        for property_name, _, _ in REFERENCES.get(self.kind, []):
            references = self.properties.get(property_name) or []
            if not isinstance(references, list) or len(references) > 1000 or any(
                not isinstance(value, str) or not 0 < len(value) <= 512 for value in references
            ):
                raise ValueError(property_name + ' must be a bounded list of record IDs')
        if self.operation == 'delete' and (self.text or self.properties):
            raise ValueError('Retractions carry identity and attribution, not content')
        return self

    @property
    def key(self):
        return json.dumps([self.project_id, self.record_id], separators=(',', ':'))


def from_evidence(event) -> KnowledgeChange:
    kind = 'message' if event.source == 'slack' else 'document'
    if event.source == 'github':
        part = event.source_id.rsplit('/', 2)[-2]
        kind = {'pull': 'pull_request'}.get(part, part)
    from .mappings import topic_for
    import os
    return KnowledgeChange(table=topic_for(event.source, kind),event_id=event.event_id, record_id=event.source_id,project_id=os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1'),
        operation=event.operation, source=event.source, kind=kind, title=event.title,
        text=event.text if event.operation != 'delete' else '', url=event.url,
        actor=event.source, observed_at=event.observed_at, properties=event.properties if event.operation!='delete' else {})


def command_id(project: str, actor: str, request_id: str, content: dict) -> str:
    """Stable across ambiguous delivery retries; distinguish different commands."""
    encoded = json.dumps([project, actor, request_id, content], sort_keys=True,
                         separators=(',', ':'), allow_nan=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


def hydrate(row):
    from apps.base.catalog.schema import BASE
    from apps.base.catalog.nodes import label_for
    topic='mari.records.'+row['source']+'.'+row['kind']
    properties=row.get('properties')
    if isinstance(properties,str):properties=json.loads(properties)
    if properties is None:properties={k:v for k,v in row.items() if k not in BASE and k not in ('table','node_type','operation')}
    return {**row,'table':topic,'node_type':label_for(topic),'properties':properties,'operation':'upsert'}
