# Mari Temporal jobs

Workflow definitions, activities, job-specific evidence reads, registration,
and worker packaging live here. There is no webhook server or separate Mari API
server. The former `platform/` folder has been removed.

- `workflows.py`: source ingestion and decision-mining workflows.
- `connectors.py`, `discovery.py`: polling activities and Slack discovery.
- `worker.py`, `bootstrap.py`: worker registration and explicit schedule setup.
- `evidence.py`: embedded OrchidDB evidence reads, using the same published
  Iceberg graph bindings as the apps. Shared normalized records and Kafka
  publication come from `apps/sdk/data`.
- `observability.py`, `ax_observability.py`: Temporal and AX projections.
- `ax_miner.py`, `decision_miner.py`: decision-mining execution. AX runner and
  Claude image recipes live in `infra/ax/`.
- `actor.py`, `Actor.Dockerfile`: retained Substrate evidence-miner helper.
- `maintenance/`: Iceberg compaction workflow, Spark job, and Polaris configuration.

## Build and run

Build the [shared application base](../apps/base/README.md) from the completed
OrchidDB release wheel first. From the parent workspace:

```sh
docker build -f mari/temporal/Dockerfile -t mari-temporal:local .
```

The worker image inherits that base and copies its OrchidDB runtime. It generates
AX Python protocol bindings and installs worker dependencies; it does not build
OrchidDB. Its entrypoint is `python -m temporal.worker`, with no HTTP listener.

For local execution, install `temporal/requirements.txt` and the
`vendor/mari-kit/packages/mari-core` and `mari-trajectories` packages. From `mari/`,
use `PYTHONPATH=.:../mari-kit/src` and `python -m temporal.worker`.
Supply environment variables through your launcher; `.env` is not automatically
executed or loaded. The former private platform environment file was preserved
as the ignored `temporal/.env` (or `.env.platform-backup` if one already existed).
Review it against `.env.example`; obsolete API/webhook settings are unused.

## Shared stack bindings

Use `.env.example` for endpoints and flags. Required services are Temporal,
Kafka, Polaris, Orchid catalog, S3, and AX when mining/observation is enabled.
The default task queue is `mari`, namespace `default`, and Polaris warehouse
`lake`. The worker image selects the published `decisions` graph; override
`ORCHID_GRAPH` if needed. Supply `ORCHID_CATALOG_CLIENT_SECRET`,
`ICEBERG_CREDENTIAL`, and AWS credentials through runtime secrets. No
`KNOWLEDGE_API_URL` or Mari service token is needed.

Evidence retrieval retains the supported `*` and `source_id:<JSON string>`
contract. General search still requires a published search mapping; it is not
silently replaced with different search semantics. Reads are project-scoped and
bounded, and errors fail the activity for Temporal retry.

Run the staged [Flink/schema/graph rollout](../flink/README.md) before enabling
jobs that read or write normalized records. No worker is deployed or started by
these build instructions. Workflow/activity names and IDs remain unchanged.

`temporal.bootstrap` is an explicit schedule-registration action.
`TEMPORAL_JOBS_ENABLED=false` prevents registration; existing running schedules
are not paused. Mining, AX observation, and compaction each require their own
enablement flag. Registration does not delete schedules, resume paused ones, or
change existing cadences.

Compaction requires an explicit `ICEBERG_MAINTENANCE_TABLES` allowlist. Names use
`namespace.table`, with the full dotted Kafka topic retained as the single table
component, e.g. `mari_streams.mari.records.mari.document`. Configure
`COMPACTION_IMAGE`, `MARI_JOB_NAMESPACE`, `COMPACTION_AWS_SECRET`, and
`COMPACTION_CATALOG_SECRET`; the worker needs narrow Kubernetes Job permissions.
An empty allowlist fails closed. Snapshot expiration and orphan deletion remain
separate operations.

Run `make check` from the workspace root for offline checks. Deployment,
registration, and live ingestion remain separate explicitly authorized actions.

Local maintenance runs hourly with overlap disabled. A bounded metadata preflight
selects only tables with at least eight small files, eight delete files, or sixteen
manifests. Healthy catalogs start no Spark Job. Selected tables are rechecked using
native Iceberg metadata; Spark is used only for Iceberg rewrite actions, with one
CPU, a 512 MiB JVM heap, two shuffle partitions, and a 1536 MiB pod memory limit.
Delete semantics are applied by readers regardless of maintenance cadence.
