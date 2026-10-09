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

# These references have a declared endpoint type. Do not expand an untyped
# supporting_record_ids/affected_record_ids field into joins against every node.
TYPED_REFERENCES = [
    ('SlackMessage', 'collection_id', 'SlackCollection', 'in_collection', False),
    ('SlackThread', 'collection_id', 'SlackCollection', 'in_collection', False),
    ('SlackMessage', 'author_record_id', 'SlackPrincipal', 'authored_by', False),
    ('SlackThread', 'author_record_id', 'SlackPrincipal', 'authored_by', False),
    ('MariPrincipal', 'project_ids', 'MariProject', 'member_of', True),
    ('MariProject', 'configuration_ids', 'MariConfiguration', 'configured_by', True),
    ('MariModelProvider', 'model_ids', 'MariModel', 'provides', True),
    ('MariReview', 'finding_ids', 'MariFinding', 'has_finding', True),
]
for _source in ('Ax', 'Agent', 'Substrate'):
    TYPED_REFERENCES.append((_source+'Trajectory', 'step_ids', _source+'Step', 'has_step', True))
for _source in ('Mari', 'Agent'):
    TYPED_REFERENCES.extend([
        (_source+'Fact', 'review_ids', _source+'Review', 'reviewed_by', True),
        (_source+'Fact', 'conflicting_fact_ids', _source+'Fact', 'conflicts_with', True),
        (_source+'Decision', 'review_ids', _source+'Review', 'reviewed_by', True),
        (_source+'Decision', 'supersedes_ids', _source+'Decision', 'supersedes', True),
    ])
for _kind in ('Issue', 'PullRequest', 'File', 'Comment', 'Document'):
    TYPED_REFERENCES.extend([
        ('Github'+_kind, 'collection_id', 'GithubCollection', 'in_collection', False),
        ('Github'+_kind, 'author_record_id', 'GithubPrincipal', 'authored_by', False),
    ])

CONTENT = ('MariDocument','SlackMessage','SlackThread','GithubIssue','GithubPullRequest','GithubComment','GithubFile','GithubDocument')
for _source in ('Mari','Agent'):
    for _kind in ('Fact','Decision'):
        TYPED_REFERENCES.extend([
            (_source+_kind,'supporting_evidence_ids','AgentEvidence','supported_by',True),
            (_source+_kind,'entity_ids','AgentEntity','mentions',True),
            (_source+_kind,'subject_id','AgentEntity','subject',False),
            (_source+_kind,'object_id','AgentEntity','object',False),
        ])
for _kind in ('Fact','Decision','MiningReceipt'):
    TYPED_REFERENCES.append(('Agent'+_kind,'run_id','AgentRun','extracted_by',False))
TYPED_REFERENCES.extend([
    ('AgentRun','workflow_run_id','TemporalRun','executed_by',False),
    ('SlackMessage','thread_root','SlackMessage','in_thread',False),
    ('AgentEvidence','ingestion_run_id','TemporalRun','ingested_by',False),
    ('AgentEvidence','connector_id','TemporalConnector','collected_by',False),
])
for _label in CONTENT:
    TYPED_REFERENCES.extend([
        (_label,'ingestion_run_id','TemporalRun','ingested_by',False),
        (_label,'connector_id','TemporalConnector','collected_by',False),
    ])

def definitions(entities):
    """Register native computed edges between two explicit physical node types."""
    by_label={d['mapping']['label']:(name,d) for name,d in entities.items() if d['kind']=='entity'}
    result={}
    for source,field,target,relation,many in TYPED_REFERENCES:
        if source not in by_label or target not in by_label:continue
        source_name,source_node=by_label[source]
        target_name,_=by_label[target]
        if field not in source_node['mapping']['properties']:
            raise ValueError('Missing relationship field: '+source+'.'+field)
        name=source+'_'+relation+'_'+target
        predicate=(f'list_contains(source.{field}, target.record_id)' if many else f'source.{field} = target.record_id')
        result['relation_'+name]={'kind':'computed_relationship','description':relation,
            'source':source_name,'target':target_name,
            'mapping':{'name':name,'source':source,'target':target,
                'predicate':'source.project_id = target.project_id AND '+predicate,'properties':{}}}
    # Typed evidence references are guarded by their declared concrete source type.
    for target in CONTENT:
        if 'AgentEvidence' not in by_label or target not in by_label:continue
        name='AgentEvidence_revision_of_'+target
        result['relation_'+name]={'kind':'computed_relationship','description':'revision_of','source':by_label['AgentEvidence'][0],'target':by_label[target][0],
            'mapping':{'name':name,'source':'AgentEvidence','target':target,
                'predicate':"source.project_id = target.project_id AND source.source_node_type = '"+target+"' AND source.source_id = target.record_id",'properties':{}}}
    for target in ('GithubIssue','GithubPullRequest'):
        if 'GithubComment' not in by_label or target not in by_label:continue
        name='GithubComment_comments_on_'+target
        result['relation_'+name]={'kind':'computed_relationship','description':'comments_on','source':by_label['GithubComment'][0],'target':by_label[target][0],
            'mapping':{'name':name,'source':'GithubComment','target':target,'predicate':'source.project_id = target.project_id AND source.repository = target.repository AND source.parent_number = target.number','properties':{}}}
    for source,target,relation,field in [('TemporalRun','TemporalWorkflow','run_of','workflow_id'),('TemporalActivity','TemporalRun','activity_of','run_id')]:
        if source not in by_label or target not in by_label:continue
        name=source+'_'+relation+'_'+target
        result['relation_'+name]={'kind':'computed_relationship','description':relation,'source':by_label[source][0],'target':by_label[target][0],
            'mapping':{'name':name,'source':source,'target':target,'predicate':f'source.project_id = target.project_id AND source.{field} = target.{field}','properties':{}}}
    return result

