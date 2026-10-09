# Local Orchid stack

Shared services run directly on **`docker-desktop`**, the existing local Kubernetes **1.32.2** cluster. **`kind-agent-substrate`**, Kubernetes **1.36.1**, runs only Agent Substrate, AX, and their database, certificate, and telemetry dependencies. Flux manages both clusters through separate roots: `clusters/local` and `clusters/substrate`. The former all-in-one `orchid-stack` cluster and its local data were deleted without migration.

```text
AX → Agent Substrate → gVisor actors → S3 snapshots
Temporal → PostgreSQL (workflow state + visibility)
PostgreSQL app database → Debezium → Strimzi Kafka
                                      ↓
                        Flink DynamicIcebergSink
                                      ↓
                        Polaris REST catalog → Iceberg on AWS S3
                                      ↓
                      Orchid catalog graph registrations
                                      ↓
                  application-owned embedded OrchidDB engines
```

Only the Orchid **catalog** runs as a service. Its Docker image is built in `~/orchiddb/orchid-catalog` using that repository's Dockerfile and published to the local registry for Docker Desktop Kubernetes. No OrchidDB engine or query-server image is deployed, and no Orchid source is copied into this repository.

## Use

```sh
make status
make forward  # keep this terminal open; binds only loopback
```

`make up` bootstraps the shared stack on `docker-desktop`. `make substrate-up`
bootstraps the dedicated agent kind cluster and its cluster-local signing Secrets;
all agent workloads are installed by Flux from `clusters/substrate`.
`make publish` publishes the YAML artifact and refreshes both Flux sources.
The agent bootstrap does not install Kafka, Flink, Knative, Temporal, or Mari.

| Service | Local endpoint | In-cluster endpoint |
|---|---|---|
| Temporal UI | http://127.0.0.1:8080 | `temporal-ui.stack.svc:8080` |
| Temporal gRPC | `localhost:7233` | `temporal.stack.svc:7233` |
| Flink UI | http://127.0.0.1:8081 | `mari-ingestion-rest.stack.svc:8081` |
| Polaris REST | http://127.0.0.1:8181/api/catalog | `polaris.stack.svc:8181/api/catalog` |
| Orchid catalog | http://127.0.0.1:8182 | `orchid-catalog.stack.svc:8182` |
| Debezium Connect | http://127.0.0.1:8083 | `debezium.stack.svc:8083` |
| PostgreSQL | `localhost:5433` | `postgres.stack.svc:5432` |
| Kafka | cluster access | `kafka-kafka-bootstrap.stack.svc:9092` |
| Knative gateway | `http://<service>.<namespace>.127.0.0.1.sslip.io:8084` | `kourier.kourier-system.svc:80` |

Credentials are generated once in `.local/credentials.json` (owner-only, ignored by Git) and installed as Kubernetes Secrets. The PostgreSQL user is `stack`; its application database is `app`. Temporal, visibility, Polaris, and Orchid have separate databases. The shared stack uses Docker Desktop's `hostpath` storage class for PostgreSQL and Kafka.

Agent Substrate uses its dedicated cluster's certificate projection APIs. AX is
available on loopback port 18080 and the actor router on 18081, through Flux-managed
NodePort Services and kind port mappings. Mari uses `host.docker.internal` for
these two endpoints; shared service traffic remains inside `docker-desktop`.
Paid agent mining remains opt-in through Mari's existing configuration command.

## Data and graph behavior

Debezium captures all tables in `app.public` through the `stack_cdc` publication and replication slot. The publication includes future tables. Every captured table needs a primary key and `REPLICA IDENTITY FULL` for complete update/TOAST images. Initial tables are snapshotted. Later tables are discovered from new change records; existing rows in a table added later need a Debezium incremental snapshot or a new change to be emitted.

Flink discovers topics matching `(cdc\..+|events\..+)` every 10 seconds. The pattern is configurable with `TOPIC_PATTERN` in the Flink pod environment. Internal Kafka topics are excluded. All topics are expected to use UTF-8 values; arbitrary binary serialization requires an explicit decoder.

