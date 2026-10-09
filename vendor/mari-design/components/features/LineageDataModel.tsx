import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { GithubMark, SourceMark } from "../icons";
import { card } from "../tokens/card";
import { focusRing } from "../tokens/focusRing";
import { Chip, StatusChip } from "../data-display/Chip";
import { SectionLabel } from "../forms/SectionLabel";
import { Skeleton, SkeletonLine } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";

/* ─────────────────────────────────────────────────────────────────────────
   Lineage data model (feature: lineage-data-model)

   Pure, React-light module: the type definitions, relation/source palettes,
   roll-up constants, severity maps, small helpers, and the baked-in demo
   graph that the lineage graph canvas + drawers + toolbar + scrubber all
   import. Also exports a few shared presentational helpers (glyph, edge
   swatch, connection row, drawer shell) that recur across every lineage
   drawer, plus a `LineageDataModel` legend component so the gallery has
   something to render for the otherwise UI-less model spec.

   Faithful to web/src/pages/lineage/model.ts + glyphs.tsx — retuned from the
   deprecated editorial-notebook (cream/serif) palette to console mode.
   ──────────────────────────────────────────────────────────────────────── */

/* ── Types ──────────────────────────────────────────────────────────────── */

export type RelKey = string;
export type Lens = "source" | "stale" | "owner" | "health";
export type LayoutMode = "flow" | "timeline";
/** The question the graph is answering. Overview is deliberately aggregated;
    provenance and impact are directional, focal, bounded traversals. */
export type LineageMode = "documents" | "overview" | "provenance" | "impact";
export type DocKind = "page" | "commit" | "pr" | "issue" | "answer" | "decision" | "seed";
export type Severity = "update-required" | "review" | "minor";

export type LNode = {
  id: string;
  docId?: number | string;
  source: string;
  title: string;
  /** "·"-separated pill string, e.g. "PR · merged · 3d ago". */
  meta: string;
  icon: string;
  docKind: DocKind;
  /** roll-up bucket id, "" = ungrouped; e.g. "gh:MariHQ/web:commits". */
  group: string;
  /** 0..1 normalized position (server auto-layout OR pinned). */
  x: number;
  y: number;
  /** ISO yyyy-mm-dd — last update; powers the time axis. */
  date?: string;
  createdDate?: string;
  pinned?: boolean;
  warn?: boolean;
  owner?: string;
  tags?: string[];
  staleDays?: number;
  orphan?: boolean;
  inbound?: number;
  outbound?: number;
  /** roll-up macro node standing in for a whole bucket. */
  macro?: boolean;
  /** members rolled up into a macro node. */
  count?: number;
  repo?: string;
  parameters?: {name: string; type: string; value: string}[];
};

export type LEdge = {
  id: string;
  from: string;
  to: string;
  rel: RelKey;
  date?: string;
  llm?: boolean;
  dashed?: boolean;
  count?: number;
  meta?: {
    derived?: string;
    confidence?: number;
    note?: string;
    evidence?: string;
    status?: string;
  };
};

export type Sel = { kind: "node" | "edge"; id: string } | null;
export type ImpactDoc = {
  title: string;
  source: string;
  severity: Severity;
  reason: string;
  /** The document the verdict is about. The analysis names documents, not
      cards, so this is what lets the canvas light the right node and a task
      point at the right document. Optional: a title is the fallback. */
  docId?: number | string;
};
export type ImpactResult = { claim: string; summary: string; docs: ImpactDoc[] };

/** An analysis, resolved against the graph on screen: which node carries which
    severity, plus the claim it came from. `null` = no analysis is showing. */
export type ImpactOverlay = { claim: string; docs: { id: string; severity: Severity }[] };
export type DocHistoryRow = { at: string; actor: string; verb: string; detail: string };
export type GraphView = { id: number; name: string; state: string };

/* ── Relation styles — order matters (drives menu + legend) ──────────────── */

/* Color is never the only channel (CONVENTIONS.md §4/§6): every relation also
   carries its own dash pattern, its own stroke weight, and a short mono code
   that is drawn on the edge itself and repeated in the legend. */
export type RelStyle = {
  color: string;
  /** SVG stroke-dasharray. Undefined = solid. Unique per relation. */
  dash?: string;
  /** Stroke weight, also unique enough to read without color. */
  width: number;
  /** Short ALL-CAPS code printed on the edge and in the legend. */
  code: string;
  /** Plain-language name for the dash pattern, for the legend. */
  pattern: string;
  label: string;
  out: string;
  in: string;
};

export const REL: Record<RelKey, RelStyle> = {
  references: { color: "#35549d", width: 1.8, code: "REF", pattern: "Solid, thin", label: "References", out: "References", in: "Referenced by" },
  discussed: { color: "#bf4f2e", dash: "1 4", width: 2.2, code: "DISC", pattern: "Dotted", label: "Discussed in", out: "Discussed in", in: "Discusses" },
  derived: { color: "#43663c", dash: "9 4", width: 2.4, code: "DERIV", pattern: "Long dash", label: "Derived from", out: "Derived from", in: "Source of" },
  translates: { color: "#6a5a9c", dash: "5 3 1 3", width: 2, code: "LOC", pattern: "Dash dot", label: "Localization", out: "Localizes", in: "Localized by" },
  contradicts: { color: "#c8502e", dash: "3 3", width: 3.4, code: "CONTRA", pattern: "Short dash, heavy", label: "Contradicts", out: "Contradicts", in: "Contradicted by" },
  /* Machine-inferred, not authored: pgvector cosine similarity over document
     embeddings. Drawn thin and finely dotted so an inferred edge never reads
     as heavily as a stated one, and symmetric in both directions because
     "is similar to" has no source and no target. */
  similar: { color: "#7a7f88", dash: "2 3", width: 1.4, code: "SIM", pattern: "Fine dotted", label: "Similar to", out: "Similar to", in: "Similar to" },
};

