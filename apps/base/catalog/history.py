"""Immutable source revisions captured during extraction, across both storage engines."""
from fastapi import HTTPException
from apps.base.db import execute,hydrate
from .nodes import label_for_table
from .graph import projection

def source_history(identity,table):
    try:label=label_for_table(table)
    except ValueError:raise HTTPException(422,'Unknown source table') from None
    rows=execute('MATCH (r:AgentEvidence) WHERE r.source_id=$id AND r.source_node_type=$type RETURN '+projection('AgentEvidence')+' ORDER BY r.observed_at DESC,r.record_id LIMIT 101',{'id':identity,'type':label},limit=101)['rows']
    return {'rows':[hydrate(row) for row in rows[:100]],'available':True,'has_more':len(rows)>100,'coverage':'Source revisions captured during extraction'}
