# Mari: independent web apps and Temporal jobs

Proposed plan. The CLI and API examples below describe interfaces to implement, not existing commands or endpoints.

## What we are building

Mari provides the navigation, sign-in, and host for independently developed web apps. Each tab is a self-contained app embedded in a frame. An app may also include ordinary Temporal workflows and activities for collection or background work.

There is no separate functions package, required graph-mapping directory, schema package, or test framework. Those concerns are independent of this app-development workflow. A web app uses its framework's normal routes and server code. Temporal code runs on existing Temporal worker infrastructure, independently of Knative.

```text
sources/
  mari.yaml            # app identity and zero or more exact Kafka topic names
  web/                 # complete web app, including its normal backend routes
  jobs/                # optional Temporal workflows and activities
```

Normal framework files and deployment configuration live with the code they configure. A small `mari.yaml` records the app identity and its topics; it does not introduce a workflow language or require mappings or schemas.

```yaml
name: sources
topics:
  - name: mari.sources.github-issues
  - name: mari.sources.collection-runs
```

`topics` supports **zero to many entries**; a read-only app can use `topics: []`. These are exact Kafka topic names, known before deployment—not names assigned after registration. Each topic is the identity of its own dynamic sink table. Stable app-prefixed names avoid accidental overlap; the API validates ownership and rejects collisions rather than silently renaming a topic or sharing another app's data. Another installation must declare distinct names before deployment.

The helper uses this declaration to validate names, duplicates, ownership, and requested ingestion bindings before provisioning. It registers one ingestion binding per declared topic and returns matching authorized endpoint details. Redeploying the same installation reuses those bindings. Query setup can refer to these known source/table identities through the existing catalog; declaring a topic does not itself create a Cypher node or edge. Removing a declaration never implicitly deletes a topic or its data.

The reusable deliverable is a **skill plus maintained deployment/auth helpers**. The skill teaches an agent how to use the platform so it can build the requested app without reinventing infrastructure.

## What the skill needs to teach

| Capability | Instructions the agent receives |
| --- | --- |
| Find the platform | Where to discover the current Knowledge API URL, API documentation, Mari host, deployment target, and Temporal worker binding. Use environment-provided bindings, not hard-coded cluster addresses. |
| Provision ingestion | How to register an app-owned ingestion endpoint with the Knowledge API, receive its stable identity and authorized write binding, and reuse that registration on redeploy. Register the exact topic names declared in `mari.yaml`; validate ownership and reject collisions. |
| Write data | How producers submit keyed upserts/retractions to that endpoint, and how the Knowledge API routes user edits through the same registered endpoint to the same topic/key. No producer connects directly to Kafka or guesses routing through graph lookups. |
| Read data | How to send parameterized Cypher requests, use bounded cursor pagination, and discover available nodes/edges. No full counts or automatic whole-lake scans. |
| Authenticate | How Mari supplies app-scoped user auth to the embedded app and how server code and Temporal activities receive their authorized platform bindings. No per-app login or manually copied infrastructure secrets. |
| Deploy | How to deploy the web app on Knative through Flux and release optional jobs to existing Temporal workers, locally or through CI. No generated persistent server infrastructure. |
| Design | Read `mari-design/design-system/SKILL.md`; use the actual Mari components and existing page compositions. |

An ingestion endpoint is a **platform-managed API registration**, not another server the agent has to deploy. Registration associates an owner, a stable stream identity, its topic, permitted writers, and the supported mutation contract. The exact registration request and response must be documented by the Knowledge API and demonstrated in the skill using the implemented API.

## End-to-end example: Sources

### 1. Create the app

The user asks: “Build a Sources page that collects GitHub issues and lets me inspect and edit the collected data.”

The agent reads the skill and existing Sources presenter, then creates:

```text
sources/
  mari.yaml                       # exact topic names, known before registration
  web/
    ...standard framework files...
    Sources.tsx                   # Mari page composition
    ...normal backend routes...   # Cypher reads, edits, job controls
  jobs/
    workflows.ts                  # polling orchestration and durable cursor
    activities.ts                 # GitHub reads and Knowledge API writes
```

Backend routes are part of the web app. There is no additional `functions/` abstraction. The agent can use shared ordinary code where helpful without creating more mandatory packages.

### 2. Provision an ingestion endpoint

The deployment helper uses the Knowledge API's documented registration operation to create or reuse an ingestion endpoint owned by this installation. For each topic declared in `mari.yaml`, such as `mari.sources.github-issues`, registration returns:

- The declared Kafka topic name, endpoint ID, and ingestion URL.
- An app-scoped authorization binding.
- The writable record-reference format used for later edits.

The API provisions the declared Kafka topic and enforces its ownership. Repeating deployment updates the same registration; another installation must declare its own non-conflicting topic names. The app does not create topics, receive broker credentials, or deploy an ingestion service. Flink dynamically writes the registered topic to its own Iceberg table.

Registration does not imply the app creates graph mappings or physical tables. The Knowledge API's independently managed catalog determines which nodes and edges are available for Cypher queries.

### 3. Collect with Temporal

A normal Temporal workflow invokes its collection activity. The activity reads a bounded GitHub batch and submits changes to the registered Knowledge API ingestion endpoint.

Illustrative activity logic, using proposed client methods:

```ts
async function collectIssues(input, clients) {
  const batch = await clients.github.readIssues({
    repository: input.repository,
    cursor: input.cursor,
    limit: 100,
  });

  await clients.knowledge.ingest(input.ingestionEndpoint, {
    changes: batch.changedIssues.map(issue => ({
      operation: 'upsert',
      key: issue.id,
      eventId: issue.revision,
      value: normalizeIssue(issue),
    })),
  });

  return { cursor: batch.nextCursor, more: batch.hasMore };
}
```

The real client signature must match the implemented API. The important boundary is **activity → Knowledge API → Kafka → Flink**, with no Knative invocation. The API acknowledges publication before the activity returns; Temporal persists the returned progress after success. Retries reuse stable event identities. No changes means no manufactured data. Provider deletions become explicit retractions when the collector can actually establish deletion.

Jobs use the platform's existing Temporal worker deployment mechanism. A schedule alone cannot execute uploaded code: the helper must package/release the workflows and activities to that worker infrastructure before enabling the schedule. It must report a missing worker binding rather than silently deploy a new persistent service.

### 4. Query from the web app

The page calls its own backend route. That route calls the Knowledge API with delegated user scope and parameterized Cypher. For example, if the catalog exposes `GitHubIssue`:

```cypher
MATCH (i:GitHubIssue)
WHERE i.repository = $repository AND i.id > $after
RETURN i.id AS id, i.title AS title, i.state AS state
ORDER BY i.id
LIMIT $fetchSize
```

Fetch 26 rows to display 25 and determine whether another page exists. Do not count the entire result set. Query the catalog's actual names; the example does not establish a new mapping contract.

The page declares its needed nodes/edges using the app SDK or ordinary page code. If `GitHubIssue` is not available, it names that missing requirement. If a related-run edge is absent, only that panel shows the warning. An available mapping with zero rows is a valid empty state. Permission and service errors are not relabeled as missing mappings.

### 5. Edit or retract through the same API

The query/read response includes an authorized writable reference identifying the ingestion registration and original record key. The web backend passes that reference to the Knowledge API with the user's upsert or retraction:

```ts
await knowledge.upsert({ ref: issue.writeRef, value: editedIssue, eventId });
await knowledge.retract({ ref: issue.writeRef, eventId });
```

The API validates the user and reference, then routes the command through the registered ingestion endpoint to the original topic/key. There is no graph lookup to infer the destination and no Kafka client in the app. The response identifies accepted work; the page shows applied only when the resulting revision is observable.

A retraction removes the materialized record through the sink's supported mutation path, even if its original Kafka event has expired. The platform must implement that behavior; individual apps do not implement Iceberg deletion. Editing externally owned content does not automatically edit GitHub, and a later GitHub update can replace the local value unless a separate override policy exists.

### 6. Supply authentication automatically

- Mari owns the signed-in session. The embedded app does not create another login flow.
- The frame SDK performs an origin/window-validated handshake and receives a short-lived app-scoped grant. Grants stay in memory, never in URLs or build output.
- The web app's backend validates that grant and calls the Knowledge API with delegated user/project scope. It cannot elevate a user through a shared admin credential.
- Temporal activities receive their installation-scoped service identity through the existing worker infrastructure. They do not impersonate a browser user to keep polling.
- Platform helpers handle endpoint discovery, renewal, and bindings. Source-provider authorization, such as connecting GitHub, is performed once by the user when needed; infrastructure auth is not configured separately for each app.

### 7. Deploy from a laptop or build server

Provide a thin CLI over the maintained platform tooling:

```sh
mari app init sources
mari app dev ./sources
mari app deploy ./sources --target local
```

