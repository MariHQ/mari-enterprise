import type { ComponentSpec } from "./types";
import {
  LineageGraph, LineageToolbar, LineageTimeScrubber, LineageDataModel,
  LineageNodeDrawer, LineageEdgeDrawer, LineageGroupDrawer, LineageAssertDrawer,
} from "../../features";
import { Lineage } from "../../index";
import { REL_ORDER, type DocHistoryRow, type LNode, type LEdge } from "../../features/LineageDataModel";
import {
  LINEAGE_NODES, LINEAGE_EDGES, LINEAGE_DATES, LINEAGE_ACTIVITY,
  LINEAGE_HISTORY, LINEAGE_GROUP, LINEAGE_ASSERT,
} from "../fixtures/features";

/* State matrix for the lineage group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks. */

const LONG =
  "Quarterly revenue recognition policy for multi-year enterprise agreements with usage-based true-ups and regional tax carve-outs";
const HUGE =
  "Supercalifragilisticexpialidocious_configuration_parameter_value_that_never_wraps_0123456789";
const LONG_OWNER = "Aleksandra Konstantinopoulou-Whitfield";

/* ── overflow fixtures ─────────────────────────────────────────────────── */

const OVER_NODES: LNode[] = [
  {
    id: "n1", source: "docs", title: LONG, meta: `Decision · owner ${LONG_OWNER} · 4d ago · customer-facing · pricing`,
    icon: "doc", docKind: "decision", group: "", x: 0.12, y: 0.3, date: "2026-07-17", createdDate: "2026-03-02",
    owner: LONG_OWNER, staleDays: 4, tags: ["customer-facing", "pricing", "revenue", "enterprise", "tax", "q3", "legal-reviewed", "long-tag-name-that-runs-on"],
    inbound: 12, outbound: 9,
  },
  {
    id: "n2", source: "github", title: HUGE, meta: `PR · merged · 2d ago`, icon: "github", docKind: "pr",
    group: "gh:MariHQ/web:prs", x: 0.5, y: 0.7, date: "2026-07-19", createdDate: "2026-07-10",
    owner: HUGE.slice(0, 40), staleDays: 2, warn: true, inbound: 3, outbound: 7,
  },
  {
    id: "n3", source: "docsite", title: "Billing FAQ", meta: "Page · owner Sam L · 52d ago", icon: "book",
    docKind: "page", group: "", x: 0.85, y: 0.4, date: "2026-05-30", owner: "Sam L", staleDays: 52, warn: true,
    inbound: 3, outbound: 1,
  },
];

const OVER_EDGES: LEdge[] = [
  { id: "e1", from: "n1", to: "n2", rel: "references", date: "2026-07-19", meta: { evidence: HUGE, status: "confirmed", note: LONG } },
  { id: "e2", from: "n2", to: "n3", rel: "contradicts", date: "2026-05-21", dashed: true, llm: true, meta: { note: LONG } },
  { id: "e3", from: "n1", to: "n3", rel: "translates", date: "2026-06-10" },
];

/** A node with no edges at all: the "empty connections" case. */
const LONE_NODES: LNode[] = [
  { id: "solo", source: "notion", title: "Orphaned scratch page", meta: "Page · unowned · 120d ago", icon: "notion",
    docKind: "page", group: "", x: 0.5, y: 0.5, date: "2026-03-01", staleDays: 120, orphan: true, inbound: 0, outbound: 0 },
];

/** Revision history the page fixture has no slot for: an unbreakable actor and
    an absurd verb, so the drawer's history table is exercised at its worst. */
const OVER_HISTORY: DocHistoryRow[] = Array.from({ length: 8 }, (_, i) => ({
  at: `2026-07-${String(20 - i).padStart(2, "0")}T09:${String(10 + i).padStart(2, "0")}:00`,
  actor: i % 2 === 0 ? LONG_OWNER : HUGE,
  verb: i % 2 === 0 ? "rewrote the section" : LONG,
  detail: i % 3 === 0 ? HUGE : LONG,
}));

/** Far too many members for one roll-up drawer. */
const MANY_MEMBERS: LNode[] = Array.from({ length: 24 }, (_, i) => ({
  id: `m${i}`, source: "github", title: i % 4 === 0 ? LONG : `fix: billing edge case #${i + 1}`,
  meta: "commit", icon: "github", docKind: "commit" as const, group: "gh:MariHQ/web:commits",
  x: 0, y: 0, owner: i % 3 === 0 ? LONG_OWNER : "Dev R", date: "2026-07-19", inbound: 24 - i,
}));

