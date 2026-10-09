/* Feature-level canvas fixtures.
 *
 * The library ships pure presenters (MIGRATION.md): every feature takes
 * required data props and holds no demo content. Two canvas surfaces render
 * features on their own rather than through a page — the component state
 * matrix (`.preview/states/*`) and the feature gallery (`.preview/pages.tsx`)
 * — so both need a "here is what this feature looks like with real data"
 * payload.
 *
 * Rather than author a second, divergent world, this module DERIVES those
 * payloads from the page fixtures. `state:OverviewDigestCard:default` and
 * `page:overview:default` therefore show the same topics, the same graph, the
 * same runs. Only genuinely feature-local content (an error variant a page
 * never renders, a stress case a page has no slot for) is authored here.
 *
 * Nothing under `.preview/` is part of the published surface.
 *
 * NOTE for `.preview/fixtures/index.ts`: this file exports no `FIXTURES`, so
 * the registry glob picks it up and filters it back out. It is not a page.
 */

import type { AuthUser } from "../../features/AuthSession";
import type { ChatSession } from "../../features/ChatDockFeature";
import type { Doc } from "../../features/TagPickerFeature";
import type { KeyRow } from "../../features/TokenRevealFeature";
import type { Finding } from "../../features/DocReviewMarkdown";
import { GUIDE_PACKS } from "../../features/WelcomeGuideStep";

import { ANSWERS_FIXTURE } from "./workflows";
import { FIXTURES as AUDIT } from "./audit";
import { FIXTURES as DECISIONS } from "./decisions";
import { FIXTURES as DOC_REVIEW } from "./docReview";
import { FIXTURES as FACTS } from "./facts";
import { FIXTURES as INSIGHTS } from "./insights";
import { FIXTURES as KNOWLEDGE } from "./knowledge";
import { FIXTURES as LIBRARY } from "./library";
import { FIXTURES as LINEAGE } from "./lineage";
import { FIXTURES as OVERVIEW } from "./overview";
import { FIXTURES as PUBLISH } from "./publish";
import { FIXTURES as SETTINGS_API_KEYS } from "./settingsApiKeys";
import { FIXTURES as SETTINGS_AUDIT_LOG } from "./settingsAuditLog";
import { FIXTURES as SETTINGS_DESIGN } from "./settingsDesign";
import { FIXTURES as SETTINGS_MEMBERS } from "./settingsMembers";
import { FIXTURES as SETTINGS_MODELS } from "./settingsModels";
import { FIXTURES as SOURCES } from "./sources";
import { FIXTURES as WELCOME } from "./welcome";

import type { DocHistoryRow, ImpactResult, LEdge, LNode } from "../../features/LineageDataModel";

/* ── Overview ───────────────────────────────────────────────────────────── */

const overview = OVERVIEW.default.data;

export const OVERVIEW_STATS = overview.stats;
export const OVERVIEW_TOPICS = overview.digest;
export const OVERVIEW_TILES = overview.sources;
export const OVERVIEW_FEED = overview.activity;
export const OVERVIEW_DOCS = overview.docs;

/* ── Knowledge ──────────────────────────────────────────────────────────── */

const knowledge = KNOWLEDGE.default.data;

export const KNOWLEDGE_RESULTS = knowledge.results;
/** The page's inspector rail is nullable (nothing selected); the feature is
    not, so the fixture pins the document the default page state opens with. */
export const KNOWLEDGE_DOC = knowledge.doc!;

/* ── Doc review ─────────────────────────────────────────────────────────── */

const doc = DOC_REVIEW.default.data.doc;

export const DOC_EDITOR_BODY = doc.editorBody;
export const DOC_EDITOR_FINDINGS = doc.editorFindings;
export const DOC_OUTLINE_BODY = doc.outlineBody;
export const DOC_REVISIONS = doc.revisions;
export const DOC_CHANGES = doc.changes;
export const DOC_CHANGE_BODY = doc.changeBody;
export const DOC_FINDINGS = doc.findings;
export const DOC_CLAIMS = doc.claims;
export const DOC_REFINE = doc.refine;

