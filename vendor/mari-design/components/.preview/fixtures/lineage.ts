/* Lineage canvas fixtures. The demo graph that used to live in
   `features/LineageDataModel.tsx` as DEMO_NODES / DEMO_EDGES / DEMO_DATES /
   DEMO_ACTIVITY, plus the payloads the four drawers used to bake in. The data
   model keeps its types and pure helpers; only the datasets moved here.

   `LNode` / `LEdge` are plain JSON: no React elements anywhere, because
   mari-cloud serves this graph from a real query. Nothing here is importable
   by a consuming app. */

import {
  eventDates, type DocHistoryRow, type GraphView, type ImpactResult, type LEdge, type LNode,
} from "../../features/LineageDataModel";
import type { LineageCrumb, LineageData, LineageDrawer, LineageExtras } from "../../pages/LineagePage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_NAME, LONG_WORD, UNBREAKABLE, MIXED_SCRIPT, LONG_SOURCE,
  HUGE_NUMBER, HUGE_NUMBER_STR, HUGE_PERCENT, MANY_TAGS, MANY_INITIALS, LONG_BREADCRUMB,
} from "./stress";

/* ── the demo graph ───────────────────────────────────────────────────────── */

const NODES: LNode[] = [
  { id: "n1", docId: 101, source: "docs", title: "Pricing policy", meta: "Decision · owner Ana K · 4d ago", icon: "doc", docKind: "decision", group: "", x: 0.06, y: 0.5, date: "2026-07-17", createdDate: "2026-03-02", owner: "Ana K", staleDays: 4, tags: ["customer-facing"], inbound: 6, outbound: 3 },
  { id: "n2", docId: 102, source: "docs", title: "Free-tier limits", meta: "Page · owner Ana K · 9d ago", icon: "doc", docKind: "page", group: "", x: 0.24, y: 0.26, date: "2026-07-12", createdDate: "2026-04-10", owner: "Ana K", staleDays: 9, tags: ["customer-facing"], inbound: 4, outbound: 2 },
  { id: "n3", docId: 103, source: "docsite", title: "Billing FAQ", meta: "Page · owner Sam L · 52d ago", icon: "book", docKind: "page", group: "", x: 0.24, y: 0.74, date: "2026-05-30", createdDate: "2026-01-14", owner: "Sam L", staleDays: 52, warn: true, tags: ["customer-facing"], inbound: 3, outbound: 1 },
  { id: "n4", docId: 104, source: "github", title: "PR #482 · billing revamp", meta: "PR · merged · 2d ago", icon: "github", docKind: "pr", group: "gh:MariHQ/web:prs", x: 0.45, y: 0.16, date: "2026-07-19", createdDate: "2026-07-10", owner: "Dev R", staleDays: 2, inbound: 2, outbound: 4 },
  { id: "n5", docId: 105, source: "slack", title: "#pricing thread", meta: "Answer · owner Mia M · 15d ago", icon: "slack", docKind: "answer", group: "", x: 0.45, y: 0.5, date: "2026-07-06", createdDate: "2026-06-28", owner: "Mia M", staleDays: 15, inbound: 5, outbound: 2 },
  { id: "n6", docId: 106, source: "notion", title: "Onboarding guide", meta: "Page · owner Jo S · 33d ago", icon: "notion", docKind: "page", group: "", x: 0.45, y: 0.84, date: "2026-06-18", createdDate: "2026-02-20", owner: "Jo S", staleDays: 33, inbound: 2, outbound: 1 },
  { id: "n7", docId: 107, source: "github", title: "Issue #91 · stale FAQ", meta: "Issue · open · 61d ago", icon: "github", docKind: "issue", group: "gh:MariHQ/web:issues", x: 0.66, y: 0.28, date: "2026-05-21", createdDate: "2026-05-10", owner: "Sam L", staleDays: 61, warn: true, inbound: 1, outbound: 1 },
  { id: "n8", docId: 108, source: "gdocs", title: "Pricing deck Q3", meta: "Page · owner Mia M · 21d ago", icon: "gdocs", docKind: "page", group: "", x: 0.66, y: 0.62, date: "2026-06-30", createdDate: "2026-06-01", owner: "Mia M", staleDays: 21, inbound: 3, outbound: 2 },
  { id: "n9", docId: 109, source: "granola", title: "Sept launch brief", meta: "Decision · owner Ana K · 1d ago", icon: "granola", docKind: "decision", group: "", x: 0.88, y: 0.46, date: "2026-07-20", createdDate: "2026-07-15", owner: "Ana K", staleDays: 1, inbound: 1, outbound: 0 },
  { id: "grp:gh:MariHQ/web:commits", macro: true, count: 42, repo: "MariHQ/web", source: "github", title: "42 commits", meta: "MariHQ/web", icon: "github", docKind: "commit", group: "gh:MariHQ/web:commits", x: 0.66, y: 0.92, inbound: 0, outbound: 8 },
];

