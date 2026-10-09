import type { ComponentSpec } from "./types";
import { KnowledgeBrowser, KnowledgeInspector } from "../../features";
import { KNOWLEDGE_RESULTS, KNOWLEDGE_DOC } from "../fixtures/features";

/* State matrix for the knowledge group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks. */

const LONG =
  "Quarterly revenue recognition policy for multi-year enterprise payment agreements with usage-based true-ups and a staged regional rollout plan";
const HUGE =
  "Supercalifragilisticexpialidocious_configuration_parameter_value_that_never_wraps_anywhere";

type Kind = "page" | "thread" | "pr";
type Result = {
  id: string; kind: Kind; source: string; title: string; snippet: string;
  author: string; date: string; tags: string[]; status?: string;
  messageCount?: number; participantCount?: number;
};

const RESULTS: Result[] = [
  { id: "r1", kind: "page", source: "notion", title: "Payments incident runbook", snippet: "When the settlement queue backs up, drain it before restarting workers. Escalate to on-call if depth exceeds 10k.", author: "Priya Nair", date: "2026-07-16", tags: ["canonical"], status: "canonical" },
  { id: "r2", kind: "thread", source: "slack", title: "Decision: move webhooks to the new gateway", snippet: "We agreed to cut over webhook delivery to the gateway on the 24th, with a rollback window through EOD.", author: "#eng-platform", date: "2026-07-15", tags: [], status: "verified", messageCount: 22, participantCount: 6 },
  { id: "r3", kind: "pr", source: "github", title: "feat: retry settlement on transient gateway errors", snippet: "Adds exponential backoff for 5xx from the settlement gateway; caps at 5 attempts, emits a metric per retry.", author: "Marcus Vale", date: "2026-07-14", tags: ["needs-review"], status: "needs-review" },
  { id: "r4", kind: "page", source: "docs", title: "Sign-in and session model", snippet: "Sessions are 30-day rolling tokens. Signing in from a new device revokes the oldest session past the cap.", author: "Dana Osei", date: "2026-07-11", tags: ["customer-facing"], status: "verified" },
  { id: "r5", kind: "thread", source: "slack", title: "Decision excerpt: deprecate the v1 export API", snippet: "v1 export is superseded by the streaming endpoint; we'll keep it read-only for one quarter, then remove it.", author: "#product", date: "2026-07-08", tags: [], status: "stale", messageCount: 14, participantCount: 4 },
  { id: "r6", kind: "pr", source: "github", title: "fix: correct freshness rollup for archived sources", snippet: "Archived sources were dragging the fresh-% down; exclude them from the denominator in the rollup job.", author: "Priya Nair", date: "2026-06-30", tags: [], status: "stale" },
  { id: "r7", kind: "page", source: "notion", title: "Evidence policy, how tags drive ranking", snippet: "Canonical outranks verified; needs-review is excluded from evidence entirely until a person clears it.", author: "Dana Osei", date: "2026-07-02", tags: ["canonical"], status: "canonical" },
];

const LONG_RESULTS: Result[] = [
  { id: "L1", kind: "page", source: "notion", title: LONG, snippet: `${LONG}. ${LONG}. The unbreakable key is ${HUGE} and it must not widen the card.`, author: "Aleksandra Konstantinopoulou-Whitfield", date: "2026-07-16", tags: ["canonical"], status: "canonical" },
  { id: "L2", kind: "thread", source: "slack", title: HUGE, snippet: HUGE, author: "#a-channel-with-an-extremely-long-name-that-never-ends", date: "2026-07-15", tags: [], status: "needs-review", messageCount: 1284, participantCount: 96 },
  ...RESULTS,
  ...RESULTS.map((r) => ({ ...r, id: `${r.id}b`, title: `${r.title} (duplicate)` })),
];

const DOC = {
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
};

const SLACK_DOC = {
  ...DOC,
  id: "chunk_44a1",
  title: "Decision: move webhooks to the new gateway",
  source: "slack",
  kind: "Decision excerpt",
  slack: true,
  messageCount: 22,
  tags: [],
};

const EMPTY_DOC = {
  ...DOC,
  id: "doc_empty",
  title: "Untitled draft",
  summary: "",
  tags: [],
  facts: [],
  related: [],
  timeline: [],
  lineage: [],
};

const LONG_DOC = {
  ...DOC,
  id: HUGE,
  title: LONG,
  owner: "Aleksandra Konstantinopoulou-Whitfield",
  summary: `${LONG}. ${LONG}. The unbreakable identifier is ${HUGE}.`,
  tags: ["canonical", "customer-facing", "internal", "needs-review", "draft", "deprecated", "stale", "verified"],
  facts: Array.from({ length: 9 }, (_, i) => ({ text: i % 2 ? `${LONG} (${i + 1})` : `${HUGE}_${i + 1}` })),
  related: Array.from({ length: 8 }, (_, i) => ({ source: ["github", "slack", "docs", "notion"][i % 4], title: i % 2 ? LONG : HUGE })),
  timeline: Array.from({ length: 12 }, (_, i) => ({ at: `Jul ${(i % 28) + 1}, 2026, 4:12 PM`, actor: "Aleksandra Konstantinopoulou-Whitfield", verb: i % 2 ? LONG : HUGE })),
};

