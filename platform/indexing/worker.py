"""Ordered Kafka → embeddings → Weaviate. No Temporal or Iceberg dependency."""
import json
import hashlib
import math
import os
from pathlib import Path
import uuid
import httpx
from confluent_kafka import Consumer
from knowledge.records import KnowledgeChange


def identity(*parts):return str(uuid.uuid5(uuid.NAMESPACE_URL,json.dumps(parts,separators=(',',':'))))


def chunks(change,policy):
    if change.operation=='delete':return []
    rule=policy.get('sources',{}).get(change.source)
    if not rule or change.kind not in rule.get('kinds',['document']):return []
    text=change.text.strip()
    if not text:return []
    size=rule.get('max_characters',8000)
    if not isinstance(size,int) or size<100:raise ValueError('Invalid embedding chunk size')
    mode=rule.get('chunking','none')
    if mode=='none':
        if len(text)>size:raise ValueError('Selected record exceeds the no-chunking policy; configure an explicit chunking rule')
        return [text]
    if mode!='paragraphs':raise ValueError('Unknown chunking policy')
    result=[];part=''
    for paragraph in text.split('\n\n'):
        if len(paragraph)>size:raise ValueError('Paragraph exceeds the configured limit; adjust the policy explicitly')
        if part and len(part)+len(paragraph)+2>size:result.append(part);part=''
        part=(part+'\n\n'+paragraph).strip()
    if part:result.append(part)
    return result


def profile():
    policy=Path(os.getenv('EMBEDDING_POLICY','/app/config/embedding-policy.json')).read_text()
    return hashlib.sha256((os.getenv('EMBEDDING_URL','')+os.getenv('EMBEDDING_MODEL','')+os.getenv('EMBEDDING_MODE','multi')+policy).encode()).hexdigest()[:12]


def collection_name():return 'MariKnowledge_'+profile()


def embed(texts,input_type='document'):
    if not texts:return []
    # Dense endpoints return vectors; multi-vector endpoints return token matrices.
    headers={}
    if os.getenv('EMBEDDING_API_KEY'):headers['Authorization']='Bearer '+os.environ['EMBEDDING_API_KEY']
    with httpx.Client(timeout=120) as client:
        response=client.post(os.environ['EMBEDDING_URL'],headers=headers,
            json={'model':os.environ['EMBEDDING_MODEL'],'input':texts,**({'encoding_format':'float'} if os.getenv('EMBEDDING_MODE','multi')=='dense' else {'input_type':input_type})})
        response.raise_for_status();data=response.json()['data']
        if any('index' in item for item in data):
            if sorted(item.get('index',-1) for item in data)!=list(range(len(texts))):
                raise ValueError('Embedding response indices do not match inputs')
            data=sorted(data,key=lambda item:item['index'])
        vectors=[item['embedding'] for item in data]
    if len(vectors)!=len(texts):raise ValueError('Embedding response count mismatch')
    dimension=None
    for matrix in vectors:
        if os.getenv('EMBEDDING_MODE','multi')=='dense':matrix=[matrix]
        if not isinstance(matrix,list) or not matrix:raise ValueError('Expected multi-vector embedding matrix')
        for vector in matrix:
            if not isinstance(vector,list) or not vector:raise ValueError('Embedding endpoint returned a single vector; token vectors are required')
            dimension=dimension or len(vector)
            if len(vector)!=dimension or any(not isinstance(v,(float,int)) or not math.isfinite(v) for v in vector):
                raise ValueError('Invalid embedding matrix')
    return vectors


class Indexer:
    def __init__(self,client,policy,embedding=embed):
        self.client=client;self.policy=policy;self.embedding=embedding
        self.records=client.collections.get(collection_name())
        self.receipts=client.collections.get('MariIndexReceipts')

    def apply(self,change):
        from weaviate.classes.query import Filter
        receipt=identity(collection_name(),change.project_id,change.record_id,change.event_id)
        if self.receipts.data.exists(receipt):return
        texts=chunks(change,self.policy)
        vectors=self.embedding(texts)  # Prepare before removing the previous revision.
        parent=identity(change.project_id,change.record_id)
        # Always remove all old chunks, including after policy changes and deletes.
        while True:
            result=self.records.data.delete_many(where=Filter.by_property('parent_id').equal(parent),verbose=True)
            if result.failed:raise RuntimeError('Weaviate did not acknowledge all deletes')
            if not result.matches:break
        if texts:
            with self.records.batch.stream() as batch:
                for index,(text,vector) in enumerate(zip(texts,vectors)):
                    batch.add_object(uuid=identity(parent,str(index)),properties={
                        'parent_id':parent,'record_id':change.record_id,'project_id':change.project_id,
                        'event_id':change.event_id,'text':text,'title':change.title,'source':change.source},
                        vector={'content':vector})
            if self.records.batch.failed_objects:raise RuntimeError('Weaviate rejected an embedding batch')
        # Persistent receipts suppress re-delivered older revisions after retraction.
        # Written only after all derived objects reached their desired state.
        self.receipts.data.insert(uuid=receipt,properties={'record_id':change.record_id,'event_id':change.event_id})


def connect():
    import weaviate
    return weaviate.connect_to_custom(http_host=os.getenv('WEAVIATE_HOST','weaviate'),http_port=8080,http_secure=False,
                                     grpc_host=os.getenv('WEAVIATE_HOST','weaviate'),grpc_port=50051,grpc_secure=False)


def setup(client):
    from weaviate.classes.config import Configure,Property,DataType,Tokenization
    name=collection_name()
    if not client.collections.exists(name):
        vector_config=Configure.Vectors.self_provided(name='content',vector_index_config=Configure.VectorIndex.hnsw()) if os.getenv('EMBEDDING_MODE','multi')=='dense' else Configure.MultiVectors.self_provided(name='content',encoding=Configure.VectorIndex.MultiVector.Encoding.muvera(),vector_index_config=Configure.VectorIndex.hnsw())
        client.collections.create(name,
            vector_config=[vector_config],
            properties=[Property(name=name,data_type=DataType.TEXT,tokenization=Tokenization.FIELD)
                for name in ['parent_id','record_id','project_id','event_id','source']]+
                [Property(name=name,data_type=DataType.TEXT) for name in ['text','title']])
    if not client.collections.exists('MariIndexReceipts'):
        client.collections.create('MariIndexReceipts',vector_config=Configure.Vectors.self_provided(),
            properties=[Property(name=name,data_type=DataType.TEXT) for name in ['record_id','event_id']])


def main():
    policy=json.loads(Path(os.environ.get('EMBEDDING_POLICY','/app/config/embedding-policy.json')).read_text())
    consumer=Consumer({'bootstrap.servers':os.getenv('KAFKA_BOOTSTRAP_SERVERS','mari-kafka-kafka-bootstrap:9092'),
        'group.id':'mari-weaviate-'+profile(),'enable.auto.commit':False,'enable.auto.offset.store':False,
        'auto.offset.reset':'earliest','max.poll.interval.ms':900000})
    with connect() as client:
        setup(client);indexer=Indexer(client,policy)
        consumer.subscribe(os.getenv('EMBEDDING_TOPICS','mari.knowledge').split(','))
        try:
            while True:
                message=consumer.poll(1)
                if message is None:continue
                if message.error():raise RuntimeError(str(message.error()))
                change=KnowledgeChange.model_validate_json(message.value())
                if message.key().decode()!=change.key:raise ValueError('Record key mismatch')
                indexer.apply(change)
                consumer.commit(message=message,asynchronous=False)
        finally:consumer.close()

if __name__=='__main__':main()
