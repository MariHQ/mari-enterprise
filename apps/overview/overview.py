"""Recent content reads; every label is backed by one topic table."""
from fastapi import APIRouter
from apps.base.db import execute, graph_snapshot
from apps.base.catalog.nodes import topic_for_label

router = APIRouter()
CONTENT = ('MariDocument', 'SlackMessage', 'SlackThread', 'GithubDocument', 'GithubFile', 'GithubIssue', 'GithubPullRequest', 'GithubComment')

@router.get('/api/overview')
@graph_snapshot
def overview():
    branches = []
    for label in CONTENT:
        table = topic_for_label(label)
        branches.append("MATCH (r:" + label + ") RETURN r.record_id AS record_id, r.title AS title, r.source AS source, r.observed_at AS observed_at, '" + table + "' AS table, '" + label + "' AS node_type ORDER BY r.observed_at DESC, r.record_id LIMIT 12")
    rows = execute(' UNION ALL '.join(branches), limit=12 * len(CONTENT))['rows']
    rows.sort(key=lambda row: (-row['observed_at'], row['record_id'], row['node_type']))
    return {'recent': rows[:12]}

@router.get('/api/overview/stats')
@graph_snapshot
def stats():
    import time
    since=int(time.time())-7*86400
    def count(label,where='',args=None):
        return execute(f'MATCH (r:{label}) '+where+' RETURN count(r) AS n',args)['rows'][0]['n']
    return {'changes':sum(count(label,'WHERE r.observed_at >= $since',{'since':since}) for label in CONTENT),
        'factsReview':count('AgentFact',"WHERE r.status IN ['pending','stale']"),
        'workflowsActive':count('AgentRun',"WHERE r.status='running'")}

@router.get('/api/overview/sources')
@graph_snapshot
def sources():
    import time
    today=int(time.time())//86400
    output=[]
    for provider,labels in [('slack',('SlackMessage',)),('github',('GithubIssue','GithubPullRequest','GithubComment','GithubFile','GithubDocument'))]:
        counts=[0]*7
        columns=','.join(f'sum(CASE WHEN r.observed_at >= {(today-6+i)*86400} AND r.observed_at < {(today-5+i)*86400} THEN 1 ELSE 0 END) AS d{i}' for i in range(7))
        for label in labels:
            row=execute(f'MATCH (r:{label}) WHERE r.observed_at >= $since RETURN '+columns,{'since':(today-6)*86400})['rows'][0]
            counts=[count+(row[f'd{i}'] or 0) for i,count in enumerate(counts)]
        output.append({'key':provider,'name':provider.title() if provider!='github' else 'GitHub','stat':str(sum(counts)),
            'unit':'current records updated this week','status':'active' if sum(counts) else 'moderate','bars':counts})
    return output

@router.get('/api/overview/knowledge')
@graph_snapshot
def knowledge():
    import time
    since=int(time.time())-7*86400
    rows=[]
    for label in ('AgentFact','AgentDecision'):
        rows.extend(execute(f"MATCH (r:{label}) WHERE r.status <> 'stale' AND r.observed_at >= $since RETURN r.title AS title,r.text AS text,r.kind AS kind,r.status AS status,r.observed_at AS observed_at ORDER BY r.observed_at DESC LIMIT 8",{'since':since})['rows'])
    rows.sort(key=lambda row:-row['observed_at'])
    return [{'title':r['title'],'summary':r['text'],'where':[],
        'impact':[{'name':r['kind'],'tone':'neutral'},{'name':r['status'] or 'pending','tone':'neutral'}]} for r in rows[:8]]

@router.get('/api/overview/activity')
@graph_snapshot
def activity():
    import time
    rows=execute('MATCH (r:AgentRun) RETURN r.record_id AS id,r.title AS title,r.status AS status,r.observed_at AS observed_at ORDER BY r.observed_at DESC LIMIT 12')['rows']
    return [{'id':index,'kind':'run','actor':'Mari','text':r['title'],'target':r['status'],'secondsAgo':max(0,int(time.time())-r['observed_at'])} for index,r in enumerate(rows)]
