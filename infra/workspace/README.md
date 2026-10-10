# App workspaces and Git archives

The persistent Substrate workspace is primary. Each app's agent edits, tests,
builds, and serves its code there. GitHub is a secondary archive: agents can
commit and push checkpoints directly, without pull requests. A push does not
deploy anything or change the running workspace.

## Ownership

`container/apps.json` retains the original app bindings. Newly authored apps
register their public manifest on their own AX task; Mari discovers these tasks
and derives the owning actor and workspace from AX. Native Workspace.spec.git
identifies each Git archive. Substrate handles activation, readiness, suspension,
snapshots, and forks. There is no additional runtime controller.

Each app's `workspace/task.yaml` contains native AX Workspace and Task resources.
`Workspace.spec.git` declares the app and shared runtime under `/workspace/mari`:

| Checkout | Archive |
| --- | --- |
| `apps/<id>` | `https://github.com/MariHQ/mari-app-<id>` |
| `apps/base` | `https://github.com/MariHQ/mari-app-base` |

Knowledge also declares overview, facts, and decisions as integration-test
dependencies. Workflows declares sources and scheduled-tasks for the same reason.
Those checkouts are prepared by AX too, rather than copied from a monorepo.

The 11 app IDs are overview, knowledge, facts, decisions, lineage, workflows,
scheduled-tasks, publish, insights, sources, and settings. These app repositories and the shared runtime archive are private. New apps
also receive their own private archives. Local `mari/apps/*` paths are Git
submodules; the integration repository tracks revisions instead of app files.
New local checkouts need `git submodule update --init --recursive`.

## Code, build, and archive

Run from `mari-root`, with the existing local AX and Substrate endpoints available
at localhost:18080 and localhost:18081:

```sh
.platform-venv/bin/python mari/infra/workspace/client.py code knowledge \
  'Make the requested change, validate it, and archive a checkpoint.'

.platform-venv/bin/python mari/infra/workspace/client.py exec knowledge -- \
  node apps/base/web/build.mjs build apps/knowledge

.platform-venv/bin/python mari/infra/workspace/client.py git knowledge knowledge -- push
```

The agent uses ordinary `git -C apps/<id> add`, `commit`, and `push`. Shared
changes belong in `apps/base`. Owners use `main`; independent forks use
`workspaces/<actor-name>`. No PR is required. Reconcile non-fast-forward failures
deliberately or create a new archive branch; never force-push another workspace's
history. Git archives exclude builds, logs, and Claude sessions. Native snapshots
preserve those workspace files alongside source.

`code` continues the latest saved Claude session and defaults to a $3 budget per
invocation (`--budget` changes it). Instructions are at `/workspace/mari/AGENTS.md`,
copied from the app repo. Python edits reload; frontend edits require a build.
App logs are `/workspace/logs/<id>.log`; guest logs are `/workspace/logs/guest`.
Context and handoffs belong under `/workspace/agent`. The app can serve without
an active coding conversation.

## Git credentials

The shared token is stored in Kubernetes Secret `ax-system/mari-apps-github`, key
`token`, in `kind-agent-substrate`. Required access is Contents read/write on the
selected app/runtime repositories. Add each new app repository to that selection.
Agents do not need repository creation or PR access.

`github_auth.py` reads it locally. Coding and Git commands send it through guest
process stdin and place it only in the child process environment. A temporary
helper answers HTTPS credential requests for `github.com/MariHQ/mari-app-*`;
credential storage helpers are disabled. The token is not stored in Git URLs,
source files, AX manifests, or a workspace credential file. Ordinary `exec`
does not supply Git credentials.

Rotate using a protected local token file:

```sh
kubectl --context kind-agent-substrate -n ax-system create secret generic mari-apps-github \
  --from-file=token=/path/to/protected/token-file --dry-run=client -o yaml | \
  kubectl --context kind-agent-substrate apply -f -
```

New coding/archive runs read the replacement immediately. Do not put credentials
in prompts or notes. Finish coding runs before taking snapshots.

## Native repository setup and resume

