"""Names and columns for one-to-one topic/node mappings; no query logic."""
from .provision import topics
from .schema import columns
from apps.base.ingestion.mappings import route_for

def label_for(topic):
    source,kind=route_for(topic)
    if kind.startswith(source+'_'):kind=kind[len(source)+1:]
    return ''.join(p.title() for p in (source+'_'+kind).split('_'))

def topic_for_label(label):
    matches=[t for t in topics() if label_for(t)==label]
    if len(matches)!=1:raise ValueError('Unknown node type: '+label)
    return matches[0]

def fields_for(label):return columns(topic_for_label(label))

def label_for_table(table):
    if table not in topics():raise ValueError('Unknown topic table')
    return label_for(table)