export const REL_ORDER: RelKey[] = ["references", "discussed", "derived", "translates", "contradicts", "similar"];

/** Only these relations carry dependency direction. Similarity,
    contradiction, and discussion are useful context but cannot truthfully
    answer either "where did this come from?" or "what depends on this?". */
export const LINEAGE_RELATIONS: RelKey[] = ["references", "derived", "translates"];
export const isLineageRelation = (rel: RelKey): boolean => LINEAGE_RELATIONS.includes(rel);

/** Catalog-owned edge names, rendered with the existing neutral edge treatment. */
const catalogEdgeStyle = { ...REL.references };
export function setLineageRelations(labels: string[]) {
  const unique = [...new Set(labels)].sort();
  if (!unique.length) return;
  for (const label of unique) {
    if (!REL[label]) REL[label] = { ...catalogEdgeStyle, code: label.toUpperCase(), label, out: label, in: `${label} (incoming)` };
  }
  REL_ORDER.splice(0, REL_ORDER.length, ...unique);
  LINEAGE_RELATIONS.splice(0, LINEAGE_RELATIONS.length, ...unique);
}

export const edgeKey = (from: string, to: string, rel: RelKey) => `${from}→${to}:${rel}`;

/* ── Source identity ────────────────────────────────────────────────────── */

export const SOURCE_ORDER = ["github", "slack", "docs", "notion", "granola", "gdocs", "docsite"] as const;

export const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub", slack: "Slack", docs: "Docs", notion: "Notion",
  granola: "Granola", gdocs: "Drive", docsite: "Doc site",
};

/** Text glyph rendered inline in cy node labels (kept for legend/fallbacks). */
export const SOURCE_GLYPH: Record<string, string> = {
  github: "⬡", slack: "✳", docs: "▤", notion: "▣", granola: "✎", gdocs: "▲", docsite: "◍",
};

/** Node underlay tint by source. */
export const SOURCE_ACCENT: Record<string, string> = {
  github: "#6b6353", slack: "#6a5a9c", docs: "#35549d", notion: "#2d2a22",
  granola: "#43663c", gdocs: "#c8973a", docsite: "#4a7d7b",
};

/** Normalize any unknown source to the globe ("docsite") group. */
export const srcKey = (source: string) =>
  (SOURCE_ORDER as readonly string[]).includes(source) ? source : "docsite";

/* ── Roll-up constants ──────────────────────────────────────────────────── */

export const MACRO_PREFIX = "grp:";
export const STUB_PREFIX = "more:";
export const AGG_EDGE_PREFIX = "ge:";
export const GROUP_PAGE_SIZE = 25;

/** Stable aggregate bucket for the global overview. GitHub activity keeps its
    repository/kind bucket; ordinary documents roll up by connector source. */
export function overviewGroupId(node: LNode): string {
  return node.group || `source:${node.source}`;
}

function overviewGroupTitle(groupId: string, members: LNode[]): string {
  const count = members.length.toLocaleString("en-US");
  if (groupId.startsWith("gh:")) {
    const { repo, kind } = groupParts(groupId);
    return `${repo} · ${count} ${groupKindWord(kind, members.length)}`;
  }
  const source = groupId.replace(/^source:/, "");
  return `${SOURCE_LABELS[source] ?? source} · ${count} document${members.length === 1 ? "" : "s"}`;
}

export type OverviewGraph = {
  nodes: LNode[];
  edges: LEdge[];
  membersByGroup: Map<string, LNode[]>;
};

/** Collapse a corpus into a small, stable overview. Similarity is omitted:
    an embedding-neighbour relationship is not lineage and otherwise becomes
    the dominant source of cross-bucket noise at enterprise scale.

    `expanded` names the groups the reader has unfolded in place: those draw
    their own member cards, and the links between those members — which the
    roll-up has to hide, because inside one macro card there is nothing to draw
    them between. Every other group stays one card. */
