package local.mari;
import java.io.Serializable;
import java.nio.file.*;
import java.util.*;
import org.yaml.snakeyaml.*;
import org.yaml.snakeyaml.constructor.SafeConstructor;
/** Only routing and keys: column schemas belong to each topic's writer schema. */
public final class IngestionConfig implements Serializable {
  public record Keys(List<String> primaryKey,List<String> partitionKeys,Map<Integer,Long> startOffsets) implements Serializable {}
  public final String namespace;
  public final List<String> topics;
  public final Map<String,Keys> keys;
  private IngestionConfig(String namespace,Map<String,Keys> keys){this.namespace=namespace;this.keys=Map.copyOf(keys);this.topics=List.copyOf(keys.keySet());}
  public Map<org.apache.flink.kafka.shaded.org.apache.kafka.common.TopicPartition,Long> startOffsets(){
    var offsets=new LinkedHashMap<org.apache.flink.kafka.shaded.org.apache.kafka.common.TopicPartition,Long>();
    for(String topic:topics){
      var starts=keys.get(topic).startOffsets();if(starts.isEmpty())throw new IllegalArgumentException("Explicit reset offsets required for "+topic);
      starts.forEach((partition,offset)->offsets.put(new org.apache.flink.kafka.shaded.org.apache.kafka.common.TopicPartition(topic,partition),offset));
    }return offsets;
  }
  public static IngestionConfig load(Path path)throws Exception{if(Files.size(path)>262144)throw new IllegalArgumentException("Declaration too large");return parse(Files.readString(path));}
  static Map<?,?> map(Object value,Set<String> allowed){if(!(value instanceof Map<?,?> m)||!allowed.containsAll(m.keySet()))throw new IllegalArgumentException("Invalid declaration keys");return m;}
  static List<String> names(Object value,boolean empty){
    if(!(value instanceof List<?> list)||(!empty&&list.isEmpty())||list.stream().anyMatch(x->!(x instanceof String s)||!s.matches("[A-Za-z_][A-Za-z0-9_]*")))throw new IllegalArgumentException("Invalid key names");
    var result=list.stream().map(String.class::cast).toList();if(new HashSet<>(result).size()!=result.size())throw new IllegalArgumentException("Duplicate keys");return result;
  }
  public static IngestionConfig parse(String text){
    var o=new LoaderOptions();o.setAllowDuplicateKeys(false);o.setMaxAliasesForCollections(0);o.setCodePointLimit(262144);o.setNestingDepthLimit(8);
    var root=map(new Yaml(new SafeConstructor(o)).load(text),Set.of("version","namespace","topics"));
    if(!Integer.valueOf(2).equals(root.get("version")))throw new IllegalArgumentException("Expected declaration version 2");
    if(!(root.get("namespace") instanceof String ns)||!ns.matches("[a-z][a-z0-9_]{0,62}"))throw new IllegalArgumentException("Invalid namespace");
    if(!(root.get("topics") instanceof Map<?,?> topics)||topics.isEmpty()||topics.size()>512)throw new IllegalArgumentException("Expected topic mappings");
    Map<String,Keys> keys=new LinkedHashMap<>();
    for(var entry:topics.entrySet()){
      if(!(entry.getKey() instanceof String topic)||topic.length()>249||!topic.matches("[a-zA-Z0-9_][a-zA-Z0-9_.-]*"))throw new IllegalArgumentException("Invalid topic");
      var k=map(entry.getValue(),Set.of("primary_key","partition_keys","start_offsets"));var pk=names(k.get("primary_key"),false);var partition=names(k.get("partition_keys"),true);
      if(!pk.containsAll(partition))throw new IllegalArgumentException("Upsert partition keys must be primary keys");
      Map<Integer,Long> offsets=new LinkedHashMap<>();
      if(k.containsKey("start_offsets")) {
        if(!(k.get("start_offsets") instanceof Map<?,?> starts))throw new IllegalArgumentException("Invalid starting offsets");
        for(var e:starts.entrySet()) {
          if(!(e.getKey() instanceof Integer partitionId)||partitionId<0||!(e.getValue() instanceof Number offset)||offset.longValue()<0)throw new IllegalArgumentException("Invalid partition offset");
          offsets.put(partitionId,offset.longValue());
        }
      }
      keys.put(topic,new Keys(pk,partition,Map.copyOf(offsets)));
    }
    return new IngestionConfig(ns,keys);
  }
}
