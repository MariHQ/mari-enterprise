
# Authoring a new app

Build the requested application end to end in your own app checkout. Read its
app.json for the app ID. The execution manifest is workspace/task.yaml; native
AX owns the task, repository preparation, workspace and lifecycle. No GitHub
Actions, image builds, separate runtime controller or custom scheduler is needed.

Implement server.py using apps.base.runtime.create_app and Manifest(name=app_id,
runtime='substrate'). This protects every API with Mari's signed user grant.
Use an APIRouter for API routes and the shared static frontend hosting. Never
disable auth or embed credentials in frontend code, logs, manifests or Git.

Only when the requested app has a user-facing UI, implement web/index.html and web/src/main.tsx using the shared build and actual
Mari components. Read the design skill, components/CONVENTIONS.md, nearest page
source, its documentation/fixture, and pages/types.ts. Do not use demo data to
mask failed API calls. Include loading, empty, error and mobile states.

Backend-only source integrations need no UI, app registration, or Mari navigation entry. Run their scheduled Temporal work and expose only the required health/management endpoints. Do not add a UI just because this template includes a frontend scaffold.

For a user-facing app, app.json contains exactly: id, name, description, icon (app/sources/knowledge),
routes (absolute browser routes), methods (allowed HTTP methods), and optional
temporal_worker (true if this app runs a Temporal worker). Publish this public
manifest into your own AX task after a successful build and health check.
Mari discovers it there. Do not put endpoints, credentials or actor overrides in it.

For Python packages not already installed, pin them in requirements.txt and run
python -m pip install --target apps/APP_ID/.deps -r apps/APP_ID/requirements.txt.
The runtime adds this durable dependency directory to PYTHONPATH. Use it in tests.

For background work use the installed temporalio SDK and TEMPORAL_ADDRESS,
TEMPORAL_NAMESPACE (default default), TEMPORAL_TASK_QUEUE. Run a native Temporal
Worker from the FastAPI startup/lifespan, await shutdown cleanly, and register
your workflows/activities on your app's queue. Temporal dispatches to workers;
it does not run filesystem directories. Keep I/O in activities, workflows
deterministic, and use native schedules, retries and overlap policies. Never
put secrets into workflow arguments/history. Show worker connection errors.
Existing shared services remain external when a workspace is forked. A fork
must not start production polling or create schedules automatically; require
an explicit opt-in worker binding before consuming a production task queue.

Catalog reads use apps.base.db, with graph selected by ORCHID_GRAPH. Writes use
apps.base.ingestion's existing normalized event/Kafka pipeline, not direct SQL.
Do not create schema or infra resources blindly. If a capability is unavailable,
report it and leave explicit configuration instructions instead of faking it.

Build, run meaningful unit tests, inspect errors, write a README explaining how
the app works and how to operate it. Commit and push directly to your current
archive branch when complete. Do not modify another app or shared base without
an explicit task requiring it. Read tools/CAPABILITIES.md and publish the app yourself, then perform browser QA.

## Browser verification

The coding client can supply MARI_BROWSER_WS_ENDPOINT and MARI_BROWSER_ORIGIN
for a disposable local Chrome browser. Use the installed Playwright from
/opt/mari-web/node_modules/playwright and chromium.connect(endpoint). Create your
own browser context, sign into Mari, then navigate to your app. Do not print or
archive the endpoint. Screenshots saved with page.screenshot({path:...}) are
written into your AX workspace. Use Read on those PNGs to inspect the rendered
UI, not only DOM assertions. Save QA evidence under /workspace/agent/qa.
Check desktop and mobile, keyboard navigation, real actions, empty/error states,
console errors and failed requests. Fix issues, rebuild, retest and archive the
source changes. Never close another context or the browser service itself.

Finish exploring once you have the contracts needed for the requested app. Implement a working vertical slice first, then run tests and improve it. Do not spend the whole session cataloging unrelated shared modules.
