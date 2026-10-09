# Mari container

Mari's host web app owns sign-in, navigation, and authenticated access to a fixed
set of serverless applications. `apps.json` is the only app list. There is no
service discovery, registration API, or mutable app database. Changes take effect
when the container restarts.

## Local preview

From the workspace root:

```sh
.platform-venv/bin/pip install -r mari/container/requirements.txt
npm --prefix mari/apps/base/web ci
node mari/apps/base/web/build.mjs build mari/container
# Build each configured apps/<id> with the same command.
.platform-venv/bin/python mari/container/dev.py
```

Open http://127.0.0.1:8088 and sign in with **demo / demo**. The local preview starts
the container and all configured app HTTP processes, with ephemeral shared secrets.
It does not deploy to Kubernetes, install infrastructure, or start Temporal jobs.
Sources shows a read error until its Orchid catalog graph and physical source
bindings are configured; it never replaces missing knowledge with sample data.

The UI consumes the shared Mari `AppShell`, `Sidebar`, `HeaderBar`, `Logo`,
`PageHeader`, `Card`, `CardBody`, `CardActions`, `Field`, `Input`, `Button`, and
`Alert` components, with self-hosted fonts.

## Authentication

Local authentication is enabled in `apps.json`. The default username and password
are `demo` / `demo`; change the username in JSON and supply `MARI_LOCAL_PASSWORD`
to override the password. Set `auth.local.enabled` to false to disable it.

Generic OpenID Connect uses Authlib's authorization-code flow with state, nonce,
PKCE S256, discovery, and signature/issuer/audience/expiry validation. Configure:

```text
MARI_PUBLIC_ORIGIN=https://mari.example.com
MARI_SESSION_SECRET=<stable random value, at least 32 characters>
MARI_OIDC_ISSUER=https://identity.example.com
MARI_OIDC_CLIENT_ID=<registered client ID>
MARI_OIDC_CLIENT_SECRET=<client secret>
```

Register `${MARI_PUBLIC_ORIGIN}/auth/oidc/callback` with the provider. The sign-in
button appears when all three provider variables are present. Authentication
accepts identities admitted by that provider; assign application access at the
provider. The container uses the issuer plus subject as the stable identity and
does not link accounts by email. No provider tokens are sent to apps or stored in
session cookies. Logout ends the Mari browser session; it does not sign out of the
identity provider. OIDC was validated with a mock provider, not a live tenant.

Sessions are signed, HttpOnly, SameSite=Lax cookies with an eight-hour absolute
expiry. HTTPS sets Secure. Replicas need the same `MARI_SESSION_SECRET`; local
single-process use generates an ephemeral secret if absent. POSTs require the
container's same-origin request header. No database or disk session store is used.
The default demo account is intended for local use; configure credentials before
exposing the service outside your workspace.

## JSON application configuration

Each entry supplies `id`, display name, description, icon, upstream `url`, an
optional environment override identified by `url_env`, `grant_secret_env`,
`enabled`, allowed HTTP `methods`, `runtime: "serverless"`, and `reads: "orchiddb"`.
Only enabled entries appear and can be mounted. The backend validates duplicate
IDs, origins, and the contract. Upstream origins and secret names are not exposed
by `/api/apps`. Override the config file with `MARI_CONTAINER_CONFIG`.

Apps are mounted at `/apps/<id>/`. The container verifies its session on every
request and replaces caller-supplied identity with a fresh, three-minute signed
grant containing subject, project, issuer, and the app ID as audience. The app
verifies the grant with its own shared secret. Configure each app with a separate
secret of at least 32 characters; Sources uses `MARI_APP_GRANT_SECRET`. Browser
cookies and OAuth credentials are never forwarded upstream. Query strings and
allowed methods are preserved, redirects are rejected, and bodies are bounded.

These are trusted first-party applications served under the same origin. This is
not a sandbox for untrusted code. No app needs its own login page, browser token
storage, background daemon, or local persistent database. Asset paths must use
`/apps/<id>/`; the JSON ID must match the app's grant audience and asset base.

## Serverless and OrchidDB contract

Each app is an independent HTTP container that listens on port 8080 and exposes
`/healthz`. It can run as a cluster-local Knative Service and scale to zero. The
container proxy uses a 120-second timeout to accommodate activation. Neither the
host nor the apps install Knative; shared infrastructure lives in `stack/`.
All tab apps are stateless and use the shared embedded runtime in
`apps/base/catalog/catalog_lake.py`. The shared Orchid catalog provides metadata,
not an engine or an app registry. Credentials and physical bindings stay on the
app server. Its fixed read queries filter the authenticated project.

The app-owned handlers and shared record bindings run inside each Knative app;
there is no separate Mari API server. The [Flink ingestion declaration](../flink/ingestion.yaml)
owns topics, normalized schemas, primary keys and partition keys. Graph registration
loads those physical tables after safe schema apply. The shared image contains the
completed Linux OrchidDB release wheel and verifies its native/compiler revision.
No fallback to the former Knowledge API or a fake registry is used.

## Build and check

Build the [shared application base](../apps/base/README.md) first. All tab apps
and this host inherit that image and use its common web toolchain.

```sh
# Workspace root; builds only, never deploys.
docker build -f mari/apps/base/App.Dockerfile --build-arg APP_DIR=container --build-arg APP_ID=container \
  --build-arg MARI_ENTRYPOINT=application.server:app \
  --build-arg MARI_APP_BASE=mari-app-base:local -t mari-container:local mari
.platform-venv/bin/python -m unittest discover -s mari/container/tests -v
npm --prefix mari/container/web run build
# With the preview running (requires Chrome):
MARI_PREVIEW_URL=http://127.0.0.1:8088 npm --prefix mari/apps/base/web run test:browser
```

For Kubernetes, supply the mounted JSON configuration, stable session Secret,
per-app grant Secrets, provider credentials, and public origin. Application image
publishing and deployment are intentionally not performed by these commands.