/* ── Lineage ────────────────────────────────────────────────────────────── */

const lineage = LINEAGE.default.data;

export const LINEAGE_NODES: LNode[] = lineage.nodes;
export const LINEAGE_EDGES: LEdge[] = lineage.edges;
export const LINEAGE_DATES: string[] = lineage.dates;
export const LINEAGE_ACTIVITY = lineage.activity;

const nodeDrawer = LINEAGE.inspect.data.drawer!;
const groupDrawer = LINEAGE.group.data.drawer!;
const assertDrawer = LINEAGE.assert.data.drawer!;

/** Revision history for the node drawer, as the page's inspect state has it.
    The page's `history` is nullable — null means "these revisions were never
    loaded", which the drawer reports as such. The feature gallery renders the
    loaded case, so null collapses to the same empty array as a non-node
    drawer would. */
export const LINEAGE_HISTORY: DocHistoryRow[] =
  nodeDrawer.kind === "node" ? nodeDrawer.history ?? [] : [];
export const LINEAGE_NODE_ID: string =
  nodeDrawer.kind === "node" ? nodeDrawer.nodeId : "n4";

export const LINEAGE_GROUP = groupDrawer.kind === "group"
  ? { groupId: groupDrawer.groupId, totalMembers: groupDrawer.totalMembers, members: groupDrawer.members }
  : { groupId: "gh:MariHQ/web:commits", totalMembers: 0, members: [] as LNode[] };

export const LINEAGE_ASSERT = assertDrawer.kind === "assert"
  ? {
      result: assertDrawer.result,
      analyzed: assertDrawer.analyzed,
      claim: assertDrawer.claim,
      owners: assertDrawer.owners,
      people: assertDrawer.people,
    }
  : {
      result: { claim: "", summary: "", docs: [] } as ImpactResult,
      analyzed: false,
      claim: "",
      owners: [] as { name: string; role: string }[],
      people: [] as string[],
    };

/* ── Insights ───────────────────────────────────────────────────────────── */

const insightWidgets = INSIGHTS.default.data.widgets!;

export const INSIGHTS_STATS = insightWidgets.stats;
export const INSIGHTS_READABILITY = insightWidgets.readability;
export const INSIGHTS_GLOSSARY = insightWidgets.glossary;
export const INSIGHTS_ACTIVITY = insightWidgets.activity;
export const INSIGHTS_SINCE = insightWidgets.since;
export const INSIGHTS_FRESHNESS = INSIGHTS.default.data.freshness ?? [];

/* ── Audit ──────────────────────────────────────────────────────────────── */

const audit = AUDIT.default.data;

export const AUDIT_FINDINGS = audit.findings;
export const AUDIT_MEMBERS = audit.members;
export const AUDIT_PROVIDER = audit.provider;
export const AUDIT_REPO = audit.repo;
export const AUDIT_RAN_AT = audit.ranAt;

/* ── Facts ──────────────────────────────────────────────────────────────── */

export const FACTS_ROWS = FACTS.default.data.facts;
/** The verification-audit card's own input: the subset the page audits. */
export const FACTS_AUDIT_ROWS = FACTS.default.data.audit ?? FACTS.default.data.facts;

const factImpact = FACTS["impact-analyzed"].data.impact!;
export const FACT_IMPACT = {
  claim: factImpact.claim,
  source: factImpact.source,
  verifiedAt: factImpact.verifiedAt,
  summary: factImpact.summary,
  docs: factImpact.docs,
};

/* ── Library ────────────────────────────────────────────────────────────── */

const library = LIBRARY.default.data;

export const LIBRARY_TAGS = library.tags;
export const LIBRARY_TOTAL_DOCS = library.totalDocs;
export const LIBRARY_TERMS = library.terms;
export const LIBRARY_GUIDES = library.guides;
export const LIBRARY_WORKSPACE = library.workspace;
export const LIBRARY_DEFAULT_PACK = library.defaultPack;
export const LIBRARY_VOICE = library.voice;
export const LIBRARY_TEMPLATES = library.templates;
export const LIBRARY_CHECKER_DOCS = library.checkerDocs;