/* ── Volume fixtures ─────────────────────────────────────────────────────
   Production-sized knowledge: a corpus search returns hundreds of documents,
   and a well-mined runbook carries dozens of facts, related docs and
   revisions. The browser must page them, not lay 400 cards on the floor. */

const STRESS_RESULTS: Result[] = Array.from({ length: 400 }, (_, i) => {
  const base = RESULTS[i % RESULTS.length];
  return {
    ...base,
    id: `s${i}`,
    title: i % 37 === 0 ? HUGE : i % 11 === 0 ? LONG : `${base.title} (${i + 1})`,
    snippet: i % 13 === 0 ? `${LONG}. ${LONG}.` : base.snippet,
    author: i % 23 === 0 ? "Aleksandra Konstantinopoulou-Whitfield" : base.author,
    date: `2026-0${(i % 7) + 1}-${String((i % 28) + 1).padStart(2, "0")}`,
  };
});

const STRESS_DOC = {
  ...DOC,
  title: "Payments incident runbook, consolidated across every connected source",
  tags: ["canonical", "customer-facing", "internal", "needs-review", "draft", "deprecated", "stale", "verified"],
  facts: Array.from({ length: 120 }, (_, i) => ({
    text: i % 19 === 0 ? `${HUGE}_${i}` : `Fact ${i + 1}: the settlement alarm fires when queue depth exceeds ${(i + 1) * 1000}.`,
  })),
  related: Array.from({ length: 90 }, (_, i) => ({
    source: ["github", "slack", "docs", "notion"][i % 4],
    title: i % 17 === 0 ? HUGE : `Related document ${i + 1}: settlement retry behaviour`,
  })),
  timeline: Array.from({ length: 240 }, (_, i) => ({
    at: `Jul ${(i % 28) + 1}, 2026, 4:12 PM`,
    actor: i % 11 === 0 ? "Aleksandra Konstantinopoulou-Whitfield" : "Priya Nair",
    verb: i % 7 === 0 ? LONG : "verified the runbook",
  })),
};

export const KNOWLEDGE: ComponentSpec[] = [
  {
    id: "KnowledgeBrowser", title: "KnowledgeBrowser", width: 1080,
    states: [
      { id: "default", label: "Default (All tab, first result selected)", node: <KnowledgeBrowser results={KNOWLEDGE_RESULTS} /> },
      { id: "loading", label: "Loading", node: <KnowledgeBrowser results={[]} loading /> },
      { id: "empty", label: "Empty corpus", node: <KnowledgeBrowser results={[]} /> },
      { id: "single", label: "Single result", node: <KnowledgeBrowser results={[RESULTS[1]]} /> },
      { id: "many", label: "Overflow: far too many results", node: <KnowledgeBrowser results={LONG_RESULTS} /> },
      { id: "long", label: "Overflow: long titles + 90-char unbreakable string", node: <KnowledgeBrowser results={LONG_RESULTS.slice(0, 3)} /> },
      /* A 320px frame is the mobile case, and mobile is composed at the page
         level: the page passes `stacked` so the facet rail sits above the feed
         instead of squeezing it (CONVENTIONS.md §10). */
      { id: "narrow", label: "Overflow: narrow 320px frame (stacked, as a page renders it)", width: 320, node: <KnowledgeBrowser stacked results={LONG_RESULTS.slice(0, 3)} /> },
      { id: "stress", label: "Volume: 400-document corpus", node: <KnowledgeBrowser results={STRESS_RESULTS} /> },
    ],
  },
  {
    id: "KnowledgeInspector", title: "KnowledgeInspector", width: 420,
    states: [
      { id: "default", label: "Default (Document tab)", node: <KnowledgeInspector doc={KNOWLEDGE_DOC} /> },
      { id: "loading", label: "Loading", node: <KnowledgeInspector doc={KNOWLEDGE_DOC} loading /> },
      { id: "empty", label: "Empty: no facts, related, or revisions", node: <KnowledgeInspector doc={EMPTY_DOC} /> },
      { id: "slack", label: "Slack decision excerpt (tags suppressed)", node: <KnowledgeInspector doc={SLACK_DOC} /> },
      { id: "long", label: "Overflow: long text, too many chips + unbreakable string", node: <KnowledgeInspector doc={LONG_DOC} /> },
      { id: "narrow", label: "Overflow: narrow 320px frame", width: 320, node: <KnowledgeInspector doc={LONG_DOC} /> },
      { id: "stress", label: "Volume: 120 facts, 90 related docs, 240 revisions", node: <KnowledgeInspector doc={STRESS_DOC} /> },
    ],
  },
];
