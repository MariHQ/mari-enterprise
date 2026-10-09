# Mari ingestion

This directory contains only Mari's normalized Kafka-to-Iceberg ingestion job,
`local.mari.MariJob`. It has no CDC/Debezium ingestion, raw event-envelope sink,
automatic topic discovery, JDBC catalog, or legacy stack verifier.

`ingestion.yaml` is the only declaration of accepted topics, column IDs/types, primary keys and identity partition keys. Producers send full `KnowledgeChange` JSON to `mari.records.<source>.<kind>`, keyed by the JSON array `[project_id, record_id]`. Unknown topics are not subscribed; missing Kafka topics fail the source instead of being silently invented. Invalid messages fail processing/checkpoint progress rather than being discarded. Add new topics to the declaration before enabling their producers.

Each declared topic creates two Iceberg tables. The table name is the exact Kafka topic, a single identifier component including its dots:

| Target | Namespace | Equality/primary key | Default identity partition |
| --- | --- | --- | --- |
| Current | `mari_streams` | `project_id, record_id` | `project_id` |
| History | `mari_history` | `project_id, record_id, event_id` | `project_id` |

Current rows upsert full replacements and apply explicit deletes. History retains both upserts and delete envelopes, deduplicating the same event identity. History event IDs must identify immutable events. No ordering is inferred from timestamps: Kafka record key and partition order determine updates. Keep topic partition counts fixed while records exist; repartitioning can split an identity's order across partitions. Sink/source parallelism is deliberately one. Current/history commits are independent Iceberg snapshots and may be visible at different instants.

The 14 columns are declared with stable IDs: `project_id`, `record_id`, `event_id`, `operation`, `kind`, `source`, `title`, `text`, `url`, `properties` (JSON string), `actor`, `observed_at` (epoch seconds), `kafka_partition`, `kafka_offset`. Partition keys must be immutable identity fields included in the target primary key; the normalized v1 primary keys are validated, not inferred. No arbitrary type coercion, inferred schema evolution, or automatic table discovery is used.

## Build and inspect locally

```bash
cd ~/mari-root/mari/flink
./build.sh
./schema.sh --validate
./schema.sh --render-topics > ../flux/topics/topics.yaml
```

Java 17 and Maven build/test the job locally. The Dockerfile only copies the resulting jar and declaration into the runtime image. The Java dependency classpath is saved under `target/` for local schema commands.

## Safe schema application

Set `POLARIS_URI`, `POLARIS_CREDENTIAL`, and `AWS_REGION` in the environment; `POLARIS_WAREHOUSE` defaults to `lake`. Use credentials intended for this catalog. `MARI_INGESTION_CONFIG` optionally selects the same declaration from another path.

```bash
./schema.sh          # Read-only remote plan; no changes
./schema.sh --apply  # Explicitly create missing namespaces/tables
```

Both commands inspect every existing declared table first and reject changes to field IDs/types/nullability/order, primary keys, partition spec, and non-v2 tables. Apply only creates missing namespaces and tables. It never updates, drops, recreates, truncates, or deletes existing tables/data. Existing schemas are not silently evolved. Races on table creation are reloaded and validated. A partial failure may leave newly created empty tables; retry is safe. There is no cross-table transaction; do not run concurrent schema administrators during rollout. Incompatible migrations need a separate reviewed migration plan.

The job also performs read-only validation and refuses to start until all tables exist and match. Schema application is an explicit step before starting the job or registering OrchidDB mappings. Graph registration reads the same declaration and references real Iceberg UUIDs; it does not own the physical schema.

## Staged rollout, not deployed

Build/tag the runtime image from this directory after `./build.sh`. The job entrypoint is `local.mari.MariJob` and jar path is `local:///opt/flink/usrlib/mari-ingestion.jar`. The image carries `/opt/flink/conf/ingestion.yaml`. Configure checkpoint storage and Flink HA/savepoints through the infrastructure deployment, using a fresh Mari checkpoint prefix and job identity. Use fresh state for this Mari topology.

Run schema application using `local.mari.SchemaApply /opt/flink/conf/ingestion.yaml --apply` from the same image and catalog credentials. Generate/review the KafkaTopic manifests from the YAML, apply tables, register OrchidDB nodes/edges, and start Mari ingestion only during an explicitly authorized rollout. The shared stack deployment is separate and unchanged.

The staged Flux entrypoint is `../flux/kustomization.yaml`. Its suspended dependency chain is topics → schema-apply Job → app/graph-registration Jobs → FlinkDeployment. Each stage waits for readiness before dependents proceed, and pruning is disabled so removing a topic declaration does not delete Kafka data. A `GitRepository` named `mari` in `flux-system` and deployable image references are prerequisites for a future explicitly authorized activation. No stage is referenced by the active stack.
