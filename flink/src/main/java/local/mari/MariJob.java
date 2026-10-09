package local.mari;

import java.nio.file.Path;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.iceberg.flink.sink.dynamic.DynamicIcebergSink;

public final class MariJob {
  public static void main(String[] args) throws Exception {
    var config=IngestionConfig.load(Path.of(System.getenv().getOrDefault("MARI_INGESTION_CONFIG","/opt/flink/conf/ingestion.yaml")));
    SchemaApply.required("SCHEMA_REGISTRY_URL");
    boolean postgres="postgres".equals(System.getenv("MARI_STORAGE"));
    var loader=postgres?null:SchemaApply.loader();
    if(!postgres) {
    var catalog=loader.loadCatalog();
    try {
      var namespaces=(org.apache.iceberg.catalog.SupportsNamespaces)catalog;
      try {namespaces.createNamespace(org.apache.iceberg.catalog.Namespace.of(config.namespace));}
      catch(org.apache.iceberg.exceptions.AlreadyExistsException ignored){}
    } finally {if(catalog instanceof AutoCloseable close)close.close();}
    }
    var env=StreamExecutionEnvironment.getExecutionEnvironment();env.setParallelism(1);
    // Checkpoint cadence is owned by the deployment configuration.
    env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);
    var source=KafkaSource.<KafkaEvent>builder().setBootstrapServers(SchemaApply.required("KAFKA_BOOTSTRAP_SERVERS"))
      .setTopics(config.topics).setProperty("allow.auto.create.topics","false").setGroupId("mari-typed-v2").setStartingOffsets(OffsetsInitializer.offsets(config.startOffsets(),org.apache.flink.kafka.shaded.org.apache.kafka.clients.consumer.OffsetResetStrategy.NONE))
      .setDeserializer(new KafkaEvent.Deserializer()).build();
    var input=env.fromSource(source,WatermarkStrategy.noWatermarks(),"Kafka typed records").uid("mari-typed-source-v2");
    if(postgres)input.addSink(new PostgresSink(config)).name("Postgres typed records").uid("mari-postgres-v1");
    else DynamicIcebergSink.forInput(input).generator(new MariGenerator(config)).catalogLoader(loader)
      .tableCreator((c,id,schema,spec)->c.createTable(id,schema,spec,java.util.Map.of("format-version","2","write.upsert.enabled","true")))
      .writeParallelism(1).uidPrefix("mari-typed-sink-v2").immediateTableUpdate(true).dropUnusedColumns(false).append();
    env.execute("Mari topic-to-table typed ingestion");
  }
}