const EDGES: LEdge[] = [
  { id: "e1", from: "n1", to: "n2", rel: "derived", date: "2026-07-12", meta: { note: "Free-tier section derives from the pricing decision." } },
  { id: "e2", from: "n1", to: "n3", rel: "derived", date: "2026-05-30" },
  { id: "e3", from: "n2", to: "n4", rel: "references", date: "2026-07-19", meta: { evidence: "MariHQ/web#482", status: "confirmed" } },
  { id: "e4", from: "n2", to: "n5", rel: "discussed", date: "2026-07-06", meta: { note: "Thread debating the new free-tier cap." } },
  { id: "e5", from: "n3", to: "n7", rel: "contradicts", date: "2026-05-21", dashed: true, meta: { note: "FAQ still quotes the old $0 tier." } },
  { id: "e6", from: "n5", to: "n8", rel: "discussed", date: "2026-06-30" },
  { id: "e7", from: "n4", to: "n7", rel: "references", date: "2026-07-15", meta: { evidence: "closes #91" } },
  { id: "e8", from: "n8", to: "n9", rel: "references", date: "2026-07-20" },
  { id: "e9", from: "n6", to: "n5", rel: "references", date: "2026-06-18" },
  { id: "e10", from: "n2", to: "n6", rel: "references", date: "2026-06-18" },
  { id: "e11", from: "n8", to: "n3", rel: "translates", date: "2026-06-10", dashed: true, llm: true, meta: { derived: "llm" } },
  { id: "ge:grp:gh:MariHQ/web:commits→n8:references", from: "grp:gh:MariHQ/web:commits", to: "n8", rel: "references", count: 42 },
];

/** Snap targets, derived from the graph rather than authored beside it. */
const DATES = eventDates(NODES, EDGES);

const ACTIVITY = [
  { date: "2026-01-14", count: 1 }, { date: "2026-02-20", count: 1 }, { date: "2026-03-02", count: 2 },
  { date: "2026-04-10", count: 3 }, { date: "2026-05-21", count: 2 }, { date: "2026-05-30", count: 4 },
  { date: "2026-06-18", count: 5 }, { date: "2026-06-30", count: 6 }, { date: "2026-07-06", count: 4 },
  { date: "2026-07-12", count: 7 }, { date: "2026-07-17", count: 5 }, { date: "2026-07-19", count: 8 },
  { date: "2026-07-20", count: 6 },
];

/* ── drawer payloads ──────────────────────────────────────────────────────── */

const NODE_HISTORY: DocHistoryRow[] = [
  { at: "2026-07-19", actor: "Dev R", verb: "merged", detail: "PR #482 into main" },
  { at: "2026-07-15", actor: "Mari", verb: "linked", detail: "closes issue #91" },
  { at: "2026-07-11", actor: "Ana K", verb: "reviewed", detail: "approved billing changes" },
  { at: "2026-07-10", actor: "Dev R", verb: "opened", detail: "PR #482 · billing revamp" },
];

