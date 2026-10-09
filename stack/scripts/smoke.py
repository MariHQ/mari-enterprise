#!/usr/bin/env python3
"""End-to-end checks against the live local stack (creates named smoke data)."""
import asyncio,json,pathlib,socket,subprocess,time,urllib.request,uuid
import psycopg
from temporalio import workflow
from temporalio.client import Client
from temporalio.worker import Worker
ROOT=pathlib.Path(__file__).resolve().parents[1];K=['kubectl','--context','docker-desktop','-n','stack']
from temporal_workflow import StackSmoke
async def temporal():
 client=await Client.connect('127.0.0.1:17233')
 async with Worker(client,task_queue='stack-smoke',workflows=[StackSmoke]):
  result=await client.execute_workflow(StackSmoke.run,'ok',id='stack-smoke-'+uuid.uuid4().hex,task_queue='stack-smoke')
  assert result=='temporal:ok'
 print('PASS Temporal persisted workflow execution')
def forward(service,port,target):
 p=subprocess.Popen(K+['port-forward','svc/'+service,f'{port}:{target}'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for _ in range(60):
  try:
   with socket.create_connection(('127.0.0.1',port),timeout=.2):return p
  except OSError:time.sleep(.2)
 raise RuntimeError('Port forward failed: '+service)
def rows(topic,ns='cdc'):
 p=subprocess.run(K+['exec','deploy/flink','--','java','-cp','/tmp/stack-lake-verify.jar:/opt/flink/lib/*','local.stack.VerifyLake',ns,topic],text=True,capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr[-1500:]+p.stdout[-1500:])
 return json.loads(next(line[10:] for line in p.stdout.splitlines() if line.startswith('LAKE_ROWS=')))
def wait_rows(topic,predicate,ns='cdc'):
 last=None
 for _ in range(60):
  try:
   last=rows(topic,ns)
   if predicate(last):return last
  except Exception as e:last=str(e)
  time.sleep(3)
 raise AssertionError(f'Iceberg did not converge: {topic}: {last}')
def main():
 procs=[forward('postgres',15433,5432),forward('temporal',17233,7233)]
 try:
  secret=json.loads((ROOT/'.local/credentials.json').read_text())['postgres']['password']
  with psycopg.connect(host='127.0.0.1',port=15433,user='stack',password=secret,dbname='app',autocommit=True) as pg:
   pod=subprocess.check_output(K+['get','pods','-l','app=flink,component=jobmanager','-o','jsonpath={.items[0].metadata.name}'],text=True)
   subprocess.run(K+['cp',str(ROOT/'.local/stack-lake-verify.jar'),pod+':/tmp/stack-lake-verify.jar'],check=True,capture_output=True)
   pg.execute("INSERT INTO customers VALUES (900001,'Stack smoke','before@example.test'),(900002,'Delete me','delete@example.test') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email")
   wait_rows('cdc.public.customers',lambda rs:{r['id'] for r in rs}>={900001,900002});print('PASS PostgreSQL → Debezium → Kafka → typed Iceberg rows on S3')
   pg.execute("UPDATE customers SET email='after@example.test' WHERE id=900001; DELETE FROM customers WHERE id=900002")
   wait_rows('cdc.public.customers',lambda rs:any(r['id']==900001 and r['email']=='after@example.test' for r in rs) and not any(r['id']==900002 for r in rs));print('PASS CDC update and equality delete')
   pg.execute("CREATE TABLE IF NOT EXISTS smoke_dynamic (id BIGINT PRIMARY KEY, note TEXT); ALTER TABLE smoke_dynamic REPLICA IDENTITY FULL")
   pg.execute("INSERT INTO smoke_dynamic VALUES (1,'discovered') ON CONFLICT(id) DO UPDATE SET note=EXCLUDED.note")
   wait_rows('cdc.public.smoke_dynamic',lambda rs:any(r['id']==1 for r in rs));print('PASS new PostgreSQL table and Kafka topic discovered dynamically')
   pg.execute("ALTER TABLE smoke_dynamic ADD COLUMN IF NOT EXISTS extra TEXT; UPDATE smoke_dynamic SET extra='schema-evolved' WHERE id=1")
   wait_rows('cdc.public.smoke_dynamic',lambda rs:any(r.get('extra')=='schema-evolved' for r in rs));print('PASS additive schema evolution')
   payload=json.dumps({'event':'stack-smoke','id':uuid.uuid4().hex})
   subprocess.run(K+['exec','-i','kafka-local-0','--','/opt/kafka/bin/kafka-console-producer.sh','--bootstrap-server','kafka-kafka-bootstrap:9092','--topic','events.smoke'],input=payload+'\n',text=True,check=True,capture_output=True)
   wait_rows('events.smoke',lambda rs:any(r['value']==payload for r in rs),'events');print('PASS ordinary Kafka topic → separate Iceberg table')
  asyncio.run(temporal())
 finally:
  for p in procs:p.terminate()
if __name__=='__main__':main()
