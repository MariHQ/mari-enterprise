package local.mari;
import java.util.*;
import java.io.*;
import java.nio.ByteBuffer;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import org.apache.flink.util.Collector;
import org.apache.flink.types.RowKind;
import org.apache.iceberg.flink.sink.dynamic.DynamicRecord;
import org.apache.iceberg.shaded.org.apache.avro.Schema;
import org.apache.iceberg.shaded.org.apache.avro.generic.*;
import org.apache.iceberg.shaded.org.apache.avro.io.EncoderFactory;
class IngestionTest {
 static final String KEY="{\"type\":\"record\",\"name\":\"Key\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"}]}";
 static final String VALUE="{\"type\":\"record\",\"name\":\"Decision\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"},{\"name\":\"statement\",\"type\":\"string\"},{\"name\":\"confidence\",\"type\":\"double\"},{\"name\":\"approved\",\"type\":\"boolean\"},{\"name\":\"owners\",\"type\":{\"type\":\"array\",\"items\":\"string\"}}]}";
 static final String YAML="version: 2\nnamespace: mari\ntopics:\n  decisions:\n    primary_key: [id]\n    partition_keys: []\n  facts:\n    primary_key: [id]\n    partition_keys: []\n";
 static byte[] encode(int id,String schema,Object... values)throws Exception{
  var s=new Schema.Parser().parse(schema);var r=new GenericData.Record(s);for(int i=0;i<values.length;i++)r.put(i,values[i]);
  var b=new ByteArrayOutputStream();b.write(0);b.write(ByteBuffer.allocate(4).putInt(id).array());var encoder=EncoderFactory.get().binaryEncoder(b,null);new GenericDatumWriter<GenericRecord>(s).write(r,encoder);encoder.flush();return b.toByteArray();
 }
 static WriterSchemas registry(){return new WriterSchemas(){public String byId(int id){return id==1?KEY:VALUE;}public String latestValue(String topic){return VALUE;}};}
 static List<DynamicRecord> generate(KafkaEvent event)throws Exception {
  var out=new ArrayList<DynamicRecord>();new MariGenerator(IngestionConfig.parse(YAML),registry()).generate(event,new Collector<>(){public void collect(DynamicRecord r){out.add(r);}public void close(){}});return out;
 }
 static KafkaEvent event()throws Exception{return new KafkaEvent("decisions",encode(1,KEY,"d1"),encode(2,VALUE,"d1","Do it",0.75,true,List.of("alice")),0,10);}
 @Test void oneMessageOneTypedTableNoEnvelopeOrHistory()throws Exception{
  var output=generate(event());assertEquals(1,output.size());var r=output.get(0);
  assertEquals("decisions",r.tableIdentifier().name());assertEquals(5,r.schema().columns().size());
  assertNull(r.schema().findField("properties"));assertEquals("Do it",r.rowData().getString(1).toString());assertEquals(0.75,r.rowData().getDouble(2));assertTrue(r.rowData().getBoolean(3));assertEquals("alice",r.rowData().getArray(4).getString(0).toString());
  assertEquals(Set.of("id"),r.equalityFields());
 }
 @Test void tombstoneEmitsOnlyEqualityDeleteToSameTable()throws Exception{
  var e=event();e.value=null;var out=generate(e);assertEquals(1,out.size());assertEquals(RowKind.DELETE,out.get(0).rowData().getRowKind());assertEquals("d1",out.get(0).rowData().getString(0).toString());
 }
 @Test void rejectsLegacyJsonAndWrongKeys()throws Exception{
  var e=event();e.value="{\"properties\":{}}".getBytes();assertThrows(IllegalArgumentException.class,()->generate(e));
  var mismatch=event();mismatch.key=encode(1,KEY,"different");assertThrows(IllegalArgumentException.class,()->generate(mismatch));
  var unknown=event();unknown.topic="unknown";assertThrows(IllegalArgumentException.class,()->generate(unknown));
 }
 @Test void requiresExplicitSafeKeys(){
  assertThrows(IllegalArgumentException.class,()->IngestionConfig.parse(YAML.replace("partition_keys: []","partition_keys: [missing]")));
  assertThrows(Exception.class,()->IngestionConfig.parse(YAML+"version: 2\n"));
  assertThrows(Exception.class,()->IngestionConfig.parse("!!java.net.URL [http://example.com]"));
 }
}
