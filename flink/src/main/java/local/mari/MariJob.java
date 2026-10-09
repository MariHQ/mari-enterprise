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
    var loader=SchemaApply.loader();var catalog=loader.loadCatalog();
    // Never start ingestion against missing or incompatible tables; apply is a separate deliberate action.
    try{SchemaApply.reconcile(catalog,config,false,true);}finally{if(catalog instanceof AutoCloseable c)c.close();}
    var env=StreamExecutionEnvironment.getExecutionEnvironment();env.setParallelism(1);
    env.enableCheckpointing(10000);env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);
    var source=KafkaSource.<KafkaEvent>builder().setBootstrapServers(SchemaApply.required("KAFKA_BOOTSTRAP_SERVERS"))
      .setTopics(config.topics).setProperty("allow.auto.create.topics","false").setGroupId("mari-normalized-v1").setStartingOffsets(OffsetsInitializer.earliest())
      .setDeserializer(new KafkaEvent.Deserializer()).build();
    var input=env.fromSource(source,WatermarkStrategy.noWatermarks(),"Mari normalized records").uid("mari-normalized-source-v1");
    DynamicIcebergSink.forInput(input).generator(new MariGenerator(config)).catalogLoader(loader)
      .writeParallelism(1).uidPrefix("mari-normalized-sink-v1").immediateTableUpdate(true).dropUnusedColumns(false).append();
    env.execute("Mari normalized records to current and history Iceberg");
  }
}
