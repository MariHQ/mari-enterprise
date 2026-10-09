# Shared Mari application runtime

All eleven tab apps and the container inherit `mari-app-base:local`. The base
owns Python dependencies, embedded OrchidDB, authentication, API hosting and
startup. `App.Dockerfile` provides one shared frontend build recipe.

## Build

OrchidDB is built **locally in the Orchid workspace**, using its existing Zig
cross-compilation and Python packaging tools:

```sh
~/orchiddb/scripts/build-linux-release.sh
```

Copy the resulting Linux ARM64 wheel into the shared image and build every app:

```sh
./mari/apps/base/build.sh --orchiddb-wheel /absolute/path/to/orchiddb.whl
```

Use `--base-only` for just the runtime or `--apps sources,knowledge,container`
for selected apps. Nothing is pushed, imported into Kubernetes, or deployed.
Docker does not compile OrchidDB.

## App layout

Each sidebar tab has a folder under `apps/`. Its `web/src/main.tsx` imports the
**original** page components from `vendor/mari-design/components/pages` and
mounts them with the shared `apps/base/web/screen.tsx` adapter. The original adapters and actions now live beside each app’s UI entrypoint.
Each app owns its `server.py` and page-specific backend modules. The shared base
contains dependencies, authentication and HTTP hosting; it contains no record APIs or application queries. Knowledge includes its
document, library, audit and welcome routes; Settings includes its six subpages
and account preferences.

There are no per-app `mari.json` files. `container/apps.json` is the only app
list, including routes, origins and enabled HTTP methods. Package manifests
are only JavaScript dependency/build metadata, not app registration.

`MARI_APP_ID` selects the app's grant audience. Every API route requires a
short-lived, project-scoped grant from the container. `MARI_ENTRYPOINT` defaults
to `application.server:app`: each image starts its own app module.

## Data and Flux

Each app's `flux/` directory contains its Knative Service and graph registration
Job/script. `flink/ingestion.yaml` is the sole topic/schema/key declaration;
`flux/topics/topics.yaml` is generated from it. The root `flux/kustomization.yaml`
stages suspended Flux dependencies: Kafka topics → safe Iceberg schema-apply Job
→ app services and graph-registration Jobs → Mari Flink ingestion. Every stage
waits for readiness. These are not included in the running stack's reconciliation.

The job in `flink/` consumes typed Avro rows from `mari.records.*`. Each topic
upserts/deletes its one identically named table in `mari`. The application history
reader is not implemented; no duplicate history tables are created. Primary and identity partition keys live in the
YAML. The schema command validates all existing tables and refuses incompatible
schema/key/partition changes; explicit apply creates missing tables only.

The shared registration helper reads that same YAML, loads existing physical
Iceberg tables, and registers one concrete node per topic table plus explicitly
typed relationships. `catalog/engine.py` attaches the lake directly, without views.
App handlers and Temporal evidence reads own their Cypher. Multi-query requests
reuse one resolved catalog and connection. No separate Mari or OrchidDB engine
server is used.


Deployments need `mari-runtime` (session/app grant secrets, public origin and
optional OIDC settings), and the stack's `aws-credentials`, `polaris` and
`orchid-catalog` Secrets. Local image tags must be loaded or published and
replaced with deployable references before Flux activation.

## Local preview and checks

```sh
.platform-venv/bin/python mari/container/dev.py --port 8099 --sources-port 8110
node mari/apps/base/web/check-apps.mjs
```

The preview reads the same container app list. Login is `demo/demo`. Without
the catalog/data bindings, pages show their original loading/error states;
no preview fixtures or fake successful query results are used in production.

The existing components still have their existing functional limits. In
particular, workflow promotion, impact analysis and external destination
provisioning are not implemented by splitting the pages into apps.

Native Cypher integration check (workspace root, no network or live data):

```sh
docker run --rm --network none --entrypoint python \
  -e MARI_INGESTION_CONFIG=/workspace/flink/ingestion.yaml \
  -e PYTHONPATH=/workspace:/kit \
  -v "$PWD/mari:/workspace:ro" -v "$PWD/mari-kit/src:/kit:ro" \
  mari-app-base:local /workspace/apps/base/tests/check_cypher.py
```

Application routes and queries belong in the app folder, including write commands and pagination. `server.py` explicitly mounts only that app's routers. Catalog/schema provisioning and physical Iceberg bindings live in `apps/base/catalog`; normalized Kafka contracts live in `apps/base/ingestion`. Neither mounts HTTP routes. Each application image includes those infrastructure modules alongside its own backend.

Shared catalog bindings, Kafka serialization, schema declarations, Python dependencies,
and DuckDB extensions are copied once into `mari-app-base`. Application images inherit
them and add only their own backend and original frontend. Each application owns its
Cypher and business logic. `infra/` contains deployment configuration, not app imports.

Remote DuckDB reads load `cache_httpfs` (the community extension's exact name), then
`iceberg`. The caching extension is installed at base-image build time. There is no
direct `httpfs` load or fallback in application code.

`db.py` owns session/error handling; `commands.py` owns write validation and delivery.
`catalog/` owns physical bindings and ontology publication. `ingestion/` owns Kafka
serialization and producer contracts; `schemas/` owns the checked-in Avro schemas.
App-specific queries, revision lookups, routes and actions remain under each app.
