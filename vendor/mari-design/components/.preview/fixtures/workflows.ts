/* Workflows canvas fixtures — both tabs.
 *
 * The Observed rows and the approved answers used to be two fixture files for
 * two pages. They are one file because they are one page: an answer here is
 * promoted OUT of an observed run, and the link between them (`trajectoryId`)
 * is only exercisable when both halves are in the same fixture.
 *
 * Nothing here is importable by a consuming app. */

import type { Answer } from "../../features/AnswerCard";
import type { AnswerStat, AnswersData, Harvest, HarvestCandidate, HarvestSource } from "../../features/ApprovedAnswers";
import type {
  ObservedData, TrajectoryRow, WorkflowsData,
} from "../../pages/WorkflowsPage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_SOURCE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER, HUGE_NUMBER_STR, MIXED_SCRIPT, repeat,
} from "./stress";

/* ══════════ Approved answers tab ══════════ */

const STATS: AnswerStat[] = [
  { value: "128", label: "Approved", tone: "ok", sub: "serving verbatim" },
  { value: "6", label: "Drafts", tone: "attention", sub: "awaiting review" },
  { value: "2,410", label: "Served this week", tone: "info", sub: "+12% vs last week" },
];

const COVERAGE: string[] = [
  "How do I rotate my API key?",
  "What's the SLA for enterprise?",
  "Can I export data as CSV?",
  "How do I invite a teammate as read-only?",
];

const APPROVED: Answer = {
  id: 1,
  question: "How long do sessions last before they expire?",
  answer: "Sessions are 30-day rolling tokens: each request within the window extends them. Signing in on a new device revokes the oldest session once you pass the five-device cap, and signing out revokes the current session immediately. Admins can force-revoke every session for a member from the members table.",
  status: "approved",
  owner: "Priya Nair",
  channels: ["slack-bot", "docs-site"],
  sources: [{ source: "docs", title: "Sign-in and session model" }, { source: "notion", title: "Auth overview" }],
  served: 1284,
  spark: [4, 6, 5, 9, 8, 12, 11, 15, 14, 18],
  updated: "2026-07-16",
};

const APPROVED_2: Answer = {
  id: 2,
  question: "What's the SLA for enterprise customers?",
  answer: "Enterprise plans carry a 99.9% monthly uptime SLA with a 1-hour first-response target for Sev1 incidents. Credits are issued automatically when monthly uptime drops below target.",
  status: "approved",
  owner: "Dana Osei",
  channels: ["slack-bot", "support-widget", "docs-site"],
  sources: [{ source: "notion", title: "Enterprise SLA policy" }],
  served: 642,
  spark: [2, 3, 3, 5, 4, 6, 7, 8, 9, 11],
  updated: "2026-07-13",
};

const DRAFT: Answer = {
  id: 3,
  question: "How do webhook retries work now?",
  answer: "Delivery retries use exponential backoff on 5xx responses from the gateway, capped at 5 attempts with a metric emitted per retry.",
  status: "draft",
  owner: "Marcus Vale",
  channels: [],
  sources: [{ source: "github", title: "feat: retry settlement on transient errors" }],
  served: 0,
  spark: [],
  updated: "2026-07-15",
};

const DRAFT_2: Answer = {
  id: 4,
  question: "Is the v1 export API still supported?",
  answer: "v1 export is deprecated in favor of the streaming endpoint. It stays read-only for one quarter, then is removed.",
  status: "draft",
  owner: "Dana Osei",
  channels: [],
  sources: [{ source: "slack", title: "Decision chunk: deprecate the v1 export API" }],
  served: 0,
  spark: [],
  updated: "2026-07-08",
};

const RETIRED: Answer = {
  id: 5,
  question: "How do I export data with the legacy v1 API?",
  answer: "The v1 export API has been removed. Use the streaming export endpoint instead: see the migration guide.",
  status: "retired",
  owner: "Priya Nair",
  channels: [],
  sources: [{ source: "docs", title: "Export migration guide" }],
  served: 0,
  spark: [],
  updated: "2026-06-30",
};