`bootstrap.py <app-id> --image <pinned-toolchain-image>` initializes a new owner
once and refuses to overwrite an existing Task. It registers the native AX
Workspace and Task, runs AX repository preparation with a transient credential,
copies shared design/build support files, builds inside the actor, and selects
a native Substrate template whose readiness probes the app on port 8080.
External service bindings come from existing local Kubernetes Secrets.

The AX runner has `--prepare-only` to run its existing repository preparation
without starting another HTTP server, and `--state-dir` to persist initialization
markers at `/workspace/agent/ax`. Those markers are snapshotted with the code.
Resume skips repository preparation: it preserves uncommitted changes and does
not need GitHub to be available. The runner also forwards app HTTP to loopback
and stores guest logs in the workspace. Source is in `~/sub/ax`.

AX adopts an existing actor's template on reconciliation, including suspend and
resume, instead of creating an unused template each time. Fresh repository setup
has a five-minute native readiness allowance. The client waits for activation
before issuing a guest command; it never retries a dispatched coding command.
If HTTP routing already started a resume, AX observes that native operation
instead of marking the task failed or issuing another resume.
`ax-workspaces.patch` records the AX changes against upstream commit
`d8ed0fe38bceb7842d3c47817d53d16ccdfcb601`, including their regression tests.

The toolchain image contains runtimes, dependencies, Claude, and the runner;
it contains no app source. Shared design assets currently enter during bootstrap
as a support-file snapshot; they are not independently synchronized on resume.

## Fork

Finish coding/build commands and stop traffic to the source while forking:

```sh
.platform-venv/bin/python mari/infra/workspace/client.py fork knowledge knowledge-experiment
.platform-venv/bin/python mari/infra/workspace/client.py code knowledge-experiment \
  'Read the inherited context and implement the experiment.'
```

The helper uses native suspend/tag/create operations, declares the child AX
Workspace with its own repository branches, and switches inherited checkouts to
`workspaces/knowledge-experiment`. It copies code, Git state, assets, context,
and logs without requiring a Git push. New forks need a registry binding or
preview shell to expose a public URL; see `container/flux/lineage-preview.yaml`.

External database, catalog, Kafka, and Temporal services remain shared. This
is not feature-scoped infrastructure. Apps serve their working trees, without
a validated-release gate. Unsnapshotted writes can be lost in a worker failure.
Merging and context compaction remain explicit agent/operator work.

## Traces

