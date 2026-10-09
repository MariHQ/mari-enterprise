"""Aggregates displayed by the existing analytics screen."""
from fastapi import APIRouter, HTTPException
from apps.base import db as reader
router=APIRouter()
# Content tables only: operational, configuration and derived records are not documents.
CONTENT_NODES=('MariDocument','SlackMessage','SlackThread','GithubIssue','GithubPullRequest','GithubComment','GithubFile','GithubDocument')

@router.get('/api/pages/{page_id}')
@reader.graph_snapshot
def page(page_id:str):
    if page_id!='insights':raise HTTPException(404,'Unknown page')
    stages=[];counts=[]
    for index,label in enumerate(CONTENT_NODES):
        variable='n'+str(index);count='c'+str(index)
        stages.append('OPTIONAL MATCH ('+variable+':'+label+') WITH '+', '.join([*counts,'count('+variable+') AS '+count]))
        counts.append(count)
    query=' '.join(stages)+' RETURN '+' + '.join(counts)+' AS documents'
    documents=reader.execute(query)['rows'][0]['documents']
    metrics={'documents':documents}
    for key,labels in (('facts',('MariFact','AgentFact')),('decisions',('MariDecision','AgentDecision')),
                       ('entities',('AgentEntity',)),('evidence',('AgentEvidence',))):
        metrics[key]=sum(reader.execute('MATCH (n:'+label+') RETURN count(n) AS total')['rows'][0]['total'] for label in labels)
    return {'records':[],'truncated':False,'metrics':metrics}