/* ── overflow / stress answers ─────────────────────────────────────────── */

const OVERFLOW_ANSWER: Answer = {
  id: 101,
  question: LONG_TITLE,
  answer: LONG_PARAGRAPH,
  status: "approved",
  owner: LONG_NAME,
  channels: ["slack-bot", "support-widget", "docs-site"],
  sources: [
    { source: "docs", title: LONG_DOC_TITLE },
    { source: "github", title: LONG_SOURCE },
    { source: "notion", title: LONG_TITLE },
  ],
  served: 482913,
  spark: [4, 6, 5, 9, 8, 12, 11, 15, 14, 18],
  updated: "2026-07-16",
};

const OVERFLOW_ANSWER_2: Answer = {
  id: 102,
  question: "What is the full end-to-end escalation, paging, and post-incident-review procedure for a Sev-1 during a multi-region outage?",
  answer: LONG_PARAGRAPH,
  status: "draft",
  owner: LONG_NAME,
  channels: [],
  sources: [{ source: "slack", title: LONG_TITLE }],
  served: 0,
  spark: [],
  updated: "2026-07-08",
};

const STRESS_ANSWER: Answer = {
  id: 111,
  question: UNBREAKABLE,
  answer: `${UNBREAKABLE} ${MIXED_SCRIPT} ${LONG_URL}`,
  status: "approved",
  owner: LONG_WORD,
  channels: ["slack-bot", "support-widget", "docs-site"],
  sources: [
    { source: "slack", title: LONG_URL },
    { source: "github", title: UNBREAKABLE },
    { source: "docs", title: MIXED_SCRIPT },
  ],
  served: HUGE_NUMBER,
  spark: repeat((i) => (i % 5) + 1, 24),
  updated: HUGE_NUMBER_STR,
};

const STRESS_ANSWER_2: Answer = {
  id: 112,
  question: `${MIXED_SCRIPT} ${LONG_WORD}`,
  answer: LONG_URL,
  status: "draft",
  owner: MIXED_SCRIPT,
  channels: [],
  sources: [{ source: "notion", title: LONG_WORD }],
  served: 0,
  spark: [],
  updated: "2026-07-01",
};

/* ── harvest wizard ────────────────────────────────────────────────────── */

/* The sources this workspace can harvest from. This list used to be a
   constant inside AnswersPage, which meant every workspace was offered the
   same three places whether or not it had them connected. It is data now, and
   the page draws no "Harvest questions" button without it — so a fixture that
   omits it cannot review the wizard at all. */
const HARVEST_SOURCES: HarvestSource[] = [
  { key: "slack", label: "Slack", desc: "Threads and decision chunks across connected channels.", on: true },
  { key: "docs", label: "Docs & repos", desc: "Google Docs, Notion pages, and GitHub READMEs.", on: true },
  { key: "history", label: "Ask-Mari history", desc: "Questions people already asked the assistant.", on: false },
];

const CANDIDATES: HarvestCandidate[] = [
  { question: "How long do sessions last before they expire?", draft: "Sessions are 30-day rolling tokens. Signing in on a new device revokes the oldest session once you pass the device cap.", source: "Google Docs", confidence: 88 },
  { question: "What happens when the settlement queue backs up?", draft: "Drain the queue before restarting workers, and escalate to #payments-oncall if depth exceeds 10,000.", source: "Notion", confidence: 79 },
  { question: "Is the v1 export API still supported?", draft: "v1 export is deprecated in favor of the streaming endpoint. It stays read-only for one quarter, then is removed.", source: "Slack", confidence: 62 },
];

const harvest = (phase: Harvest["phase"]): Harvest => ({
  phase,
  sources: HARVEST_SOURCES,
  scanning: "Scanning slack, docs…",
  candidates: CANDIDATES,
});

/* ── states ─────────────────────────────────────────────────────────────── */

