# Mari platform

Mari is the governance interface; its application server reads the read-only Knowledge API and publishes edits and retractions to Kafka. The Knowledge API uses OrchidDB with DuckDB or an externally configured StarRocks backend. Knowledge lives in Iceberg on S3.

## Configuration

Edit `config/platform.json` before building a release:

- `knowledge.backend`: `duckdb` or `starrocks`. StarRocks requires an existing Iceberg external catalog and a read-only account configured through `STARROCKS_HOST`, `STARROCKS_USER`, `STARROCKS_PASSWORD`, and optionally `STARROCKS_PORT` and `STARROCKS_ICEBERG_DATABASE` (default `lake.mari`). This deployment does not provision StarRocks.
- `quickwit.enabled`: read access to user-managed Kafka telemetry search.
- `vectors.enabled`: read access to user-managed Weaviate. Disabled by default.
- `vectors.endpoint`, `model`, `api_key_env`, and `topics`: hosted embedding configuration. `provider` describes the service; endpoints must implement the response contract below.
- `vectors.mode`: `dense` for a single vector per input, or `multi` for token vectors and MUVERA/HNSW. The example uses OpenAI `text-embedding-3-small` in dense mode. It does not provide native multi-vector embeddings.
- `flink.state`: `running` by default; change to `suspended` only for an intentional stop.
- `cdc.enabled`: direct Debezium source. Requires `CDC_HOST`, `CDC_DATABASE`, `CDC_SCHEMAS`, `CDC_TABLES`, `CDC_USER`, and `CDC_PASSWORD`; optional `CDC_PORT`, `CDC_SLOT`, and `CDC_PUBLICATION`. It does not route CDC through Kafka.
- `compaction`: enablement, daily scheduling (`every_hours: 24`), and an explicit table allowlist for Temporal-launched Iceberg compaction jobs.

`config/embedding-policy.json` selects sources and record kinds. Each rule chooses `none` or `paragraphs` chunking and a character limit. The example keeps Slack messages whole. Oversized messages or paragraphs fail explicitly; they are not silently truncated. Kafka topics selected for embedding must contain normalized `KnowledgeChange` events, keyed by project and record ID.

The embedding HTTP adapter sends `{model, input}` with `encoding_format: "float"` in dense mode, or `input_type` in multi mode. Responses use `data: [{index, embedding}]`: each embedding is a numeric vector in dense mode or a token-vector matrix in multi mode. An adapter is needed for providers with another API contract. Provider/model/mode/policy changes create a separate collection and consumer group for rebuilding from retained Kafka events. Retired collections require operator cleanup.

Credentials belong in the ignored `mari/platform/.env` file, mode 0600. Existing environment values take precedence. Deployment creates Kubernetes secrets separately from the Flux manifest artifact. Never put credentials in platform JSON or diagrams.

## Ingestion and changes

Signed GitHub/Slack webhook connectors and Temporal polling connectors are independent ingestion paths. Both publish normalized events to Kafka. Polling workflows carry checkpoints in Temporal, compare successful inventories, and emit updates and retractions. A failed or unauthorized inventory does not imply deletion. Slack polling can only read channels accessible to the configured bot.

Temporal also schedules background knowledge work and Iceberg compaction. Agent-generated changes publish to Kafka; the Knowledge API remains read-only.

Flink consumes Kafka and independently configured direct Debezium CDC. Dynamic Iceberg sinks append normalized history and upsert or retract current records. Kafka acknowledgment means accepted, not yet materialized. Mari displays pending changes accordingly. Revision checks are advisory against visible lake state, not a transactional compare-and-swap guarantee.

Weaviate workers consume selected Kafka topics directly, apply chunking and embedding policies, and handle inserts, replacements, and deletions. They do not depend on Temporal or read Iceberg. Quickwit independently consumes telemetry from Kafka. Neither optional service is required for structured knowledge queries.

## Build and Flux

Prerequisites: Docker, kubectl, Python 3.12+, AWS CLI with the `personal` profile, local Flux/Kind tools under `.platform-tools`, the pinned Substrate source checkout, and a Linux OrchidDB wheel matching `config/orchiddb.json` and the target node architecture.