/* ── volume fixtures ───────────────────────────────────────────────────────
   The tiny demo graph hides every density problem. These are the honest worst
   cases: a 150-node / ~400-edge graph, a 500-member bucket, an 80-document
   impact analysis, a 30-source workspace, and a hub node wired to ~60 others.
   Deterministic (a tiny LCG) so a contact sheet is reproducible. */

let seed = 20260724;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const VOL_SOURCES = ["docs", "github", "slack", "notion", "granola", "gdocs", "docsite"];
const VOL_OWNERS = ["Ana K", "Dev R", "Mia M", "Sam L", "Jo S", LONG_OWNER, "Priya N", "Tom W"];
const VOL_TITLES = [
  "Pricing policy", "Free-tier limits", "Billing FAQ", "Seat cap rollout", "Refund workflow",
  "Enterprise agreement template", "Usage-based true-up rules", "Regional tax carve-outs",
  "Launch brief", "Support macro: billing", "Onboarding guide", "Trial conversion plan",
];

/** 150 document nodes spread over the canvas, a handful deliberately warned. */
const VOL_NODES: LNode[] = Array.from({ length: 150 }, (_, i) => {
  const source = VOL_SOURCES[i % VOL_SOURCES.length];
  const stale = Math.floor(rnd() * 120);
  return {
    id: `v${i}`,
    source,
    title: i % 17 === 0 ? LONG : `${VOL_TITLES[i % VOL_TITLES.length]} ${i + 1}`,
    meta: `Page · owner ${VOL_OWNERS[i % VOL_OWNERS.length]} · ${stale}d ago`,
    icon: source,
    docKind: (["page", "commit", "pr", "issue", "answer", "decision"] as const)[i % 6],
    group: "",
    x: 0.05 + rnd() * 0.9,
    y: 0.05 + rnd() * 0.9,
    date: `2026-0${1 + (i % 7)}-${String(1 + (i % 28)).padStart(2, "0")}`,
    owner: VOL_OWNERS[i % VOL_OWNERS.length],
    staleDays: stale,
    warn: stale > 90,
    tags: i % 5 === 0 ? ["customer-facing", "pricing", "revenue", "enterprise", "tax", "q3", "legal-reviewed", "renewals", "emea", "long-tag-name-that-runs-on"] : undefined,
    inbound: 0,
    outbound: 0,
  };
});

/** ~400 edges, with v0 as a hub carrying ~60 of them. */
const VOL_EDGES: LEdge[] = [
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `vh${i}`,
    from: i % 2 === 0 ? "v0" : `v${1 + i}`,
    to: i % 2 === 0 ? `v${1 + i}` : "v0",
    rel: REL_ORDER[i % REL_ORDER.length],
    date: "2026-07-19",
    meta: { note: i % 3 === 0 ? LONG : undefined, evidence: i % 4 === 0 ? HUGE : undefined },
  })),
  ...Array.from({ length: 340 }, (_, i) => {
    const from = Math.floor(rnd() * 150);
    const to = (from + 1 + Math.floor(rnd() * 20)) % 150;
    return {
      id: `ve${i}`,
      from: `v${from}`,
      to: `v${to}`,
      rel: REL_ORDER[i % REL_ORDER.length],
      date: "2026-06-10",
    };
  }),
];

for (const n of VOL_NODES) {
  n.inbound = VOL_EDGES.filter((e) => e.to === n.id).length;
  n.outbound = VOL_EDGES.filter((e) => e.from === n.id).length;
}

/** 30 connected sources, the wide end of what a workspace can wire up. */
const VOL_SOURCE_NODES: LNode[] = Array.from({ length: 30 }, (_, i) => ({
  id: `vs${i}`,
  source: i < VOL_SOURCES.length ? VOL_SOURCES[i] : `connector-${String(i).padStart(2, "0")}-with-a-long-name`,
  title: `${VOL_TITLES[i % VOL_TITLES.length]} ${i + 1}`,
  meta: "Page · owner Ana K · 5d ago",
  icon: "doc", docKind: "page" as const, group: "",
  x: 0.05 + (i % 10) * 0.1, y: 0.1 + Math.floor(i / 10) * 0.3,
  date: "2026-07-01", owner: VOL_OWNERS[i % VOL_OWNERS.length], staleDays: i, inbound: i, outbound: 30 - i,
}));

