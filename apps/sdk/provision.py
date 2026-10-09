"""Flux job: publish existing normalized Iceberg tables and Mari's graph mappings."""
import os
import sys
from pathlib import Path
import hashlib
import httpx
from pyiceberg.catalog import load_catalog
import yaml
from apps.sdk.data.query import COLUMNS
from apps.sdk.graph import JSON_PROPERTIES, RECORD_PROPERTIES, property_type
from apps.sdk.data.relationships import REFERENCES
from apps.sdk.catalog_config import catalog_properties

def ingestion_config():
    path = Path(os.getenv('MARI_INGESTION_CONFIG', str(Path(__file__).resolve().parents[2] / 'flink/ingestion.yaml')))
    with path.open() as stream:
        config = yaml.safe_load(stream)
    if config.get('version') != 1:
        raise ValueError('Unsupported ingestion configuration version')
    return config


def topics(): return ingestion_config()['topics']
def table_name(topic): return topic
RELATIONS = sorted({'ingested','produced','authored','contains','polls','discussed','derived_from'} | {label for refs in REFERENCES.values() for _,label,_ in refs})
NODES = {'Fact':'facts','Decision':'decisions','Connector':'connector_configurations','Workflow':'workflow_definitions','Run':'workflow_runs','Schedule':'temporal_schedules','Review':'reviews','Collection':'collections','Trajectory':'agent_trajectories','Step':'agent_steps','Activity':'workflow_activities','Observation':'temporal_observations','MiningReceipt':'mining_receipts','History':'history'}
def columns(): return [{'name':name,'data_type':'int64' if typ=='BIGINT' else 'string'} for name,typ in COLUMNS] + [{'name':name,'data_type':property_type(name)} for name in RECORD_PROPERTIES if name not in dict(COLUMNS)]


def definitions(physical):
    result={
        'polaris':{'kind':'connector','description':'Mari event lake in Polaris','adapter':'iceberg','protocol_version':1,'credential_ref':'polaris_read'},
        'records':{'kind':'dataset','description':'Latest normalized record per project, topic and identity; maintained by Flink','table':'graph_records','columns':columns(),'source_metadata':{'format':'mari_normalized_v1','options':{'topics':topics()}}},
        'record':{'kind':'entity','description':'Mari knowledge and operational record','dataset':'records','mapping':{'label':'Record','table':'graph_records','id':'record_id','properties':{n:n for n in RECORD_PROPERTIES}}},
        'links':{'kind':'dataset','description':'Explicit and provenance-derived Mari relationships','table':'links','columns':[{'name':n,'data_type':'string'} for n in ('record_id','from_id','to_id','relation')]+[{'name':'observed_at','data_type':'int64'}]},
        'related':{'kind':'relationship','description':'Typed provenance, evidence, review, ownership and workflow relationship','dataset':'links','source':'record','target':'record','mapping':{'label':'RELATED','table':'links','id':'record_id','source':'from_id','target':'to_id','source_label':'Record','target_label':'Record','properties':{n:n for n in ('record_id','from_id','to_id','relation','observed_at')}}},
    }
    for label,view in NODES.items():
        name='node_'+label.lower()
        result[name+'_data']={'kind':'dataset','description':label+' records from the normalized event lake','table':view,'columns':columns()}
        result[name]={'kind':'entity','description':label,'dataset':name+'_data','mapping':{'label':label,'table':view,'id':'event_key' if label=='History' else 'record_id','properties':{n:n for n in RECORD_PROPERTIES}}}
    for relation in RELATIONS:
        name='edge_'+relation
        result[name+'_data']={'kind':'dataset','description':relation+' relationships','table':name,'columns':[{'name':n,'data_type':'string'} for n in ('record_id','from_id','to_id','relation')]+[{'name':'observed_at','data_type':'int64'}]}
        result[name]={'kind':'relationship','description':relation,'dataset':name+'_data','source':'record','target':'record','mapping':{'label':relation,'table':name,'id':'record_id','source':'from_id','target':'to_id','source_label':'Record','target_label':'Record','properties':{n:n for n in ('record_id','from_id','to_id','relation','observed_at')}}}
    config=ingestion_config()
    physical_columns=[{'name':field['name'],'data_type':{'string':'string','long':'int64','int':'int32'}[field['type']],'field_id':field['id']} for field in config['schema']]
    for (namespace,topic),table in physical.items():
        alias='physical_'+hashlib.sha256((namespace+'.'+topic).encode()).hexdigest()[:20]
        result[alias]={'kind':'dataset','description':'Normalized '+namespace+' records for '+topic,'table':alias,'columns':physical_columns,'connector':'polaris','iceberg':{'catalog':'lake','namespace':[namespace],'table':topic,'table_uuid':str(table.metadata.table_uuid),'schema_id':table.metadata.current_schema_id}}
    return result


def register(app):
    config=ingestion_config()
    catalog=load_catalog('mari',**catalog_properties())
    # SchemaApply validates and creates tables first. Registration never changes them.
    physical={(target['namespace'],topic):catalog.load_table((target['namespace'],topic))
              for target in config['targets'].values() for topic in config['topics']}
    base=os.getenv('ORCHID_CATALOG_URL','http://orchid-catalog.stack.svc:8182').rstrip('/')+'/v1/'+os.getenv('ORCHID_SCOPE','mari')
    with httpx.Client(timeout=30) as client:
        response=client.post(base+'/oauth/tokens',data={'grant_type':'client_credentials','client_id':os.getenv('ORCHID_CATALOG_CLIENT_ID','admin'),'client_secret':os.environ['ORCHID_CATALOG_CLIENT_SECRET'],'scope':'PRINCIPAL_ROLE:ALL'})
        response.raise_for_status();client.headers['Authorization']='Bearer '+response.json()['access_token']
        def upsert(path,definition,read_path=None):
            old=client.get(base+'/'+(read_path or path))
            if old.status_code!=404:old.raise_for_status()
            previous={} if old.status_code==404 else old.json()
            if previous.get('definition')==definition:return previous['version'],False
            result=client.put(base+'/'+path,json={'expected_version':previous.get('version',0),'definition':definition});result.raise_for_status()
            return result.json()['version'],True
        objects=definitions(physical);versions={};changed=False
        for name,definition in objects.items():
            versions[name],update=upsert('objects/'+name,definition);changed|=update
        graph=app.replace('-','_')
        roots=[n for n,d in objects.items() if d['kind'] in ('entity','relationship') or n.startswith('physical_')]
        version,update=upsert('graphs/'+graph,{'description':'Mari '+app+' application graph','objects':roots},'graphs/'+graph+'/draft');changed|=update
        old=client.get(base+'/graphs/'+graph+'/resolve')
        if old.status_code!=404:old.raise_for_status()
        stale=old.status_code==200 and any(old.json()['manifest']['objects'].get(n,{}).get('version')!=v for n,v in versions.items())
        if changed or stale or old.status_code==404:
            revision=0 if old.status_code==404 else old.json()['manifest']['revision']
            response=client.post(base+'/graphs/'+graph+'/publish',json={'expected_revision':revision,'graph_version':version,'object_versions':versions});response.raise_for_status()
        print('Registered Iceberg datasets and Record/RELATED mappings for '+app)

if __name__=='__main__': register(sys.argv[1])
