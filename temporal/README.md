# Mari Temporal jobs

Workflow definitions, activities, job-specific evidence reads, registration,
and worker packaging live here. There is no webhook server or separate Mari API
server. The former `platform/` folder has been removed.

- `workflows.py`: source ingestion and decision-mining workflows.
- `connectors.py`, `discovery.py`: polling activities and Slack discovery.
- `worker.py`, `bootstrap.py`: worker registration and explicit schedule setup.
- `evidence.py`: embedded OrchidDB evidence reads, using the same published
  Iceberg graph bindings as the apps. Shared normalized records and Kafka
  publication come from `apps/base/ingestion`.
- `observability.py`, `ax_observability.py`: Temporal and AX projections.
- `ax_miner.py`, `decision_miner.py`: decision-mining execution. AX runner and
  Claude image recipes live in `infra/ax/`.
- `actor.py`, `Actor.Dockerfile`: retained Substrate evidence-miner helper.
- `maintenance/`: Iceberg compaction workflow, Spark job, and Polaris configuration.

## Base ontology extraction

`ontology.py` registers `ExtractOntology`. It groups Slack threads and GitHub
issues/pull requests with their comments, then invokes AX/Substrate using the
canonical `vendor/mari-kit-runtime/src/mari_kit/ontology.py` recipe. Long contexts are processed
in overlapping windows rather than silently truncated. The model emits scoped
entities and atomic fact/decision candidates with exact source quotations.
Deterministic identities connect claims to immutable evidence revisions, source
records, extraction runs, and ingestion runs. Candidates remain pending review;
approval rechecks the current evidence. Source edits and deletions mark affected
claims stale.

The daily schedule skips overlapping runs and defaults to 20 contexts, $5 per
run, and $2 per context (`MINING_MAX_CONTEXTS`, `MINING_RUN_BUDGET_USD`,
`MINING_CONTEXT_BUDGET_USD`). These are Claude-reported model cost limits, not
subscription billing measurements. Completed calls are cached in the AX guest
workspace across activity retries; unfinished contexts remain unacknowledged
for a later run. Failed calls are not repeated within the same run.

Source polling and extraction emit `mari.records.agent.run` to Kafka, including
status, source/candidate counts, duration, model tokens, cached tokens, and
reported cost where applicable. Overview, Workflows, and Insights read these
records through independent UI queries. No Prometheus or OpenTelemetry collector
is required for these application statistics.

## Build and run

Build the [shared application base](../apps/base/README.md) from the completed
OrchidDB release wheel first. From the repository root:

```sh
docker build -f temporal/Dockerfile -t mari-temporal:local .
```

The worker image inherits that base and copies its OrchidDB runtime. It generates
AX Python protocol bindings and installs worker dependencies; it does not build
OrchidDB. Its entrypoint is `python -m temporal.worker`, with no HTTP listener.

For local execution, install `temporal/requirements.txt` and the
`vendor/mari-kit/packages/mari-core` and `mari-trajectories` packages. From `mari/`,
use `PYTHONPATH=.:vendor/mari-kit-runtime/src` and `python -m temporal.worker`.
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
component, e.g. `mari.mari.records.mari.document`. Configure
`COMPACTION_IMAGE`, `MARI_JOB_NAMESPACE`, `COMPACTION_AWS_SECRET`, and
`COMPACTION_CATALOG_SECRET`; the worker needs narrow Kubernetes Job permissions.
An empty allowlist fails closed. Snapshot expiration and orphan deletion remain
separate operations.

Run `make check` from the workspace root for offline checks. Deployment,
registration, and live ingestion remain separate explicitly authorized actions.

Local maintenance runs daily with overlap disabled. A bounded metadata preflight
selects only tables with at least eight small files, eight delete files, or sixteen
manifests. Healthy catalogs start no Spark Job. Selected tables are rechecked using
native Iceberg metadata; Spark is used only for Iceberg rewrite actions, with one
CPU, a 512 MiB JVM heap, two shuffle partitions, and a 1536 MiB pod memory limit.
Delete semantics are applied by readers regardless of maintenance cadence.

Source polling, Slack membership discovery, Temporal observation, and AX observation
use daily Temporal Schedules with overlap disabled. Each ScheduledPoll execution
finishes after one poll and persists its successful cursor in the Schedule action.
Existing legacy loop executions must be migrated with their latest completed cursor
before they are retired; bootstrap never resets existing schedule state.
