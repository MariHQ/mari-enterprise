"""One-time reset: replay retained JSON as registered typed Avro rows.

The exclusive stop offsets are the Flink cutover offsets in ingestion.yaml.
Only this explicit migration understands the retired envelope format.
"""
import json,os
from pathlib import Path
import yaml
from confluent_kafka import Consumer,TopicPartition
from apps.base.ingestion.avro import publish_rows,registry

def replay(config, selected=None, dry_run=False):
    consumer=Consumer({'bootstrap.servers':os.environ['KAFKA_BOOTSTRAP_SERVERS'],'group.id':'mari-typed-reset-replay','enable.auto.commit':False})
    try:
        for topic,settings in config['topics'].items():
            if topic.startswith('mari.records.slack.'):continue
            if selected and topic not in selected:continue
            fields={f['name'] for f in json.loads(registry().get_latest_version(topic+'-value').schema.schema_str)['fields']}
            rows=[]
            for partition,stop in settings['start_offsets'].items():
                low,high=consumer.get_watermark_offsets(TopicPartition(topic,int(partition)),timeout=10)
                if stop>high:raise RuntimeError('Cutover offset exceeds Kafka log')
                consumer.assign([TopicPartition(topic,int(partition),low)])
                offset=low
                while offset<stop:
                    message=consumer.poll(10)
                    if message is None:raise TimeoutError('Kafka replay stalled')
                    if message.error():raise RuntimeError(message.error())
                    offset=message.offset()+1
                    if message.offset()>=stop:break
                    old=json.loads(message.value())
                    if old['table']!=topic:raise ValueError('Topic mismatch')
                    key={'project_id':old['project_id'],'record_id':old['record_id']}
                    value=None
                    if old['operation']!='delete':
                        value={k:v for k,v in old.items() if k not in {'version','table','operation','properties'}}
                        props=dict(old['properties'])
                        if topic.endswith('.temporal_run') and isinstance(props.get('phase'),str):props['phase']={'phase':props['phase']}
                        if topic.endswith('.temporal_observation') and 'observed_at' in props:props['projection_observed_at']=props.pop('observed_at')
                        if topic.endswith('.change') and 'table' in props:props['changed_table']=props.pop('table')
                        if topic.endswith('.step') and isinstance(props.get('args'),dict):props['args']={k:v if isinstance(v,str) else json.dumps(v) for k,v in props['args'].items()}
                        if any(value[k]!=props[k] for k in set(value)&set(props)):raise ValueError('Column collision: '+topic)
                        value.update(props)
                        if set(value)-fields:raise ValueError('Undeclared columns: '+str(set(value)-fields))
                    rows.append((topic,key,value))
            from apps.base.ingestion.avro import serialize_rows
            if dry_run:serialize_rows(rows)
            receipts=publish_rows(rows) if rows and not dry_run else []
            print(json.dumps({'topic':topic,'validated':len(rows),'replayed':len(receipts),'last_offset':max((r['offset'] for r in receipts),default=None)}),flush=True)
    finally:consumer.close()

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--dry-run',action='store_true');parser.add_argument('--topic',action='append');args=parser.parse_args()
    replay(yaml.safe_load(Path(os.environ.get('MARI_INGESTION_CONFIG','flink/ingestion.yaml')).read_text()),args.topic,args.dry_run)
