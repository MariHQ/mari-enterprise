package local.mari;

import java.nio.file.Path;
import java.util.*;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.*;
import org.apache.iceberg.exceptions.*;
import org.apache.iceberg.flink.CatalogLoader;

/** Validate explicit routing/keys and render Kafka topics; column schemas come from writers. */
public final class SchemaApply {
  public static String required(String key) {String v=System.getenv(key);if(v==null||v.isBlank())throw new IllegalArgumentException("Missing "+key);return v;}
  public static CatalogLoader loader() {
    String uri=required("POLARIS_URI");
    return CatalogLoader.custom("mari",Map.of("uri",uri,"warehouse",System.getenv().getOrDefault("POLARIS_WAREHOUSE","lake"),"credential",required("POLARIS_CREDENTIAL"),"scope","PRINCIPAL_ROLE:ALL","oauth2-server-uri",uri+"/v1/oauth/tokens","io-impl","org.apache.iceberg.aws.s3.S3FileIO","client.region",required("AWS_REGION")),new org.apache.hadoop.conf.Configuration(),"local.mari.MariCatalog");
  }
  public static void main(String[] args) throws Exception {
    if(args.length<1||args.length>2||args.length==2&&!Set.of("--apply","--validate","--render-topics").contains(args[1]))throw new IllegalArgumentException("Usage: SchemaApply ingestion.yaml [--apply|--validate|--render-topics]; default is offline validation");
    var c=IngestionConfig.load(Path.of(args[0]));
    if(args.length==2&&args[1].equals("--validate")){System.out.println("Valid declaration: "+c.topics.size()+" topics, one table per topic");return;}
    if(args.length==2&&args[1].equals("--render-topics")) {
      System.out.println("# Generated from flink/ingestion.yaml by schema.sh --render-topics; do not edit.");
      for(String topic:c.topics)System.out.println("---\napiVersion: kafka.strimzi.io/v1\nkind: KafkaTopic\nmetadata:\n  name: "+topic.replace('_','-')+"\n  namespace: stack\n  labels:\n    strimzi.io/cluster: kafka\nspec:\n  topicName: "+topic+"\n  partitions: 1\n  replicas: 1\n  config:\n    cleanup.policy: delete\n    retention.ms: -1");
      return;
    }
    if(args.length==2&&args[1].equals("--apply")) {
      if("postgres".equals(System.getenv("MARI_STORAGE"))){PostgresSink.provision(c);return;}
      var registry=new WriterSchemas();var schemas=new LinkedHashMap<String,org.apache.iceberg.Schema>();
      var specs=new LinkedHashMap<String,PartitionSpec>();
      // Validate every registered writer schema before creating any table.
      for(String topic:c.topics) {
        var avro=new org.apache.iceberg.shaded.org.apache.avro.Schema.Parser().parse(registry.latestValue(topic));
        var schema=org.apache.iceberg.avro.AvroSchemaUtil.toIceberg(avro);var ids=new HashSet<Integer>();
        for(String key:c.keys.get(topic).primaryKey()) {
          var f=schema.findField(key);if(f==null||f.isOptional()||!f.type().isPrimitiveType())throw new IllegalArgumentException("Invalid required primary key: "+topic+"."+key);
          ids.add(f.fieldId());
        }
        schema=new org.apache.iceberg.Schema(schema.columns(),ids);schemas.put(topic,schema);
        var partition=PartitionSpec.builderFor(schema);for(String key:c.keys.get(topic).partitionKeys())partition.identity(key);specs.put(topic,partition.build());
      }
      var catalog=loader().loadCatalog();
      try {
        for(String topic:c.topics) {
          var id=TableIdentifier.of(c.namespace,topic);
          if(catalog.tableExists(id)) {
            var existing=catalog.loadTable(id);
            // Optional writer fields evolve additively; never migrate or rewrite rows.
            existing.updateSchema().unionByNameWith(schemas.get(topic)).commit();
            var expected=org.apache.iceberg.types.TypeUtil.reassignIds(schemas.get(topic),existing.schema());
            var expectedSpec=PartitionSpec.builderFor(expected);for(String key:c.keys.get(topic).partitionKeys())expectedSpec.identity(key);
            if(!existing.schema().sameSchema(expected)||!existing.spec().compatibleWith(expectedSpec.build()))throw new IllegalStateException("Explicit schema migration required: "+topic);
          }
        }
        try {((SupportsNamespaces)catalog).createNamespace(Namespace.of(c.namespace));}catch(AlreadyExistsException ignored){}
        for(String topic:c.topics) {
          var id=TableIdentifier.of(c.namespace,topic);
          if(!catalog.tableExists(id))catalog.createTable(id,schemas.get(topic),specs.get(topic),Map.of("format-version","2","write.upsert.enabled","true"));
          System.out.println("READY "+id);
        }
      } finally {if(catalog instanceof AutoCloseable close)close.close();}
    }
    // DynamicIcebergSink creates/evolves tables from registered writer schemas.
    System.out.println("Valid mapping: "+c.topics.size()+" topics; table schemas are supplied by writer schemas at ingestion");
  }
}
