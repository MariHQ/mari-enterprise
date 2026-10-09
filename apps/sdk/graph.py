"""Shared Cypher projections and catalog-visible scalar record properties."""
from apps.sdk.data.query import COLUMNS

# Storage binding extracts these JSON properties once; handlers use graph properties.
JSON_PROPERTIES = ('status','workflow_id','run_id','started_at','error','ordinal',
                   'miner_version','source_id','source_revision')
RECORD_PROPERTIES = [name for name,_ in COLUMNS] + list(JSON_PROPERTIES) + ['source_group','owner_name','content_type','event_key']


def property_type(name): return 'int64' if name=='ordinal' else 'string'


def projection(alias='r', text=None):
    return ', '.join((text if name=='text' and text is not None else f'{alias}.`{name}`')+f' AS `{name}`' for name,_ in COLUMNS)


def page_limit(value):
    # The current compiler requires a literal LIMIT rather than a parameter.
    if type(value) is not int or not 1 <= value <= 1001: raise ValueError('Invalid graph page size')
    return str(value)


DOCUMENTS = "r.source <> 'temporal' AND NOT r.kind IN ['workflow','mining_receipt','principal','change','review','collection','trajectory','step']"
LATEST_RUN = """NOT EXISTS {
 MATCH (newer:Run) WHERE newer.workflow_id=r.workflow_id AND (
 coalesce(newer.started_at,'') > coalesce(r.started_at,'') OR
 (coalesce(newer.started_at,'')=coalesce(r.started_at,'') AND newer.observed_at>r.observed_at) OR
 (coalesce(newer.started_at,'')=coalesce(r.started_at,'') AND newer.observed_at=r.observed_at AND newer.record_id>r.record_id))
}"""