export function buildOverviewGraph(
  nodes: LNode[], edges: LEdge[], minConfidence = 0.8, expanded: Iterable<string> = [],
): OverviewGraph {
  const open = new Set(expanded);
  const membersByGroup = new Map<string, LNode[]>();
  for (const node of nodes.filter((n) => !n.macro)) {
    const key = overviewGroupId(node);
    const at = membersByGroup.get(key);
    if (at) at.push(node); else membersByGroup.set(key, [node]);
  }
  const groups = [...membersByGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(groups.length))));
  const rows = Math.max(1, Math.ceil(groups.length / cols));
  const slotOf = (index: number) => ({
    x: cols === 1 ? 0.5 : 0.14 + (0.72 * (index % cols)) / (cols - 1),
    y: rows === 1 ? 0.5 : 0.2 + (0.6 * Math.floor(index / cols)) / (rows - 1),
  });

  /* An unfolded group's members are laid out in a small square centred on the
     slot its macro card held, so the reader can see which bucket opened. Past
     the canvas's declutter threshold the lanes take over anyway; this is what
     a small graph with one group open looks like. */
  const CLUSTER = 0.15;
  const unfolded = (members: LNode[], at: { x: number; y: number }): LNode[] => {
    const side = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    const step = side === 1 ? 0 : CLUSTER / (side - 1);
    return members.map((member, i) => ({
      ...member,
      x: clamp(at.x + step * ((i % side) - (side - 1) / 2), 0.06, 0.94),
      y: clamp(at.y + step * (Math.floor(i / side) - (side - 1) / 2), 0.08, 0.92),
    }));
  };

  const macroOf = (group: string, members: LNode[], at: { x: number; y: number }): LNode => {
    const source = members[0]?.source ?? "docs";
    const owners = new Map<string, number>();
    for (const member of members) if (member.owner) owners.set(member.owner, (owners.get(member.owner) ?? 0) + 1);
    const owner = [...owners].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    return {
      id: `${MACRO_PREFIX}${group}`,
      source,
      title: overviewGroupTitle(group, members),
      meta: `${members.length} rolled-up document${members.length === 1 ? "" : "s"}`,
      icon: source,
      docKind: members[0]?.docKind ?? "page",
      group,
      x: at.x,
      y: at.y,
      date: members.map((n) => n.date ?? "").sort().slice(-1)[0],
      // The bucket exists from its first member's birth: without a birthday,
      // time travel hid a roll-up's edges but left the card floating.
      createdDate: members.map((n) => n.createdDate ?? n.date ?? "").filter(Boolean).sort()[0],
      warn: members.some((n) => n.warn || n.orphan),
      owner,
      tags: [],
      staleDays: Math.max(0, ...members.map((n) => n.staleDays ?? 0)),
      orphan: false,
      inbound: members.reduce((n, member) => n + (member.inbound ?? 0), 0),
      outbound: members.reduce((n, member) => n + (member.outbound ?? 0), 0),
      macro: true,
      count: members.length,
      repo: group.startsWith("gh:") ? groupParts(group).repo : SOURCE_LABELS[source] ?? source,
    };
  };

  const drawnNodes: LNode[] = [];
  groups.forEach(([group, members], index) => {
    const at = slotOf(index);
    if (open.has(group)) drawnNodes.push(...unfolded(members, at));
    else drawnNodes.push(macroOf(group, members, at));
  });

  const groupOf = new Map<string, string>();
  for (const [group, members] of membersByGroup) for (const member of members) groupOf.set(member.id, group);
  /* Which card an endpoint is drawn as: itself inside an unfolded group, the
     macro card everywhere else. */
  const drawnFor = (id: string): string | null => {
    const group = groupOf.get(id);
    if (!group) return null;
    return open.has(group) ? id : `${MACRO_PREFIX}${group}`;
  };

  const aggregate = new Map<string, LEdge>();
  const direct: LEdge[] = [];
  for (const edge of edges) {
    if (edge.rel === "similar") continue;
    if (edge.llm && Number(edge.meta?.confidence ?? 0) < minConfidence) continue;
    const from = drawnFor(edge.from);
    const to = drawnFor(edge.to);
    // `from === to` is a link inside one card: a rolled-up bucket's internal
    // wiring, with nothing on the canvas to draw it between.
    if (!from || !to || from === to) continue;
    if (!from.startsWith(MACRO_PREFIX) && !to.startsWith(MACRO_PREFIX)) {
      // Both ends are unfolded, so the real link is drawable as itself.
      direct.push({ ...edge, from, to });
      continue;
    }
    const key = `${from}\u2192${to}:${edge.rel}`;
    const existing = aggregate.get(key);
    if (existing) existing.count = (existing.count ?? 1) + 1;
    else aggregate.set(key, {
      id: `${AGG_EDGE_PREFIX}${key}`,
      from, to, rel: edge.rel, date: edge.date, count: 1,
      dashed: edge.llm || edge.dashed,
    });
  }
  return { nodes: drawnNodes, edges: [...direct, ...aggregate.values()], membersByGroup };
}

/** A bounded semantic traversal. Edges are stored dependent -> source:
    provenance follows the arrow, while impact walks it in reverse. */
export function buildFocusedGraph(
  nodes: LNode[], edges: LEdge[], focalId: string | null,
  mode: Extract<LineageMode, "provenance" | "impact">, depth = 1, minConfidence = 0.8,
): { nodes: LNode[]; edges: LEdge[] } {
  if (!focalId || !nodes.some((n) => n.id === focalId)) return { nodes: [], edges: [] };
  const semantic = edges.filter((edge) =>
    isLineageRelation(edge.rel) && (!edge.llm || Number(edge.meta?.confidence ?? 0) >= minConfidence));
  const seen = new Set<string>([focalId]);
  let frontier = new Set<string>([focalId]);
  for (let hop = 0; hop < Math.max(1, depth); hop++) {
    const next = new Set<string>();
    for (const edge of semantic) {
      const from = mode === "provenance" ? edge.from : edge.to;
      const to = mode === "provenance" ? edge.to : edge.from;
      if (frontier.has(from) && !seen.has(to)) next.add(to);
    }
    for (const id of next) seen.add(id);
    frontier = next;
    if (!frontier.size) break;
  }
  return {
    nodes: nodes.filter((node) => seen.has(node.id)),
    edges: semantic.filter((edge) => seen.has(edge.from) && seen.has(edge.to)),
  };
}

