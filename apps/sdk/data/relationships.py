"""Computed relationships from explicit normalized record references.

These are logical mappings, not sink tables. Deleting the owning record removes
its computed edges. An empty reference never invents an actor or relationship.
"""
# kind -> (property, edge label, direction). References are graph record IDs.
REFERENCES = {
    'fact': [('supporting_record_ids', 'supported_by', 'out'), ('review_ids', 'reviewed_by', 'out'),
             ('conflicting_fact_ids', 'conflicts_with', 'out')],
    'decision': [('supporting_record_ids', 'supported_by', 'out'), ('owner_ids', 'owned_by', 'out'),
                 ('affected_record_ids', 'affects', 'out'), ('supersedes_ids', 'supersedes', 'out'),
                 ('review_ids', 'reviewed_by', 'out')],
    'review': [('record_ids', 'reviewed_by', 'in'), ('finding_ids', 'has_finding', 'out'),
               ('reviewer_ids', 'reviewed', 'in')],
    'finding': [('supporting_record_ids', 'supported_by', 'out')],
    'answer': [('supporting_record_ids', 'supported_by', 'out'), ('run_ids', 'produced', 'in'),
               ('destination_ids', 'published_to', 'out')],
    'collection': [('record_ids', 'contains', 'out')],
    'trajectory': [('supporting_record_ids', 'supported_by', 'out')],
    'step': [('run_ids', 'has_step', 'in'), ('supporting_record_ids', 'supported_by', 'out')],
    'workflow': [('execution_ids', 'executed_by', 'out'), ('supporting_record_ids', 'supported_by', 'out'), ('workflow_ids', 'instance_of', 'out')],
    'change': [('record_ids', 'changed', 'out'), ('actor_ids', 'authored', 'in')],
    'principal': [('project_ids', 'member_of', 'out')],
    'model_provider': [('model_ids', 'provides', 'out')],
    'project': [('configuration_ids', 'configured_by', 'out')],
}


def relationship_sql():
    rules = ','.join(
        "('" + "','".join((kind, prop, label, direction)) + "')"
        for kind, references in REFERENCES.items()
        for prop, label, direction in references)
    return f"""SELECT r.record_id || ':' || mapping.property || ':' || reference.id AS record_id,
        CASE WHEN mapping.direction='out' THEN r.record_id ELSE reference.id END AS from_id,
        CASE WHEN mapping.direction='out' THEN reference.id ELSE r.record_id END AS to_id,
        mapping.relation, r.title, r.properties, r.observed_at
        FROM graph_records r
        JOIN (VALUES {rules}) mapping(kind, property, relation, direction) ON r.kind=mapping.kind,
        UNNEST(CAST(json_extract(r.properties, '$.' || mapping.property) AS VARCHAR[])) reference(id)
        WHERE reference.id IS NOT NULL AND reference.id <> ''"""


RELATIONSHIP_LINKS_SQL = relationship_sql()
