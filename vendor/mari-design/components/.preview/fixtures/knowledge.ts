/* Knowledge canvas fixtures. Lifted verbatim out of KnowledgePage and the two
   Knowledge features, which now take required data props and ship no demo
   content of their own. Nothing here is importable by a consuming app. */

import type { KnowledgeResult } from "../../features/KnowledgeBrowser";
import type { KnowledgeDoc } from "../../features/KnowledgeInspector";
import type { KnowledgeData } from "../../pages/KnowledgePage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_SOURCE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER, HUGE_NUMBER_STR, MIXED_SCRIPT, MANY_TAGS,
} from "./stress";

const RESULTS: KnowledgeResult[] = [
  { id: "r1", kind: "page", source: "notion", title: "Payments incident runbook", snippet: "When the settlement queue backs up, drain it before restarting workers. Escalate to on-call if depth exceeds 10k.", author: "Priya Nair", date: "2026-07-16", tags: ["canonical"], status: "canonical" },
  { id: "r2", kind: "thread", source: "slack", title: "Decision: move webhooks to the new gateway", snippet: "We agreed to cut over webhook delivery to the gateway on the 24th, with a rollback window through EOD.", author: "#eng-platform", date: "2026-07-15", tags: [], status: "verified", messageCount: 22, participantCount: 6 },
  { id: "r3", kind: "pr", source: "github", title: "feat: retry settlement on transient gateway errors", snippet: "Adds exponential backoff for 5xx from the settlement gateway; caps at 5 attempts, emits a metric per retry.", author: "Marcus Vale", date: "2026-07-14", tags: ["needs-review"], status: "needs-review" },
  { id: "r4", kind: "page", source: "docs", title: "Sign-in and session model", snippet: "Sessions are 30-day rolling tokens. Signing in from a new device revokes the oldest session past the cap.", author: "Dana Osei", date: "2026-07-11", tags: ["customer-facing"], status: "verified" },
  { id: "r5", kind: "thread", source: "slack", title: "Decision chunk: deprecate the v1 export API", snippet: "v1 export is superseded by the streaming endpoint; we'll keep it read-only for one quarter, then remove it.", author: "#product", date: "2026-07-08", tags: [], status: "stale", messageCount: 14, participantCount: 4 },
  { id: "r6", kind: "pr", source: "github", title: "fix: correct freshness rollup for archived sources", snippet: "Archived sources were dragging the fresh-% down; exclude them from the denominator in the rollup job.", author: "Priya Nair", date: "2026-06-30", tags: [], status: "stale" },
  { id: "r7", kind: "page", source: "notion", title: "Evidence policy: how tags drive ranking", snippet: "Canonical outranks verified; needs-review is excluded from evidence entirely until a person clears it.", author: "Dana Osei", date: "2026-07-02", tags: ["canonical"], status: "canonical" },
];

const MANY: KnowledgeResult[] = [
  ...RESULTS,
  { id: "r8", kind: "page", source: "docs", title: "Billing proration runbook", snippet: "Mid-cycle plan changes prorate to the day; downgrades credit the difference to the next invoice.", author: "Maya M.", date: "2026-06-24", tags: ["verified"], status: "verified" },
  { id: "r9", kind: "thread", source: "slack", title: "Decision chunk: SSO enforcement rollout", snippet: "Enforce SSO org-wide after the 30-day grace period; break-glass local logins stay for two named admins.", author: "#security", date: "2026-06-20", tags: [], status: "canonical", messageCount: 31, participantCount: 9 },
  { id: "r10", kind: "pr", source: "github", title: "chore: bump ingestion workers to 8 replicas", snippet: "Scale ingestion horizontally ahead of the Notion backfill; adds an HPA target at 70% CPU.", author: "Marcus Vale", date: "2026-06-18", tags: [], status: "verified" },
  { id: "r11", kind: "page", source: "notion", title: "On-call escalation ladder", snippet: "Primary → secondary after 10 minutes unacked; incident commander paged at Sev1 automatically.", author: "Sam Ortiz", date: "2026-06-15", tags: ["needs-review"], status: "needs-review" },
  { id: "r12", kind: "thread", source: "slack", title: "Decision chunk: freeze schema changes for GA", snippet: "No breaking schema changes in the two weeks before GA; additive columns only, behind flags.", author: "#eng-platform", date: "2026-06-11", tags: [], status: "verified", messageCount: 18, participantCount: 7 },
  { id: "r13", kind: "pr", source: "github", title: "feat: add JWKS rotation health check", snippet: "Fails the readiness probe if the JWKS endpoint hasn't rotated inside the expected window.", author: "Aki Kim", date: "2026-06-09", tags: [], status: "stale" },
];

