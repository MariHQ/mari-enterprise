package local.mari;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;
import io.confluent.kafka.schemaregistry.client.CachedSchemaRegistryClient;
import io.confluent.kafka.schemaregistry.avro.AvroSchema;
import org.apache.flink.util.Collector;
import org.apache.iceberg.flink.sink.dynamic.DynamicRecord;
class RegistryIntegrationTest {
 @Test @EnabledIfEnvironmentVariable(named="SCHEMA_REGISTRY_TEST_URL",matches=".+")
 void registeredWriterSchemasProduceTypedRowsAndRejectIncompatibleEvolution()throws Exception{
  String url=System.getenv("SCHEMA_REGISTRY_TEST_URL"),topic="mari_validation_"+UUID.randomUUID().toString().replace("-","");
  var client=new CachedSchemaRegistryClient(url,16);
  try {
   int keyId=client.register(topic+"-key",new AvroSchema(IngestionTest.KEY));
   int valueId=client.register(topic+"-value",new AvroSchema(IngestionTest.VALUE));
   assertFalse(client.testCompatibility(topic+"-value",new AvroSchema(IngestionTest.VALUE.replace("\"double\"","\"string\""))));
   var config=IngestionConfig.parse(IngestionTest.YAML.replace("decisions",topic));
   var event=new KafkaEvent(topic,IngestionTest.encode(keyId,IngestionTest.KEY,"d1"),IngestionTest.encode(valueId,IngestionTest.VALUE,"d1","Registered row",0.9,true,List.of("alice")),0,1);
   var rows=new ArrayList<DynamicRecord>();
   var generator=new MariGenerator(config,new WriterSchemas(url));
   Collector<DynamicRecord> sink=new Collector<>(){public void collect(DynamicRecord r){rows.add(r);}public void close(){}};
   generator.generate(event,sink);assertEquals(1,rows.size());assertEquals(topic,rows.get(0).tableIdentifier().name());assertEquals("Registered row",rows.get(0).rowData().getString(1).toString());
   event.value=null;generator.generate(event,sink);assertEquals(org.apache.flink.types.RowKind.DELETE,rows.get(1).rowData().getRowKind());
  } finally {
   for(String subject:List.of(topic+"-key",topic+"-value")){
    try{client.deleteSubject(subject,false);client.deleteSubject(subject,true);}catch(io.confluent.kafka.schemaregistry.client.rest.exceptions.RestClientException e){if(e.getStatus()!=404)throw e;}
   }client.close();
  }
 }
}