`init` creates a normal web app, a small `mari.yaml` with `topics: []`, and optional jobs starter. `dev` starts its framework development server with an authenticated Mari preview host. `deploy` validates the declared topic names and ownership, then builds the web image, publishes standard Flux configuration for Knative, provisions/reuses Knowledge API ingestion registrations, registers the page, and releases any job code through the existing worker binding.

CI calls the same deploy command using a scoped deployment identity. It does not require a different generated deployment system. The target supplies registry, API, identity and infrastructure bindings. A deployment reports the page URL, release revision, ingestion registration, and job readiness.

Only the web app runs on Knative. Temporal jobs stay on Temporal infrastructure. Persistent signed-webhook servers or other always-on services must already exist and be bound explicitly. Updating one page does not rebuild Mari or the other pages. Removing an app disables its jobs and access; deleting its collected data is a separate explicit action.

## Proposed skill

This will live at `mari/skills/mari-app/SKILL.md`. Its API reference must describe actual implemented requests and responses, and its platform-discovery instructions must work in both local and CI environments.

```markdown
---
name: mari-app
description: Build an independent Mari web app with optional Temporal jobs,
  using the Knowledge API for ingestion, edits, retractions and Cypher queries.
---

# Build a Mari app

Read the selected target's platform bindings and Knowledge API reference.
Discover the API URL, authentication helpers, ingestion registration operations,
query contract, and existing Temporal worker/deployment binding. Do not guess
API routes or introduce a new platform service to fill a missing capability.

Read mari-design/design-system/SKILL.md and the nearest existing page.
Use its actual components. Mari owns navigation and login; the app owns its
page and normal backend routes. Temporal workflows and activities belong in
optional jobs code. Do not introduce a separate functions framework or require
graph mappings, schemas, or a test package as part of every app.

Declare zero or more exact Kafka topic names in mari.yaml before provisioning.
Use stable app-prefixed names; validate duplicates and ownership. Never silently
rename colliding topics. For each declared topic, provision or reuse its ingestion
endpoint through the Knowledge API. Keep its registration in the deployment binding.
Use these known topic/table identities for catalog-backed query setup; a topic
declaration does not create graph mappings. Submit all data,
including upserts and retractions, through that API. Never connect to Kafka
from app or job code. Use returned writable references for user edits.

Read data through parameterized Cypher against available catalog capabilities.
Bound queries and use cursor pagination without full counts. Declare what nodes
and edges a page needs, and show specific warnings when they are unavailable.
Do not silently invent graph mappings or substitute mock data.

Use the frame auth helper for embedded user access and the supplied service
identity for jobs. Keep provider and platform secrets out of browser code.
Use existing connections, requesting provider authorization only when needed.

Write ordinary Temporal workflows and activities. Activities call the source
and Knowledge API, not Knative. Preserve incremental progress, retry identity,
and no-change behavior. Release them through existing worker infrastructure.

Deploy the web app through the supported Knative/Flux helper, locally or in CI.
Do not provision persistent servers or workers for the app. Report missing
infrastructure bindings explicitly. Keep the app's code and domain behavior
flexible; use platform helpers for auth, registration and deployment mechanics.
```

## Migration of existing tabs

Keep the existing Mari components, navigation groups, and useful deep links. Move each page's composition, backend reads, and actions into its own independently deployable app. Remove the corresponding business-page imports/adapters from the shell after replacement.

| Pages | App responsibility |
| --- | --- |
| Knowledge, Document review | Bounded browse/detail, available search capability, review, upserts/retractions. |
| Sources | Collector connections, ingestion registrations, collection controls and actual status. |
| Lineage | Bounded traversal from a selected record. |
| Workflows | All ecosystem agent trajectories/steps and approved answers through available graph relationships. |
| Scheduled tasks | Temporal schedule/run views and real run/pause/resume/update commands. |
| Decisions, Facts | Supporting records, review/edit actions; optional incremental extraction jobs. |
| Library | Collections and membership views/edits. |
| Audit, Insights | Review findings and available summaries with bounded drill-downs. |
| Destinations | Publishing through jobs or existing external infrastructure. |
| Overview, Welcome | Available knowledge/activity and connection readiness. |
| Preferences and every Settings tab | Existing user/project/model/member/key/audit/design functions through authorized platform APIs. Security changes use authoritative identity/configuration services, not eventual lake projections. |

Login and platform setup stay in the shell. Lookbook stays in design tooling. Pages use catalog capability checks without imposing a graph-mapping workflow on their developers.

Implement the auth/API/deployment helpers first, then prove the Sources example end to end, then migrate the remaining tabs using the same skill. Do not reset the lake or reintroduce OpenDots, Quickwit, or Weaviate deployments.