/** One list view: the stat strip, the coverage rail, and a set of answers. */
const list = (answers: Answer[], filter: AnswersData["filter"] = "all"): AnswersData => ({
  stats: STATS,
  filter,
  answers,
  coverage: COVERAGE,
  harvestSources: HARVEST_SOURCES,
  pane: { kind: "answers" },
});

const DEFAULT = list([APPROVED, DRAFT, APPROVED_2]);

/** Nothing curated at all: no answers and no coverage gaps, so the page's own
    `isEmpty` check fires rather than the canvas faking the empty state. No
    harvest sources either: a workspace with nothing connected has nothing to
    scan, and the page draws no button for it. */
const ANSWERS_EMPTY: AnswersData = {
  stats: STATS, filter: "all", answers: [], coverage: [],
  harvestSources: [], pane: { kind: "answers" },
};

/* ══════════ Observed tab ══════════ */

const STEPS: TrajectoryRow["steps"] = [
  { ordinal: 0, tool: "search", actionFamily: "discover", args: { query: "retention policy" }, summary: "3 documents matched", ok: true, disposition: "preferred", editedArgs: null },
  { ordinal: 1, tool: "read_document", actionFamily: "inspect", args: { id: 1 }, summary: "Read the retention runbook", ok: true, disposition: "included", editedArgs: null },
  { ordinal: 2, tool: "list_sources", actionFamily: "inspect", args: {}, summary: "Timed out after 30s", ok: false, disposition: "excluded", editedArgs: null },
  { ordinal: 3, tool: "tag_document", actionFamily: "change", args: { id: 1, tag: "canonical" }, summary: "Tagged the runbook canonical", ok: true, disposition: "included", editedArgs: null },
];

const EVIDENCE: TrajectoryRow["evidence"] = [
  { documentId: 1, title: "Retention runbook", reason: "Used as answer context", rank: 1, relevance: "pinned", note: "The only place the 30-day window is written down." },
  { documentId: 2, title: "Data lifecycle overview", reason: "Used as answer context", rank: 2, relevance: "observed", note: "" },
];

const PHASES: TrajectoryRow["phases"] = [
  { id: 0, name: "Discover", family: "discover", start: 0, end: 0, steps: 1, substate: "Progress", failures: 0 },
  { id: 1, name: "Inspect", family: "inspect", start: 1, end: 2, steps: 2, substate: "Recovery", failures: 1 },
  { id: 2, name: "Change", family: "change", start: 3, end: 3, steps: 1, substate: "Progress", failures: 0 },
];

const RUN: TrajectoryRow = {
  id: 1,
  sessionId: 10,
  prompt: "How long do we keep customer data, and where is that written down?",
  status: "ready",
  model: "ollama:gemma3:4b",
  layer1: "Searched the knowledge base for the retention policy, read the runbook it found, tried to list connected sources and gave up when that timed out, then tagged the runbook canonical.",
  layer2: "Answered a retention question from the runbook and marked it canonical.",
  category: "Documentation maintenance",
  macroIntent: "Answer a retention question from the runbook",
  phases: PHASES,
  stepCount: 4,
  failureCount: 1,
  reworkCount: 1,
  startedAt: "2026-08-19T12:00:00Z",
  completedAt: "2026-08-19T12:00:14Z",
  steps: STEPS,
  evidence: EVIDENCE,
  promotedWorkflowId: null,
  promotedWorkflow: null,
  disposition: "observed",
};

const CLEAN_RUN: TrajectoryRow = {
  ...RUN,
  id: 2,
  prompt: "Which regions can we run enterprise workloads in?",
  macroIntent: "Confirm the supported enterprise regions",
  layer2: "Read the region list and answered without changing anything.",
  category: "Product questions",
  stepCount: 2, failureCount: 0, reworkCount: 0,
  steps: STEPS.slice(0, 2),
  evidence: EVIDENCE.slice(1),
  phases: PHASES.slice(0, 2),
  startedAt: "2026-08-18T09:12:00Z",
  completedAt: "2026-08-18T09:12:06Z",
};

