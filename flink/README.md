# Kafka topic to typed table

`MARI_STORAGE=iceberg` (default) uses the Iceberg sink below.
`MARI_STORAGE=postgres` selects `PostgresSink`: one typed table per topic in the
`mari` PostgreSQL schema, using the same primary keys and Avro records. Row
changes and per-partition offsets commit in one transaction, making replay
idempotent. Primitive arrays stay native PostgreSQL arrays; nested records use
JSONB. `SchemaApply` creates the selected backend's tables. The PostgreSQL route
is staged pending the separate OrchidDB relationship-query engine fix.

`local.mari.MariJob` uses Apache Iceberg's `DynamicIcebergSink`. Each declared Kafka topic writes to one Iceberg table with the **exact topic name** in the `mari` namespace. There are no implicit history tables, generic record columns, or JSON-string properties bags.

## Schema and keys

Producers register a distinct Avro value schema for each topic in Confluent Schema Registry and publish Confluent Avro wire-format messages. The value is the actual row: named typed columns, including native structs, arrays and maps where declared. Flink reads the writer schema identified in the message, uses Iceberg's `AvroSchemaUtil` and `AvroGenericRecordToRowDataMapper`, and emits one `DynamicRecord`. Iceberg handles table creation and schema evolution. Schemas are never inferred from samples or JSON payloads.

`ingestion.yaml` declares only the namespace, accepted topics, primary keys and identity partition keys. It does not impose a common column schema. The table name always equals the topic name. Partition keys must belong to the primary key for upserts.

Each Kafka key is an Avro record containing exactly the declared primary-key fields. Those fields must be required primitive columns in the value schema, and key/value identities must match. Non-null values are full replacements. A Kafka tombstone emits an equality delete into the same table, using the latest registered `<topic>-value` schema. There is no application operation envelope or duplicate event/history write.

Schema Registry uses standard `<topic>-key` and `<topic>-value` subjects and `BACKWARD_TRANSITIVE` compatibility. Key identity and partition fields must stay immutable; incompatible key changes require an explicit migration. Invalid input fails processing rather than silently discarding data.

## Local build

```sh
./build.sh
./schema.sh --validate
./schema.sh --render-topics > ../flux/topics/topics.yaml
docker build -t mari-ingestion:local .
```

Java 17 and Maven build locally; Docker copies the finished jar. OrchidDB is not compiled.

`SCHEMA_REGISTRY_URL` configures the registry; optional `SCHEMA_REGISTRY_BASIC_AUTH_USER_INFO` provides registry credentials. Polaris uses `POLARIS_URI`, `POLARIS_CREDENTIAL`, `POLARIS_WAREHOUSE` (default `lake`), and `AWS_REGION`. `schema.sh --apply` validates all registered writer schemas and existing table keys/partitions before creating missing typed tables. The dynamic sink handles subsequent writes and compatible schema evolution.

## Live reset status

The old 102 current/history tables were deleted on 2026-10-08. Typed Flink is deployed with an explicit per-partition cutover offset in `ingestion.yaml`, so old JSON records are not decoded as Avro. Retained Slack messages, collections and principals were explicitly converted and replayed through Kafka using `migrations/replay_normalized_slack.py`. The replay reads only offsets before that boundary and preserves primary keys.

All 51 topic schemas are checked in under `apps/base/schemas/`; `apps/base/catalog/register_schemas.py` publishes them with standard Schema Registry clients. The native Iceberg verification query is `tools/query_slack.py`. It reads the committed Iceberg snapshot, including delete semantics, through DuckDB's Iceberg extension.

All producer writes use registered Avro schemas. Subsequent Flink upgrades use savepoints; the initial destructive reset used explicit cutover offsets and a new state directory. `replay_normalized_records.py` converts the remaining retained pre-cutover rows.