const GROUP_MEMBERS: LNode[] = [
  { id: "c1", source: "github", title: "fix: enforce free-tier cap per workspace", meta: "commit", icon: "github", docKind: "commit", group: "gh:MariHQ/web:commits", x: 0, y: 0, owner: "Dev R", date: "2026-07-19", inbound: 4 },
  { id: "c2", source: "github", title: "refactor billing plan resolver", meta: "commit", icon: "github", docKind: "commit", group: "gh:MariHQ/web:commits", x: 0, y: 0, owner: "Dev R", date: "2026-07-18", inbound: 3 },
  { id: "c3", source: "github", title: "add Q3 pricing constants", meta: "commit", icon: "github", docKind: "commit", group: "gh:MariHQ/web:commits", x: 0, y: 0, owner: "Mia M", date: "2026-07-16", inbound: 2 },
  { id: "c4", source: "github", title: "docs: sync FAQ with new tiers", meta: "commit", icon: "github", docKind: "commit", group: "gh:MariHQ/web:commits", x: 0, y: 0, owner: "Sam L", date: "2026-07-14", inbound: 2 },
  { id: "c5", source: "github", title: "test: billing edge cases", meta: "commit", icon: "github", docKind: "commit", group: "gh:MariHQ/web:commits", x: 0, y: 0, owner: "Dev R", date: "2026-07-12", inbound: 1 },
  { id: "c6", source: "github", title: "chore: bump stripe sdk", meta: "commit", icon: "github", docKind: "commit", group: "gh:MariHQ/web:commits", x: 0, y: 0, owner: "Jo S", date: "2026-07-09", inbound: 0 },
];

const IMPACT: ImpactResult = {
  claim: "Free tier ends September 1",
  summary: "36 documents reference the free tier. 3 directly contradict the new end date and must be corrected before launch; 11 need a review pass; 22 mention it in passing.",
  /* `docId` is what ties a verdict to a card: the analysis names documents and
     the canvas draws nodes, and the page lights the graph by matching these
     against the graph's own document ids. */
  docs: [
    { title: "Billing FAQ", docId: 103, source: "docsite", severity: "update-required", reason: "states the free tier is permanent" },
    { title: "Pricing policy", docId: 101, source: "docs", severity: "update-required", reason: "no sunset date recorded" },
    { title: "Onboarding guide", docId: 106, source: "notion", severity: "update-required", reason: "promises free-forever workspace" },
    { title: "Pricing deck Q3", docId: 108, source: "gdocs", severity: "review", reason: "tier table predates the change" },
    { title: "#pricing thread", docId: 105, source: "slack", severity: "review", reason: "unresolved customer question" },
    { title: "Free-tier limits", docId: 102, source: "docs", severity: "review", reason: "caps may need restating" },
    { title: "Sept launch brief", docId: 109, source: "granola", severity: "minor", reason: "mentions the date in passing" },
    { title: "Issue #91 · stale FAQ", docId: 107, source: "github", severity: "minor", reason: "loosely related" },
  ],
};

const IMPACT_OWNERS = [
  { name: "Ana K", role: "3 documents" },
  { name: "Sam L", role: "2 documents" },
  { name: "Mia M", role: "2 documents" },
  { name: "Dev R", role: "1 document" },
];

const IMPACT_PEOPLE = ["AK", "SL", "MM", "DR", "JS"];

/** Saved views, as the toolbar's Views menu reads them back. `state` is JSON
    the server round-trips verbatim, so these are written in exactly the shape
    `parseViewState` accepts — one deliberately unreadable row included,
    because the menu has to report a view it cannot apply rather than half-
    applying it. */
