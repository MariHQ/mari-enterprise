"""Publish checked-in producer schemas through the standard Schema Registry client."""
import json,os
from pathlib import Path
import yaml
from confluent_kafka.schema_registry import SchemaRegistryClient,Schema

def register():
    config=yaml.safe_load(Path(os.getenv('MARI_INGESTION_CONFIG',str(Path(__file__).resolve().parents[3]/'flink/ingestion.yaml'))).read_text())
    registry=SchemaRegistryClient({'url':os.environ['SCHEMA_REGISTRY_URL']})
    for path in sorted(Path(os.getenv('MARI_SCHEMA_DIR',str(Path(__file__).resolve().parents[1]/'schemas'))).glob('*.avsc')):
        topic=path.stem
        if topic not in config['topics']:raise ValueError('Undeclared schema topic: '+topic)
        value=json.loads(path.read_text());fields={f['name']:f for f in value['fields']}
        pk=config['topics'][topic]['primary_key']
        if any(name not in fields for name in pk):raise ValueError('Missing primary key column')
        key={'type':'record','name':'SlackKey' if topic.startswith('mari.records.slack.') else value['name']+'Key','namespace':value.get('namespace','mari'),'fields':[fields[name] for name in pk]}
        for suffix,definition in [('key',key),('value',value)]:
            subject=topic+'-'+suffix
            registry.set_compatibility(subject_name=subject,level='FULL_TRANSITIVE' if suffix=='key' else 'BACKWARD_TRANSITIVE')
            schema_id=registry.register_schema(subject,Schema(json.dumps(definition),'AVRO'))
            print(subject,schema_id,flush=True)

if __name__=='__main__':register()