export function groupParts(id: string): { repo: string; kind: string } {
  if (id.startsWith("source:")) {
    const source = id.slice("source:".length);
    return { repo: SOURCE_LABELS[source] ?? source, kind: "documents" };
  }
  // "gh:MariHQ/web:commits" → { repo, kind }
  const body = id.replace(/^gh:/, "");
  const lastColon = body.lastIndexOf(":");
  if (lastColon < 0) return { repo: body, kind: "" };
  return { repo: body.slice(0, lastColon), kind: body.slice(lastColon + 1) };
}

export function groupKindWord(kind: string, n: number): string {
  const map: Record<string, [string, string]> = {
    documents: ["document", "documents"],
    commits: ["commit", "commits"],
    prs: ["PR", "PRs"],
    issues: ["issue", "issues"],
  };
  const pair = map[kind];
  if (!pair) return kind;
  return n === 1 ? pair[0] : pair[1];
}

/* ── Lens palettes / helpers ────────────────────────────────────────────── */

export const LENSES: { key: Lens; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "stale", label: "Staleness" },
  { key: "owner", label: "Ownership" },
  { key: "health", label: "Health" },
];

export const OWNER_PALETTE = ["#35549d", "#6a5a9c", "#43663c", "#b04e2c", "#c8973a", "#4a7d7b", "#8a5a3b", "#a04a6e"];

export function ownerColor(owner: string): string {
  let h = 0;
  for (let i = 0; i < owner.length; i++) h = (h * 31 + owner.charCodeAt(i)) >>> 0;
  return OWNER_PALETTE[h % OWNER_PALETTE.length];
}

/* The same freshness palette the analytics chart uses — biscay-2 blue for
   fresh, light ink-toned grey for aging, the blue's complement orange for
   stale — so the product has ONE freshness language. Every stop clears
   WCAG 1.4.11 against paper. */
export const staleColor = (d: number) => (d <= 14 ? "#1E6FA8" : d <= 45 ? "#8290A0" : "#CB5E0E");

/* ── Severity (impact analysis) ─────────────────────────────────────────── */

export const SEVERITY_TASK: Record<Severity, { kind: string; kindLabel: string }> = {
  "update-required": { kind: "stale", kindLabel: "Update" },
  review: { kind: "factcheck", kindLabel: "Review" },
  minor: { kind: "approval", kindLabel: "Minor" },
};

export const SEVERITY_META: Record<Severity, { label: string; color: string; tone: string }> = {
  "update-required": { label: "Update required", color: "#c8502e", tone: "blocked" },
  review: { label: "Review", color: "#c8973a", tone: "attention" },
  minor: { label: "Minor", color: "#35549d", tone: "info" },
};

export const SEVERITY_ORDER: Severity[] = ["update-required", "review", "minor"];

/** Resolve an analysis against the graph on screen.

    The analysis names documents and the canvas draws nodes, so the two have to
    be matched before anything can be lit: by document id, which is the real
    identity, and by title for a result that carries none. A verdict about a
    document this graph does not draw is left out rather than invented onto the
    nearest card. `null` when nothing matched, so a caller can tell "no analysis"
    from "an analysis about documents that are not here". */
export function impactOverlay(result: ImpactResult | null, nodes: LNode[]): ImpactOverlay | null {
  if (!result) return null;
  const byDocId = new Map<number | string, string>();
  const byTitle = new Map<string, string>();
  for (const node of nodes) {
    if (node.macro) continue;
    if (node.docId != null && !byDocId.has(node.docId)) byDocId.set(node.docId, node.id);
    const key = node.title.trim().toLowerCase();
    if (key && !byTitle.has(key)) byTitle.set(key, node.id);
  }
  const seen = new Map<string, Severity>();
  for (const doc of result.docs) {
    const id = (doc.docId != null ? byDocId.get(doc.docId) : undefined)
      ?? byTitle.get(doc.title.trim().toLowerCase());
    if (!id) continue;
    const held = seen.get(id);
    // Two verdicts on one card: the reader has to act on the harder one.
    if (held && SEVERITY_ORDER.indexOf(held) <= SEVERITY_ORDER.indexOf(doc.severity)) continue;
    seen.set(id, doc.severity);
  }
  if (!seen.size) return null;
  return { claim: result.claim, docs: [...seen].map(([id, severity]) => ({ id, severity })) };
}

/** The analysis as a report the reader can keep: plain Markdown, the summary
    and every document under the severity that was returned for it. */