const VIEWS: GraphView[] = [
  { id: 1, name: "Customer-facing only", state: JSON.stringify({ sources: ["docs", "docsite"], status: "all", lens: "source", layout: "flow", scope: "all", zoom: 1, query: "" }) },
  { id: 2, name: "Warnings, timeline", state: JSON.stringify({ status: "warnings", lens: "health", layout: "timeline", scope: "all", zoom: 0.8, query: "" }) },
  { id: 3, name: "Pricing closure", state: JSON.stringify({ query: "pricing", scope: "focus", lens: "owner", layout: "flow", zoom: 1.2 }) },
  { id: 4, name: "Unreadable view", state: "{not json" },
];

const DRAWERS: Record<string, LineageDrawer> = {
  node: { kind: "node", nodeId: "n4", history: NODE_HISTORY },
  edge: { kind: "edge", edgeId: "e3" },
  group: { kind: "group", groupId: "gh:MariHQ/web:commits", totalMembers: 42, members: GROUP_MEMBERS },
  assert: {
    kind: "assert", result: IMPACT, analyzed: true,
    claim: "Free tier ends September 1", owners: IMPACT_OWNERS, people: IMPACT_PEOPLE,
  },
  /* What the toolbar's "Assert impact" actually opens: nothing analyzed, no
     counts, no owners. The populated state above is the same drawer after a
     run, and it is the only one that lights the canvas. */
  "assert-ready": {
    kind: "assert", result: { claim: "", summary: "", docs: [] }, analyzed: false,
    claim: "", owners: [], people: [],
  },
};

/* ── overflow / stress ────────────────────────────────────────────────────── */

/* The graph's node cards are fixed-width with truncate, so long labels are the
   key overflow case. `overflow` uses natural long titles; `stress` uses
   pathological unbreakable tokens. */
function strainedNodes(extreme: boolean): LNode[] {
  const titles = extreme
    ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT, `${HUGE_NUMBER_STR} unresolved contradictions`]
    : [LONG_TITLE];
  return NODES.map((n, i) => {
    if (n.macro) {
      return {
        ...n,
        title: extreme ? `${HUGE_NUMBER_STR} commits` : "Every commit across the entire platform monorepo this quarter",
        repo: extreme ? UNBREAKABLE : LONG_SOURCE,
        count: extreme ? HUGE_NUMBER : n.count,
      };
    }
    return { ...n, title: titles[i % titles.length], owner: extreme ? LONG_WORD : LONG_NAME };
  });
}

const extras = (extreme: boolean): LineageExtras => ({
  title: extreme ? MIXED_SCRIPT : LONG_TITLE,
  hint: extreme ? HUGE_PERCENT : `${HUGE_NUMBER_STR} refs`,
  body: extreme ? UNBREAKABLE : LONG_NAME,
  tags: extreme ? MANY_TAGS : MANY_TAGS.slice(0, 10),
  people: MANY_INITIALS,
  avatarMax: extreme ? 4 : 6,
});

/* ── the trail ────────────────────────────────────────────────────────────── */

/** Crumbs the way the app builds them: every step back is a real lineage URL,
    and the last crumb is where the reader already is, so it carries none. */
const crumbs = (labels: string[], hrefs: string[] = []): LineageCrumb[] =>
  labels.map((label, i) => (i === labels.length - 1
    ? { label }
    : { label, href: hrefs[i] ?? "/lineage" }));

/** What a reader who drilled from the whole graph into one PR inside one
    repository bucket has above the instrument. */
const DRILLED = crumbs(
  ["Lineage", "Overview", "MariHQ/web PRs", "PR #482 · billing revamp"],
  ["/lineage", "/lineage?mode=overview", "/lineage?mode=overview&group=gh:MariHQ/web:prs"],
);

/* ── states ───────────────────────────────────────────────────────────────── */

const BASE: LineageData = {
  nodes: NODES,
  edges: EDGES,
  mode: "overview",
  tuning: { maxNodes: 35, hopDepth: 2, minConfidence: 0.72 },
  dates: DATES,
  activity: ACTIVITY,
  lens: "source",
  layout: "flow",
  focalId: "n1",
  trace: null,
  asOf: null,
  search: null,
  views: VIEWS,
  drawer: null,
  crumbs: null,
  extras: null,
  action: { label: "Authentication API ↗", docId: 1 },
};

