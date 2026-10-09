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
contains only common record access, authentication, clients and hosting. Knowledge includes its
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

The migrated job in `flink/` consumes normalized `mari.records.*` changes. Current
tables in `mari_streams` upsert/delete by project and record; history tables in
`mari_history` retain each event. Primary and identity partition keys live in the
YAML. The schema command validates all existing tables and refuses incompatible
schema/key/partition changes; explicit apply creates missing tables only.

The shared registration helper reads that same YAML, loads existing physical
Iceberg tables, and registers real table UUIDs plus Record/typed nodes and
RELATED/typed relationships. `catalog_lake.py` binds those tables into each app's
embedded runtime. App handlers and Temporal evidence reads use Cypher; SQL remains
inside physical Iceberg bindings and maintenance. Multi-query graph requests share
one catalog/metadata snapshot. No separate Mari or OrchidDB engine server is used.
No live topic, table, catalog object, or service has been created by this work.

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
