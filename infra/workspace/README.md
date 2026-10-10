# App workspaces and Git archives

The persistent Substrate workspace is primary. Each app's agent edits, tests,
builds, and serves its code there. GitHub is a secondary archive: agents can
commit and push checkpoints directly, without pull requests. A push does not
deploy anything or change the running workspace.

## Ownership

`container/apps.json` maps each app to its AX owner, Substrate actor, workspace,
manifest, and Git archive. Substrate handles activation, readiness, suspension,
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
scheduled-tasks, publish, insights, sources, and settings. All 12 repositories,
including the shared runtime, are private. Local `mari/apps/*` paths are Git
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
12 app/runtime repositories. Agents do not need repository creation or PR access.

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
