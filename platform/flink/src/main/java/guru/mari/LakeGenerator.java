package guru.mari;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Set;
import org.apache.flink.table.data.GenericRowData;
import org.apache.flink.table.data.StringData;
import org.apache.flink.types.RowKind;
import org.apache.flink.util.Collector;
import org.apache.iceberg.*;
import org.apache.iceberg.catalog.TableIdentifier;
import org.apache.iceberg.flink.sink.dynamic.*;
import org.apache.iceberg.types.Types;

/** Adapted from context-graph's DynamicLakeJob/PostgresCdcGenerator pattern.
 * Routes each record to its table; no per-source SQL INSERT or fixed sink list.
 */
public final class LakeGenerator implements DynamicRecordGenerator<LakeEvent> {
    static final ObjectMapper JSON = new ObjectMapper();
    static final Schema EVIDENCE = new Schema(java.util.List.of(
        Types.NestedField.required(1, "event_id", Types.StringType.get()),
        Types.NestedField.required(2, "source", Types.StringType.get()),
        Types.NestedField.required(3, "source_id", Types.StringType.get()),
        Types.NestedField.optional(4, "title", Types.StringType.get()),
        Types.NestedField.optional(5, "text", Types.StringType.get()),
        Types.NestedField.optional(6, "url", Types.StringType.get()),
        Types.NestedField.required(7, "observed_at", Types.LongType.get()),
        Types.NestedField.required(8, "operation", Types.StringType.get()),
        Types.NestedField.required(9, "stream_offset", Types.LongType.get())), Set.of(1));
    static final Schema CDC = new Schema(java.util.List.of(
        Types.NestedField.required(1, "cdc_key", Types.StringType.get()),
        Types.NestedField.optional(2, "row_json", Types.StringType.get()),
        Types.NestedField.required(3, "source_table", Types.StringType.get())), Set.of(1));

    static final Schema KNOWLEDGE = new Schema(java.util.List.of(
        Types.NestedField.required(1, "project_id", Types.StringType.get()),
        Types.NestedField.required(2, "record_id", Types.StringType.get()),
        Types.NestedField.required(3, "event_id", Types.StringType.get()),
        Types.NestedField.required(4, "operation", Types.StringType.get()),
        Types.NestedField.optional(5, "kind", Types.StringType.get()),
        Types.NestedField.optional(6, "source", Types.StringType.get()),
        Types.NestedField.optional(7, "title", Types.StringType.get()),
        Types.NestedField.optional(8, "text", Types.StringType.get()),
        Types.NestedField.optional(9, "url", Types.StringType.get()),
        Types.NestedField.optional(10, "properties", Types.StringType.get()),
        Types.NestedField.optional(11, "actor", Types.StringType.get()),
        Types.NestedField.required(12, "observed_at", Types.LongType.get()),
        Types.NestedField.required(13, "stream_offset", Types.LongType.get())), Set.of(1, 2));

    private void knowledge(LakeEvent event, JsonNode value, Collector<DynamicRecord> out) {
        String operation = value.path("operation").asText();
        if (!Set.of("upsert", "delete").contains(operation)) throw new IllegalArgumentException("Invalid knowledge operation");
        for (String field : new String[]{"project_id", "record_id", "event_id"})
            if (value.path(field).asText().isBlank()) throw new IllegalArgumentException("Missing " + field);
        GenericRowData row = GenericRowData.of(text(value,"project_id"), text(value,"record_id"),
            text(value,"event_id"), text(value,"operation"), text(value,"kind"), text(value,"source"),
            text(value,"title"), text(value,"text"), text(value,"url"),
            StringData.fromString(value.path("properties").toString()), text(value,"actor"),
            value.path("observed_at").asLong(), event.offset);
        // Operational observations must not rewrite the content table on every poll.
        // Deletes carry the original source/kind so they reach the same physical table.
        // Deduplication happens in checkpointed keyed state, so history is append-only.
        DynamicRecord history = new DynamicRecord(TableIdentifier.of("mari_history", tableName(event.route)),
            "main", KNOWLEDGE, row, partition(event.route, KNOWLEDGE, "record_id"), DistributionMode.HASH, 1);
        history.setUpsertMode(false);
        out.collect(history);
        // A separate row is essential: mutating the history row would turn it into a delete.
        GenericRowData current = new GenericRowData(row.getArity());
        for (int i = 0; i < row.getArity(); i++) current.setField(i, row.getField(i));
        current.setRowKind(operation.equals("delete") ? RowKind.DELETE : RowKind.INSERT);
        DynamicRecord state = new DynamicRecord(TableIdentifier.of("mari_streams", tableName(event.route)),
            "main", KNOWLEDGE, current, partition(event.route, KNOWLEDGE, "record_id"), DistributionMode.HASH, 1);
        state.setUpsertMode(true);
        state.setEqualityFields(Set.of("project_id", "record_id"));
        out.collect(state);
    }