/** A document revised every working day for a year. */
const VOL_HISTORY: DocHistoryRow[] = Array.from({ length: 260 }, (_, i) => ({
  at: `2026-0${1 + (i % 7)}-${String(1 + (i % 28)).padStart(2, "0")}T09:12:00`,
  actor: VOL_OWNERS[i % VOL_OWNERS.length],
  verb: i % 19 === 0 ? LONG : "verified the claim",
  detail: i % 23 === 0 ? HUGE : `Revision ${i + 1}`,
}));

/** 500 commits in one roll-up bucket. */
const VOL_MEMBERS: LNode[] = Array.from({ length: 500 }, (_, i) => ({
  id: `vm${i}`, source: "github",
  title: i % 11 === 0 ? LONG : i % 13 === 0 ? HUGE : `fix: billing edge case #${i + 1}`,
  meta: "commit", icon: "github", docKind: "commit" as const, group: "gh:MariHQ/web:commits",
  x: 0, y: 0, owner: VOL_OWNERS[i % VOL_OWNERS.length],
  date: `2026-0${1 + (i % 7)}-${String(1 + (i % 28)).padStart(2, "0")}`, inbound: 500 - i,
}));

/** An 80-document impact analysis. */
const VOL_IMPACT = {
  claim: "Free tier ends September 1",
  summary: "412 documents reference the free tier. 27 directly contradict the new end date, 31 need a review pass, and 22 mention it in passing.",
  docs: Array.from({ length: 80 }, (_, i) => ({
    title: i % 9 === 0 ? LONG : i % 11 === 0 ? HUGE : `${VOL_TITLES[i % VOL_TITLES.length]} ${i + 1}`,
    source: VOL_SOURCES[i % VOL_SOURCES.length],
    severity: (["update-required", "review", "minor"] as const)[i % 3],
    reason: i % 4 === 0 ? LONG : "states the free tier is permanent",
  })),
};

/* ── data-display Lineage fixtures ─────────────────────────────────────── */

const UP = [
  { id: "u1", label: "Pricing policy", sublabel: "docs", tone: "ok" as const },
  { id: "u2", label: "Free-tier limits", sublabel: "docs", tone: "info" as const },
  { id: "u3", label: "#pricing thread", sublabel: "slack", tone: "attention" as const },
];
const DOWN = [
  { id: "d1", label: "Billing FAQ", sublabel: "doc site", tone: "blocked" as const },
  { id: "d2", label: "Onboarding guide", sublabel: "notion", tone: "neutral" as const },
];
const FOCUS = { id: "f", label: "PR #482 · billing revamp", sublabel: "github · merged", tone: "info" as const };

