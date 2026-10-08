package guru.mari;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import org.apache.flink.util.Collector;
import org.apache.flink.types.RowKind;
import org.apache.iceberg.flink.sink.dynamic.DynamicRecord;

class LakeGeneratorTest {
    static class Output implements Collector<DynamicRecord> {
        DynamicRecord record;
        public void collect(DynamicRecord record) { this.record = record; }
        public void close() {}
    }
    @Test void normalizedEvidenceRoutesToSourceTableAndReplaysByEventId() throws Exception {
        var out = new Output();
        new LakeGenerator().generate(new LakeEvent("evidence.github", "e1",
            "{\"event_id\":\"e1\",\"source\":\"github\",\"source_id\":\"github:a\",\"operation\":\"upsert\",\"observed_at\":1}", 42), out);
        assertTrue(out.record.upsertMode());
        assertEquals(java.util.Set.of("event_id"), out.record.equalityFields());
        assertEquals(42, out.record.rowData().getLong(8));
        assertEquals("mari_streams", out.record.tableIdentifier().namespace().toString());
        assertNotEquals(LakeGenerator.tableName("evidence.github"), LakeGenerator.tableName("evidence.slack"));
        assertNotEquals(LakeGenerator.tableName("a.b"), LakeGenerator.tableName("a_b"));
    }
    @Test void directCdcUpsertsAndDeletesCanonicalPrimaryKey() throws Exception {
        var out = new Output(); var generator = new LakeGenerator();
        generator.generate(new LakeEvent("postgres.public.documents", "{\"z\":2,\"a\":1}",
            "{\"op\":\"u\",\"after\":{\"text\":\"reviewed\"}}", 0), out);
        assertTrue(out.record.upsertMode());
        assertEquals("{\"a\":1,\"z\":2}", out.record.rowData().getString(0).toString());
        assertEquals(RowKind.INSERT, out.record.rowData().getRowKind());
        generator.generate(new LakeEvent("postgres.public.documents", "{\"a\":1,\"z\":2}", "{\"op\":\"d\"}", 0), out);
        assertEquals(RowKind.DELETE, out.record.rowData().getRowKind());
        assertTrue(out.record.rowData().isNullAt(1));
    }
    @Test void incompleteCdcRowsFailInsteadOfOverwritingGoodData() {
        assertThrows(IllegalArgumentException.class, () -> new LakeGenerator().generate(
            new LakeEvent("postgres.public.documents", "{\"id\":1}",
                "{\"op\":\"u\",\"after\":{\"text\":\"__debezium_unavailable_value\"}}", 0), new Output()));
    }
    @Test void knowledgeRetractionWritesHistoryAndDeletesCurrentByStableIdentity() throws Exception {
        var records = new java.util.ArrayList<DynamicRecord>();
        var collector = new Collector<DynamicRecord>() {
            public void collect(DynamicRecord record) { records.add(record); }
            public void close() {}
        };
        new LakeGenerator().generate(new LakeEvent("mari.records.mari.document", "[\"1\",\"record-a\"]",
            "{\"project_id\":\"1\",\"record_id\":\"record-a\",\"event_id\":\"retract-1\",\"operation\":\"delete\",\"observed_at\":2,\"properties\":{}}",100),collector);
        assertEquals(2,records.size());
        assertEquals("mari.records.mari.document",records.get(0).tableIdentifier().name());
        assertEquals("mari_history",records.get(0).tableIdentifier().namespace().toString());
        assertFalse(records.get(0).upsertMode());
        assertEquals(RowKind.INSERT,records.get(0).rowData().getRowKind());
        assertEquals("mari.records.mari.document",records.get(1).tableIdentifier().name());
        assertTrue(records.get(1).upsertMode());
        assertEquals(java.util.Set.of("project_id","record_id"),records.get(1).equalityFields());
        assertEquals(RowKind.DELETE,records.get(1).rowData().getRowKind());
        assertEquals("record-a",records.get(1).rowData().getString(1).toString());
    }

    @Test void operationalUpdatesAndRetractionsStayOutOfContentTables() throws Exception {
        for (String sourceKind : new String[]{"temporal:temporal_run", "temporal:edge", "agent:workflow", "agent:mining_receipt"}) {
            for (String operation : new String[]{"upsert", "delete"}) {
                String[] parts = sourceKind.split(":");
                var rows = knowledgeChange(parts[0], parts[1], operation);
                assertEquals("mari.records."+parts[0]+"."+parts[1], rows.get(0).tableIdentifier().name());
                assertFalse(rows.get(0).upsertMode());
                assertEquals(RowKind.INSERT, rows.get(0).rowData().getRowKind());
                assertEquals("mari.records."+parts[0]+"."+parts[1], rows.get(1).tableIdentifier().name());
                assertTrue(rows.get(1).upsertMode());
                assertEquals(java.util.Set.of("project_id", "record_id"), rows.get(1).equalityFields());
                assertEquals(operation.equals("delete") ? RowKind.DELETE : RowKind.INSERT, rows.get(1).rowData().getRowKind());
            }
        }
    }
    @Test void contentAndMigrationCleanupStillTargetKnowledgeTables() throws Exception {
        for (String sourceKind : new String[]{"slack:message", "github:issue", "agent:fact", "mari:edge", "migration:document"}) {
            String[] parts = sourceKind.split(":");
            for (String operation : new String[]{"upsert", "delete"}) {
                var rows = knowledgeChange(parts[0], parts[1], operation);
                assertEquals("mari.records."+parts[0]+"."+parts[1], rows.get(0).tableIdentifier().name());
                assertEquals("mari.records."+parts[0]+"."+parts[1], rows.get(1).tableIdentifier().name());
                assertEquals("project-one", rows.get(1).rowData().getString(0).toString());
            }
        }
    }
    static java.util.List<DynamicRecord> knowledgeChange(String source, String kind, String operation) throws Exception {
        var records = new java.util.ArrayList<DynamicRecord>();
        var collector = new Collector<DynamicRecord>() {
            public void collect(DynamicRecord record) { records.add(record); }
            public void close() {}
        };
        String event = "{\"project_id\":\"project-one\",\"record_id\":\"same-id\",\"event_id\":\"unique-event\",\"operation\":\""
            + operation + "\",\"source\":\"" + source + "\",\"kind\":\"" + kind + "\",\"observed_at\":1,\"properties\":{}}";
        new LakeGenerator().generate(new LakeEvent("mari.records."+source+"."+kind, "key", event, 100), collector);
        return records;
    }
}