/** The document the inspector opens with: lifted out of KnowledgeInspector. */
const DOC: KnowledgeDoc = {
  id: "doc_8f21",
  title: "Payments incident runbook",
  source: "notion",
  kind: "Page",
  owner: "Priya Nair",
  updated: "2026-07-16",
  summary: "The canonical procedure for payment-processing incidents: how to detect a stalled settlement queue, drain it safely, restart workers, and escalate to on-call when depth exceeds the alarm threshold.",
  tags: ["canonical", "customer-facing"],
  facts: [
    { text: "Settlement alarm fires when queue depth exceeds 10,000." },
    { text: "Workers must be drained before restart to avoid duplicate captures." },
    { text: "On-call escalation target is the #payments-oncall rotation." },
    { text: "Rollback window is the end of the business day of the change." },
  ],
  related: [
    { source: "github", title: "feat: retry settlement on transient errors" },
    { source: "slack", title: "Decision: move webhooks to the gateway" },
    { source: "docs", title: "Sign-in and session model" },
  ],
  timeline: [
    { at: "Jul 16, 2026, 4:12 PM", actor: "Priya Nair", verb: "verified the runbook" },
    { at: "Jul 11, 2026, 9:38 AM", actor: "Marcus Vale", verb: "added the rollback window" },
    { at: "Jun 28, 2026, 2:05 PM", actor: "Dana Osei", verb: "created the page" },
    { at: "Jun 20, 2026, 11:02 AM", actor: "Priya Nair", verb: "linked the settlement dashboard" },
    { at: "Jun 14, 2026, 3:47 PM", actor: "Marcus Vale", verb: "split the escalation section" },
    { at: "Jun 02, 2026, 8:15 AM", actor: "Dana Osei", verb: "imported the page from Notion" },
  ],
  lineage: [
    { rel: "derived", dir: "in", title: "Settlement queue postmortem", source: "docs" },
    { rel: "references", dir: "out", title: "feat: retry settlement on transient errors", source: "github" },
    { rel: "discussed", dir: "out", title: "#payments-oncall escalation thread", source: "slack" },
  ],
};

/** A Slack thread-chunk: the inspector's second shape (tags suppressed). */
const SLACK_DOC: KnowledgeDoc = {
  id: "chunk_2f9a",
  title: "Decision: move webhooks to the new gateway",
  source: "slack",
  kind: "Thread chunk",
  owner: "#eng-platform",
  updated: "2026-07-15",
  slack: true,
  messageCount: 22,
  summary: "A thread-sized decision chunk: the team agreed to cut webhook delivery over to the new gateway on the 24th, keeping a rollback window through end of day. Ownership stays with #eng-platform.",
  tags: [],
  facts: [
    { text: "Cutover date is the 24th, with a same-day rollback window." },
    { text: "Delivery retries use exponential backoff capped at 5 attempts." },
  ],
  related: [
    { source: "github", title: "feat: retry settlement on transient errors" },
    { source: "notion", title: "Payments incident runbook" },
  ],
  timeline: [
    { at: "Jul 15, 2026, 3:20 PM", actor: "Marcus Vale", verb: "summarized the decision" },
    { at: "Jul 15, 2026, 2:58 PM", actor: "Priya Nair", verb: "raised the rollback window" },
  ],
};

/* ── overflow / stress corpora ─────────────────────────────────────────── */

const OVERFLOW_RESULTS: KnowledgeResult[] = [
  { id: "o1", kind: "page", source: "notion", title: LONG_TITLE, snippet: LONG_PARAGRAPH, author: LONG_NAME, date: "2026-07-16", tags: MANY_TAGS.slice(0, 8), status: "canonical" },
  { id: "o2", kind: "pr", source: "github", title: LONG_DOC_TITLE, snippet: LONG_PARAGRAPH, author: LONG_NAME, date: "2026-07-14", tags: MANY_TAGS.slice(0, 5), status: "needs-review" },
  { id: "o3", kind: "thread", source: "slack", title: LONG_TITLE, snippet: LONG_PARAGRAPH, author: "#platform-reliability-and-incident-response-coordination", date: "2026-07-12", tags: [], status: "verified", messageCount: 1284, participantCount: 96 },
  { id: "o4", kind: "page", source: "docs", title: LONG_DOC_TITLE, snippet: LONG_PARAGRAPH, author: "Dana Osei", date: "2026-07-11", tags: MANY_TAGS.slice(0, 6), status: "verified" },
];