const view = (over: Partial<LineageData>): LineageData => ({ ...BASE, ...over });

/** A workspace with no graph at all: the page's own `isEmpty` check fires
    because there is genuinely nothing to draw. */
const EMPTY: LineageData = view({ nodes: [], edges: [], dates: [], activity: [], focalId: null, views: [] });

const strained = (extreme: boolean): LineageData => view({
  nodes: strainedNodes(extreme),
  crumbs: crumbs(LONG_BREADCRUMB),
  extras: extras(extreme),
});

/* A roll-up unfolded on the canvas: the commits bucket has real members here,
   so the overview can draw them in place of the one macro card and the volume
   control in the toolbar has something to count. */
const EXPANDED_NODES: LNode[] = [
  ...NODES.filter((n) => !n.macro),
  ...GROUP_MEMBERS.map((m) => ({ ...m, staleDays: 6, inbound: m.inbound ?? 0, outbound: 1 })),
];

const EXPANDED_EDGES: LEdge[] = [
  ...EDGES.filter((e) => !e.id.startsWith("ge:")),
  { id: "x1", from: "c1", to: "n8", rel: "references", date: "2026-07-19" },
  { id: "x2", from: "c2", to: "n2", rel: "references", date: "2026-07-18" },
  { id: "x3", from: "c4", to: "n3", rel: "derived", date: "2026-07-14" },
  { id: "x4", from: "c1", to: "c2", rel: "references", date: "2026-07-19" },
  { id: "x5", from: "c3", to: "c1", rel: "derived", date: "2026-07-16" },
];

export const FIXTURES: PageFixtures<LineageData> = {
  default: { data: BASE },
  "lens-owner": { data: view({ lens: "owner" }) },
  "lens-stale": { data: view({ lens: "stale" }) },
  "lens-health": { data: view({ lens: "health" }) },
  "layout-timeline": { data: view({ layout: "timeline" }) },
  "as-of": { data: view({ asOf: 6 }) },
  "trace-impact": { data: view({ trace: { originId: "n1", direction: "down" } }) },
  "trace-provenance": { data: view({ focalId: "n9", trace: { originId: "n9", direction: "up" } }) },
  search: { data: view({ search: { query: "pricing" } }) },
  inspect: { data: view({ drawer: DRAWERS.node }) },
  edge: { data: view({ drawer: DRAWERS.edge }) },
  group: { data: view({ drawer: DRAWERS.group }) },
  assert: { data: view({ drawer: DRAWERS.assert }) },
  "assert-ready": { data: view({ drawer: DRAWERS["assert-ready"] }) },
  loading: { data: BASE, loading: true },
  error: { data: EMPTY, error: "The lineage graph is temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
  crumbs: {
    data: view({
      mode: "overview",
      focalId: "n4",
      crumbs: DRILLED,
      drawer: DRAWERS.node,
      action: { label: "PR #482 · billing revamp", docId: 104 },
    }),
  },
  capped: {
    data: view({
      mode: "documents",
      // A cap the demo graph actually exceeds, so the toolbar prints a true
      // "showing 4 of 9" instead of a control nobody can trigger.
      tuning: { maxNodes: 4, hopDepth: 2, minConfidence: 0.72 },
      crumbs: null,
    }),
  },
  expanded: {
    data: view({
      mode: "overview",
      nodes: EXPANDED_NODES,
      edges: EXPANDED_EDGES,
      expanded: ["gh:MariHQ/web:commits"],
      focalId: null,
      drawer: {
        kind: "group",
        groupId: "gh:MariHQ/web:commits",
        totalMembers: GROUP_MEMBERS.length,
        members: GROUP_MEMBERS,
      },
      crumbs: crumbs(["Lineage", "Overview", "MariHQ/web commits"], ["/lineage", "/lineage?mode=overview"]),
      action: null,
    }),
  },
};