```sh
python3.12 -m venv .platform-venv
.platform-venv/bin/pip install -r mari/platform/requirements.txt
make setup-local
make provision-s3
# Prepare the matching locally versioned compiler/client package:
.platform-venv/bin/python mari/platform/scripts/prepare_orchiddb.py --source ~/orchiddb/orchiddb --output .platform-state/orchiddb-wheels
make deploy ORCHIDDB_WHEEL=/absolute/path/to/prepared-linux-wheel.whl
make open
```

`SUBSTRATE_SOURCE` defaults to `~/context-graph/.runtime/upstream-substrate`. `KUBE_CONTEXT` defaults to `kind-mari-platform`, with the dedicated kubeconfig `.platform-state/kubeconfig`. Deployment validates the pinned OrchidDB wheel, builds images, pins pushed digests, and publishes an immutable S3 manifest release. Flux reconciles operators, infrastructure, Kafka, Substrate, and applications in dependency order. Strimzi manages Kafka; the Flink operator manages the stream job. Search and vector engines are not provisioned by this deployment.

`make open` forwards Mari to 8081, ingestion to 8082, and Temporal UI to 8233. Local owner credentials are generated in `.platform-state/governance-secrets.json`. These files are private and ignored. Local HTTP cookies are configured for loopback development, not public hosting.

## Validation and current limitations

```sh
make check
npm --prefix mari/web run typecheck
```

Flink is running. `make demo` checks signed connectors, duplicate delivery, governance creates and edits, Cypher reads, and retractions through the live Kafka/Flink/Iceberg path. `make check-lake` reads lake counts through the Knowledge API; it does not submit a stream job. `make sql` queries the same API.

PostgreSQL stores Temporal and Iceberg catalog metadata; Mari queries the Knowledge API, which reads the lake through OrchidDB. Agent Substrate and its existing workspace storage remain available for tacit-knowledge extraction. Existing Substrate namespace and storage identifiers retain their historical names to preserve workspace continuity.

Quickwit and Weaviate are bring-your-own integrations and currently disabled. External StarRocks and direct CDC require their configured source services before live verification. Slack polling is configured for all five channels, but the supplied bot can currently ingest only `#test`; joining the other four returns `missing_scope`. Failed channel access never generates retractions.

This is a local single-owner workspace. Imported source ACLs and multi-user authorization are not implemented. Normalized history is retained after retraction; current-state and search deletion is not a historical-data erasure policy. Do not delete PVCs or reset offsets as a deployment repair step.

## Operating Flux

Flux Kustomizations reconcile every five minutes; the S3 source checks every minute. Manifests reference immutable image digests and are uploaded beneath `flux/releases/<content-hash>/`. Inspect the applied revisions and conditions with:

```sh
kubectl --kubeconfig .platform-state/kubeconfig -n flux-system get kustomizations
kubectl --kubeconfig .platform-state/kubeconfig -n mari-platform get flinkdeployments,jobs,pods
```

For an incremental release after building and pushing changed images, run `make release`, then `.platform-venv/bin/python mari/platform/scripts/reconcile.py --context kind-mari-platform --kubeconfig .platform-state/kubeconfig --release .platform-state/release`. Secrets are reconciled separately. Previous S3 release prefixes remain available for rollback; select the previous Bucket prefix only after checking workload and schema compatibility. Preserve PVCs, catalog backups, Kafka offsets, and Flink checkpoints. Flink upgrades use savepoints.

The local query service bounds execution to two concurrent DuckDB sessions, each with a 256 MB engine memory limit and four execution threads. Excess concurrency returns a retryable service error. Flux controller probes allow slow startup without repeatedly killing controllers under local CPU contention. Compaction workers have a two-CPU limit.

The locally prepared OrchidDB wheel is versioned `0.4.0+mari.1`: its Python client and native compiler use the same core revision. Preparation verifies the original artifact hash and unchanged compiler sources; published package artifacts are not overwritten. The Knowledge API image checks the loaded native revision during its build.


## Bring your own retrieval infrastructure

OrchidDB catalog integration is the intended registration point for external data and computed edges; that catalog integration is still being built. Mari must consume its definitions rather than maintain another graph catalog.

