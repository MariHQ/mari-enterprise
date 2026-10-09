"""Queries for the existing library, audit and welcome sections."""
from fastapi import APIRouter, HTTPException
from apps.base import db as reader
from apps.base.catalog.graph import projection
from apps.base.catalog.nodes import fields_for, label_for
from .records import CONTENT

router = APIRouter()
PAGES = {
    'library': ('MariConfiguration', 'MariProject', 'MariCollection', 'SlackCollection', 'GithubCollection'),
    'audit': ('MariReview', 'AgentReview', 'MariFinding'),
    'welcome': ('TemporalConnector',),
}

@router.get('/api/pages/{page_id}')
@reader.graph_snapshot
def page(page_id: str):
    if page_id not in PAGES: raise HTTPException(404, 'Unknown page')
    labels = PAGES[page_id]
    fields = sorted({field for label in labels for field in fields_for(label)})
    branches = []
    for label in labels:
        native = fields_for(label)
        columns = ', '.join(('r.`' + field + '`' if field in native else 'null') + ' AS `' + field + '`' for field in fields)
        branches.append('MATCH (r:' + label + ') RETURN ' + columns + ' ORDER BY r.observed_at DESC, r.record_id LIMIT 101')
    rows = reader.execute(' UNION ALL '.join(branches), limit=101 * len(labels))['rows']
    rows.sort(key=lambda row: (-row['observed_at'], row['source'], row['record_id']))
    records=[]
    for row in rows[:100]:
        native=fields_for(label_for('mari.records.'+row['source']+'.'+row['kind']))
        records.append(reader.hydrate({key:value for key,value in row.items() if key in native}))
    response = {'records': records, 'truncated': len(rows) > 100}
    if page_id == 'library':
        stages=[];counts=[]
        for index,label in enumerate(CONTENT):
            variable='n'+str(index);count='c'+str(index)
            stages.append('OPTIONAL MATCH ('+variable+':'+label+') WITH '+', '.join([*counts,'count('+variable+') AS '+count]))
            counts.append(count)
        query=' '.join(stages)+' RETURN '+' + '.join(counts)+' AS documents'
        response['metrics']={'documents':reader.execute(query)['rows'][0]['documents']}
    return response