export function impactReport(result: ImpactResult): string {
  const lines = [
    "# Impact analysis",
    "",
    `Claim: ${result.claim}`,
    "",
    result.summary,
  ];
  for (const severity of SEVERITY_ORDER) {
    const docs = result.docs.filter((doc) => doc.severity === severity);
    if (!docs.length) continue;
    lines.push("", `## ${SEVERITY_META[severity].label} (${docs.length})`, "");
    for (const doc of docs) {
      lines.push(`- ${doc.title} (${SOURCE_LABELS[doc.source] ?? doc.source}): ${doc.reason}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/* ── Node surface ───────────────────────────────────────────────────────── */

/** Flat cream node fill (brand paper, warmed). No gradient, no shadow. */
export const NODE_CREAM = "#FAF7F2";
/** Cream one step down, for the node's meta strip. */
export const NODE_CREAM_DEEP = "#F3EEE4";

/* ── Shared toolbar ⇄ canvas control state ──────────────────────────────
   The toolbar and the graph render as siblings (the page composes them), so a
   plain parent `useState` cannot connect them without owning the page. This is
   a tiny external store instead: the toolbar writes, the canvas subscribes, and
   "the toolbar does nothing to the graph" stops being true. Components may
   still be driven by explicit props — a prop always wins and is pushed into the
   store on mount so both paths agree. */

export type StatusFilter = "all" | "verified" | "review" | "warnings";
export type NodeStatusKey = "verified" | "review" | "warning";

export type LineageControlState = {
  query: string;
  /** null = every source. */
  sources: string[] | null;
  /** null = every relation. */
  rels: RelKey[] | null;
  status: StatusFilter;
  lens: Lens;
  layout: LayoutMode;
  scope: "focus" | "all";
  /** As-of date (ISO yyyy-mm-dd), `null` = live / all time. It lives here for
      the same reason `path` does: the scrubber sets it and the canvas is what
      has to obey it. Before this the scrubber kept the index to itself and its
      caption described time travel that never happened. */
  asOf: string | null;
  /** Canvas scale, 1 = 100%. */
  zoom: number;
  /** Path finder: `null` = off, otherwise the node ids picked so far (0–2).
      It lives here, with the other toolbar⇄canvas state, because the picking
      happens on the canvas and the button that armed it is in the toolbar. */
  path: string[] | null;
  /** How many node cards the canvas may draw. `null` = the workspace cap the
      page was given. Raising it is a reader's decision made in the toolbar and
      obeyed by the canvas, which is why it sits here rather than in either. */
  maxNodes: number | null;
  /** Roll-up groups the reader has unfolded in place, so the overview draws
      their members instead of one macro card. Ids are the group ids, not the
      `grp:` macro node ids. */
  expanded: string[];
  /** A one-shot viewport request from the toolbar, obeyed and cleared by the
      canvas: fit everything drawn, fit the focal node and its neighbours, or
      drop the dragged positions and return to 100%. */
  viewport: "fit" | "selection" | "reset" | null;
};

const DEFAULT_CONTROLS: LineageControlState = {
  query: "", sources: null, rels: null, status: "all",
  lens: "source", layout: "flow", scope: "all", zoom: 1, path: null,
  asOf: null, maxNodes: null, expanded: [], viewport: null,
};

let controlState: LineageControlState = DEFAULT_CONTROLS;
const controlListeners = new Set<() => void>();

export function getLineageControls(): LineageControlState {
  return controlState;
}

export function setLineageControls(patch: Partial<LineageControlState>) {
  const next = { ...controlState, ...patch };
  const changed = (Object.keys(next) as (keyof LineageControlState)[]).some((k) => next[k] !== controlState[k]);
  if (!changed) return;
  controlState = next;
  for (const l of controlListeners) l();
}

function subscribeControls(cb: () => void) {
  controlListeners.add(cb);
  return () => { controlListeners.delete(cb); };
}

/** Subscribe to the shared control state. Returns [state, patch]. */
export function useLineageControls(): [LineageControlState, (patch: Partial<LineageControlState>) => void] {
  const state = useSyncExternalStore(subscribeControls, getLineageControls, getLineageControls);
  return [state, setLineageControls];
}

export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "verified", label: "Verified" },
  { key: "review", label: "Needs review" },
  { key: "warnings", label: "Warnings" },
];

/** Health bucket for one node: fresh = verified, aging = needs review. */
export function nodeStatusKey(n: LNode): NodeStatusKey {
  if (n.warn || n.orphan) return "warning";
  if ((n.staleDays ?? 0) > 14) return "review";
  return "verified";
}

/* ── Time travel (as-of) ────────────────────────────────────────────────────
   The three predicates the scrubber's caption is a description of. A document
   that did not exist on the as-of date is not drawn, a link that had not been
   made yet is not drawn, and a document whose latest edit is still in the
   future is drawn dashed. All three read dates the graph already carries, so
   nothing here is invented: a node with no date is simply not time-filtered. */

/** The date a node came into existence, as far as the graph knows. */
const bornOn = (n: LNode) => n.createdDate ?? n.date;

/** Did this node not exist yet on `asOf`? A macro roll-up's birthday is its
    earliest member's, so a bucket whose first document postdates the cutoff
    hides with its edges instead of floating unconnected. */
export const nodeCreatedAfter = (n: LNode, asOf: string | null): boolean => {
  if (!asOf) return false;
  const born = bornOn(n);
  return !!born && born > asOf;
};

/** Did this node exist on `asOf`, but pick up its latest edit after it? */
export const nodeEditedAfter = (n: LNode, asOf: string | null): boolean =>
  !!asOf && !!n.date && n.date > asOf && !nodeCreatedAfter(n, asOf);

/** Was this link made after `asOf`? Undated links are left alone. */
export const edgeCreatedAfter = (e: LEdge, asOf: string | null): boolean =>
  !!asOf && !!e.date && e.date > asOf;

/** Does this node survive the current source + status + as-of filters? */
export function nodePasses(n: LNode, c: LineageControlState): boolean {
  if (nodeCreatedAfter(n, c.asOf)) return false;
  if (c.sources && !n.macro && !c.sources.includes(n.source)) return false;
  if (c.status !== "all" && !n.macro) {
    const k = nodeStatusKey(n);
    if (c.status === "verified" && k !== "verified") return false;
    if (c.status === "review" && k !== "review") return false;
    if (c.status === "warnings" && k !== "warning") return false;
  }
  return true;
}

/** Search match (used to spotlight rather than remove). */
export function nodeMatchesQuery(n: LNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    n.title.toLowerCase().includes(q) ||
    (n.owner ?? "").toLowerCase().includes(q) ||
    n.source.toLowerCase().includes(q) ||
    (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
  );
}

/* ── Path finder ────────────────────────────────────────────────────────── */

/** Fewest-hop route between two nodes, as the ids along it (both ends
    included), or `null` when nothing connects them. Undirected on purpose: a
    reader asking "how are these two documents related" does not care which way
    the arrows point, and half the corpus is only reachable upstream. */
export function findPath(fromId: string, toId: string, edges: LEdge[]): string[] | null {
  if (fromId === toId) return [fromId];
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const at = adj.get(a);
    if (at) at.push(b); else adj.set(a, [b]);
  };
  for (const e of edges) { link(e.from, e.to); link(e.to, e.from); }
  const prev = new Map<string, string>([[fromId, fromId]]);
  const queue = [fromId];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const next of adj.get(cur) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === toId) {
        const out = [toId];
        while (out[0] !== fromId) out.unshift(prev.get(out[0])!);
        return out;
      }
      queue.push(next);
    }
  }
  return null;
}

/** What the canvas draws for a resolved path: the nodes on it, every edge
    joining two consecutive ones, and the hop count. `null` while fewer than two
    nodes are picked, or when the two picked are not connected at all. */
export type PathTrace = { ids: string[]; nodes: Set<string>; edges: Set<string>; hops: number };

export function tracePath(picks: string[] | null, edges: LEdge[]): PathTrace | null {
  if (!picks || picks.length < 2) return null;
  const ids = findPath(picks[0], picks[1], edges);
  if (!ids) return null;
  const onPath = new Set<string>();
  for (let i = 0; i < ids.length - 1; i++) {
    for (const e of edges) {
      if ((e.from === ids[i] && e.to === ids[i + 1]) || (e.to === ids[i] && e.from === ids[i + 1])) onPath.add(e.id);
    }
  }
  return { ids, nodes: new Set(ids), edges: onPath, hops: ids.length - 1 };
}

/** Accent color per toolbar control — each control owns one hue. */
export const CONTROL_ACCENT: Record<string, string> = {
  search: "#10263B",
  sources: "#1E6FA8",
  relations: "#6a5a9c",
  status: "#A05E1C",
  zoom: "#4a7d7b",
  lens: "#2C6E49",
  layout: "#35549d",
  flow: "#8a5a3b",
  views: "#a04a6e",
};

/* ── Pure helpers ───────────────────────────────────────────────────────── */

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function downloadText(name: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Presentational helpers (shared across drawers + graph) ─────────────── */

/** Source/kind node glyph: the node's own source mark, roll-up or not. The
    macro branch hard-coded the GitHub mark, which put an octocat on Notion,
    Slack, and Drive buckets beside their correct source chips. */
export function NodeGlyph({ node, size = 18 }: { node: Pick<LNode, "source" | "macro">; size?: number }) {
  return <SourceMark provider={node.source === "gdocs" ? "gdocs" : node.source} size={size} />;
}

/** Inline SVG line swatch: the relation's own color, dash pattern and weight,
    so the swatch matches the edge drawn on the canvas exactly. */
export function EdgeSwatch({ rel, width = 22, dashed }: { rel: RelKey; width?: number; dashed?: boolean }) {
  const s = REL[rel];
  const dash = dashed === true ? (s.dash ?? "3 3") : dashed === false ? undefined : s.dash;
  return (
    <svg width={width} height={9} viewBox="0 0 22 9" aria-hidden className="shrink-0">
      <line x1={1} y1={4.5} x2={21} y2={4.5} stroke={s.color} strokeWidth={s.width} strokeLinecap="butt" strokeDasharray={dash} />
    </svg>
  );
}

/** A line-swatch + directional title + subline + trailing focus row.
    Reused across node / edge / group / trace lists. */
export function ConnectionRow({
  rel, dir = "out", dashed, title, subline, onSelect, onFocus,
}: {
  rel: RelKey;
  dir?: "out" | "in";
  dashed?: boolean;
  title: ReactNode;
  subline?: ReactNode;
  onSelect?: () => void;
  onFocus?: () => void;
}) {
  return (
    /* No negative margins: a `-mx-2` bleed pushed the row 8px past the
       drawer's content edge on every list in every drawer. */
    <div className={`group flex items-center gap-2.5 rounded-[4px] border border-transparent px-2 py-1.5 hover:border-ink/12 hover:bg-flysch/60 ${onSelect ? "cursor-pointer" : ""}`}>
      <EdgeSwatch rel={rel} dashed={dashed} />
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-w-0 flex-1 items-start gap-1.5 text-left ${focusRing} rounded-[3px]`}
      >
        <span className="mt-[1px] shrink-0 font-term text-[12px] text-ink/65">{dir === "out" ? "→" : "←"}</span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-ink">{title}</span>
          {subline && <span className="block truncate font-term text-[11px] text-ink/65">{subline}</span>}
        </span>
      </button>
      {onFocus && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFocus(); }}
          className={`shrink-0 rounded-[3px] px-1.5 py-0.5 font-term text-[11px] text-ink/65 opacity-0 hover:text-ink group-hover:opacity-100 ${focusRing}`}
          title="Focus on the canvas"
        >
          ⌖ focus
        </button>
      )}
    </div>
  );
}