/** The state the whole promotion story exists for: a run that has produced a
    paused workflow AND a draft answer, both shown on the card itself. */
const PROMOTED_RUN: TrajectoryRow = {
  ...RUN,
  id: 3,
  promotedWorkflowId: 44,
  promotedWorkflow: { id: 44, name: "Answer a retention question", status: "paused", nodeCount: 4 },
};

const REJECTED_RUN: TrajectoryRow = { ...CLEAN_RUN, id: 4, disposition: "rejected" };

const PROMOTED_ANSWER: Answer = {
  id: 6,
  question: "How long do we keep customer data, and where is that written down?",
  answer: "Customer data is kept for 30 days after deletion is requested, then purged on the nightly job. The retention runbook is the source of truth.",
  status: "draft",
  owner: "Priya Nair",
  channels: [],
  sources: [{ source: "docs", title: "Retention runbook" }],
  served: 0,
  spark: [],
  updated: "2026-08-19",
  trajectoryId: 3,
  recheckAfter: "2026-11-17",
};

const observed = (rows: TrajectoryRow[], over: Partial<ObservedData> = {}): ObservedData => ({
  rows,
  total: rows.length,
  categories: ["Documentation maintenance", "Product questions"],
  statuses: ["ready", "processing", "fallback"],
  category: null,
  status: null,
  failures: null,
  search: "",
  offset: 0,
  limit: 25,
  focused: null,
  ...over,
});

const NO_RUNS = observed([], { categories: [], statuses: [] });

const page = (over: Partial<WorkflowsData> = {}): WorkflowsData => ({
  tab: "observed",
  observed: observed([RUN, CLEAN_RUN]),
  answers: DEFAULT,
  ...over,
});

const PROMOTED_PAGE = page({
  observed: observed([PROMOTED_RUN, RUN]),
  answers: list([PROMOTED_ANSWER, APPROVED, DRAFT]),
});

const STRESS_RUNS = Array.from({ length: 25 }, (_, index) => ({
  ...RUN,
  id: index + 10,
  macroIntent: index % 3 === 0 ? LONG_TITLE : `${RUN.macroIntent} ${index + 1}`,
  prompt: index % 3 === 0 ? UNBREAKABLE : RUN.prompt,
}));

export const FIXTURES: PageFixtures<WorkflowsData> = {
  default: { data: page() },
  drawer: { data: page({ observed: observed([RUN, CLEAN_RUN], { focused: RUN }) }) },
  promoted: { data: PROMOTED_PAGE },
  rejected: { data: page({ observed: observed([REJECTED_RUN, RUN]) }) },
  /** Narrowed by the reader, and nothing matches: a different fact from a
      workspace that has observed nothing, and a different empty state. */
  filtered: {
    data: page({ observed: observed([], { search: "settlement queue", failures: "with", total: 0 }) }),
  },
  answers: { data: page({ tab: "answers", answers: DEFAULT }) },
  "answers-drafts": { data: page({ tab: "answers", answers: list([DRAFT, DRAFT_2], "drafts") }) },
  "answers-harvest": {
    data: page({ tab: "answers", answers: { ...DEFAULT, pane: { kind: "harvest", harvest: harvest("review") } } }),
  },
  loading: { data: page({ observed: NO_RUNS, answers: ANSWERS_EMPTY }), loading: true },
  error: {
    data: page({ observed: NO_RUNS, answers: ANSWERS_EMPTY }),
    error: "Workflows are temporarily unavailable.",
  },
  empty: { data: page({ observed: NO_RUNS, answers: ANSWERS_EMPTY }) },
  stress: {
    data: page({
      observed: observed(STRESS_RUNS, { total: 5000 }),
      answers: list([STRESS_ANSWER, STRESS_ANSWER_2, OVERFLOW_ANSWER, OVERFLOW_ANSWER_2]),
    }),
  },
};

/* The answers half, for `features.ts` — the AnswerCard catalog entry reads a
   real answer from here rather than baking its own. */
export const ANSWERS_FIXTURE = DEFAULT;