* `cdc.*` uses Debezium JSON with schemas enabled. It creates typed Iceberg tables, applies inserts/updates as primary-key upserts, and deletes with equality deletes. Additive column changes are supported; fields use stable IDs derived from their names. Dropped columns are retained. Incompatible type changes or primary-key changes require an explicit migration. Decimals are strings, logical date/time values retain their Debezium primitive representation, and nested values are JSON strings.
* `events.*` creates append-only Iceberg tables with `topic`, `partition`, `offset`, `timestamp_ms`, `key`, and `value`. Null values remain visible as events. Topic-level domain schemas can be added to `LakeGenerator` if desired.
* Each topic gets a unique physical table name: `t_` plus the UTF-8 topic name encoded as hex. For example, `cdc.public.customers` lives under the `cdc` namespace. Ordinary events live under `events`. This preserves distinctions among dots, underscores, and dashes.
* Checkpoints run every 15 seconds and commit Iceberg snapshots. Checkpoint, savepoint, and Flink HA files live in S3. Flux/Flink upgrades use savepoints. A single task manager and writer preserve key ordering in this local installation.

The `catalog-sync` CronJob publishes generated metadata every minute into Orchid scope **`lake`**. It registers Polaris-backed Iceberg datasets with real table UUIDs/schema IDs, entity keys/properties, and corresponding live PostgreSQL source definitions for CDC tables. Graph IDs are `t_` plus the first 20 hex characters of SHA-256(topic). Updates use optimistic versions and immutable graph releases. It leaves other Orchid scopes alone; use a separate scope for hand-maintained graph definitions.

Orchid's catalog is metadata only. Embedded consumers supply credentials and bind their own engine to the physical sources in the resolved manifest. Connector names are `polaris` and `postgres`; credential references are `polaris_read` and `postgres_read`. No credentials are embedded in graph metadata. See the local [Orchid catalog API](../orchiddb/orchid-catalog/README.md) and [embedded client examples](../orchiddb/orchiddb/README.md).

## AWS and Terraform

Terraform uses AWS profile **`personal`**, region **`us-east-1`**. The bucket is:

```text
s3://orchid-local-stack-846199521923-us-east-1
  warehouse/          Iceberg tables and metadata
  flink/checkpoints/  Flink checkpoints
  flink/savepoints/   Flink upgrade savepoints
  flink/ha/           Flink recovery state
  actors/             Substrate snapshots
```

There are exactly five managed Terraform resources, all S3: bucket, versioning, AES256 encryption, public-access blocking, and a TLS-only bucket policy. No IAM, EC2, EKS, RDS, Glue, or other AWS resources are provisioned. Bucket deletion is protected. Terraform state is local under `terraform/` and excluded from Git; retain it along with `.local/`.

Workloads use credentials exported from the existing personal profile through Secrets; Terraform does not create an identity. `make credentials` refreshes those Secrets. If the profile's credentials rotate, restart Polaris and Substrate workloads and roll Flink through a savepoint so processes pick up the new environment. Run `aws sso login --profile personal` first if that profile requires a renewed SSO session.

## Flux and changes

Flux 2.9.6 reconciles an OCI artifact from the existing local `kind-registry` container. A hosted Git repository is not required. Edit manifests in `apps/`, `infrastructure/`, or `clusters/local/`, then run:

```sh
make publish
make status
```

Only these declarative directories enter the artifact; AWS credentials, generated passwords, Terraform state, and build outputs are excluded. The dependency graph orders operators → databases/Kafka → catalogs/Temporal → bootstrap and schema registry. Mari's Flux tree orders topics → schemas → apps → ingestion → Temporal workers. Substrate and AX are excluded from the local reconciliation tree. Deletion/pruning is disabled to avoid accidentally removing local state; intentional resource removal needs an explicit Kubernetes deletion.

## Recreate and validate

`make up` checks the existing `docker-desktop` cluster, applies the checked S3-only Terraform plan, refreshes local Secrets, installs Flux, and publishes the shared manifests. It neither creates nor deletes Kubernetes clusters. It expects Docker, kubectl, Python/PyYAML, and the CLIs under `bin/`. The existing `kind-registry` container is only a registry (its name is historical), exposed at localhost:5001 to host tools and host.docker.internal:5001 to Flux. Keep it for pinned application images. Mari release/configuration scripts also target `docker-desktop`.

The deployment was recreated without migrating PostgreSQL, Kafka, or application state. Existing S3 objects were not imported into the new catalog. Flink uses a new `mari/desktop-flink-typed-v2/` state prefix to avoid recovering the deleted cluster's state.