const STRESS_RESULTS: KnowledgeResult[] = [
  { id: "s1", kind: "page", source: "notion", title: UNBREAKABLE, snippet: `${MIXED_SCRIPT} ${LONG_URL}`, author: LONG_WORD, date: "2026-07-16", tags: MANY_TAGS, status: "canonical" },
  { id: "s2", kind: "pr", source: "github", title: LONG_WORD, snippet: UNBREAKABLE, author: LONG_NAME, date: "2026-07-15", tags: MANY_TAGS, status: "needs-review" },
  { id: "s3", kind: "thread", source: "slack", title: `${MIXED_SCRIPT} ${UNBREAKABLE}`, snippet: LONG_URL, author: `#${LONG_WORD}`, date: "2026-07-14", tags: [], status: "verified", messageCount: HUGE_NUMBER, participantCount: HUGE_NUMBER },
  { id: "s4", kind: "page", source: "docs", title: LONG_URL, snippet: `${UNBREAKABLE} ${MIXED_SCRIPT} ${HUGE_NUMBER_STR}`, author: MIXED_SCRIPT, date: "2026-07-13", tags: MANY_TAGS, status: "stale" },
];

const OVERFLOW_DOC: KnowledgeDoc = {
  id: "doc_overflow_consolidated_reliability_runbook_revision",
  title: LONG_TITLE,
  source: "notion",
  kind: "Page",
  owner: LONG_NAME,
  updated: "2026-07-16",
  summary: LONG_PARAGRAPH,
  tags: MANY_TAGS.slice(0, 8),
  facts: [
    { text: LONG_PARAGRAPH },
    { text: "Escalation to the on-call incident commander happens automatically at Sev-1, and the paging policy re-pages the secondary responder after ten minutes without an acknowledgement from the primary." },
  ],
  related: [
    { source: "github", title: LONG_DOC_TITLE },
    { source: "docs", title: LONG_TITLE },
    { source: "slack", title: LONG_SOURCE },
  ],
  timeline: [
    /* Years are not optional here. "Jul 16, 4:12 PM" is a display string, and
       Date.parse reads its "4" as the YEAR, so the inspector rendered a 2026
       revision as "Jul 16, 2001" beside a document updated Jul 16, 2026. This
       fixture stresses long strings, not date parsing. */
    { at: "Jul 16, 2026, 4:12 PM", actor: LONG_NAME, verb: "verified the consolidated runbook after reconciling it against four quarters of incident retrospectives" },
    { at: "Jul 11, 2026, 9:38 AM", actor: LONG_NAME, verb: "added the end-of-business-day rollback window" },
  ],
};

const STRESS_DOC: KnowledgeDoc = {
  id: UNBREAKABLE,
  title: `${UNBREAKABLE} ${MIXED_SCRIPT}`,
  source: "docs",
  kind: LONG_WORD,
  owner: LONG_WORD,
  updated: HUGE_NUMBER_STR,
  summary: `${UNBREAKABLE} ${MIXED_SCRIPT} ${LONG_URL}`,
  tags: MANY_TAGS,
  facts: [
    { text: UNBREAKABLE },
    { text: `${MIXED_SCRIPT}, ${LONG_URL}` },
    { text: LONG_WORD },
  ],
  related: [
    { source: "github", title: LONG_URL },
    { source: "slack", title: UNBREAKABLE },
  ],
  timeline: [
    { at: HUGE_NUMBER_STR, actor: LONG_WORD, verb: MIXED_SCRIPT },
  ],
};

/* ── states ─────────────────────────────────────────────────────────────── */

const DEFAULT: KnowledgeData = { results: RESULTS, doc: DOC };

/** Nothing indexed, nothing selected: the page's own `isEmpty` fires. */
const EMPTY: KnowledgeData = { results: [], doc: null };

export const FIXTURES: PageFixtures<KnowledgeData> = {
  default: { data: DEFAULT },
  documents: { data: { results: RESULTS.filter((r) => r.kind === "page"), doc: DOC } },
  conversations: { data: { results: RESULTS.filter((r) => r.kind === "thread"), doc: SLACK_DOC } },
  pages: { data: { results: RESULTS.filter((r) => r.source === "docs" || r.source === "notion"), doc: DOC } },
  "pull-requests": { data: { results: RESULTS.filter((r) => r.kind === "pr"), doc: DOC } },
  "single-result": { data: { results: RESULTS.slice(0, 1), doc: DOC } },
  /* `total` is the corpus-wide count behind one page of hits, which is what
     turns the browser's footer into "13 of 248" and arms Show more. Absent,
     `results` IS the answer — which is what every other state here says.
     (`query` is only read when an app supplies `setQuery`; the canvas has no
     handlers, so the browser owns its own search box.) */
  "many-results": { data: { results: MANY, doc: DOC, total: 248 } },
  "inspector-slack": { data: { results: RESULTS, doc: SLACK_DOC } },
  "no-selection": { data: { results: RESULTS, doc: null } },
  loading: { data: DEFAULT, loading: true },
  error: { data: EMPTY, error: "Search is unavailable. Retrying…" },
  empty: { data: EMPTY },
  overflow: { data: { results: OVERFLOW_RESULTS, doc: OVERFLOW_DOC } },
  stress: { data: { results: STRESS_RESULTS, doc: STRESS_DOC } },
};
