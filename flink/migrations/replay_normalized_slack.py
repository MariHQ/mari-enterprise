"""One-time reset: replay retained Slack JSON as registered typed Avro rows.

The exclusive stop offsets are the Flink cutover offsets in ingestion.yaml.
Only this explicit migration understands the retired envelope format.
"""
import json,os
from pathlib import Path
import yaml
from confluent_kafka import Consumer,TopicPartition
from apps.base.ingestion.avro import publish_rows,registry

def replay(config):
    consumer=Consumer({'bootstrap.servers':os.environ['KAFKA_BOOTSTRAP_SERVERS'],'group.id':'mari-slack-reset-replay','enable.auto.commit':False})
    try:
        for topic,settings in config['topics'].items():
            if not topic.startswith('mari.records.slack.'):continue
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
                        if set(value)&set(old['properties']):raise ValueError('Column collision')
                        value.update(old['properties'])
                        if set(value)-fields:raise ValueError('Undeclared columns: '+str(set(value)-fields))
                    rows.append((topic,key,value))
            receipts=publish_rows(rows) if rows else []
            print(json.dumps({'topic':topic,'replayed':len(receipts),'last_offset':max((r['offset'] for r in receipts),default=None)}),flush=True)
    finally:consumer.close()

if __name__=='__main__':
    replay(yaml.safe_load(Path(os.environ.get('MARI_INGESTION_CONFIG','flink/ingestion.yaml')).read_text()))
