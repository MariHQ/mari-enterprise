/** Pure presentation mapping shared by platform adapters. */
import type { LineageCrumb, LineageData, LineageDrawer } from "@mari-design/components/pages/LineagePage";
import { groupKindWord, groupParts, type LEdge, type LNode, type Lens, type LayoutMode, type LineageMode } from "@mari-design/components/features/LineageDataModel";

type Res = {
  lineage: {
    id: string; docId: number | string; source: string; title: string; meta: string; icon: string;
    x: number; y: number; pinned: boolean; date: string; createdDate: string; warn: boolean;
    owner: string; tags: string[]; staleDays: number; orphan: boolean;
    inbound: number; outbound: number; docKind: string; group: string;
  }[];
  lineageEdges: {
    id: number | string; fromId: string; toId: string; kind: string; date: string;
    meta: { derived?: string; confidence?: number; note?: string; evidence?: string; status?: string } | null;
  }[];
  graphStats: { activity: { date: string; count: number }[] } | null;
  graphViews: { id: number; name: string; state: string }[];
  settings: { key: string; value: unknown }[];
};

export type LineageView = {
  lens: Lens;
  layout: LayoutMode;
  mode: LineageMode;
  focalId: string | null;
  trace: { originId: string; direction: "down" | "up" } | null;
  asOf: string | null;
  query: string | null;
  node: string | null;
  edge: string | null;
  group: string | null;
  /** Roll-up groups a link asks to open unfolded on the canvas. */
  expand: string[];
};

const LENSES = new Set<Lens>(["source", "stale", "owner", "health"]);

const LAYOUTS = new Set<LayoutMode>(["flow", "timeline"]);

const MODES = new Set<LineageMode>(["documents", "overview", "provenance", "impact"]);

export function readView(params: URLSearchParams): LineageView {
  const lens = params.get("lens") as Lens | null;
  const layout = params.get("layout") as LayoutMode | null;
  const trace = params.get("trace");
  const mode = params.get("mode") as LineageMode | null;
  return {
    lens: lens && LENSES.has(lens) ? lens : "source",
    layout: layout && LAYOUTS.has(layout) ? layout : "flow",
    mode: mode && MODES.has(mode) ? mode : "documents",
    focalId: params.get("focal") || null,
    // Direction is part of what a trace IS (upstream provenance vs downstream
    // impact), so a trace with no readable direction traces downstream rather
    // than not tracing at all.
    trace: trace ? { originId: trace, direction: params.get("dir") === "up" ? "up" : "down" } : null,
    asOf: params.get("asOf") || null,
    query: params.get("q") || null,
    node: params.get("node") || null,
    edge: params.get("edge") || null,
    group: params.get("group") || null,
    // Same contract as `q`: the link seeds it, the reader owns it from there.
    expand: (params.get("expand") || "").split(",").map((g) => g.trim()).filter(Boolean),
  };
}

function asOfIndex(dates: string[], asOf: string | null): number | null {
  if (!asOf) return null;
  let found: number | null = null;
  for (let i = 0; i < dates.length; i++) if (dates[i] <= asOf) found = i;
  return found;
}

function drawerFor(view: LineageView, nodes: LNode[], edges: LEdge[]): LineageDrawer | null {
  if (view.node) {
    const node = nodes.find((n) => n.id === view.node);
    // `history: null` says the page is not carrying this node's revisions —
    // the drawer asks for them itself (actions.loadDocHistory) rather than
    // being handed an empty timeline that reads as "nothing ever happened".
    return node ? { kind: "node", nodeId: node.id, history: null } : null;
  }
  if (view.edge) {
    const edge = edges.find((e) => e.id === view.edge);
    return edge ? { kind: "edge", edgeId: edge.id } : null;
  }
  if (view.group) {
    const members = nodes.filter((n) => n.group === view.group);
    return members.length
      ? { kind: "group", groupId: view.group, totalMembers: members.length, members }
      : null;
  }
  // The assert drawer renders what `analyzeImpact` returned; there is no
  // result to deep-link to, so it is never opened from a URL.
  return null;
}

