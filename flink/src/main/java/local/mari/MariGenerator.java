package local.mari;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.apache.flink.table.data.GenericRowData;
import org.apache.flink.table.data.StringData;
import org.apache.flink.types.RowKind;
import org.apache.flink.util.Collector;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.flink.sink.dynamic.*;

/** Full normalized replacements and explicit retractions, never raw Kafka/CDC envelopes. */
public final class MariGenerator implements DynamicRecordGenerator<KafkaEvent> {
  static final ObjectMapper JSON=new ObjectMapper();
  private final IngestionConfig config;
  public MariGenerator(IngestionConfig config){this.config=config;}
  static String required(JsonNode node,String name,int max) {
    JsonNode value=node.path(name);
    if(!value.isTextual()||value.textValue().isEmpty()||value.textValue().length()>max)throw new IllegalArgumentException("Invalid "+name);
    return value.textValue();
  }
  @Override public void generate(KafkaEvent e,Collector<DynamicRecord> out) throws Exception {
    if(!config.topics.contains(e.topic))throw new IllegalArgumentException("Undeclared topic: "+e.topic);
    if(e.value==null||e.value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>2200000)throw new IllegalArgumentException("Missing or oversized normalized record");
    JsonNode n=JSON.readTree(e.value);
    if(!n.isObject()||!n.path("version").isIntegralNumber()||n.path("version").intValue()!=1)throw new IllegalArgumentException("Expected normalized version 1");
    Set<String> allowed=new HashSet<>(List.of("version","table"));config.columns.forEach(c->allowed.add(c.name()));allowed.removeAll(List.of("kafka_partition","kafka_offset"));
    n.fieldNames().forEachRemaining(k->{if(!allowed.contains(k))throw new IllegalArgumentException("Unknown normalized field: "+k);});
    String project=required(n,"project_id",128),record=required(n,"record_id",512),event=required(n,"event_id",256),op=required(n,"operation",10),source=required(n,"source",64),kind=required(n,"kind",64);
    if(!Set.of("upsert","delete").contains(op))throw new IllegalArgumentException("Invalid operation");
    if(!e.topic.equals(required(n,"table",249))||!e.topic.equals("mari.records."+source+"."+kind))throw new IllegalArgumentException("Topic/source/kind mismatch");
    JsonNode key=e.key==null?null:JSON.readTree(e.key);
    if(key==null||!key.isArray()||key.size()!=2||!project.equals(key.get(0).textValue())||!record.equals(key.get(1).textValue()))throw new IllegalArgumentException("Kafka key must be [project_id,record_id] to preserve update order");
    if(!n.path("properties").isObject()||n.path("properties").toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>64000)throw new IllegalArgumentException("Invalid properties");
    if(op.equals("delete")&&(!n.path("text").asText("").isEmpty()||!n.path("properties").isEmpty()))throw new IllegalArgumentException("Delete must not retain record content");
    if(!n.path("observed_at").isIntegralNumber()||!n.path("observed_at").canConvertToLong()||n.path("observed_at").longValue()<0)throw new IllegalArgumentException("Invalid observed_at");
    Object[] values=new Object[config.columns.size()];
    for(int i=0;i<config.columns.size();i++) {
      String name=config.columns.get(i).name();
      values[i]=switch(name){
        case "kafka_partition"->e.partition;
        case "kafka_offset"->e.offset;
        case "observed_at"->n.get(name).longValue();
        case "properties"->StringData.fromString(n.get(name).toString());
        default->{JsonNode value=n.path(name);int max=switch(name){case "title"->2000;case "text"->500000;case "url"->4000;case "actor"->256;default->512;};if(!value.isTextual()||value.textValue().length()>max)throw new IllegalArgumentException("Invalid "+name);yield StringData.fromString(value.textValue());}
      };
    }
    for(String mode:List.of("current","history")) {
      var target=config.targets.get(mode);var row=GenericRowData.of(values.clone());
      row.setRowKind(mode.equals("current")&&op.equals("delete")?RowKind.DELETE:RowKind.INSERT);
      var r=new DynamicRecord(TableIdentifier.of(target.namespace(),e.topic),"main",config.schema(mode),row,config.spec(mode),DistributionMode.HASH,1);
      r.setUpsertMode(true);r.setEqualityFields(new HashSet<>(target.primaryKey()));out.collect(r);
    }
  }
}