Flink ingestion source now lives in `~/mari-root/mari/flink`; its README describes local builds and the Mari normalized-record job. The legacy stack Flink deployment has been removed after taking a savepoint; Mari owns the only ingestion deployment. The shared Flink operator remains in this stack. To rebuild the AX runner, use `images/ax-runner/Dockerfile` with `~/sub/ax` as the Docker build context. `make test` validates Terraform; the legacy live smoke verifier is preserved separately in `.local/stack-lake-verify.jar` and is not built by Mari; `make smoke` uses `.local/venv` with `psycopg[binary]` and `temporalio` installed.

The live smoke test verifies actual Iceberg reads including equality deletes, automatic table/topic discovery, additive schema changes, ordinary Kafka events, and a completed Temporal workflow. It creates `customers` rows 900001/900002, `smoke_dynamic`, and `events.smoke`. Logs are under `logs/`; `logs/validation.txt` contains the verified deployment results. AX sandbox and S3 suspend/resume checks are separate. This is a single-node local stack; PVCs use Docker Desktop hostpath storage.

Pinned components: Strimzi 1.2.0 / Kafka 4.3.1; Flink operator 1.13.0 / Flink 1.20.1 / Iceberg 1.11.0; Debezium 3.3.1.Final; Polaris 1.7.0; Temporal 1.29.1 / UI 2.43.3; PostgreSQL 17. AX source `d8ed0fe38bceb7842d3c47817d53d16ccdfcb601`; Substrate `bb0effed188e06a44e03862cb6ea993e58f86893`; Orchid catalog `2200a71333b4b195099ea3f639a6e3600f20dc2e` (existing user changes preserved).

Upstream references: [Flux OCI sources](https://fluxcd.io/flux/components/source/ocirepositories/), [Iceberg dynamic Flink sink](https://iceberg.apache.org/docs/1.11.0/flink-writes/), [Strimzi version compatibility](https://strimzi.io/downloads/), [Polaris configuration](https://polaris.apache.org/releases/1.7.0/configuration/configuration-reference/), [Temporal PostgreSQL setup](https://github.com/temporalio/docker-builds/blob/main/docker-readme/auto-setup.md).

## Knative Serving

Knative Serving **1.20.3** and Kourier **1.20.1** run in `knative-serving` and `kourier-system`. Flux orders `knative-crds` → `knative-serving` → `knative-kourier`. Upstream release manifests are vendored under those `apps/` directories; Kustomize patches select Kourier, configure the local domain, pin Envoy by digest, and use a ClusterIP gateway. No AWS load balancer or additional AWS resource is needed.

`make forward` exposes Kourier on loopback port **8084**. A public Knative Service named `hello` in namespace `stack` is reachable at `http://hello.stack.127.0.0.1.sslip.io:8084`. The Knative status URL omits this local forwarded port. If wildcard DNS is unavailable, use `curl -H 'Host: hello.stack.127.0.0.1.sslip.io' http://127.0.0.1:8084`. Local HTTP is intended for development.

Cluster-local services, including Mari's Sources service, use the label `networking.knative.dev/visibility: cluster-local` and are reachable from application pods through `<service>.<namespace>.svc.cluster.local`; they do not require a host port-forward. Mari is deployed separately through its Flux release.

Run `make smoke-knative` to deploy a temporary digest-pinned HTTP service, verify gateway routing, wait for zero pods, and verify request-triggered activation. The test removes its service afterward. For application Flux Kustomizations, depend on `knative-kourier` before applying Knative Services.

Upstream manifests: [Serving CRDs](https://github.com/knative/serving/releases/download/knative-v1.20.3/serving-crds.yaml), [Serving core](https://github.com/knative/serving/releases/download/knative-v1.20.3/serving-core.yaml), [Kourier](https://github.com/knative-extensions/net-kourier/releases/download/knative-v1.20.1/kourier.yaml).

## Schema Registry

The standard Confluent Schema Registry is deployed by `apps/schema-registry` and
Flux's `schema-registry` stage. Its internal URL is
`http://schema-registry.stack.svc:8081`. Schema versions are stored durably in
Kafka's compacted `_schemas` topic. Compatibility defaults to
`BACKWARD_TRANSITIVE`; producers own their topic-specific Avro schemas.

For local access: `kubectl -n stack port-forward svc/schema-registry 8087:8081`.
`http://127.0.0.1:8087/subjects` lists registered subjects (HTTP API, no UI).
The laptop deployment requests 50m CPU/256Mi RAM and limits 500m CPU/512Mi RAM,
with a 256Mi Java heap. It adds no polling or scheduled jobs.