/* ── Answers ────────────────────────────────────────────────────────────── */

export const ANSWERS_ROWS = ANSWERS_FIXTURE.answers;
export const ANSWER_ONE = ANSWERS_ROWS[0];

/* ── Sources ────────────────────────────────────────────────────────────── */

const sources = SOURCES.default.data;
const destinations = PUBLISH.default.data;

export const SOURCES_ROWS = sources.sources;
export const SOURCES_CATALOG = sources.catalog;
export const DESTINATIONS_SLACK = destinations.slack;
export const DESTINATIONS_GITHUB = destinations.github;

/* ── Onboarding ─────────────────────────────────────────────────────────── */

const welcome = WELCOME.default.data;

export const WELCOME_CANDIDATES = welcome.glossaryCandidates;
export const WELCOME_PACKS = GUIDE_PACKS;
export const WELCOME_SYNC_ROWS = welcome.syncRows;
export const WELCOME_REPOS = welcome.repos;

/* ── Admin ──────────────────────────────────────────────────────────────── */

const members = SETTINGS_MEMBERS.default.data;
export const MEMBERS_ROWS = members.members;
export const MEMBERS_WORKSPACE = members.workspaceName;
export const MEMBERS_GITHUB_TEAM = members.githubTeam;

export const API_KEYS = SETTINGS_API_KEYS.default.data.keys;

const auditLog = SETTINGS_AUDIT_LOG.default.data;
export const AUDIT_EVENTS = auditLog.events;
export const AUDIT_EVENT_TOTAL = auditLog.total;

const models = SETTINGS_MODELS.default.data;
export const MODELS_CONFIG = {
  embedding: models.embedding,
  llm: models.llm,
  dims: models.dims,
  chunking: models.chunking,
  keys: models.keys,
  indexSummary: models.indexSummary,
};

/* The branding editor's inputs come from Settings → Design & brand, which is
   the only page that renders it with handlers. Settings → General still
   carries the three brand fields as optionals nothing reads; deriving from
   there produced `Branding | undefined` against props that are required. */
const design = SETTINGS_DESIGN.default.data;
export const BRANDING = {
  branding: design.branding,
  harvest: design.harvest,
  previewStats: design.previewStats,
};

/* ── Publish ────────────────────────────────────────────────────────────── */

export const MCP_SERVERS = PUBLISH.default.data.servers;

/* ── Decisions ──────────────────────────────────────────────────────────── */

export const DECISIONS_ROWS = DECISIONS.default.data.decisions;

/* ── The gallery's per-feature prop bundle ──────────────────────────────────
   `.preview/pages.tsx` renders each feature by export name with no knowledge
   of its prop type, so the required data has to be looked up by name. A
   feature missing from this map renders on its optional props alone; a
   feature whose props are all optional is deliberately absent. */




/* ── features with no page of their own ──────────────────────────────────
   These are exercised only by the state matrix and the feature gallery, so
   their content has no page fixture to derive from. It is authored here for
   the same reason as everything else in this directory: the components
   themselves must ship empty. */
export const TAG_PICKER_DOCS: Doc[] = [
  { id: "d1", title: "Incident response runbook", provider: "notion", source: "notion · SRE", updatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(), tags: ["canonical", "internal"] },
  { id: "d2", title: "Q3 pricing announcement", provider: "gdocs", source: "gdocs · marketing", updatedAt: new Date(Date.now() - 5 * 86400_000).toISOString(), tags: ["draft", "customer-facing"] },
  { id: "d3", title: "Legacy webhook migration", provider: "github", source: "github · docs/webhooks.md", updatedAt: new Date(Date.now() - 40 * 86400_000).toISOString(), tags: ["deprecated", "needs-review"] },
];

