package guru.mari;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Properties;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.api.common.typeinfo.TypeInformation;
import org.apache.flink.connector.base.DeliveryGuarantee;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.connector.kafka.source.reader.deserializer.KafkaRecordDeserializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.cdc.connectors.postgres.PostgreSQLSource;
import org.apache.flink.cdc.debezium.DebeziumDeserializationSchema;
import org.apache.flink.util.Collector;
import org.apache.iceberg.catalog.Namespace;
import org.apache.iceberg.catalog.SupportsNamespaces;
import org.apache.iceberg.exceptions.AlreadyExistsException;
import org.apache.iceberg.flink.CatalogLoader;
import org.apache.iceberg.flink.sink.dynamic.DynamicIcebergSink;
import org.apache.flink.kafka.shaded.org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.flink.cdc.connectors.shaded.org.apache.kafka.connect.source.SourceRecord;
import org.apache.flink.cdc.connectors.shaded.org.apache.kafka.connect.json.JsonConverter;

/** Independent Kafka evidence and embedded Debezium CDC sources, one dynamic Iceberg sink. */
public final class LakeJob {
    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("--verify")) { verify(); return; }
        if (args.length > 0) throw new IllegalArgumentException("Only --verify is supported");
        var env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setParallelism(1); // Checkpoint interval comes from the Flink deployment configuration.
        env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);
        var kafka = KafkaSource.<LakeEvent>builder().setBootstrapServers(env("KAFKA_BOOTSTRAP_SERVERS", "mari-kafka-kafka-bootstrap:9092"))
            .setTopicPattern(java.util.regex.Pattern.compile(env("LAKE_TOPIC_PATTERN", "mari\\.records\\..+")))
            .setProperty("partition.discovery.interval.ms", "30000").setGroupId("mari-topic-lake-v3")
            .setStartingOffsets(OffsetsInitializer.earliest()).setDeserializer(new KnowledgeDeserializer()).build();
        var records = env.fromSource(kafka, WatermarkStrategy.noWatermarks(), "knowledge-changes")
            .uid("knowledge-changes-v2").keyBy(event -> event.route + "\u0000" + event.key)
            .process(new DeduplicateChanges()).uid("knowledge-deduplication-v2");
        org.apache.flink.streaming.api.datastream.DataStream<LakeEvent> input = records;
        // Optional independent CDC source; Mari's own knowledge never stages in Postgres.
        if (System.getenv("CDC_HOST") != null) {
            Properties debezium = new Properties();
            debezium.setProperty("publication.name", env("CDC_PUBLICATION", "mari_lake"));
            debezium.setProperty("publication.autocreate.mode", "filtered");
            debezium.setProperty("tombstones.on.delete", "false");
            var postgres = PostgreSQLSource.<LakeEvent>builder().hostname(required("CDC_HOST"))
                .port(Integer.parseInt(env("CDC_PORT", "5432"))).database(required("CDC_DATABASE"))
                .schemaList(required("CDC_SCHEMAS").split(",")).tableList(required("CDC_TABLES").split(","))
                .username(required("CDC_USER")).password(required("CDC_PASSWORD")).decodingPluginName("pgoutput")
                .slotName(env("CDC_SLOT", "mari_lake")).debeziumProperties(debezium)
                .deserializer(new DirectCdcDeserializer()).build();
            input = input.union(env.addSource(postgres, "direct-debezium").uid("direct-debezium-v2"));
        }
        var loader = CatalogLoader.custom("mari", Map.of(
            "uri", "jdbc:postgresql://postgres:5432/iceberg", "jdbc.user", "mari", "jdbc.password", required("DB_PASSWORD"),
            "warehouse", "s3://" + required("S3_BUCKET") + "/warehouse/", "io-impl", "org.apache.iceberg.aws.s3.S3FileIO",
            "client.region", required("AWS_REGION"), "clients", "1"), new org.apache.hadoop.conf.Configuration(), "guru.mari.TopicJdbcCatalog");
        var catalog = loader.loadCatalog();
        try {
            for (String namespace : new String[]{"mari_streams", "mari_history"}) {
                try { ((SupportsNamespaces) catalog).createNamespace(Namespace.of(namespace)); }
                catch (AlreadyExistsException ignored) {}
            }
        } finally { if (catalog instanceof AutoCloseable closeable) closeable.close(); }
        DynamicIcebergSink.forInput(input).generator(new LakeGenerator()).catalogLoader(loader)
            .writeParallelism(1).uidPrefix("mari-dynamic-iceberg-v1").immediateTableUpdate(true).dropUnusedColumns(false).append();
        env.execute("mari-dynamic-lake");
    }
    private static void verify() throws Exception {
        var tables = org.apache.flink.table.api.TableEnvironment.create(org.apache.flink.table.api.EnvironmentSettings.inBatchMode());
        tables.executeSql("CREATE CATALOG lake WITH ('type'='iceberg','catalog-impl'='org.apache.iceberg.jdbc.JdbcCatalog',"
            + "'uri'='jdbc:postgresql://postgres:5432/iceberg','jdbc.user'='mari','jdbc.password'='" + required("DB_PASSWORD").replace("'", "''")
            + "','warehouse'='s3://" + required("S3_BUCKET") + "/warehouse/','io-impl'='org.apache.iceberg.aws.s3.S3FileIO',"
            + "'client.region'='" + required("AWS_REGION") + "')");
        try (var rows = tables.executeSql("SELECT record_id, kind, source FROM lake.mari.knowledge_records LIMIT 20").collect()) {
            while (rows.hasNext()) System.out.println("LAKE_RECORD " + rows.next());
        }
    }

    private static String env(String name, String fallback) { return System.getenv().getOrDefault(name, fallback); }
    public static final class KnowledgeDeserializer implements KafkaRecordDeserializationSchema<LakeEvent> {
        public void deserialize(ConsumerRecord<byte[], byte[]> record, Collector<LakeEvent> out) throws java.io.IOException {
            if (record.value() == null) throw new IllegalArgumentException("Use an explicit delete change, not a Kafka null tombstone");
            String value = new String(record.value(), StandardCharsets.UTF_8);
            var json = LakeGenerator.JSON.readTree(value);
            if (json.path("version").asInt() != 1) throw new IllegalArgumentException("Unsupported knowledge event version");
            String key = LakeGenerator.JSON.writeValueAsString(java.util.List.of(
                json.path("project_id").asText(), json.path("record_id").asText()));
            if (record.key() == null || !key.equals(new String(record.key(), StandardCharsets.UTF_8)))
                throw new IllegalArgumentException("Kafka key must match the record identity");
            if (!record.topic().equals(json.path("table").asText())) throw new IllegalArgumentException("Table must equal the Kafka topic");
            out.collect(new LakeEvent(record.topic(), key, value, record.offset()));
        }
        public TypeInformation<LakeEvent> getProducedType() { return TypeInformation.of(LakeEvent.class); }
    }
    public static final class DeduplicateChanges extends org.apache.flink.streaming.api.functions.KeyedProcessFunction<String,LakeEvent,LakeEvent> {
        private transient org.apache.flink.api.common.state.MapState<String,Boolean> seen;
        public void open(org.apache.flink.api.common.functions.OpenContext context) throws Exception {
            seen = getRuntimeContext().getMapState(new org.apache.flink.api.common.state.MapStateDescriptor<>("seen-events", String.class, Boolean.class));
        }
        public void processElement(LakeEvent event, Context context, Collector<LakeEvent> out) throws Exception {
            String id = LakeGenerator.JSON.readTree(event.value).path("event_id").asText();
            if (id.isBlank()) throw new IllegalArgumentException("Missing event ID");
            if (!seen.contains(id)) { out.collect(event); seen.put(id, true); }
        }
    }
    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalStateException("Missing " + name);
        return value;
    }
    public static final class EvidenceDeserializer implements KafkaRecordDeserializationSchema<LakeEvent> {
        public void deserialize(ConsumerRecord<byte[], byte[]> record, Collector<LakeEvent> out) throws java.io.IOException {
            if (record.value() == null) return;
            String value = new String(record.value(), StandardCharsets.UTF_8);
            var json = LakeGenerator.JSON.readTree(value);
            String source = json.path("source").asText();
            if (!java.util.Set.of("github", "slack").contains(source)) throw new IllegalArgumentException("Unsupported normalized source");
            out.collect(new LakeEvent("evidence." + source, json.path("event_id").asText(), value, record.offset()));
        }
        public TypeInformation<LakeEvent> getProducedType() { return TypeInformation.of(LakeEvent.class); }
    }
    public static final class DirectCdcDeserializer implements DebeziumDeserializationSchema<LakeEvent> {
        private transient JsonConverter converter;
        public void deserialize(SourceRecord record, Collector<LakeEvent> out) throws Exception {
            if (record.value() == null) return;
            if (converter == null) { converter = new JsonConverter(); converter.configure(Map.of("schemas.enable", false), false); }
            String value = new String(converter.fromConnectData(record.topic(), record.valueSchema(), record.value()), StandardCharsets.UTF_8);
            var json = LakeGenerator.JSON.readTree(value);
            if (!json.has("op")) return; // Debezium heartbeat/schema records are not application rows.
            String key = new String(converter.fromConnectData(record.topic(), record.keySchema(), record.key()), StandardCharsets.UTF_8);
            out.collect(new LakeEvent("postgres." + json.path("source").path("schema").asText() + "." + json.path("source").path("table").asText(), key, value, 0));
        }
        public TypeInformation<LakeEvent> getProducedType() { return TypeInformation.of(LakeEvent.class); }
    }
}