/** The bespoke non-modal `.lg-drawer` shell shared by all four lineage
    drawers: paper panel, hairline border, NO backdrop / focus-trap (so the
    canvas stays interactive). Not the catalog `Drawer`. */
export function LgDrawerShell({
  icon, title, summary, pills, footer, onClose, width = LG_DRAWER_W, children, className = "",
}: {
  icon: ReactNode;
  /** Slot 1: the header/title of the CARD (not of the document). */
  title: ReactNode;
  /** Slot 2: one line of supporting text under the card header. */
  summary?: ReactNode;
  pills?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  width?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      aria-label={typeof title === "string" ? title : "Lineage detail"}
      // Desktop-fixed width (CONVENTIONS.md §10): one number, no breakpoints.
      // minWidth keeps the panel from being squeezed by a narrow parent — a
      // squeezed drawer reads as a broken mobile layout.
      style={{ width, minWidth: width, maxHeight: 720 }}
      className={`${card} flex flex-col overflow-hidden font-display ${className}`.trim()}
    >
      <header className="shrink-0 border-b border-ink/10 px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-ink/70" aria-hidden>{icon}</span>
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <div className="text-[14.5px] font-semibold leading-snug text-ink">{title}</div>
            {summary && <div className="mt-0.5 text-[12.5px] leading-snug text-ink/70">{summary}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-[4px] text-ink/65 hover:bg-flysch hover:text-ink active:bg-ink/10 ${focusRing}`}
          >
            ✕
          </button>
        </div>
        {pills && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{pills}</div>}
      </header>
      {/* min-h-0 grow, not flex-1: the 0% basis collapsed this wrapper inside
          the max-height (auto-height) aside and body content painted over the
          footer. basis:auto sizes to content, then shrinks and scrolls once
          the 720px cap bites. */}
      <Scrollable axis="y" className="min-h-0 grow" scrollerClassName="px-4 py-4">{children}</Scrollable>
      {footer && <footer className="shrink-0 border-t border-ink/10 px-4 py-3">{footer}</footer>}
    </aside>
  );
}

/** Source identity chip: brand glyph + label. Same object in all four drawers
    so the "source badge" slot (CONVENTIONS §1.6) reads identically. */
export function LgSourceChip({ source }: { source: string }) {
  return (
    <Chip
      label={SOURCE_LABELS[source] ?? source}
      tone="neutral"
      icon={<SourceMark provider={source === "gdocs" ? "gdocs" : source} size={13} />}
    />
  );
}

/** Status badge for one node, derived from health + staleness. Never color
    alone: the chip carries its own word and a dot. */
export function LgNodeStatusChip({ node }: { node: LNode }) {
  const k = nodeStatusKey(node);
  return <StatusChip status={k === "warning" ? "warn" : k === "review" ? "needs-review" : "verified"} />;
}

/** The date + author pair that sits on the RIGHT of the meta line. The author
    is deliberately higher-contrast than the date (client note). */
export function LgAuthor({ name }: { name?: string }) {
  return <span className="font-medium text-ink/85">{name?.trim() ? name : "Unowned"}</span>;
}

/** Owners block used by every drawer's "Owners" section. */
export function LgOwners({ owners }: { owners: { name: string; role: string }[] }) {
  if (owners.length === 0) return <p className="text-[12.5px] text-ink/70">No owner recorded.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {owners.map((o, i) => (
        <li key={i} className="flex items-center gap-2 text-[13px] text-ink">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[3px] border border-ink/15 bg-flysch font-term text-[10px] font-semibold text-ink/75">
            {o.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink/85">{o.name}</span>
          <span className="shrink-0 font-term text-[11px] text-ink/65">{o.role}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shared drawer widths. Node / edge / roll-up share one number so the three
    panels are interchangeable; the impact analyser is one step wider because it
    carries an input, three buckets and a document list. */
export const LG_DRAWER_W = 420;
export const LG_DRAWER_W_WIDE = 460;

/** Inline result panel used by the drawers' "make something happen" buttons
    (trace impact / provenance, export, expand group, full history). */
export function LgResultPanel({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-[4px] border border-biscay-2/30 bg-biscay-2/[0.06] px-3 py-2.5">
      <div className="text-[12.5px] font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 text-[12.5px] leading-relaxed text-ink/70">{children}</div>}
    </div>
  );
}

/** A secondary button that visibly latches when it is "on". Plain hover states
    were not enough of a change indicator for toggles like Watch / Pin. */
export const lgToggleOn = "border-biscay-2 bg-biscay-2/[0.10] text-biscay-2 hover:border-biscay-2 hover:text-biscay-2";

/** Sorted unique event dates across nodes + edges (the scrubber's snap
    targets). A pure function of the graph, so it is derived, never authored. */
export const eventDates = (nodes: LNode[], edges: LEdge[]): string[] =>
  Array.from(new Set([
    ...nodes.flatMap((n) => [n.date, n.createdDate].filter(Boolean) as string[]),
    ...edges.map((e) => e.date).filter(Boolean) as string[],
  ])).sort();

export const nodeById = (nodes: LNode[]) =>
  Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, LNode>;

/* ── LineageDataModel — visual legend (so the model spec has a gallery view) */

function Swatch({ rel }: { rel: RelKey }) {
  const s = REL[rel];
  return (
    <svg width={40} height={9} viewBox="0 0 40 9" aria-hidden className="shrink-0">
      <line x1={1} y1={4.5} x2={39} y2={4.5} stroke={s.color} strokeWidth={s.width} strokeLinecap="butt" strokeDasharray={s.dash} />
    </svg>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />;
}

export type LineageDataModelProps = {
  /** The graph the footer line counts. The legend itself is pure palette, but
      it reports the size of the model it is describing, so the graph is a
      required input rather than a baked-in demo (MIGRATION.md). */
  nodes: LNode[];
  edges: LEdge[];
  dates: string[];
  /** Render a content-shaped skeleton silhouette instead of the legend. */
  loading?: boolean;
  className?: string;
};

/** Legend / palette reference for the lineage model: relation types, source
    identities, staleness + health lenses, and impact severities. */
export function LineageDataModel({ nodes, edges, dates, loading = false, className = "" }: LineageDataModelProps) {
  if (loading) {
    return (
      <div className={`${card} w-[640px] min-w-[640px] p-5 ${className}`.trim()} aria-hidden="true">
        <div className="mb-4 space-y-2"><Skeleton width={200} height={16} /><SkeletonLine w={320} h={10} /></div>
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine w={90} h={9} />
              {Array.from({ length: 4 }).map((_, j) => <SkeletonLine key={j} w={`${72 - j * 8}%`} h={11} />)}
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-ink/10 pt-3"><SkeletonLine w="60%" h={10} /></div>
      </div>
    );
  }

  return (
    <div className={`${card} w-[640px] min-w-[640px] p-5 font-display text-ink ${className}`.trim()}>
      <div className="mb-4">
        <div className="text-[15px] font-semibold">Lineage model: legend</div>
        <div className="mt-0.5 text-[12.5px] text-ink/70">The shared palettes every lineage view reads from.</div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <SectionLabel>Relations</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {REL_ORDER.map((k) => (
              <li key={k} className="flex items-center gap-2.5 text-[13px]">
                <Swatch rel={k} />
                <span className="font-term text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink/70">{REL[k].code}</span>
                <span>{REL[k].label}</span>
                <span className="ml-auto font-term text-[11px] text-ink/65">{REL[k].pattern}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-ink/70">
            Every relation carries three channels: color, dash pattern, and the
            code printed on the edge. Color is never the only signal.
          </p>
        </section>

        <section>
          <SectionLabel>Sources</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {SOURCE_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-2.5 text-[13px]">
                <SourceMark provider={s === "gdocs" ? "gdocs" : s} size={16} />
                <span>{SOURCE_LABELS[s]}</span>
                <span className="font-term text-[11px] text-ink/65">{SOURCE_GLYPH[s]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionLabel>Node</SectionLabel>
          <div className="mt-2 flex items-stretch overflow-hidden rounded-[4px] border border-ink/20" style={{ backgroundColor: NODE_CREAM }}>
            <span className="w-[5px] shrink-0" style={{ backgroundColor: SOURCE_ACCENT.docs }} aria-hidden />
            <span className="flex min-w-0 items-center gap-2 px-2.5 py-1.5">
              <SourceMark provider="docs" size={16} />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium text-ink">Pricing policy</span>
                <span className="block truncate font-term text-[10.5px] text-ink/70">DOCS · Ana K</span>
              </span>
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink/70">
            Flat cream card. The source is a bar on the left plus an icon and a
            mono source label, so the color bar is never read alone.
          </p>
        </section>

        <section>
          <SectionLabel>Staleness lens</SectionLabel>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            <li className="flex items-center gap-2.5"><Dot color={staleColor(5)} /> Fresh · ≤ 14 days</li>
            <li className="flex items-center gap-2.5"><Dot color={staleColor(30)} /> Aging · ≤ 45 days</li>
            <li className="flex items-center gap-2.5"><Dot color={staleColor(90)} /> Stale · &gt; 45 days</li>
          </ul>
        </section>

        <section>
          <SectionLabel>Impact severity</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {(Object.keys(SEVERITY_META) as Severity[]).map((s) => (
              <li key={s} className="flex items-center gap-2.5 text-[13px]">
                <Dot color={SEVERITY_META[s].color} />
                <span>{SEVERITY_META[s].label}</span>
                <Chip label={SEVERITY_TASK[s].kindLabel} tone={SEVERITY_META[s].tone} className="ml-auto" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 border-t border-ink/10 pt-3 font-term text-[11px] text-ink/65">
        {nodes.filter((n) => !n.macro).length} document nodes · {edges.length} edges · {dates.length} event dates · virtual space 1600×900
      </div>
    </div>
  );
}