export const TOKEN_REVEAL_KEYS: KeyRow[] = [
  { id: "k_prod", label: "Production", prefix: "mari_sk_live_9f2a", createdAt: "2026-05-02", lastUsed: new Date(Date.now() - 40 * 60_000).toISOString() },
  { id: "k_ci", label: "CI pipeline", prefix: "mari_sk_live_7c81", createdAt: "2026-06-19", lastUsed: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { id: "k_local", label: "Local dev", prefix: "mari_sk_test_1b40", createdAt: "2026-07-11", lastUsed: null },
];

export const MARKDOWN_SOURCE = `# Authentication Service Migration

##1. Overview
The new authentication service replaces the legacy session store with stateless **JWT** tokens. It is expected to reduce login latency by roughly 40% and remove the shared-session bottleneck.

Tokens are signed with \`RS256\` and rotated every 24 hours.

## 2. Rollout phases
- Canary at *5%* of traffic for 48 hours
- Ramp to 50% once the canary is stable
- Full cutover after a clean week

\`\`\`bash
POST /auth/token
Authorization: Basic <credentials>
\`\`\`

### 3. Cutover order
1. Drain the legacy session store
2. Flip the router
3. Revoke the old signing key

| Phase | Traffic | Watch for |
| --- | --- | --- |
| Canary | 5% | error rate |
| Ramp | 50% | p99 latency |

> Rollback is not free: draining active tokens signs every user out.

#### Open question
Whether the 24-hour rotation cadence is a requirement or a habit.
`;

/* The blocks above the fence are the editable ones; the ordered list, the
   table, the blockquote and the h4 below it are exactly what the parser used
   to throw away on a round trip. Surviving `serializeBlocks(parseMarkdown(md))`
   unchanged is the whole contract, so the fixture has to contain them. */

export const MARKDOWN_FINDINGS: Finding[] = [
  { id: 1, kind: "fact", severity: "error", text: "reduce login latency by roughly 40%", note: "Contradicts verified fact: measured reduction was 22%." },
  { id: -2, kind: "prose", severity: "warn", text: "expected to", note: "hedge" },
  { id: 3, kind: "freshness", severity: "warn", text: "every 24 hours", note: "rotation cadence unverified" },
];

export const AUTH_IDENTITY: AuthUser = {
  name: "Maya Chen", email: "maya@team.com", role: "admin", initials: "MC", provider: "password",
};

export const CHAT_SESSIONS: ChatSession[] = [
  { id: "s_current", title: "Free-tier seat audit", meta: "current" },
  { id: "s_2", title: "Sync GitHub docs", meta: "6 msgs" },
  { id: "s_3", title: "Draft release notes", meta: "14 msgs" },
];

export const FEATURE_PROPS: Record<string, Record<string, unknown>> = {
  OverviewStatTiles: { stats: OVERVIEW_STATS },
  OverviewDigestCard: { topics: OVERVIEW_TOPICS },
  OverviewSourcePulse: { tiles: OVERVIEW_TILES },
  OverviewLiveActivity: { items: OVERVIEW_FEED, pollMs: 0 },
  OverviewRecentDocs: { docs: OVERVIEW_DOCS },

  KnowledgeBrowser: { results: KNOWLEDGE_RESULTS },
  KnowledgeInspector: { doc: KNOWLEDGE_DOC },

  DocReviewEditor: { body: DOC_EDITOR_BODY, findings: DOC_EDITOR_FINDINGS },
  DocReviewFindingsPanel: { findings: DOC_FINDINGS, claims: DOC_CLAIMS },
  DocReviewChangeQueue: { changes: DOC_CHANGES, body: DOC_CHANGE_BODY },
  DocReviewRefinePanel: { ...DOC_REFINE },
  DocReviewOutlinePanel: { body: DOC_OUTLINE_BODY, revisions: DOC_REVISIONS },

  LineageGraph: { nodes: LINEAGE_NODES, edges: LINEAGE_EDGES, focalId: "n1" },
  LineageToolbar: { nodes: LINEAGE_NODES },
  LineageTimeScrubber: { dates: LINEAGE_DATES, activity: LINEAGE_ACTIVITY },
  LineageDataModel: { nodes: LINEAGE_NODES, edges: LINEAGE_EDGES, dates: LINEAGE_DATES },
  LineageNodeDrawer: {
    nodes: LINEAGE_NODES, edges: LINEAGE_EDGES,
    nodeId: LINEAGE_NODE_ID, history: LINEAGE_HISTORY,
  },
  LineageEdgeDrawer: { nodes: LINEAGE_NODES, edges: LINEAGE_EDGES, edgeId: "e3" },
  LineageGroupDrawer: { ...LINEAGE_GROUP, nodes: LINEAGE_NODES, edges: LINEAGE_EDGES },
  LineageAssertDrawer: { ...LINEAGE_ASSERT },

  InsightsWidgets: {
    stats: INSIGHTS_STATS, readability: INSIGHTS_READABILITY,
    glossary: INSIGHTS_GLOSSARY, activity: INSIGHTS_ACTIVITY, since: INSIGHTS_SINCE,
  },
  InsightsFreshnessChart: { freshness: INSIGHTS_FRESHNESS },

  AuditFindingsChecklist: {
    findings: AUDIT_FINDINGS, members: AUDIT_MEMBERS,
    provider: AUDIT_PROVIDER, repo: AUDIT_REPO, ranAt: AUDIT_RAN_AT,
  },
  FactsVerificationAudit: { facts: FACTS_AUDIT_ROWS },

  LibraryGlossaryPanel: { terms: LIBRARY_TERMS },
  LibraryGuidesPanel: {
    guides: LIBRARY_GUIDES, workspace: LIBRARY_WORKSPACE,
    defaultPack: LIBRARY_DEFAULT_PACK, layer: LIBRARY_VOICE,
  },
  LibraryRulesPanel: { workspace: LIBRARY_WORKSPACE, docs: LIBRARY_CHECKER_DOCS },
  LibraryTagsPanel: { tags: LIBRARY_TAGS, totalDocs: LIBRARY_TOTAL_DOCS },
  LibraryTemplatesPanel: { templates: LIBRARY_TEMPLATES },

  AnswerCard: { answer: ANSWER_ONE },

  SourcesConnectorCard: { sources: SOURCES_ROWS },
  SourcesConnectorWizard: { providers: SOURCES_CATALOG, defaultOpen: false },
  SourcesBots: { slack: DESTINATIONS_SLACK, github: DESTINATIONS_GITHUB, defaultOpen: null },

  WelcomeGithubConnect: { repos: WELCOME_REPOS, defaultOpen: false },
  WelcomeGenericConnect: { defaultOpen: false },
  WelcomeUploadConnect: { defaultOpen: false },
  WelcomeGlossaryStep: { candidates: WELCOME_CANDIDATES },
  WelcomeGuideStep: { packs: WELCOME_PACKS },
  WelcomeSyncPanel: { sources: WELCOME_SYNC_ROWS },

  SettingsMembersTable: {
    members: MEMBERS_ROWS, workspaceName: MEMBERS_WORKSPACE, githubTeam: MEMBERS_GITHUB_TEAM,
  },
  SettingsApiKeys: { keys: API_KEYS },
  SettingsAuditLog: { events: AUDIT_EVENTS, total: AUDIT_EVENT_TOTAL },
  SettingsModelsConfig: { ...MODELS_CONFIG },
  BrandingEditor: { ...BRANDING },

  PublishMcpServers: { servers: MCP_SERVERS },
  TagPickerFeature: { docs: TAG_PICKER_DOCS },
  AuthSession: { signedInAs: AUTH_IDENTITY },
  ChatDockFeature: { sessions: CHAT_SESSIONS },
  TokenRevealFeature: { keys: TOKEN_REVEAL_KEYS },
  DocReviewMarkdown: { markdown: MARKDOWN_SOURCE, findings: MARKDOWN_FINDINGS },

  ImpactPanelFeature: { ...FACT_IMPACT, analyzed: true },
  DecisionCardFeature: { decisions: DECISIONS_ROWS },
};