[Open the local trace archive](http://127.0.0.1:18082/). Refresh after coding:

```sh
.platform-venv/bin/python mari/infra/workspace/traces.py knowledge lineage-preview
```

The unmodified `claude-code-transcripts` renderer exports HTML served on loopback
by the `dev.mari.workspace-traces` macOS LaunchAgent. Source sessions remain in
`/workspace/agent/claude/projects`. This is a snapshot, not a live stream or
distributed tracing service. No cloud upload is used.

## Author a new app from a prompt

On this machine, Docker Desktop and the existing local Mari stack supply the
shared services. Start/reconnect the existing AX installation:

```sh
mari/infra/workspace/ax-app up
```

Create a private `MariHQ/mari-app-<id>` repository with an initial README on
`main`, then add it to the shared fine-grained token's selected repositories
(Contents read/write). This is an archive prerequisite, not a deployment hook.
From `mari-root`:

```sh
mari/infra/workspace/ax-app new my-app \
  --repo https://github.com/MariHQ/mari-app-my-app.git \
  --prompt 'Build an app that ...' --budget 10
```

The command creates native AX Workspace/Task objects, lets AX clone the declared
repositories, supplies the native AX CLI plus shared design/runtime instructions,
and runs the installed coding agent inside that workspace. The agent writes the
backend, frontend, requirements, tests, README and `app.json`; installs durable
Python dependencies; builds and tests; starts its server; and registers its own
public manifest on its AX task. The host launcher does not implement or publish
the app. Mari discovers registrations directly from AX, so the existing shell
lists new apps without another shell build. Refresh the browser, or wait for
its session refresh. Browser checks run from that same app agent.
No GitHub Actions are created. Git commits/pushes archive source only. Execution,
logs, build artifacts and agent context stay in the workspace. Shared services
(Temporal, Kafka, catalog and PostgreSQL) remain the existing local services.
`up` restarts the existing Substrate Docker containers and checks AX; it is not
an installer for an empty machine. Initial stack provisioning remains the native
`stack/scripts/up.sh` and `stack/scripts/substrate-up.sh` setup.

Use `--prompt-file` for a longer brief and `--slack` to bind the existing Slack
credentials. Other integrations need their service credentials provisioned
explicitly; the agent cannot invent access or external infrastructure. The
current shared graph binding is `temporal`. A different data model requires an
explicit catalog/schema binding, rather than generated SQL tables behind Mari.

A source app sets `temporal_worker: true` in `app.json` and runs a Temporal worker
in its server lifespan on `TEMPORAL_TASK_QUEUE`. Temporal dispatches workflows
to that worker; it does not execute a directory. Workflows, activities and native
schedules belong in the app. Do not automatically create duplicate schedules on
startup. The Slack example migrates the existing IDs/cursors separately after
validation. Keep source-worker owner tasks running so their queues have pollers.

For an interrupted authoring run, preserve its workspace and continue:

```sh
mari/infra/workspace/ax-app new my-app --phase code \
  --prompt 'Continue the implementation, fix failing tests and archive it.'
```

`--phase init` only creates/seeds a new workspace. It refuses an existing task;
`--phase code` continues its saved coding conversation, with authority to finish
serving, registration and browser checks. The example prompts are in `prompts/`.

Forks receive a distinct archive branch and Temporal queue, have workers disabled,
and are not registered as their parent app. Their cold-boot template is installed
before first activation, so an inherited worker cannot briefly consume the owner
queue. Feature-specific external infrastructure is intentionally not created.

### The AX agent checks its own browser UI

`ax-app up` also starts a disposable local Chrome profile through Playwright.
The browser listens on loopback, and its unguessable endpoint stays in ignored
`.artifacts/browser-endpoint.json`. Coding runs receive it transiently as
`MARI_BROWSER_WS_ENDPOINT`, with `MARI_BROWSER_ORIGIN` pointing to the local shell.
Agents use their installed Playwright client from inside the workspace; no
browser dependency is required in each application's production requirements.

The full `new` flow instructs the app agent to publish and check its own live
UI at desktop and mobile sizes, exercise relevant actions, capture screenshots,
inspect those images, and fix/rebuild/retest problems. Evidence lives under
`/workspace/agent/qa`, alongside durable agent context. The browser is a development
tool, not another app runtime or deployment controller. The browser profile is
separate from your personal Chrome profile.

Long coding runs reconnect their native AX output stream at byte offsets after
network timeouts. They do not replay the command or start another agent session.

### Inspect the evidence

Run `python mari/infra/workspace/traces.py slack-source job-reports` using the
platform venv to refresh the stock transcript viewer on localhost:18082. These
are real Claude sessions exported from AX workspaces, including tool calls.
Original JSONL files remain unchanged under `/workspace/agent/claude/projects`.
Viewer copies redact exact known credentials only; each actor's `provenance.json`
records original SHA-256 hashes and redaction counts. Host setup work is not
represented as agent-authored application work.

### Dashboard and app proof

The independent [Mari command dashboard](https://github.com/MariHQ/mari-dash)
contains live screenshots, operating instructions, and a
[rendered Job Reports PDF](https://github.com/MariHQ/mari-dash/blob/main/docs/screenshots/job-report-pdf.png)
from 72 actual Temporal executions. The original PDF and capture hash are archived
alongside it. Dashboard development and these evidence captures were performed
by the host assistant; the application source was authored by the AX app agents.

A backend-only source integration does not require a UI, routes, or a Mari
navigation entry. Slack's extra UI was a mistake and is retained for now at the
user's request. Its real execution remains scheduled Temporal workflows. The
shared Flink ingestion pipeline is separate; bootstrap no longer copies its
manifest into every app workspace.
