# Sources app

Independent, information-only Sources tab. Slack and GitHub configuration comes
from OrchidDB Cypher via the Knowledge API. Existing Temporal collectors continue
to own ingestion; this app starts no jobs and publishes no Kafka messages.

`mari.yaml` declares zero owned topics and the exact configuration topics it reads.
The backend consumes that declaration. The web app uses the original Mari
`ConnectorCard`, page header, source marks and supporting-rail composition from
`vendor/mari-design`; it supplies no sync, pause, edit or disconnect callbacks.

## Run and deploy

From the workspace root:

```sh
npm ci --prefix mari/apps/sources/web
npm run build --prefix mari/apps/sources/web
.platform-venv/bin/python mari/apps/sources/deploy.py --install-serving
```

The deployment helper uses the existing local platform target, builds only this
app, pins its image digest and publishes manifests to the existing S3 Flux source.
The flag installs shared Knative Serving/Kourier through separate Flux stages.
Subsequent deployments can omit it after Serving is ready. The app itself is a
cluster-local Knative Service, scaling to zero. No persistent app server is created.

Initial Mari host integration requires deploying the updated governance image and
its `MARI_SOURCES_URL`/`sources-app-auth` bindings. Thereafter, Sources releases do
not rebuild Mari. For framework development use `npm run dev` in `web`; its API
proxy expects this app's backend on port 8014. It must be mounted through Mari for
the authenticated frame handshake; there is no separate login.

## Auth and reads

Mari protects `/apps/sources/` with its existing session, and issues a three-minute
app-scoped signed grant through `/api/apps/sources/grant`. The frame handshake
validates the exact origin and window. The grant stays in memory; the app backend
validates audience, project, signature and expiry. Knowledge API service credentials
remain on the server. The platform supplies `sources-app-auth` automatically.
This initial mount is same-origin and is for trusted Mari applications.

The backend exposes only GET `/api/status` and health/static routes. It reads the
two configuration topics with bounded, parameterized Cypher; no corpus counts,
provider API calls or source credentials are needed. Missing configuration is
reported explicitly. Cards show configuration observation time, not last-sync time.
Workflow health and activity remain unknown until a working bounded relationship
query is available; no synthetic sparkline or healthy status is displayed.