    public static String tableName(String route) {
        return route;
    }
    static PartitionSpec partition(String route, Schema schema, String key) {
        // Mutable records can only partition by stable equality-key transforms.
        // Time partitions on observation time would strand older row versions.
        try {
            JsonNode rules = JSON.readTree(System.getenv().getOrDefault("LAKE_PARTITION_RULES", "[]"));
            return partition(route, schema, key, rules);
        } catch (java.io.IOException e) { throw new IllegalArgumentException("Invalid partition rules", e); }
    }
    static PartitionSpec partition(String route, Schema schema, String key, JsonNode rules) {
        if (!rules.isArray()) throw new IllegalArgumentException("Partition rules must be an array");
        for (JsonNode rule : rules) {
            if (!route.matches(rule.path("pattern").asText())) continue;
            int buckets = rule.path("buckets").asInt(0);
            if (buckets < 0 || buckets > 1024) throw new IllegalArgumentException("Invalid bucket count");
            return buckets == 0 ? PartitionSpec.unpartitioned() : PartitionSpec.builderFor(schema).bucket(key, buckets).build();
        }
        return PartitionSpec.unpartitioned();
    }
    @Override public void generate(LakeEvent event, Collector<DynamicRecord> out) throws Exception {
        JsonNode value = JSON.readTree(event.value);
        if (event.route.startsWith("mari.records.")) { knowledge(event, value, out); return; }
        boolean evidence = event.route.startsWith("evidence.");
        GenericRowData row;
        if (evidence) {
            String operation = value.path("operation").asText();
            if (!Set.of("upsert", "delete").contains(operation)) throw new IllegalArgumentException("Invalid evidence operation");
            row = GenericRowData.of(text(value, "event_id"), text(value, "source"), text(value, "source_id"),
                text(value, "title"), text(value, "text"), text(value, "url"), value.path("observed_at").asLong(),
                text(value, "operation"), event.offset);
        } else {
            String operation = value.path("op").asText();
            if (!Set.of("r", "c", "u", "d").contains(operation)) throw new IllegalArgumentException("Unsupported CDC operation " + operation);
            if (event.key == null || JSON.readTree(event.key).isEmpty()) throw new IllegalArgumentException("CDC primary key required");
            JsonNode after = value.path("after");
            if (!operation.equals("d") && (!after.isObject() || containsUnavailable(after)))
                throw new IllegalArgumentException("Incomplete CDC row; require REPLICA IDENTITY FULL");
            row = GenericRowData.of(StringData.fromString(canonical(JSON.readTree(event.key)).toString()),
                operation.equals("d") ? null : StringData.fromString(after.toString()), StringData.fromString(event.route));
            row.setRowKind(operation.equals("d") ? RowKind.DELETE : RowKind.INSERT);
        }
        DynamicRecord record = new DynamicRecord(TableIdentifier.of("mari_streams", tableName(event.route)),
            "main", evidence ? EVIDENCE : CDC, row, partition(event.route, evidence ? EVIDENCE : CDC,
                evidence ? "event_id" : "cdc_key"), DistributionMode.HASH, 1);
        record.setUpsertMode(true);
        record.setEqualityFields(Set.of(evidence ? "event_id" : "cdc_key"));
        out.collect(record);
    }
    private static StringData text(JsonNode value, String field) { return StringData.fromString(value.path(field).asText()); }
    private static boolean containsUnavailable(JsonNode value) {
        if (value.isTextual() && value.asText().equals("__debezium_unavailable_value")) return true;
        for (JsonNode child : value) if (containsUnavailable(child)) return true;
        return false;
    }
    private static JsonNode canonical(JsonNode value) {
        if (!value.isObject()) return value;
        var result = JSON.createObjectNode();
        var names = new java.util.TreeSet<String>(); value.fieldNames().forEachRemaining(names::add);
        for (String name : names) result.set(name, canonical(value.get(name)));
        return result;
    }
}
