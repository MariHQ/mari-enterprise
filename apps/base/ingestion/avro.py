"""Standard Schema Registry serialization of typed Kafka rows."""
import os
from functools import lru_cache
from confluent_kafka import Producer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.serialization import SerializationContext, MessageField

@lru_cache(maxsize=1)
def registry():
    return SchemaRegistryClient({'url':os.environ['SCHEMA_REGISTRY_URL']})

@lru_cache(maxsize=128)
def serializer(topic,field):
    schema=registry().get_latest_version(topic+'-'+field).schema
    return AvroSerializer(registry(),schema,conf={'auto.register.schemas':False})

def serialize_rows(rows):
    encoded=[]
    for topic,key,value in rows:
        key_bytes=serializer(topic,'key')(key,SerializationContext(topic,MessageField.KEY))
        value_bytes=None if value is None else serializer(topic,'value')(value,SerializationContext(topic,MessageField.VALUE))
        encoded.append((topic,key_bytes,value_bytes))
    return encoded

def publish_rows(rows):
    # Validate the complete command before any record is sent to Kafka.
    encoded=serialize_rows(rows)
    producer=Producer({'bootstrap.servers':os.environ['KAFKA_BOOTSTRAP_SERVERS'],'enable.idempotence':True,'acks':'all','delivery.timeout.ms':15000})
    errors=[];receipts=[]
    def delivered(error,message):
        if error:errors.append(str(error))
        else:receipts.append({'topic':message.topic(),'partition':message.partition(),'offset':message.offset()})
    for topic,key_bytes,value_bytes in encoded:
        producer.produce(topic,key=key_bytes,value=value_bytes,on_delivery=delivered)
        producer.poll(0)
    if producer.flush(20) or errors:raise RuntimeError('Kafka did not acknowledge typed rows: '+str(errors))
    return receipts
