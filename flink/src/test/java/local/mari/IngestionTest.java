package local.mari;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import org.apache.flink.util.Collector;
import org.apache.flink.types.RowKind;
import org.apache.iceberg.*;
import org.apache.iceberg.flink.sink.dynamic.DynamicRecord;
class IngestionTest {
 static String declaration() throws Exception{return Files.readString(Path.of("ingestion.yaml"));}
 static IngestionConfig config() throws Exception{return IngestionConfig.parse(declaration());}
 static KafkaEvent event(String op) throws Exception {
  Map<String,Object> row=new LinkedHashMap<>();row.put("version",1);row.put("table","mari.records.github.issue");row.put("project_id","1");row.put("record_id","issue:1");row.put("event_id","event:1");row.put("operation",op);row.put("kind","issue");row.put("source","github");row.put("title","");row.put("text",op.equals("delete")?"":"hello");row.put("url","");row.put("properties",Map.of());row.put("actor","github");row.put("observed_at",100);
  return new KafkaEvent("mari.records.github.issue","[\"1\",\"issue:1\"]",new ObjectMapper().writeValueAsString(row),0,5);
 }
 static List<DynamicRecord> generate(KafkaEvent e) throws Exception {
  List<DynamicRecord> out=new ArrayList<>();new MariGenerator(config()).generate(e,new Collector<>(){public void collect(DynamicRecord r){out.add(r);}public void close(){}});return out;
 }
 @Test void reusesSinkSchemasAcrossRecords() throws Exception {
  var generator=new MariGenerator(config());var out=new ArrayList<DynamicRecord>();
  Collector<DynamicRecord> collector=new Collector<>(){public void collect(DynamicRecord r){out.add(r);}public void close(){}};
  generator.generate(event("upsert"),collector);generator.generate(event("delete"),collector);
  assertSame(out.get(0).schema(),out.get(2).schema());
  assertSame(out.get(1).schema(),out.get(3).schema());
 }
 @Test void currentDeleteAndHistoryAreDistinct() throws Exception {
  var insert=generate(event("upsert"));assertEquals(2,insert.size());assertEquals(RowKind.INSERT,insert.get(0).rowData().getRowKind());
  var deleted=generate(event("delete"));assertEquals(RowKind.DELETE,deleted.get(0).rowData().getRowKind());assertEquals(RowKind.INSERT,deleted.get(1).rowData().getRowKind());
  assertEquals(Set.of("project_id","record_id"),deleted.get(0).equalityFields());assertEquals(Set.of("project_id","record_id","event_id"),deleted.get(1).equalityFields());assertEquals(5,deleted.get(1).rowData().getLong(13));
 }
 @Test void rejectsUnorderedOrUnroutableInput() throws Exception {
  var wrongKey=event("upsert");wrongKey.key="[\"other\",\"issue:1\"]";assertThrows(IllegalArgumentException.class,()->generate(wrongKey));
  var wrongTopic=event("upsert");wrongTopic.topic="mari.records.github.undeclared";assertThrows(IllegalArgumentException.class,()->generate(wrongTopic));
  var mismatch=event("upsert");mismatch.value=mismatch.value.replace("\"source\":\"github\"","\"source\":\"slack\"");assertThrows(IllegalArgumentException.class,()->generate(mismatch));
  var tombstone=event("delete");tombstone.value=null;assertThrows(IllegalArgumentException.class,()->generate(tombstone));
 }
 @Test void rejectsUnsafeDeclarations() throws Exception {
  String yaml=declaration();
  assertThrows(IllegalArgumentException.class,()->IngestionConfig.parse(yaml.replace("primary_key: [project_id, record_id]","primary_key: [record_id]")));
  assertThrows(IllegalArgumentException.class,()->IngestionConfig.parse(yaml.replace("partition_keys: [project_id]","partition_keys: [observed_at]")));
  assertThrows(Exception.class,()->IngestionConfig.parse(yaml+"version: 1\n"));
  assertThrows(Exception.class,()->IngestionConfig.parse("!!java.net.URL [http://example.com]"));
 }
 @Test void refusesExistingSchemaAndPartitionChanges() throws Exception {
  var c=config();var schema=c.schema("current");
  var metadata=TableMetadata.newTableMetadata(schema,c.spec("current"),"file:///unused",Map.of("format-version","2"));
  Table table=new BaseTable(new TableOperations(){public TableMetadata current(){return metadata;}public TableMetadata refresh(){return metadata;}public void commit(TableMetadata b,TableMetadata n){throw new AssertionError("must not mutate");}public org.apache.iceberg.io.FileIO io(){throw new UnsupportedOperationException();}public String metadataFileLocation(String f){return f;}public org.apache.iceberg.io.LocationProvider locationProvider(){throw new UnsupportedOperationException();}},"existing");
  SchemaApply.validate(table,c,"current");
  assertThrows(IllegalStateException.class,()->SchemaApply.validate(table,c,"history"));
  var changed=IngestionConfig.parse(declaration().replace("partition_keys: [project_id]","partition_keys: [project_id, record_id]"));
  assertThrows(IllegalStateException.class,()->SchemaApply.validate(table,changed,"current"));
 }
}
