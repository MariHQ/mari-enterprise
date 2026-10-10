# Finish independently inside AX

You own authoring, tests, serving, registration, browser QA and Git archiving.
The host assistant supplies tools and reviews evidence; it should not implement
or deploy the app for you. Record your actual actions in your normal transcript.

## Native AX control

`/workspace/mari/tools/ax --server host.docker.internal:18080 -a mari` is the
native AX CLI. `get task APP_ID` returns YAML; `apply -f -` accepts YAML on stdin.
Capture task YAML in memory when editing it: it contains runtime credentials.
Never print it, save it in the app archive, or include it in your report.
Preserve other fields and credentials; remove status before applying changes.
Do not suspend or delete your own task while your coding process is running.

To register your healthy app, place the JSON contents of its public app.json in
your own native Task.spec.env entry MARI_APP_REGISTRATION. Only the task with the
same ID can register that app. Mari reads AX directly and exposes it at
http://mari-container.stack.127.0.0.1.sslip.io:8084/#/APP_ID. Refresh the shell to
see new registrations. Allowed manifest fields: id, name, description, icon,
routes, methods, temporal_worker. No endpoint overrides or secrets.

## Serving

Your Task is already configured to run apps.APP_ID.server:app with uvicorn on
8080, reloading Python changes. Initially a bootstrap health server holds that
port while it waits for /workspace/agent/app-ready. Build and test first, then
touch that marker. The existing command starts your app; no host publication
step is required. Build UI changes with the shared build.mjs. Logs are in
/workspace/logs/APP_ID.log. Durable requirements belong in apps/APP_ID/.deps,
which the task's startup command adds to PYTHONPATH.

Task env edits in this local AX version are control-plane metadata changes;
they do not replace the existing actor template or mutate a running process's
environment. Account for that when enabling a worker. You may implement your
app's explicit durable runtime opt-in, guarded by owner identity. AX_TASK_YAML
contains metadata.name; inspect only that field to establish owner identity.
A fork must never consume its parent's queue: it has a different task name,
MARI_APP_WORKER_ENABLED=false and a different TEMPORAL_TASK_QUEUE. Do not bypass
that isolation. Serving an independent app needs no GitHub Actions or new stack.

## Shared service bindings

The real Temporal server is host.docker.internal:30733, namespace default, already
bound through TEMPORAL_ADDRESS. It is reachable from the workspace. Use that
existing data, not a new dev Temporal server on localhost:7233. Kafka, catalog
and PostgreSQL are bound in task environment too; do not dump their credentials.

## Browser

MARI_BROWSER_WS_ENDPOINT is injected transiently into coding sessions. Use
require('/opt/mari-web/node_modules/playwright').chromium.connect(endpoint).
MARI_BROWSER_ORIGIN is the local Mari shell. Create your own context and sign in
with context.request.post(origin+'/auth/login', {headers:{'X-Mari-CSRF':'1'},
data:{username:'demo',password:'demo'}}). Do not print the endpoint or cookies.
Navigate to your app, wait for its iframe, capture desktop and mobile screenshots
under /workspace/agent/qa, and use Read to inspect them. Test relevant actions,
error and empty states. Save QA.md and a reusable test script. Browser automation
runs from AX; screenshots belong to the AX workspace. Close only your context
and Playwright connection, not another agent's tabs or the browser server.

## Other app owners

The existing native guest client is at infra/workspace/client.py. To communicate
with another authorized app workspace, run it with:

PYTHONPATH=/workspace/agent/tools/python:$PYTHONPATH \
SUBSTRATE_ROUTER=host.docker.internal:18081 \
AX_ENDPOINT=host.docker.internal:18080 \
python infra/workspace/client.py code sources 'Your precise task' --budget 3

`exec` runs a command in that actor and `git` performs an authenticated archive
operation. The coding client's transient Git and Claude credentials are already
in your process environment; do not print or persist them. Delegate a change to
its owner rather than silently changing another app in your own checkout.

For this Slack migration you are authorized to ask the sources app owner to hide
the legacy Slack UI after your new integration is healthy. You are authorized
to migrate existing Slack schedules and run a real validation poll once tests
and worker readiness pass. Preserve schedule IDs, cursors, cadence, pause state,
policies and history. Refuse concurrent in-flight actions, keep rollback metadata,
and never send Slack messages. Report any limitation accurately.
