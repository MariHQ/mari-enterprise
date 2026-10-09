package local.mari;

import java.io.Serializable;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.*;
import org.apache.iceberg.*;
import org.apache.iceberg.types.Types;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.constructor.SafeConstructor;

/** Deliberately small, strict declaration: no YAML object construction or inferred schemas. */
public final class IngestionConfig implements Serializable {
  public record Column(int id,String name,String type,boolean required) implements Serializable {}
  public record Target(String namespace,List<String> primaryKey,List<String> partitionKeys) implements Serializable {}
  public final List<String> topics;
  public final List<Column> columns;
  public final Map<String,Target> targets;
  private IngestionConfig(List<String> topics,List<Column> columns,Map<String,Target> targets) {
    this.topics=List.copyOf(topics);this.columns=List.copyOf(columns);this.targets=Map.copyOf(targets);
  }
  public static IngestionConfig load(Path path) throws Exception {
    if(Files.size(path)>262144)throw new IllegalArgumentException("Declaration exceeds 256 KiB");
    return parse(Files.readString(path));
  }
  static Map<?,?> map(Object value,Set<String> allowed) {
    if(!(value instanceof Map<?,?> m)||!allowed.containsAll(m.keySet()))throw new IllegalArgumentException("Invalid declaration keys: "+value);
    return m;
  }
  static List<String> strings(Object value) {
    if(!(value instanceof List<?> list)||list.isEmpty()||list.stream().anyMatch(x->!(x instanceof String)))throw new IllegalArgumentException("Expected nonempty string list");
    List<String> result=list.stream().map(String.class::cast).toList();
    if(new HashSet<>(result).size()!=result.size())throw new IllegalArgumentException("Duplicate names");return result;
  }
  public static IngestionConfig parse(String text) {
    LoaderOptions options=new LoaderOptions();options.setAllowDuplicateKeys(false);options.setMaxAliasesForCollections(0);options.setCodePointLimit(262144);options.setNestingDepthLimit(8);
    Map<?,?> root=map(new Yaml(new SafeConstructor(options)).load(text),Set.of("version","topics","schema","targets"));
    if(!Integer.valueOf(1).equals(root.get("version")))throw new IllegalArgumentException("Unsupported declaration version");
    List<String> topics=strings(root.get("topics"));
    if(topics.size()>512||topics.stream().anyMatch(t->t.length()>249||!t.matches("mari\\.records\\.[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*")))throw new IllegalArgumentException("Invalid or excessive topic inventory");
    if(!(root.get("schema") instanceof List<?> fields)||fields.size()!=14)throw new IllegalArgumentException("Expected normalized v1 schema with 14 columns");
    List<String> names=List.of("project_id","record_id","event_id","operation","kind","source","title","text","url","properties","actor","observed_at","kafka_partition","kafka_offset");
    List<Column> columns=new ArrayList<>();Set<Integer> ids=new HashSet<>();
    for(int i=0;i<fields.size();i++) {
      Map<?,?> f=map(fields.get(i),Set.of("id","name","type","required"));
      String name=names.get(i),type=i==11||i==13?"long":i==12?"int":"string";
      if(!(f.get("id") instanceof Integer id)||id<=0||!ids.add(id)||!name.equals(f.get("name"))||!type.equals(f.get("type"))||!(f.get("required") instanceof Boolean))throw new IllegalArgumentException("Invalid normalized column: "+f);
      boolean required=(Boolean)f.get("required");
      if((i<6||i>=11)&&!required)throw new IllegalArgumentException("Identity/offset columns must be required: "+name);
      columns.add(new Column(id,name,type,required));
    }
    Map<?,?> rawTargets=map(root.get("targets"),Set.of("current","history"));
    if(rawTargets.size()!=2)throw new IllegalArgumentException("Both current and history targets required");
    Map<String,Target> targets=new LinkedHashMap<>();
    for(String mode:List.of("current","history")) {
      Map<?,?> t=map(rawTargets.get(mode),Set.of("namespace","primary_key","partition_keys"));
      if(!(t.get("namespace") instanceof String namespace)||!namespace.matches("[a-z][a-z0-9_]{0,62}"))throw new IllegalArgumentException("Invalid namespace");
      List<String> pk=strings(t.get("primary_key")),partition=strings(t.get("partition_keys"));
      Set<String> expected=mode.equals("current")?Set.of("project_id","record_id"):Set.of("project_id","record_id","event_id");
      if(!new HashSet<>(pk).equals(expected))throw new IllegalArgumentException("Normalized v1 "+mode+" primary key must be "+expected);
      if(!pk.containsAll(partition)||!partition.contains("project_id"))throw new IllegalArgumentException("Identity partition keys must include project_id and belong to primary key");
      targets.put(mode,new Target(namespace,List.copyOf(pk),List.copyOf(partition)));
    }
    if(targets.get("current").namespace().equals(targets.get("history").namespace()))throw new IllegalArgumentException("Current and history require different namespaces");
    return new IngestionConfig(topics,columns,targets);
  }
  public Schema schema(String mode) {
    Set<Integer> ids=new HashSet<>();List<Types.NestedField> fields=new ArrayList<>();
    for(Column c:columns) {
      var type=switch(c.type()){case "long"->Types.LongType.get();case "int"->Types.IntegerType.get();default->Types.StringType.get();};
      fields.add(c.required()?Types.NestedField.required(c.id(),c.name(),type):Types.NestedField.optional(c.id(),c.name(),type));
      if(targets.get(mode).primaryKey().contains(c.name()))ids.add(c.id());
    }
    return new Schema(fields,ids);
  }
  public PartitionSpec spec(String mode) {
    var builder=PartitionSpec.builderFor(schema(mode));for(String key:targets.get(mode).partitionKeys())builder.identity(key);return builder.build();
  }
}
