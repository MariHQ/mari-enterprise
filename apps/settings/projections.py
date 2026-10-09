"""Queries for the concrete records used by each settings section."""
from fastapi import APIRouter, Depends, HTTPException
from apps.base import db as reader
from apps.base.catalog.nodes import fields_for, label_for
from apps.base.commands import actor_identity
router=APIRouter()
NODES={'preferences': ['MariPreferences'], 'settings-general': ['MariProject','MariConfiguration'],
       'settings-members':['MariPrincipal','MariProject'], 'settings-models':['MariModelProvider','MariModel','MariConfiguration'],
       'settings-api-keys':['MariServicePrincipal'], 'settings-audit-log':['MariChange'], 'settings-design':['MariPresentation']}

@router.get('/api/pages/{page_id}')
@reader.graph_snapshot
def page(page_id:str,actor:str=Depends(actor_identity)):
    if page_id not in NODES:raise HTTPException(404,'Unknown page')
    labels=NODES[page_id]
    fields=list(dict.fromkeys(field for label in labels for field in fields_for(label)))
    branches=[];parameters={'actor':actor}
    for label in labels:
        where=''
        if label=='MariPreferences':where=' WHERE r.actor=$actor'
        elif label in ('MariProject','MariConfiguration','MariPresentation'):
            where=' WHERE r.record_id=$'+label
            parameters[label]={'MariProject':'project:workspace','MariConfiguration':'configuration:workspace','MariPresentation':'presentation:workspace'}[label]
        native=fields_for(label)
        projection=', '.join(('r.`'+field+'`' if field in native else 'null')+' AS `'+field+'`' for field in fields)
        branches.append('MATCH (r:'+label+')'+where+' RETURN '+projection+' ORDER BY observed_at DESC,record_id LIMIT 101')
    rows=reader.execute(' UNION ALL '.join(branches),parameters,limit=101*len(labels))['rows']
    rows.sort(key=lambda row:(-(row.get('observed_at') or 0),row['record_id']))
    records=[]
    for row in rows[:100]:
        native=fields_for(label_for('mari.records.'+row['source']+'.'+row['kind']))
        records.append(reader.hydrate({key:value for key,value in row.items() if key in native}))
    return {'records':records,'truncated':len(rows)>100}
