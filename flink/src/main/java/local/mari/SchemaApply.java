package local.mari;

import java.nio.file.Path;
import java.util.*;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.*;
import org.apache.iceberg.exceptions.*;
import org.apache.iceberg.flink.CatalogLoader;

/** Default is a read-only plan. Apply only creates missing namespaces/tables. */
public final class SchemaApply {
  public static String required(String key) {String v=System.getenv(key);if(v==null||v.isBlank())throw new IllegalArgumentException("Missing "+key);return v;}
  public static CatalogLoader loader() {
    String uri=required("POLARIS_URI");
    return CatalogLoader.custom("mari",Map.of("uri",uri,"warehouse",System.getenv().getOrDefault("POLARIS_WAREHOUSE","lake"),"credential",required("POLARIS_CREDENTIAL"),"scope","PRINCIPAL_ROLE:ALL","oauth2-server-uri",uri+"/v1/oauth/tokens","io-impl","org.apache.iceberg.aws.s3.S3FileIO","client.region",required("AWS_REGION")),new org.apache.hadoop.conf.Configuration(),"local.mari.MariCatalog");
  }
  public static void validate(Table table,IngestionConfig c,String mode) {
    if(!table.schema().sameSchema(c.schema(mode)))throw new IllegalStateException("Incompatible schema or primary key: "+table.name());
    if(!table.spec().compatibleWith(c.spec(mode)))throw new IllegalStateException("Incompatible partition keys: "+table.name());
    if(!table.properties().getOrDefault("format-version","2").equals("2"))throw new IllegalStateException("Expected Iceberg format v2: "+table.name());
    if(table instanceof BaseTable base && base.operations().current().formatVersion()!=2)throw new IllegalStateException("Expected Iceberg format v2: "+table.name());
  }
  public static void reconcile(Catalog catalog,IngestionConfig c,boolean apply,boolean requireExisting) {
    // Check EVERY existing table before any write, so a late mismatch cannot cause a partial schema rollout.
    for(String mode:List.of("current","history"))for(String topic:c.topics) {
      var id=TableIdentifier.of(c.targets.get(mode).namespace(),topic);
      if(catalog.tableExists(id))validate(catalog.loadTable(id),c,mode);
      else if(requireExisting)throw new IllegalStateException("Missing table; run explicit schema apply first: "+id);
    }
    for(String mode:List.of("current","history")) {
      var ns=Namespace.of(c.targets.get(mode).namespace());
      if(apply) {try{((SupportsNamespaces)catalog).createNamespace(ns);}catch(AlreadyExistsException ignored){}}
      for(String topic:c.topics) {
        var id=TableIdentifier.of(ns,topic);
        if(!catalog.tableExists(id)) {
          System.out.println((apply?"CREATE ":"WOULD CREATE ")+id);
          if(apply) {
            try{catalog.createTable(id,c.schema(mode),c.spec(mode),Map.of("format-version","2","write.upsert.enabled","true"));}catch(AlreadyExistsException ignored){}
            validate(catalog.loadTable(id),c,mode);
          }
        } else System.out.println("VALID "+id);
      }
    }
  }
  public static void main(String[] args) throws Exception {
    if(args.length<1||args.length>2||args.length==2&&!Set.of("--apply","--validate","--render-topics").contains(args[1]))throw new IllegalArgumentException("Usage: SchemaApply ingestion.yaml [--apply|--validate|--render-topics]; default is read-only plan");
    var c=IngestionConfig.load(Path.of(args[0]));
    if(args.length==2&&args[1].equals("--validate")){System.out.println("Valid declaration: "+c.topics.size()+" topics, current and history");return;}
    if(args.length==2&&args[1].equals("--render-topics")) {
      System.out.println("# Generated from flink/ingestion.yaml by schema.sh --render-topics; do not edit.");
      for(String topic:c.topics)System.out.println("---\napiVersion: kafka.strimzi.io/v1\nkind: KafkaTopic\nmetadata:\n  name: "+topic.replace('_','-')+"\n  namespace: stack\n  labels:\n    strimzi.io/cluster: kafka\nspec:\n  topicName: "+topic+"\n  partitions: 1\n  replicas: 1\n  config:\n    cleanup.policy: delete\n    retention.ms: -1");
      return;
    }
    var catalog=loader().loadCatalog();try{reconcile(catalog,c,args.length==2,false);}finally{if(catalog instanceof AutoCloseable close)close.close();}
  }
}
