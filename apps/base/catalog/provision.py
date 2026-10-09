"""Flux job: publish existing normalized Iceberg tables and Mari's graph mappings."""
import os
import sys
from pathlib import Path
import hashlib
import httpx
from pyiceberg.catalog import load_catalog
import yaml
from apps.base.catalog.catalog_config import catalog_properties
from apps.base.ingestion.mappings import route_for

def ingestion_config():
    path = Path(os.getenv('MARI_INGESTION_CONFIG', str(Path(__file__).resolve().parents[3] / 'flink/ingestion.yaml')))
    with path.open() as stream:
        config = yaml.safe_load(stream)
    if config.get('version') != 2:
        raise ValueError('Unsupported ingestion configuration version')
    return config


def topics(): return list(ingestion_config()['topics'])
def table_name(topic): return topic
def definitions(physical):
    """Each entity maps to exactly one physical Iceberg dataset. No union datasets."""
    from apps.base.catalog.schema import columns,orchid_type
    postgres=os.getenv('MARI_STORAGE','iceberg')=='postgres'
    connector='postgres' if postgres else 'polaris'
    result={connector:{'kind':'connector','description':'Mari typed records','adapter':'postgres' if postgres else 'iceberg','protocol_version':1,'credential_ref':connector+'_read'}}
    for (namespace,topic),table in physical.items():
        source,kind=route_for(topic)
        from .nodes import label_for
        label=label_for(topic)
        dataset='dataset_'+source+'_'+kind
        entity='node_'+source+'_'+kind
        cols=[{'name':n,'data_type':orchid_type(t),**({} if postgres else {'field_id':table.schema().find_field(n).field_id})} for n,t in columns(topic).items()]
        result[dataset]={'kind':'dataset','description':topic,'table':dataset,'columns':cols,'connector':connector}
        if not postgres:result[dataset]['iceberg']={'catalog':'lake','namespace':[namespace],'table':topic,'table_uuid':str(table.metadata.table_uuid),'schema_id':table.metadata.current_schema_id}
        result[entity]={'kind':'entity','description':label,'dataset':dataset,'mapping':{'label':label,'table':dataset,'id':['project_id','record_id'],'properties':{c['name']:c['name'] for c in cols}}}
    from .relationships import definitions as relationship_definitions
    result.update(relationship_definitions(result))
    return result


def register(app,labels):
    """Publish only the concrete tables explicitly declared by this application."""
    from .nodes import label_for
    config=ingestion_config()
    if not isinstance(labels,(list,tuple)) or not labels:
        raise ValueError('An app must explicitly declare its node types')
    by_label={label_for(topic):topic for topic in config['topics']}
    unknown=set(labels)-set(by_label)
    if unknown:raise ValueError('Unknown app node types: '+', '.join(sorted(unknown)))
    declared=list(dict.fromkeys(by_label[label] for label in labels))
    if os.getenv('MARI_STORAGE','iceberg')=='postgres':
        physical={(config['namespace'],topic):None for topic in declared}
    else:
        catalog=load_catalog('mari',**catalog_properties())
        physical={(config['namespace'],topic):catalog.load_table((config['namespace'],topic)) for topic in declared}
    base=os.getenv('ORCHID_CATALOG_URL','http://orchid-catalog.stack.svc:8182').rstrip('/')+'/v1/'+os.getenv('ORCHID_SCOPE','mari')
    with httpx.Client(timeout=30) as client:
        response=client.post(base+'/oauth/tokens',data={'grant_type':'client_credentials','client_id':os.getenv('ORCHID_CATALOG_CLIENT_ID','admin'),'client_secret':os.environ['ORCHID_CATALOG_CLIENT_SECRET'],'scope':'PRINCIPAL_ROLE:ALL'})
        response.raise_for_status();client.headers['Authorization']='Bearer '+response.json()['access_token']
        def upsert(path,definition,read_path=None):
            old=client.get(base+'/'+(read_path or path))
            if old.status_code!=404:old.raise_for_status()
            previous={} if old.status_code==404 else old.json()
            if previous.get('definition')==definition:return previous['version'],False
            result=client.put(base+'/'+path,json={'expected_version':previous.get('version',0),'definition':definition});
            if result.status_code==409:
                current=client.get(base+'/'+(read_path or path));current.raise_for_status()
                if current.json().get('definition')==definition:return current.json()['version'],False
            if result.is_error:raise ValueError('Catalog rejected '+path+': '+result.text)
            return result.json()['version'],True
        objects=definitions(physical);versions={};changed=False
        for name,definition in objects.items():
            versions[name],update=upsert('objects/'+name,definition);changed|=update
        graph=app.replace('-','_')
        roots=[n for n,d in objects.items() if d['kind'] in ('entity','relationship','computed_relationship')]
        version,update=upsert('graphs/'+graph,{'description':'Mari '+app+' application graph','objects':roots},'graphs/'+graph+'/draft');changed|=update
        old=client.get(base+'/graphs/'+graph+'/resolve')
        if old.status_code!=404:old.raise_for_status()
        stale=old.status_code==200 and any(old.json()['manifest']['objects'].get(n,{}).get('version')!=v for n,v in versions.items())
        if changed or stale or old.status_code==404:
            revision=0 if old.status_code==404 else old.json()['manifest']['revision']
            response=client.post(base+'/graphs/'+graph+'/publish',json={'expected_revision':revision,'graph_version':version,'object_versions':versions});response.raise_for_status()
        print('Registered '+os.getenv('MARI_STORAGE','iceberg')+' datasets and typed graph mappings for '+app)

if __name__=='__main__': register(sys.argv[1],sys.argv[2:])