export const LINEAGE: ComponentSpec[] = [
  /* ── graph canvas ────────────────────────────────────────────────────── */
  {
    id: "LineageGraph", title: "LineageGraph", width: 900,
    states: [
      { id: "default", label: "Default (source lens, flow layout, focal node selected)",
        node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} focalId="n1" /> },
      { id: "lens-stale", label: "Lens: staleness", node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} lens="stale" /> },
      { id: "lens-owner", label: "Lens: ownership", node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} lens="owner" /> },
      { id: "lens-health", label: "Lens: health (warn badges)", node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} lens="health" /> },
      { id: "timeline", label: "Layout: timeline", node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} layout="timeline" /> },
      { id: "trace-down", label: "Trace: impact of n1 (downstream closure)",
        node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} trace={{ originId: "n1", direction: "down" }} /> },
      { id: "trace-up", label: "Trace: provenance of n9 (upstream closure)",
        node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} trace={{ originId: "n9", direction: "up" }} /> },
      { id: "loading", label: "Loading skeleton", node: <LineageGraph nodes={[]} edges={[]} loading /> },
      { id: "empty", label: "Empty graph (no nodes, no edges)", node: <LineageGraph nodes={[]} edges={[]} focalId={null} /> },
      { id: "single", label: "One orphan node, no edges", node: <LineageGraph nodes={LONE_NODES} edges={[]} focalId="solo" /> },
      { id: "overflow", label: "Overflow: absurd titles, unbreakable string, long owners",
        node: <LineageGraph nodes={OVER_NODES} edges={OVER_EDGES} focalId="n1" /> },
      { id: "capped", label: "Capped: a cap the graph exceeds, counted in the header",
        node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} focalId="n1" maxNodes={4} /> },
      { id: "stress", label: "Volume: 150 nodes, 400 edges (capped, decluttered, counted)",
        node: <LineageGraph nodes={VOL_NODES} edges={VOL_EDGES} focalId="v0" /> },
      { id: "stress-trace", label: "Volume: 150 nodes, downstream trace from the hub node",
        node: <LineageGraph nodes={VOL_NODES} edges={VOL_EDGES} focalId="v0" trace={{ originId: "v0", direction: "down" }} /> },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: <LineageGraph nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} focalId="n1" /> },
    ],
  },

  /* ── toolbar ─────────────────────────────────────────────────────────── */
  {
    id: "LineageToolbar", title: "LineageToolbar", width: 900,
    states: [
      { id: "default", label: "Default (three rows: filters / view / actions)", node: <LineageToolbar nodes={LINEAGE_NODES} /> },
      { id: "volume", label: "Volume readout: capped, with the way to draw more",
        node: <LineageToolbar nodes={LINEAGE_NODES} volume={{ shown: 4, matching: 9, total: 128, cap: 4 }} volumeStep={35} /> },
      { id: "views", label: "Saved views, removable (confirm in place)",
        node: <LineageToolbar
          nodes={LINEAGE_NODES}
          views={[
            { id: 1, name: "Customer-facing only", state: '{"status":"all"}' },
            { id: 2, name: "Warnings, timeline", state: '{"status":"warnings"}' },
          ]}
          onSaveView={() => {}}
          onDeleteView={() => {}} /> },
      { id: "loading", label: "Loading skeleton", node: <LineageToolbar nodes={[]} loading /> },
      { id: "empty", label: "No nodes (no sources to filter by)", node: <LineageToolbar nodes={[]} /> },
      { id: "overflow", label: "Overflow: many long source names", node: <LineageToolbar nodes={OVER_NODES.concat(LINEAGE_NODES)} /> },
      { id: "stress", label: "Volume: 30 connected sources, 150-node graph",
        node: <LineageToolbar nodes={VOL_SOURCE_NODES.concat(VOL_NODES)} /> },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: <LineageToolbar nodes={LINEAGE_NODES} /> },
    ],
  },

  /* ── time scrubber ───────────────────────────────────────────────────── */
  {
    id: "LineageTimeScrubber", title: "LineageTimeScrubber", width: 900,
    states: [
      { id: "live", label: "Live (all time)", node: <LineageTimeScrubber dates={LINEAGE_DATES} activity={LINEAGE_ACTIVITY} /> },
      { id: "asof", label: "Scrubbed back to an event date", node: <LineageTimeScrubber dates={LINEAGE_DATES} activity={LINEAGE_ACTIVITY} value={4} /> },
      { id: "loading", label: "Loading skeleton", node: <LineageTimeScrubber dates={[]} activity={[]} loading /> },
      { id: "empty", label: "Empty: no events", node: <LineageTimeScrubber dates={[]} activity={[]} /> },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: <LineageTimeScrubber dates={LINEAGE_DATES} activity={LINEAGE_ACTIVITY} /> },
    ],
  },

  /* ── data-model legend ───────────────────────────────────────────────── */
  {
    id: "LineageDataModel", title: "LineageDataModel", width: 700,
    states: [
      { id: "default", label: "Legend", node: <LineageDataModel nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} dates={LINEAGE_DATES} /> },
      { id: "loading", label: "Loading skeleton", node: <LineageDataModel nodes={[]} edges={[]} dates={[]} loading /> },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: <LineageDataModel nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} dates={LINEAGE_DATES} /> },
    ],
  },

  /* ── node drawer ─────────────────────────────────────────────────────── */
  {
    id: "LineageNodeDrawer", title: "LineageNodeDrawer", width: 460,
    states: [
      { id: "default", label: "Default (PR node, references + connections)", node: <LineageNodeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} history={LINEAGE_HISTORY} nodeId="n4" /> },
      { id: "decision", label: "Decision doc, tagged, fresh", node: <LineageNodeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} history={LINEAGE_HISTORY} nodeId="n1" /> },
      { id: "warn", label: "Stale doc that needs attention", node: <LineageNodeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} history={LINEAGE_HISTORY} nodeId="n3" /> },
      { id: "macro", label: "Roll-up macro node", node: <LineageNodeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} history={LINEAGE_HISTORY} nodeId="grp:gh:MariHQ/web:commits" /> },
      { id: "loading", label: "Loading skeleton", node: <LineageNodeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} history={LINEAGE_HISTORY} nodeId="n4" loading /> },
      { id: "empty", label: "Empty: orphan node with no connections",
        node: <LineageNodeDrawer nodes={LONE_NODES} edges={[]} history={[]} nodeId="solo" /> },
      { id: "overflow", label: "Overflow: absurd title, unbreakable meta, many tags",
        node: <LineageNodeDrawer nodes={OVER_NODES} edges={OVER_EDGES} history={LINEAGE_HISTORY} nodeId="n1" /> },
      { id: "overflow-unbreakable", label: "Overflow: 90-char unbreakable title",
        node: <LineageNodeDrawer nodes={OVER_NODES} edges={OVER_EDGES} history={OVER_HISTORY} nodeId="n2" /> },
      { id: "stress", label: "Volume: hub node with ~60 links, 10 tags",
        node: <LineageNodeDrawer nodes={VOL_NODES} edges={VOL_EDGES} history={VOL_HISTORY} nodeId="v0" /> },
      { id: "narrow", label: "Overflow: narrow frame (fixed width must not shrink)", width: 320,
        node: <LineageNodeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} history={LINEAGE_HISTORY} nodeId="n4" /> },
    ],
  },

  /* ── edge drawer ─────────────────────────────────────────────────────── */
  {
    id: "LineageEdgeDrawer", title: "LineageEdgeDrawer", width: 460,
    states: [
      { id: "default", label: "Confirmed reference with evidence", node: <LineageEdgeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} edgeId="e3" /> },
      { id: "contradicts", label: "Contradiction (heavy dashed relation)", node: <LineageEdgeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} edgeId="e5" /> },
      { id: "derived", label: "Derived by Mari (translates)", node: <LineageEdgeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} edgeId="e11" /> },
      { id: "bare", label: "Bare edge: no evidence, no note", node: <LineageEdgeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} edgeId="e2" /> },
      { id: "loading", label: "Loading skeleton", node: <LineageEdgeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} edgeId="e3" loading /> },
      { id: "overflow", label: "Overflow: absurd endpoint titles + unbreakable evidence",
        node: <LineageEdgeDrawer nodes={OVER_NODES} edges={OVER_EDGES} edgeId="e1" /> },
      { id: "stress", label: "Volume: edge inside a 400-edge graph, both endpoints heavily linked",
        node: <LineageEdgeDrawer nodes={VOL_NODES} edges={VOL_EDGES} edgeId="vh0" /> },
      { id: "narrow", label: "Overflow: narrow frame (fixed width must not shrink)", width: 320,
        node: <LineageEdgeDrawer nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} edgeId="e3" /> },
    ],
  },

  /* ── group drawer ────────────────────────────────────────────────────── */
  {
    id: "LineageGroupDrawer", title: "LineageGroupDrawer", width: 460,
    states: [
      { id: "default", label: "Default roll-up bucket", node: <LineageGroupDrawer {...LINEAGE_GROUP} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} /> },
      { id: "expandable", label: "Rolled up, with the way to unfold it on the graph",
        node: <LineageGroupDrawer {...LINEAGE_GROUP} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} onExpandInPlace={() => {}} onCollapseInPlace={() => {}} /> },
      { id: "expanded", label: "Unfolded on the graph, with the way to roll it back up",
        node: <LineageGroupDrawer {...LINEAGE_GROUP} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} expandedInPlace onExpandInPlace={() => {}} onCollapseInPlace={() => {}} /> },
      { id: "single", label: "One member", node: <LineageGroupDrawer groupId={LINEAGE_GROUP.groupId} totalMembers={1} members={MANY_MEMBERS.slice(0, 1)} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} /> },
      { id: "many", label: "Far too many members", node: <LineageGroupDrawer groupId={LINEAGE_GROUP.groupId} totalMembers={248} members={MANY_MEMBERS} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} /> },
      { id: "loading", label: "Loading skeleton", node: <LineageGroupDrawer groupId={LINEAGE_GROUP.groupId} totalMembers={0} members={[]} nodes={[]} edges={[]} loading /> },
      { id: "empty", label: "Empty: no members left after filters", node: <LineageGroupDrawer groupId={LINEAGE_GROUP.groupId} totalMembers={0} members={[]} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} /> },
      { id: "overflow", label: "Overflow: absurd repo id and member titles",
        node: <LineageGroupDrawer groupId={`gh:MariHQ/${HUGE}:commits`} totalMembers={248} members={MANY_MEMBERS} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} /> },
      { id: "stress", label: "Volume: 500 members in one bucket",
        node: <LineageGroupDrawer groupId={LINEAGE_GROUP.groupId} totalMembers={500} members={VOL_MEMBERS} nodes={VOL_NODES} edges={VOL_EDGES} /> },
      { id: "narrow", label: "Overflow: narrow frame (fixed width must not shrink)", width: 320,
        node: <LineageGroupDrawer {...LINEAGE_GROUP} nodes={LINEAGE_NODES} edges={LINEAGE_EDGES} /> },
    ],
  },

  /* ── assert / impact drawer ──────────────────────────────────────────── */
  {
    id: "LineageAssertDrawer", title: "LineageAssertDrawer", width: 500,
    states: [
      { id: "default", label: "Completed analysis", node: <LineageAssertDrawer {...LINEAGE_ASSERT} /> },
      { id: "empty", label: "Pre-analysis (no result yet)", node: <LineageAssertDrawer {...LINEAGE_ASSERT} analyzed={false} /> },
      { id: "loading", label: "Loading skeleton", node: <LineageAssertDrawer {...LINEAGE_ASSERT} loading /> },
      { id: "overflow", label: "Overflow: absurd claim, summary and doc titles",
        node: (
          <LineageAssertDrawer
            {...LINEAGE_ASSERT}
            result={{
              claim: HUGE,
              summary: LONG + " " + LONG,
              docs: Array.from({ length: 12 }, (_, i) => ({
                title: i % 3 === 0 ? LONG : i % 3 === 1 ? HUGE : "Billing FAQ",
                source: "docsite",
                severity: (["update-required", "review", "minor"] as const)[i % 3],
                reason: i % 2 === 0 ? LONG : "states the free tier is permanent",
              })),
            }}
          />) },
      { id: "stress", label: "Volume: 80 impacted documents",
        node: <LineageAssertDrawer {...LINEAGE_ASSERT} result={VOL_IMPACT} /> },
      { id: "narrow", label: "Overflow: narrow frame (fixed width must not shrink)", width: 320,
        node: <LineageAssertDrawer {...LINEAGE_ASSERT} /> },
    ],
  },

  /* ── data-display Lineage (upstream → focus → downstream) ────────────── */
  {
    id: "Lineage", title: "Lineage (data-display)", width: 900,
    states: [
      { id: "default", label: "Upstream + focus + downstream", node: <Lineage upstream={UP} focus={FOCUS} downstream={DOWN} onSelect={() => {}} /> },
      { id: "upstream-only", label: "Upstream only", node: <Lineage upstream={UP} focus={FOCUS} /> },
      { id: "downstream-only", label: "Downstream only", node: <Lineage focus={FOCUS} downstream={DOWN} /> },
      { id: "solo", label: "Focus alone (no lineage recorded)", node: <Lineage focus={FOCUS} /> },
      { id: "many", label: "Overflow: many nodes on both sides",
        node: <Lineage
          upstream={Array.from({ length: 7 }, (_, i) => ({ id: `u${i}`, label: `Upstream document ${i + 1}`, sublabel: "docs" }))}
          focus={FOCUS}
          downstream={Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, label: `Downstream document ${i + 1}`, sublabel: "notion" }))} /> },
      { id: "overflow", label: "Overflow: absurd labels + unbreakable string",
        node: <Lineage
          upstream={[{ id: "u1", label: LONG, sublabel: LONG_OWNER }, { id: "u2", label: HUGE, sublabel: HUGE }]}
          focus={{ id: "f", label: LONG, sublabel: HUGE }}
          downstream={[{ id: "d1", label: HUGE, sublabel: "doc site" }]} /> },
      { id: "stress", label: "Volume: 40 upstream and 40 downstream nodes",
        node: <Lineage
          upstream={Array.from({ length: 40 }, (_, i) => ({ id: `su${i}`, label: i % 7 === 0 ? LONG : `Upstream document ${i + 1}`, sublabel: "docs", tone: (["ok", "info", "attention", "blocked", "neutral"] as const)[i % 5] }))}
          focus={FOCUS}
          downstream={Array.from({ length: 40 }, (_, i) => ({ id: `sd${i}`, label: i % 9 === 0 ? HUGE : `Downstream document ${i + 1}`, sublabel: "notion" }))}
          onSelect={() => {}} /> },
      { id: "narrow", label: "Overflow: narrow frame", width: 320,
        node: <Lineage upstream={UP} focus={FOCUS} downstream={DOWN} /> },
    ],
  },
];