For Quickwit, deploy and operate it in your own infrastructure, create a telemetry index using `config/index.json`, and attach a Kafka source using `config/source.json` with your broker addresses. Configure `QUICKWIT_URL` in the query components and enable telemetry reads. Index/source creation is not part of normal Mari bootstrap.

For Weaviate, supply your service through `WEAVIATE_HOST`, configure the hosted embedding endpoint/model and selection policy, and run `python -m indexing.worker` against the Kafka topics you choose. The current adapter uses HTTP 8080 and gRPC 50051; TLS/authenticated remote service support still needs wiring before this is a general hosted integration. Retractions must reach this consumer along with updates. Multi-vector mode requires token-vector embeddings; a dense OpenAI embedding is not MUVERA.

Enabling read features never installs Quickwit, Weaviate, or an indexing worker through Flux. Engine deployment, network access, credentials, and retention belong to the user-managed integration.

## Temporal status in the graph

The `ObserveTemporal` workflow projects schedules and running/recent workflow executions every five minutes. Only changed records are published to Kafka. Flink materializes them in Iceberg; the Knowledge API's OrchidDB query path reads them through `/api/operations`. An observation watermark reports projection age and the 1,000-run visibility bound. Schedule control commands go to Temporal, while displayed status remains a lake query. The displayed timestamp is the observer timestamp carried by the graph; no delivery-lag estimate is inferred.

The projection emits `temporal_schedule`, `temporal_workflow`, `temporal_run`, and pending connector `temporal_activity` records, linked by `schedules`, `run_of`, and `has_activity` relationships. Configured polling connectors link to their workflow through `polls`. Missing page mappings display the relationships that the page expects; this is separate from an empty mapped result or a query failure. Other domain pages still need their OrchidDB catalog mappings implemented.


## Polling, schedules, and mining controls

Polling runs as one durable `SourceSync` workflow per configured channel or repository. The old `sync-*` schedules remain paused for history and are shown as retired without Run/Resume controls. Permission failures such as Slack `not_in_channel` or `missing_scope` stop activity retries; fix source access before restarting the workflow.

Mari sends authenticated schedule commands to Temporal and acknowledges acceptance without changing the displayed graph state optimistically. The knowledge ingestion topic is not a command queue. Deployments preserve operator-set schedule cadence and pause state. Daily compaction keeps overlap prevention.

Hourly mining selects at most 100 current Slack/GitHub revisions without a matching mining receipt. It skips Substrate execution when there is no new input. Receipts are published only after extraction and candidate publication succeed, through Kafka and the lake. Delivery and extraction are at-least-once: delayed projection or a crash before a receipt can cause a repeat, rather than lose unprocessed input. Pending reviews do not block the next hourly input check. The existing Substrate actor still uses the explicit `rules-v1` extractor; this does not represent completed model-based tacit inference.

Mari's Home and Sources views read lake projections. KB browsing uses cursor pages with one lookahead row and no full counts or global facet scans. Filters and ordering apply before pagination. Text search requires a search-capable OrchidDB edge mapping; absent mappings produce an explicit requirement without scanning record text. Lineage requires a selected focal record and requests bounded adjacent edges and their endpoints. Other domain views list the required graph mappings when those bindings are unavailable.

## Python dependencies

`requirements.txt` combines the service lists for local development. Production
images install only their own requirements, with existing version pins shared
through `constraints.txt`:

- `governance/requirements.txt`: Mari HTTP, session, Kafka, and Temporal clients;
  no PostgreSQL, lake, or vector database drivers.
- `runtime/requirements.txt`: ingestion, Temporal, and catalog-maintenance workers.
  Catalog maintenance needs Iceberg and PostgreSQL access; this is separate from Mari.
- `knowledge/requirements.txt`: OrchidDB's lake-query dependencies, catalog access,
  optional StarRocks, and optional vector-retrieval clients.
- `indexing/requirements.txt`: Kafka, embedding HTTP, and Weaviate clients.
- `scripts/requirements.txt`: deployment and operator tooling.

Protocol generation uses `requirements-build.txt` in a build stage; only generated
Python modules and the gRPC runtime enter the runtime image. The pinned OrchidDB
wheel is installed separately in the Knowledge API image. Spark maintenance and
AX images retain their existing dependency definitions.
