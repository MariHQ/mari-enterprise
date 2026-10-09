package local.mari;
import java.nio.ByteBuffer;
import java.util.*;
import org.apache.flink.table.data.GenericRowData;
import org.apache.flink.types.RowKind;
import org.apache.flink.util.Collector;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.avro.AvroSchemaUtil;
import org.apache.iceberg.flink.sink.AvroGenericRecordToRowDataMapper;
import org.apache.iceberg.flink.sink.dynamic.*;
import org.apache.iceberg.shaded.org.apache.avro.generic.*;
import org.apache.iceberg.shaded.org.apache.avro.io.DecoderFactory;
/** Exactly one typed row into exactly one topic-named table; no envelope or history fan-out. */
public final class MariGenerator implements DynamicRecordGenerator<KafkaEvent> {
  private final IngestionConfig config;
  private final WriterSchemas registry;
  private record CacheKey(String topic,org.apache.iceberg.shaded.org.apache.avro.Schema avro) {}
  private record Binding(Schema schema,PartitionSpec spec,AvroGenericRecordToRowDataMapper mapper) {}
  private transient Map<CacheKey,Binding> bindings;

  public MariGenerator(IngestionConfig config){this(config,new WriterSchemas());}
  MariGenerator(IngestionConfig config,WriterSchemas registry){this.config=config;this.registry=registry;}
  private GenericRecord decode(byte[] bytes)throws Exception{
    if(bytes==null||bytes.length<6||bytes[0]!=0)throw new IllegalArgumentException("Expected Confluent Avro wire format; raw JSON/envelopes are not supported");
    int id=ByteBuffer.wrap(bytes,1,4).getInt();
    var schema=new org.apache.iceberg.shaded.org.apache.avro.Schema.Parser().parse(registry.byId(id));
    var decoder=DecoderFactory.get().binaryDecoder(bytes,5,bytes.length-5,null);
    Object row=new GenericDatumReader<>(schema).read(null,decoder);
    if(!(row instanceof GenericRecord record))throw new IllegalArgumentException("Topic schema must be a record");
    if(!decoder.isEnd())throw new IllegalArgumentException("Trailing bytes after Avro record");
    return record;
  }
  @Override public void generate(KafkaEvent event,Collector<DynamicRecord> out)throws Exception{
    var keys=config.keys.get(event.topic);if(keys==null)throw new IllegalArgumentException("Undeclared topic: "+event.topic);
    GenericRecord key=decode(event.key);
    GenericRecord value=event.value==null?null:decode(event.value);
    var avro=value!=null?value.getSchema():new org.apache.iceberg.shaded.org.apache.avro.Schema.Parser().parse(registry.latestValue(event.topic));
    if(avro.getType()!=org.apache.iceberg.shaded.org.apache.avro.Schema.Type.RECORD)throw new IllegalArgumentException("Value must be an Avro record");
    var schema=AvroSchemaUtil.toIceberg(avro);
    Set<Integer> identifiers=new HashSet<>();
    if(!new HashSet<>(key.getSchema().getFields().stream().map(f->f.name()).toList()).equals(new HashSet<>(keys.primaryKey())))throw new IllegalArgumentException("Kafka key fields must equal declared primary keys");
    for(String name:keys.primaryKey()){
      var field=schema.findField(name);
      if(field==null||field.isOptional()||!field.type().isPrimitiveType())throw new IllegalArgumentException("Primary key must be a required primitive value field: "+name);
      Object k=key.get(name);if(k==null)throw new IllegalArgumentException("Null primary key: "+name);
      if(value!=null&&!Objects.equals(k,value.get(name)))throw new IllegalArgumentException("Kafka key/value mismatch: "+name);
      identifiers.add(field.fieldId());
    }
    if(bindings==null)bindings=new LinkedHashMap<>() {
      @Override protected boolean removeEldestEntry(Map.Entry<CacheKey,Binding> entry){return size()>128;}
    };
    var cacheKey=new CacheKey(event.topic,avro);var binding=bindings.get(cacheKey);
    if(binding==null) {
      schema=new Schema(schema.columns(),identifiers);
      var partitions=PartitionSpec.builderFor(schema);for(String p:keys.partitionKeys())partitions.identity(p);
      binding=new Binding(schema,partitions.build(),AvroGenericRecordToRowDataMapper.forAvroSchema(avro));bindings.put(cacheKey,binding);
    }
    if(value==null){value=new GenericData.Record(avro);for(String p:keys.primaryKey())value.put(p,key.get(p));}
    var row=binding.mapper().map(value);
    row.setRowKind(event.value==null?RowKind.DELETE:RowKind.INSERT);
    var record=new DynamicRecord(TableIdentifier.of(config.namespace,event.topic),"main",binding.schema(),row,binding.spec(),DistributionMode.HASH,1);
    record.setUpsertMode(true);record.setEqualityFields(new HashSet<>(keys.primaryKey()));out.collect(record);
  }
}