export function lineageHref(view: LineageView, over: Record<string, string | null>): string {
  const params = new URLSearchParams();
  if (view.lens !== "source") params.set("lens", view.lens);
  if (view.layout !== "flow") params.set("layout", view.layout);
  if (view.asOf) params.set("asOf", view.asOf);
  if (view.query) params.set("q", view.query);
  for (const [key, value] of Object.entries(over)) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/lineage?${qs}` : "/lineage";
}

const MODE_LABEL: Record<LineageMode, string> = {
  documents: "Documents",
  overview: "Overview",
  provenance: "Provenance",
  impact: "Impact",
};

function groupLabel(groupId: string): string {
  const { repo, kind } = groupParts(groupId);
  const word = groupKindWord(kind, 2);
  return word ? `${repo} ${word}` : repo;
}

export function buildCrumbs(view: LineageView, nodes: LNode[]): LineageCrumb[] | null {
  const focal = view.focalId ? nodes.find((n) => n.id === view.focalId) ?? null : null;
  const opened = view.node ? nodes.find((n) => n.id === view.node) ?? null : null;
  const leaf = opened ?? focal;
  const group = view.group || leaf?.group || null;
  if (view.mode === "documents" && !leaf && !group) return null;

  const trail: LineageCrumb[] = [{ label: "Lineage", href: lineageHref(view, {}) }];
  const mode = view.mode === "documents" ? null : view.mode;
  if (mode) {
    trail.push({ label: MODE_LABEL[view.mode], href: lineageHref(view, { mode, focal: view.focalId }) });
  }
  if (group) {
    // A bucket is an overview idea, so its crumb opens the overview on it.
    trail.push({ label: groupLabel(group), href: lineageHref(view, { mode: "overview", group }) });
  }
  if (leaf) {
    trail.push({ label: leaf.title, href: lineageHref(view, { mode, focal: leaf.id, node: opened?.id ?? null }) });
  }
  if (trail.length === 1) return null;
  // The last crumb is where the reader already is (§ Breadcrumb): no link.
  return trail.map((crumb, i) => (i === trail.length - 1 ? { label: crumb.label } : crumb));
}

const DOC_KINDS = new Set<LNode["docKind"]>([
  "page", "commit", "pr", "issue", "answer", "decision", "seed",
]);

const REL: Record<string, LEdge["rel"]> = {
  references: "references",
  reference: "references",
  links_to: "references",
  discussed: "discussed",
  derived: "derived",
  translates: "translates",
  contradicts: "contradicts",
  similar: "similar",
};

export function mapNodes(res: Res): LNode[] {
  return (res.lineage ?? [])
    .filter((n) => DOC_KINDS.has(n.docKind as LNode["docKind"]))
    .map<LNode>((n) => ({
      id: n.id,
      docId: n.docId,
      source: n.source,
      title: n.title,
      meta: n.meta,
      icon: n.icon,
      docKind: n.docKind as LNode["docKind"],
      group: n.group,
      x: n.x,
      y: n.y,
      date: n.date,
      createdDate: n.createdDate,
      pinned: n.pinned,
      warn: n.warn,
      owner: n.owner,
      tags: n.tags ?? [],
      staleDays: n.staleDays,
      orphan: n.orphan,
      inbound: n.inbound,
      outbound: n.outbound,
      // macro/count/repo describe a roll-up the server does not fold for us:
      // it returns every node plus its `group`, and the graph rolls up.
    }));
}

export function mapEdges(res: Res, nodes: LNode[]): LEdge[] {
  const known = new Set(nodes.map((n) => n.id));
  return (res.lineageEdges ?? [])
    .filter((e) => REL[e.kind] && known.has(e.fromId) && known.has(e.toId))
    .map<LEdge>((e) => ({
      id: String(e.id),
      from: e.fromId,
      to: e.toId,
      rel: REL[e.kind],
      date: e.date,
      // `derived: "llm"` is how links.py records a machine-proposed edge; the
      // graph draws those dashed and badges them.
      llm: e.meta?.derived === "llm",
      meta: e.meta ?? undefined,
    }));
}

export const EMPTY: LineageData = {
  nodes: [], edges: [], dates: [], activity: [], views: [],
  lens: "source", layout: "flow", mode: "documents", tuning: { maxNodes: 35, hopDepth: 1, minConfidence: 0.8 },
  focalId: null, trace: null, asOf: null, search: null, drawer: null,
  crumbs: null, extras: null, action: null,
};

const LIVE: LineageView = {
  lens: "source", layout: "flow", mode: "documents", focalId: null, trace: null,
  asOf: null, query: null, node: null, edge: null, group: null, expand: [],
};

export function buildLineage(res: Res | null, view: LineageView = LIVE): LineageData {
  if (!res) return EMPTY;
  const nodes = mapNodes(res);
  const edges = mapEdges(res, nodes);
  // The scrubber snaps to the dates something actually happened on, which is
  // the same series that draws its density track.
  const activity = (res.graphStats?.activity ?? []).filter((a) => a.date);
  const dates = activity.map((a) => a.date);
  // A focal id that names no node is not a focus; the graph would close over
  // nothing and render an empty canvas.
  const focal = view.focalId ? nodes.find((n) => n.id === view.focalId) ?? null : null;
  const traced = view.trace && nodes.some((n) => n.id === view.trace!.originId) ? view.trace : null;
  const tuningRow = (res.settings ?? []).find((setting) => setting.key === "lineage")?.value;
  const tuning = tuningRow && typeof tuningRow === "object" ? tuningRow as Record<string, unknown> : {};
  const maxNodes = Math.round(Math.max(8, Math.min(35, Number(tuning.max_nodes) || 35)));
  const hopDepth = Math.round(Math.max(1, Math.min(3, Number(tuning.hop_depth) || 1)));
  const minConfidence = Math.max(0.5, Math.min(1, Number(tuning.min_confidence) || 0.8));
  return {
    nodes,
    edges,
    dates,
    activity,
    // Saved views, so the Views menu can list what `saveView` wrote. It used
    // to write with nothing reading it back.
    views: (res.graphViews ?? []).map((v) => ({ id: v.id, name: v.name, state: v.state })),
    lens: view.lens,
    layout: view.layout,
    mode: view.mode,
    tuning: { maxNodes, hopDepth, minConfidence },
    focalId: focal?.id ?? null,
    trace: traced,
    asOf: asOfIndex(dates, view.asOf),
    search: view.query ? { query: view.query } : null,
    // Only groups the graph actually has: unfolding a bucket that is not there
    // would leave an "Expanded" chip standing for nothing.
    expanded: view.expand.filter((group) => nodes.some((n) => (n.group || `source:${n.source}`) === group)),
    drawer: drawerFor(view, nodes, edges),
    // The trail out of whatever the reader drilled into, from the URL that
    // took them there. `null` on a fresh graph: there is nothing to go back
    // out of yet, and a one-crumb trail is furniture.
    crumbs: buildCrumbs(view, nodes),
    // The long-text extras card has no source in the graph query; it is a
    // canvas composition.
    extras: null,
    // The header's "document being traced" names the focal document and
    // carries its id, so the button has a real destination. Nothing in focus,
    // no button.
    // A node with no docId stands for no document, so there would be nothing
    // for the button to open — no button rather than a dead one.
    action: focal?.docId ? { label: focal.title, docId: focal.docId } : null,
  };
}
