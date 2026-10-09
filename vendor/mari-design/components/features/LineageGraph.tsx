import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus, Maximize2, Move } from "lucide-react";
import { card } from "../tokens/card";
import { focusRing } from "../tokens/focusRing";
import { Chip } from "../data-display/Chip";
import type { ChipTone } from "../data-display/Chip";
import { Button } from "../actions/Button";
import { Skeleton, SkeletonLine } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";
import { Truncate, TruncateInline } from "../data-display/Truncate";
import { WriteError } from "../feedback/WriteError";
import { useWrite } from "../actions/useWrite";
import { fmtDate } from "../tokens/format";
import {
  REL, REL_ORDER, NodeGlyph, staleColor, ownerColor, SOURCE_ACCENT, SOURCE_LABELS,
  NODE_CREAM, clamp, useLineageControls, nodePasses, nodeMatchesQuery,
  nodeById, tracePath, nodeEditedAfter, edgeCreatedAfter, nodeStatusKey,
  buildOverviewGraph, buildFocusedGraph, isLineageRelation, groupParts,
  overviewGroupId, MACRO_PREFIX,
  LINEAGE_RELATIONS, SEVERITY_META, SEVERITY_ORDER,
  type LNode, type LEdge, type Lens, type LayoutMode, type LineageMode,
  type ImpactOverlay, type Severity,
} from "./LineageDataModel";

/* ─────────────────────────────────────────────────────────────────────────
   Lineage graph canvas (feature: lineage-graph)

   The central instrument of the lineage page: a directed graph of document
   nodes + typed edges, drawn as inline SVG edges under absolutely-positioned
   HTML node cards over a faint paper grid. There is no graph engine behind it
   and none is planned: the layout arrives with the data (the server does the
   auto-layout), so the canvas only has to place, filter and draw.

   The canvas is live, not a picture: drag the background to pan, drag a node to
   move it, click to select, and the zoom controls drive a real scale transform.
   Filters, lens, layout and zoom come from the shared control store, so the
   toolbar above actually operates this canvas.

   Node design: FLAT cream cards. The type/source is a solid bar down the LEFT
   edge, backed by an icon and a mono source label, so color is never the only
   distinguisher. Relations differ by color AND dash pattern AND weight AND the
   code printed on the edge.
   ──────────────────────────────────────────────────────────────────────── */

const VB_W = 1000;
const VB_H = 560;

export type LineageGraphProps = {
  nodes: LNode[];
  edges: LEdge[];
  /** Seeds the shared control store's layout. The store is the single source
      of truth after that, so the toolbar's own Layout control keeps working;
      passing this again with the same value does not undo a reader's choice. */
  layout?: LayoutMode;
  /** Seeds the shared control store's lens. Same contract as `layout`. */
  lens?: Lens;
  /** Initially selected / focal node id. */
  focalId?: string | null;
  /** Show the "Impact of …" trace summary + dim everything outside it. */
  trace?: { originId: string; direction: "down" | "up" } | null;
  /** The user question this canvas answers. Overview aggregates; the two
      focused modes traverse only directional lineage relations. */
  mode?: LineageMode;
  /** An impact analysis's answer, drawn over whatever this canvas is showing:
      the documents it named keep their colour and take their severity, and
      everything else recedes. Unlike `trace`, which walks recorded edges, this
      is a semantic verdict about documents that may share no link at all,
      which is why it arrives as an explicit set rather than being derived. */
  impact?: ImpactOverlay | null;
  /** Take the analysis back off the canvas. Without it the overlay's own
      "Clear" is not offered, because it would clear nothing the page knows
      about and the analysis would come straight back on the next render. */
  onClearImpact?: () => void;
  /** Maximum dependency hops in provenance / impact mode. */
  hopDepth?: number;
  /** Minimum confidence for machine-proposed dependency edges. */
  minConfidence?: number;
  /** Hard cap on how many node cards the canvas will draw at once. Past this
   *  the graph keeps the best-connected nodes and says how many it dropped,
   *  rather than painting an unreadable hairball. */
  maxNodes?: number;
  onSelectNode?: (id: string) => void;
  onSelectGroup?: (groupId: string) => void;
  onSelectEdge?: (id: string) => void;
  /** Persist where a node was dragged to, so the position survives a reload.
      May throw; the canvas shows the message over the graph. Omitted = the
      move stays local, which is what the design canvas renders. */
  onPinNode?: (args: { docId: number | string; x: number; y: number }) => void | Promise<void>;
  /** What the canvas ended up drawing, reported whenever the numbers change:
      how many cards are on screen, how many passed the filters, how many the
      graph holds, and the cap in force. The toolbar renders this as an honest
      "showing N of M" with a control to raise the cap — the cap is applied
      here, so this is the only place that knows the true numbers. */
  onVolume?: (volume: { shown: number; matching: number; total: number; cap: number }) => void;
  /** Render a content-shaped skeleton silhouette instead of the graph. */
  loading?: boolean;
  className?: string;
};

/** Lens → accent color for a node's left bar. */
function accentColor(node: LNode, lens: Lens): string {
  if (lens === "source") return SOURCE_ACCENT[node.source] ?? "#6b6353";
  if (lens === "stale") return staleColor(node.staleDays ?? 0);
  if (lens === "owner") return node.owner ? ownerColor(node.owner) : "#8a7f68";
  if (node.warn || node.orphan) return "#c0392b";
  return "#43663c";
}

/** Second, non-color channel for the left bar: what the lens is saying. */
function accentWord(node: LNode, lens: Lens): string {
  if (lens === "source") return SOURCE_LABELS[node.source] ?? node.source;
  if (lens === "stale") return `${node.staleDays ?? 0} days`;
  if (lens === "owner") return node.owner ?? "Unowned";
  return node.warn || node.orphan ? "Warn" : "OK";
}

/** Third channel again, for readers who cannot separate the bar's hues: the
    chip's own tone. Source and owner are categories, not verdicts, so they
    stay neutral rather than colouring a healthy document red by accident. */
function accentTone(node: LNode, lens: Lens): ChipTone {
  if (lens === "health") return node.warn || node.orphan ? "blocked" : "ok";
  if (lens === "stale") {
    const days = node.staleDays ?? 0;
    return days <= 14 ? "ok" : days <= 45 ? "attention" : "blocked";
  }
  return "neutral";
}

/** Directed BFS closure over edges (down = impact, up = provenance). */
function traceClosure(originId: string, dir: "down" | "up", edges: LEdge[]): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of edges.filter((edge) => isLineageRelation(edge.rel))) {
    // Stored direction is dependent -> source. Provenance follows it; impact
    // walks it backwards from a source to the documents that depend on it.
    const key = dir === "up" ? e.from : e.to;
    const val = dir === "up" ? e.to : e.from;
    (adj.get(key) ?? adj.set(key, []).get(key)!).push(val);
  }
  const seen = new Set<string>([originId]);
  const stack = [originId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nxt of adj.get(cur) ?? []) if (!seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
  }
  return seen;
}

/* ── Volume defences ──────────────────────────────────────────────────────
   A real lineage graph is hundreds of nodes and edges. Drawn literally, 150
   cards over a 1000×560 canvas overlap into a hairball, every edge code stacks
   on top of its neighbours, and nothing is readable. Three defences, in order:

   1. CAP     — draw at most `maxNodes` cards, keeping the best-connected ones
                (plus the focal / trace origin) and reporting the remainder.
   2. PACK    — the authored layout arrives as 0..1 fractions, which say
                nothing about how wide a card is. Whenever those fractions put
                two card BOXES on top of each other at the canvas's real pixel
                size, the packer takes over: source lanes, laid out in pixels
                around the card box plus a minimum gap, so cards cannot touch.
                A layout that already reads clear is left exactly as authored.
   3. QUIET   — past LABEL_LIMIT edges, drop the per-edge relation codes; the
                legend still carries them and the dash patterns still read. */

const DEFAULT_MAX_NODES = 35;
/** Above this many drawn edges the per-edge codes stop being painted. */
const LABEL_LIMIT = 40;
/** Node card width in px, and its half — the card is centred on its position,
    so half a card is how far inside the canvas the centre has to stay. The
    card's own class is the literal `w-[168px]`; keep the two in step. */
const CARD_W = 168;
const CARD_HALF = CARD_W / 2;
/** A two-line card's height. The real one is measured off a rendered card, so
    a taller card (a second line that wraps, a macro card's heavier border)
    still gets its own row; this is the value used until that measurement
    lands, and the bounds it is trusted between. */
const CARD_H = 50;
const CARD_H_MIN = 36;
const CARD_H_MAX = 120;
/** The air the packer leaves between two card boxes. This is a FLOOR, not a
    fixed value: the grid opens out to fill whatever room the current scale
    gives it, and closes back down to exactly this and never less. */
const GAP_X = 16;
const GAP_Y = 12;
/** …and a ceiling on that opening out, in cells. Zoomed far enough out the
    room is unbounded, and a grid that keeps growing with it stops reading as
    a grid and starts reading as scattered cards. */
const SPREAD_MAX = 2.6;
/** The canvas overlays — zoom cluster, filter readout, drag hint, trace panel
    — sit in the corners at a fixed size whatever the zoom, so the packed rows
    start below them and stop above them rather than under them. */
const PAD_X = 14;
const PAD_TOP = 64;
const PAD_BOTTOM = 48;
/** How close two authored cards may come before the packer takes the layout
    over. A hand-authored graph is allowed to be tight; it is not allowed to
    overlap. */
const TOUCH_X = 8;
const TOUCH_Y = 6;
/** Fallbacks for the card's share of the canvas, used by "fit to view" before
    the canvas has been measured. */
const CARD_FRAC_W = 0.21;
const CARD_FRAC_H = 0.15;

type Pt = { x: number; y: number };
type CardBox = { w: number; h: number };

/** Measuring has to land before the browser paints, or the first frame shows
    the unpacked layout and then jumps. On a server there is nothing to measure
    and nothing to paint, so this falls back to the effect React can run there
    rather than warning about a layout effect it cannot honour. */
const useMeasure = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Total edge count per node id, used to rank which nodes survive the cap. */
function degreeMap(edges: LEdge[]): Map<string, number> {
  const d = new Map<string, number>();
  for (const e of edges) {
    d.set(e.from, (d.get(e.from) ?? 0) + 1);
    d.set(e.to, (d.get(e.to) ?? 0) + 1);
  }
  return d;
}

/* ── The packer ───────────────────────────────────────────────────────────
   Positions arrive as 0..1 fractions — the server's auto-layout, or a reader's
   pin. A fraction cannot know that a card is 168px wide, so on a narrower
   console two positions a comfortable 0.16 apart put two cards 130px apart and
   the cards overlap. Everything below works in the canvas's real pixels, in
   whole card boxes plus a minimum gap, and only converts back to fractions at
   the very end (which is what the rest of the canvas — drag, fit, edges —
   already speaks). */

/** Would any two cards, placed at these fractions on this canvas, touch? */
function anyCollision(nodes: LNode[], at: (n: LNode) => Pt, w: number, h: number, box: CardBox) {
  const needX = box.w + TOUCH_X;
  const needY = box.h + TOUCH_Y;
  const pts = nodes.map((n) => { const q = at(n); return { x: q.x * w, y: q.y * h }; });
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i].x - pts[j].x) < needX && Math.abs(pts[i].y - pts[j].y) < needY) return true;
    }
  }
  return false;
}

type Lane = { key: string; members: LNode[]; at: number };

/** One lane per source — lanes left to right by where the layout already put
    them, so the flow reading survives — and inside a lane oldest first, with
    the best-connected document winning a tie. */
function sourceLanes(nodes: LNode[], at: (n: LNode) => Pt, degree: Map<string, number>): Lane[] {
  const byKey = new Map<string, LNode[]>();
  for (const n of nodes) {
    const key = n.source || "other";
    const bucket = byKey.get(key);
    if (bucket) bucket.push(n); else byKey.set(key, [n]);
  }
  const lanes = [...byKey].map(([key, members]) => ({
    key,
    at: Math.min(...members.map((n) => at(n).x)),
    members: members.sort((a, b) =>
      (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99") ||
      (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) ||
      at(a).x - at(b).x || a.id.localeCompare(b.id)),
  }));
  return lanes.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/** Fill columns top to bottom, `rows` cards to a column, without cutting a
    lane in half where it did not have to be: a lane that will not fit in what
    is left of the current column opens a fresh one, a lane longer than a
    column fills whole columns first, and a short lane is allowed to finish out
    a column its neighbour started. */
function laneColumns(lanes: Lane[], rows: number): LNode[][] {
  const cols: LNode[][] = [];
  let col: LNode[] = [];
  const flush = () => { if (col.length) { cols.push(col); col = []; } };
  for (const lane of lanes) {
    if (col.length && col.length + lane.members.length > rows) flush();
    for (const n of lane.members) {
      col.push(n);
      if (col.length >= rows) flush();
    }
  }
  flush();
  return cols;
}

/** Timeline columns: x stays the event date, but a date band is a column of
    its own, so two documents from the same week stagger into rows instead of
    stacking on one point. Bands keep their time order, which is the whole
    reading of this layout. */
function timeColumns(
  nodes: LNode[], laneRank: Map<string, number>,
  dateRank: Map<string, number>, bands: number,
): LNode[][] {
  const cols: LNode[][] = Array.from({ length: bands }, () => []);
  for (const n of nodes) {
    const i = n.date ? dateRank.get(n.date) ?? -1 : -1;
    // No date is no place on a time axis: those cards sit in the middle, which
    // is where the old timeline layout parked them too.
    const band = i < 0 || dateRank.size === 0
      ? Math.min(bands - 1, Math.floor(bands / 2))
      : Math.min(bands - 1, Math.floor((i * bands) / dateRank.size));
    cols[band].push(n);
  }
  for (const col of cols) {
    col.sort((a, b) =>
      (laneRank.get(a.source || "other") ?? 0) - (laneRank.get(b.source || "other") ?? 0) ||
      (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
  }
  return cols.filter((c) => c.length > 0);
}

/* ── The force layout ─────────────────────────────────────────────────────
   The flow view is a graph, not a table: a card belongs next to the cards it
   is actually linked to, whatever source lane the seed put it in. Edges pull
   their endpoints together, everything repels softly, the canvas centre holds
   the cloud, and a rectangle pass keeps whole cards apart. Deterministic —
   seeded by the server layout, fixed iterations, no randomness — so the same
   graph always lands the same way. */
function forceLayout(args: {
  nodes: LNode[]; edges: LEdge[]; at: (n: LNode) => Pt;
  width: number; height: number; box: CardBox;
}): { pos: Record<string, Pt>; fit: number } {
  const { nodes, edges, at, width, height, box } = args;
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const px = nodes.map((n) => at(n).x * width);
  const py = nodes.map((n) => at(n).y * height);
  const springs: Array<[number, number]> = [];
  for (const e of edges) {
    const a = index.get(e.from), b = index.get(e.to);
    if (a !== undefined && b !== undefined && a !== b) springs.push([a, b]);
  }
  const needX = box.w + TOUCH_X;
  const needY = box.h + TOUCH_Y;
  const edgeLength = Math.hypot(needX, needY) * 1.15;
  const repelRadius = edgeLength * 1.6;
  const cx = width / 2, cy = height / 2 + (PAD_TOP - PAD_BOTTOM) / 2;
  const STEPS = 220;
  for (let step = 0; step < STEPS; step++) {
    const heat = 1 - step / STEPS;
    // Springs: linked cards drift toward one edge-length apart.
    for (const [a, b] of springs) {
      const dx = px[b] - px[a], dy = py[b] - py[a];
      const d = Math.hypot(dx, dy) || 1;
      const pull = ((d - edgeLength) / d) * 0.12 * heat;
      px[a] += dx * pull; py[a] += dy * pull;
      px[b] -= dx * pull; py[b] -= dy * pull;
    }
    // Repulsion: nothing huddles, including cards no edge mentions.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = px[j] - px[i], dy = py[j] - py[i];
        const d = Math.hypot(dx, dy) || 1;
        if (d >= repelRadius) continue;
        const push = ((repelRadius - d) / d) * 0.06 * heat;
        px[i] -= dx * push; py[i] -= dy * push;
        px[j] += dx * push; py[j] += dy * push;
      }
    }
    // Centering: the cloud stays on the canvas instead of drifting off it.
    for (let i = 0; i < nodes.length; i++) {
      px[i] += (cx - px[i]) * 0.012 * heat;
      py[i] += (cy - py[i]) * 0.014 * heat;
    }
    // Collision: cards are rectangles, not points; separate overlaps along
    // the cheaper axis so neighbours settle beside, not on, each other.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = px[j] - px[i], dy = py[j] - py[i];
        const ox = needX - Math.abs(dx), oy = needY - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        if (ox / needX < oy / needY) {
          const move = (ox / 2) * (dx >= 0 ? 1 : -1) || ox / 2;
          px[i] -= move; px[j] += move;
        } else {
          const move = (oy / 2) * (dy >= 0 ? 1 : -1) || oy / 2;
          py[i] -= move; py[j] += move;
        }
      }
    }
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < nodes.length; i++) {
    x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]);
    y0 = Math.min(y0, py[i]); y1 = Math.max(y1, py[i]);
  }
  // Recentre the settled cloud on the canvas, then report the scale that
  // brings all of it into view (the Fit button's answer).
  const shiftX = cx - (x0 + x1) / 2;
  const shiftY = cy - (y0 + y1) / 2;
  const pos: Record<string, Pt> = {};
  nodes.forEach((n, i) => {
    pos[n.id] = { x: (px[i] + shiftX) / width, y: (py[i] + shiftY) / height };
  });
  const availW = Math.max(1, width - PAD_X * 2);
  const availH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);
  const fit = Math.min(availW / Math.max(1, x1 - x0 + box.w), availH / Math.max(1, y1 - y0 + box.h), 1);
  return { pos, fit };
}

/** WHAT the grid is: which cards stand in which column, in which order. It is
    worked out from the card box and the canvas alone, never from the scale, so
    zooming never reshuffles a reader's graph — only the air between the cards
    changes. */
type Plan = {
  cols: LNode[][];
  rows: number;
  /** The scale that brings the whole grid into view at its tightest packing.
      1 = it already fits the canvas. */
  fit: number;
};

/** WHERE that grid lands at one particular scale. */
type Placed = {
  /** id → canvas-fraction centre. Outside 0..1 when the grid is wider than the
      canvas, which is either a grid awaiting its zoom-to-fit or a reader who
      has zoomed out and is being given the room they asked for. */
  pos: Record<string, Pt>;
  /** Does the whole grid stand inside the canvas box at this scale? */
  inside: boolean;
};

/** Work out the grid: how many rows deep a column runs, which cards fill it,
    and how much of the canvas the tightest version of it needs. */
function planLayout(args: {
  nodes: LNode[]; at: (n: LNode) => Pt; degree: Map<string, number>;
  width: number; height: number; box: CardBox; timeline: boolean;
}): Plan | null {
  const { nodes, at, degree, width, height, box, timeline } = args;
  if (!width || !height || nodes.length === 0) return null;
  const cellW = box.w + GAP_X;
  const cellH = box.h + GAP_Y;
  const availW = Math.max(cellW, width - PAD_X * 2);
  const availH = Math.max(cellH, height - PAD_TOP - PAD_BOTTOM);

  const lanes = sourceLanes(nodes, at, degree);
  const laneRank = new Map(lanes.map((lane, i) => [lane.key, i]));
  const dateRank = new Map(
    [...new Set(nodes.filter((n) => n.date).map((n) => n.date as string))].sort()
      .map((d, i) => [d, i] as const),
  );
  const limit = Math.max(1, timeline ? dateRank.size : nodes.length);

  /* One free parameter — rows per column, or bands on the time axis — and a
     closed-form score for each: how much of the canvas the resulting grid
     needs. Six columns of six beats twelve columns of three on a wide canvas
     and loses on a tall one, and this is the cheapest honest way to know
     which. Ties go to the later value: more time on the axis, fuller columns
     off it. */
  let best: { cols: LNode[][]; rows: number; fit: number } | null = null;
  for (let k = 1; k <= limit; k++) {
    const cols = timeline ? timeColumns(nodes, laneRank, dateRank, k) : laneColumns(lanes, k);
    if (cols.length === 0) continue;
    const rows = Math.max(...cols.map((c) => c.length));
    const fit = Math.min(
      availW / (cols.length * cellW - GAP_X),
      availH / (rows * cellH - GAP_Y),
    );
    if (!best || fit >= best.fit) best = { cols, rows, fit };
  }
  if (!best) return null;
  return { cols: best.cols, rows: best.rows, fit: Math.min(best.fit, 1) };
}

/** Lay the plan out at one scale.

    Zoom is a lens over a stable grid. The grid takes its pitch from the
    canvas box alone — a small graph still opens out to fill the canvas at
    100% — and the scale transform then shows that same grid larger or
    smaller. Zooming out therefore compacts the view: the whole graph and all
    of its edges draw closer together, which is what an overview is for. (The
    earlier reading, where zooming out handed the grid MORE room to spread
    into, meant the further out a reader zoomed the emptier the canvas got,
    and the connections they zoomed out to see stretched into noise.) Zooming
    in past the canvas is what fit and pan are for. */
function placeLayout(plan: Plan, args: {
  width: number; height: number; box: CardBox;
}): Placed {
  const { width, height, box } = args;
  const { cols, rows } = plan;
  const cellW = box.w + GAP_X;
  const cellH = box.h + GAP_Y;
  // The room is the canvas box at 100%, always: the layout must not depend on
  // the scale, or zooming reflows the graph under the reader.
  const roomW = Math.max(cellW, width - PAD_X * 2);
  const roomH = Math.max(cellH, height - PAD_TOP - PAD_BOTTOM);
  const pitchX = clamp(roomW / cols.length, cellW, cellW * SPREAD_MAX);
  const pitchY = clamp(roomH / rows, cellH, cellH * SPREAD_MAX);
  const spreadW = cols.length * pitchX;
  const spreadH = rows * pitchY;
  // Centred on the canvas, offset by the overlays' share of it at 100%.
  const originX = width / 2 - spreadW / 2;
  const originY = height / 2 + (PAD_TOP - PAD_BOTTOM) / 2 - spreadH / 2;

  const pos: Record<string, Pt> = {};
  cols.forEach((col, c) => {
    const short = ((rows - col.length) * pitchY) / 2;
    col.forEach((n, r) => {
      pos[n.id] = {
        x: (originX + (c + 0.5) * pitchX) / width,
        y: (originY + short + (r + 0.5) * pitchY) / height,
      };
    });
  });
  const inside = originX >= 0 && originY >= 0
    && originX + spreadW <= width && originY + spreadH <= height;
  return { pos, inside };
}

/** Timeline layout: x by event date rank, y kept from the flow layout. */
function timelinePositions(nodes: LNode[]): Record<string, { x: number; y: number }> {
  const dated = nodes.filter((n) => n.date).map((n) => n.date as string);
  const ranks = Array.from(new Set(dated)).sort();
  const out: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    const i = n.date ? ranks.indexOf(n.date) : -1;
    const x = i < 0 || ranks.length < 2 ? 0.5 : 0.07 + (0.86 * i) / (ranks.length - 1);
    out[n.id] = { x, y: n.y };
  }
  return out;
}

export function LineageGraph({
  nodes: rawNodes, edges: rawEdges, layout, lens, focalId = "n1",
  trace: traceProp = null, maxNodes = DEFAULT_MAX_NODES,
  mode, hopDepth = 1, minConfidence = 0.8, impact = null, onClearImpact,
  onSelectNode, onSelectGroup, onSelectEdge, onPinNode, onVolume,
  loading = false, className = "",
}: LineageGraphProps) {
  const [controls, setControls] = useLineageControls();
  /* Which roll-ups the reader unfolded in place. Joined into a string so the
     memo below re-runs when the SET changes and not on every patch that mints
     a new array with the same ids in it. */
  const expandedKey = controls.expanded.join("\u0000");
  const graph = useMemo(() => {
    if (mode === "overview") {
      return buildOverviewGraph(rawNodes, rawEdges, minConfidence, expandedKey ? expandedKey.split("\u0000") : []);
    }
    if (mode === "provenance" || mode === "impact") {
      return buildFocusedGraph(rawNodes, rawEdges, focalId, mode, hopDepth, minConfidence);
    }
    return { nodes: rawNodes, edges: rawEdges };
  }, [rawNodes, rawEdges, focalId, mode, hopDepth, minConfidence, expandedKey]);
  const nodes = graph.nodes;
  const edges = graph.edges;
  const byId = useMemo(() => nodeById(nodes), [nodes]);
  const [sel, setSel] = useState<{ kind: "node" | "edge"; id: string } | null>(
    focalId ? { kind: "node", id: focalId } : null,
  );
  const [hover, setHover] = useState<string | null>(null);
  const [trace, setTrace] = useState(traceProp);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});
  /* Dropping a node writes its position, so the drop goes through the one
     write hook rather than a local busy/failed pair (actions/useWrite.ts). */
  const pinWrite = useWrite();

  /* ONE source of truth for lens/layout: the shared control store. The props
     only seed it, and only when they change — the page used to both pass them
     and remount this component on every change, which threw away pan, drag
     positions and selection, and reset a reader's "Color by" choice back to
     whatever the data shipped. */
  useEffect(() => { if (lens) setControls({ lens }); }, [lens, setControls]);
  useEffect(() => { if (layout) setControls({ layout }); }, [layout, setControls]);
  useEffect(() => { setTrace(traceProp); }, [traceProp]);
  // Selection follows the focal node when the page moves it. This used to
  // arrive via a remount, which is why it cost the whole canvas state.
  useEffect(() => { if (focalId) setSel({ kind: "node", id: focalId }); }, [focalId]);

  // Read from the store, not the prop: the prop seeds the store above, and the
  // toolbar can then change it. Reading the prop directly would make the
  // toolbar's lens/layout controls dead on any page that passes one.
  const effLens = controls.lens;
  const effLayout = controls.layout;
  const zoom = controls.zoom;
  /* The current scale, readable from an effect that must not re-run when it
     changes — the auto-fit below fires on the LAYOUT, not on the number. */
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const canvasRef = useRef<HTMLDivElement>(null);
  /* The canvas's real pixel box. The packer needs it — a card is 168px wide
     whatever fraction of the canvas that turns out to be — and it changes with
     the window, the sidebar and the drawer, so it is watched, not read once. */
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });
  /* The card's real height, measured off a rendered card rather than guessed:
     the row pitch has to clear the tallest thing in the row. */
  const [cardH, setCardH] = useState(CARD_H);
  /** Every node card, so the arrow keys can move focus between them and the
      layout can measure one. */
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  /** Has the reader taken the zoom into their own hands? Until they do, the
      canvas fits the drawn graph; after, it leaves the scale alone. */
  const userZoomed = useRef(false);
  const drag = useRef<{
    mode: "pan" | "node"; id?: string; startX: number; startY: number;
    origin: { x: number; y: number }; moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  /* ── which nodes/edges survive the toolbar filters ─────────────────── */
  const timeline = useMemo(() => timelinePositions(nodes), [nodes]);

  const focusSet = useMemo(() => {
    if (mode) return null;
    if (controls.scope !== "focus" || !focalId) return null;
    const keep = new Set<string>([focalId]);
    for (const e of edges) {
      if (e.from === focalId) keep.add(e.to);
      if (e.to === focalId) keep.add(e.from);
    }
    return keep;
  }, [controls.scope, focalId, edges, mode]);

  const passing = useMemo(
    () => nodes.filter((n) => nodePasses(n, controls) && (!focusSet || focusSet.has(n.id))),
    [nodes, controls, focusSet],
  );

  const closure = useMemo(
    () => (trace ? traceClosure(trace.originId, trace.direction, edges) : null),
    [trace, edges],
  );

  /** Node id → the severity the analysis gave that document. */
  const impactBy = useMemo(() => {
    if (!impact?.docs.length) return null;
    return new Map<string, Severity>(impact.docs.map((d) => [d.id, d.severity]));
  }, [impact]);

  /* The toolbar's "Find path" arms `controls.path`; the picking happens here,
     because the two ends are nodes on this canvas. Two picks resolve to a
     route, which is drawn and holds everything else back. */
  const pathMode = controls.path !== null;
  const path = useMemo(() => tracePath(controls.path, edges), [controls.path, edges]);

  /* The cap: keep the best-connected nodes, and never drop the focal node, the
     trace origin, or anything inside an active trace closure.

     `maxNodes` is the workspace default; the reader can raise it from the
     toolbar, and that choice lives in the shared control store so the number
     the toolbar prints and the number the canvas obeys can never disagree. */
  const cap = Math.max(1, controls.maxNodes ?? maxNodes);
  const visibleNodes = useMemo(() => {
    if (passing.length <= cap) return passing;
    const deg = degreeMap(edges);
    const keep = [...passing].sort((a, b) => {
      // A node on the current path is never capped away: dropping one end (or
      // a hop in the middle) would draw a route with a hole in it.
      const pin = (n: LNode) => (n.id === focalId || n.id === trace?.originId ? 1 : 0) +
        (closure?.has(n.id) ? 1 : 0) + (path?.nodes.has(n.id) ? 2 : 0) +
        // A document the analysis named is the answer on screen. Capping one
        // away would leave the reader a report listing a card that is not
        // drawn anywhere.
        (impactBy?.has(n.id) ? 2 : 0);
      return pin(b) - pin(a) || (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || a.id.localeCompare(b.id);
    }).slice(0, cap);
    const kept = new Set(keep.map((n) => n.id));
    // Restore the authored order so the layout is not reshuffled by ranking.
    return passing.filter((n) => kept.has(n.id));
  }, [passing, cap, edges, focalId, trace?.originId, closure, path, impactBy]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((e) =>
      visibleIds.has(e.from) && visibleIds.has(e.to) &&
      (!controls.rels || controls.rels.includes(e.rel)) &&
      // Time travel: a link that had not been made yet on the as-of date is
      // not drawn, which is half of what the scrubber's caption promises.
      !edgeCreatedAfter(e, controls.asOf)),
    [edges, visibleIds, controls.rels, controls.asOf],
  );

  const basePos = (n: LNode) => (effLayout === "timeline" ? timeline[n.id] ?? { x: n.x, y: n.y } : { x: n.x, y: n.y });

  const degrees = useMemo(() => degreeMap(edges), [edges]);
  const cardBox = useMemo(() => ({ w: CARD_W, h: cardH }), [cardH]);

  /* Pack, but only when the authored layout actually fails. The positions the
     data ships are the ones the server reasoned about and the ones a reader
     pinned, so a graph whose cards already stand clear of each other at this
     canvas size keeps them exactly. The moment two card boxes touch — a denser
     graph, a narrower console, a roll-up unfolded onto the slot its macro card
     held — the packer takes the whole visible set over, whichever mode drew
     it. */
  const plan = useMemo(() => {
    if (!canvas.w || !canvas.h || visibleNodes.length === 0) return null;
    if (effLayout !== "timeline") {
      // The flow view is a graph: cards stand next to what they are linked
      // to, not in source columns. The timeline keeps its date-band grid —
      // time order IS that layout's reading.
      const settled = forceLayout({
        nodes: visibleNodes, edges: visibleEdges, at: basePos,
        width: canvas.w, height: canvas.h, box: cardBox,
      });
      return { kind: "force" as const, ...settled };
    }
    if (!anyCollision(visibleNodes, basePos, canvas.w, canvas.h, cardBox)) return null;
    const grid = planLayout({
      nodes: visibleNodes, at: basePos, degree: degrees,
      width: canvas.w, height: canvas.h, box: cardBox,
      timeline: true,
    });
    return grid ? { kind: "grid" as const, ...grid } : null;
    // basePos is derived from effLayout + timeline, both listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, visibleEdges, effLayout, timeline, canvas.w, canvas.h, cardBox, degrees]);

  /** The scale that brings the packed grid into view, 1 when it needs none. */
  const fitScale = plan ? plan.fit : 1;

  /** Where the grid lands on the canvas. Zoom plays no part: the scale
      transform shows this same placement larger or smaller, so zooming never
      moves a card relative to its neighbours. */
  const packed = useMemo(() => {
    if (!plan) return null;
    if (plan.kind === "force") return { pos: plan.pos, inside: plan.fit >= 1 };
    return placeLayout(plan, { width: canvas.w, height: canvas.h, box: cardBox });
  }, [plan, canvas.w, canvas.h, cardBox]);

  const posOf = (n: LNode) => moved[n.id] ?? packed?.pos[n.id] ?? basePos(n);
  const px = (n: LNode) => { const p = posOf(n); return { x: p.x * VB_W, y: p.y * VB_H }; };
  const dimmed = (id: string) => {
    // A resolved path is the strongest statement on the canvas: everything off
    // it recedes, including whatever the search or a trace was spotlighting.
    if (path) return !path.nodes.has(id);
    // An analysis is the next strongest: the reader asked one question and the
    // answer is a set of documents, so the rest of the corpus stands back.
    if (impactBy) return !impactBy.has(id);
    if (closure && !closure.has(id)) return true;
    const n = byId[id];
    return n ? !nodeMatchesQuery(n, controls.query) : false;
  };

  /* ── viewport: fit, fit-to-selection, reset ───────────────────────────
     The reader can pan and zoom by hand, which means they can also lose the
     graph off the edge of the canvas. Three ways back, all of them arriving
     through the shared control store because the buttons are in the toolbar
     and the geometry is only known here. */

  /** The focal node and everything one link from it: what "fit to selection"
      is actually about, since a single card fitted alone tells you nothing
      about where it sits. */
  const selectionSet = useMemo(() => {
    const wanted = sel?.kind === "node" ? sel.id : focalId;
    if (!wanted) return null;
    /* The focal DOCUMENT is not always a card. In the overview it is folded
       into the macro card standing for its bucket, and that card is what "the
       selection" means on this canvas — without this the fit had nothing to
       frame and quietly reset the zoom instead. */
    const raw = rawNodes.find((n) => n.id === wanted);
    const anchorId = byId[wanted] ? wanted
      : raw ? `${MACRO_PREFIX}${overviewGroupId(raw)}` : null;
    if (!anchorId || !byId[anchorId]) return null;
    const keep = new Set<string>([anchorId]);
    for (const e of visibleEdges) {
      if (e.from === anchorId) keep.add(e.to);
      if (e.to === anchorId) keep.add(e.from);
    }
    return keep;
  }, [sel, focalId, visibleEdges, byId, rawNodes]);

  /** Centre a set of cards and scale them up to fill the canvas. `null` fits
      everything drawn. Positions are canvas fractions and the transform is
      `translate(pan) scale(zoom)` about the centre, so the pan that lands a
      bounding box's centre on the canvas centre is a closed form. */
  const fitTo = (ids: Set<string> | null, ceiling = 2.5) => {
    // A fit is a zoom the reader asked for, so the canvas stops fitting the
    // packed grid under them afterwards.
    userZoomed.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    // Nothing selected, or a selection nothing is drawing: fit the graph. A
    // control that promises to bring something into view must not answer by
    // resetting the zoom and leaving the reader where they were.
    const picked = ids ? visibleNodes.filter((n) => ids.has(n.id)) : [];
    const subject = picked.length ? picked : visibleNodes;
    if (!rect || rect.width === 0 || subject.length === 0) {
      setPan({ x: 0, y: 0 });
      setControls({ zoom: 1 });
      return;
    }
    /* Frame the cards where they stand. The layout no longer moves with the
       scale, so one pass over the real positions is the whole answer. */
    const frame = (at: (n: LNode) => Pt) => {
      let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (const n of subject) {
        const q = at(n);
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
        y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      // Grow the box by a card, so the outermost cards land whole rather than
      // with their right edge cropped at the canvas boundary. A card's share
      // of the canvas is a measurement, not a guess, once it has been read.
      const w = (x1 - x0) + (rect.width ? CARD_W / rect.width : CARD_FRAC_W);
      const h = (y1 - y0) + (rect.height ? cardH / rect.height : CARD_FRAC_H);
      return {
        z: clamp(Number(Math.min(0.94 / w, 0.94 / h).toFixed(2)), 0.3, ceiling),
        cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
      };
    };
    const answer = frame(posOf);
    setPan({
      x: -(answer.cx - 0.5) * rect.width * answer.z,
      y: -(answer.cy - 0.5) * rect.height * answer.z,
    });
    setControls({ zoom: answer.z });
  };

  /** Back to the layout the data shipped: dragged positions dropped, pan
      cleared, and the scale the drawn graph actually needs — 100% when it fits
      the canvas, zoomed out to it when it does not. */
  const resetLayout = () => {
    userZoomed.current = false;
    setMoved({});
    setPan({ x: 0, y: 0 });
    setControls({ zoom: fitScale >= 1 ? 1 : clamp(Number(fitScale.toFixed(2)), 0.3, 2.5) });
  };

  /* ── measuring the canvas and the card ────────────────────────────────
     Both are pixels, and both change under the layout: the canvas with the
     window, the sidebar and any open drawer, the card with its content. The
     packer is only as honest as these two numbers. */
  useMeasure(() => {
    const el = canvasRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setCanvas((c) => (Math.abs(c.w - r.width) < 0.5 && Math.abs(c.h - r.height) < 0.5
        ? c : { w: r.width, h: r.height }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  useMeasure(() => {
    const first = visibleNodes.find((n) => nodeRefs.current[n.id]);
    const h = first ? nodeRefs.current[first.id]?.offsetHeight : 0;
    if (h && Math.abs(h - cardH) > 0.5) setCardH(clamp(h, CARD_H_MIN, CARD_H_MAX));
    // Card height follows the card's content, which is what these two change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, effLens]);

  /* A packed grid can be bigger than the canvas — 35 cards is more card than
     an 820px console has room for — and the honest answer to that is to zoom
     out to it, never to let the cards overlap. Once the reader touches the
     zoom themselves the canvas stops re-fitting under them; Reset layout hands
     the fitting back. */
  const fittedKey = useRef<string | null>(null);
  const layoutKey = `${visibleNodes.length}:${effLayout}:${mode ?? "flow"}:${Math.round(canvas.w)}:${Math.round(canvas.h)}:${packed ? "packed" : "authored"}`;
  useEffect(() => {
    if (userZoomed.current || !canvas.w || fittedKey.current === layoutKey) return;
    fittedKey.current = layoutKey;
    const z = fitScale >= 1 ? 1 : clamp(Number(fitScale.toFixed(2)), 0.3, 2.5);
    if (z === zoomRef.current) return;
    setPan({ x: 0, y: 0 });
    setControls({ zoom: z });
    // Reading the current zoom through a ref: this fires when the LAYOUT
    // changes, not every time the number it writes comes back round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, fitScale]);

  /* A viewport request is one-shot: obey it, then clear it, so the same button
     works twice in a row. */
  useEffect(() => {
    const request = controls.viewport;
    if (!request) return;
    if (request === "reset") resetLayout();
    else fitTo(request === "selection" ? selectionSet : null);
    setControls({ viewport: null });
    // fitTo/resetLayout read this render's positions, which is what the
    // request is about; re-running on every position change would fight the
    // reader's own panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.viewport]);

  /* Moving the focus is a navigation, and the reader should not have to hunt
     for where they landed: the canvas frames the new focal node and its
     immediate neighbours. Only on a CHANGE — refitting on every render would
     undo the reader's own zoom the moment they touched it. */
  const framedFocal = useRef(focalId);
  useEffect(() => {
    if (focalId === framedFocal.current) return;
    framedFocal.current = focalId;
    if (!focalId) return;
    fitTo(selectionSet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focalId]);

  /* A finished analysis is a navigation too: the answer is a handful of cards
     that can be anywhere on the graph, and leaving the reader at whatever pan
     they had would hand them a canvas of dimmed cards with the lit ones off
     screen. Only on a CHANGE of analysis, for the same reason the focal fit
     is: refitting on every render would undo the reader's own zoom. */
  const framedImpact = useRef<string | null>(null);
  useEffect(() => {
    const key = impact ? `${impact.claim} ${impact.docs.map((d) => d.id).join(",")}` : null;
    if (framedImpact.current === key) return;
    framedImpact.current = key;
    if (!impactBy?.size) return;
    /* Never past 100%: an analysis that named two documents would otherwise
       be framed at 250%, filling the canvas with two cards and hiding the
       corpus they were picked out of. The point of the overlay is that the
       lit documents are read AGAINST the graph around them. */
    fitTo(new Set(impactBy.keys()), 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impact]);

  /* What the canvas actually drew, for the toolbar's volume readout. Keyed on
     the numbers themselves, so this fires when they change and not once per
     render. */
  useEffect(() => {
    onVolume?.({ shown: visibleNodes.length, matching: passing.length, total: nodes.length, cap });
  }, [onVolume, visibleNodes.length, passing.length, nodes.length, cap]);

  /* ── pointer: drag the background to pan, drag a node to move it ────── */
  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    /* Overlays inside the canvas (find-path panel, drawers, zoom controls)
       are real controls. Capturing the pointer here would route their click
       to the canvas and they would never fire. */
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='button'], [role='menu']")) return;
    drag.current = { mode: "pan", startX: e.clientX, startY: e.clientY, origin: pan, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const startNode = (e: ReactPointerEvent<HTMLElement>, n: LNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { mode: "node", id: n.id, startX: e.clientX, startY: e.clientY, origin: posOf(n), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    if (d.mode === "pan") {
      setPan({ x: d.origin.x + dx, y: d.origin.y + dy });
      return;
    }
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    /* A card may be dropped anywhere the reader can see, and no further: half
       a real card inside the viewport, which at a zoomed-out scale reaches
       past the canvas box itself. Guessed margins used to cut the reach short
       on a wide canvas and let a card hang out on a narrow one. */
    const reach = 0.5 / Math.max(zoom, 0.05);
    const edgeX = r.width ? CARD_HALF / r.width : 0.04;
    const edgeY = r.height ? cardH / 2 / r.height : 0.05;
    setMoved((m) => ({
      ...m,
      [d.id!]: {
        x: clamp(d.origin.x + dx / (r.width * zoom), 0.5 - reach + edgeX, 0.5 + reach - edgeX),
        y: clamp(d.origin.y + dy / (r.height * zoom), 0.5 - reach + edgeY, 0.5 + reach - edgeY),
      },
    }));
  };

  /* Dropping a node is the pin gesture: the position it was dragged to is
     persisted, so the layout the reader arranged survives a reload instead of
     snapping back to the auto-layout. */
  const endDrag = () => {
    const d = drag.current;
    suppressClick.current = Boolean(d?.moved);
    drag.current = null;
    if (!d?.moved || d.mode !== "node" || !d.id || !onPinNode) return;
    const at = moved[d.id];
    const node = byId[d.id];
    if (!at || !node || node.docId == null) return;
    void pinWrite.run(() => onPinNode({ docId: node.docId as number, x: at.x, y: at.y }));
  };

  const selectNode = (id: string) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    /* In path mode a click is a pick, not an inspection: opening the drawer
       over the canvas would hide the very route the pick is meant to reveal.
       A third pick starts a new pair from the node just clicked. */
    if (pathMode) {
      const picks = controls.path ?? [];
      if (picks.length === 1 && picks[0] === id) return; // same node twice is not a path
      setControls({ path: picks.length >= 2 ? [id] : [...picks, id] });
      return;
    }
    const node = byId[id];
    if (node?.macro) {
      setSel({ kind: "node", id });
      onSelectGroup?.(node.group);
      return;
    }
    setSel({ kind: "node", id });
    onSelectNode?.(id);
  };

  const setZoom = (z: number) => {
    userZoomed.current = true;
    setControls({ zoom: clamp(Number(z.toFixed(2)), 0.3, 2.5) });
  };

  /* ── keyboard traversal ─────────────────────────────────────────────────
     The canvas was mouse-only: pointer handlers everywhere and no way to walk
     the graph without one. Every node card is a real button (so Tab reaches
     them in reading order and Enter opens one), and the arrow keys move focus
     to the nearest card in that direction, which is how a reader follows a
     lineage without dragging. */
  const ARROWS: Record<string, "left" | "right" | "up" | "down"> = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  };

  const moveFocus = (from: LNode, dir: "left" | "right" | "up" | "down") => {
    const p = posOf(from);
    const horizontal = dir === "left" || dir === "right";
    const best = visibleNodes
      .filter((n) => n.id !== from.id)
      .map((n) => ({ n, q: posOf(n) }))
      .filter(({ q }) =>
        dir === "left" ? q.x < p.x : dir === "right" ? q.x > p.x : dir === "up" ? q.y < p.y : q.y > p.y)
      // Distance along the travel axis counts double against distance across
      // it, so "right" lands on the next card over rather than the far corner.
      .sort((a, b) => {
        const cost = (q: { x: number; y: number }) => (horizontal
          ? Math.abs(q.x - p.x) + 2 * Math.abs(q.y - p.y)
          : Math.abs(q.y - p.y) + 2 * Math.abs(q.x - p.x));
        return cost(a.q) - cost(b.q);
      })[0];
    if (!best) return;
    nodeRefs.current[best.n.id]?.focus();
  };

  /** What a screen reader is told about one card: everything the card's own
      colors and glyphs say, in words. */
  const nodeLabel = (n: LNode, editedAfter: boolean, severity: Severity | null) => [
    n.title,
    n.macro ? `${n.count ?? 0} rolled-up document${(n.count ?? 0) === 1 ? "" : "s"} from ${n.repo ?? "a repository"}` : SOURCE_LABELS[n.source] ?? n.source,
    n.macro ? null : n.owner ? `owned by ${n.owner}` : "unowned",
    n.macro ? null : nodeStatusKey(n) === "warning" ? "needs attention" : nodeStatusKey(n) === "review" ? "needs review" : "verified",
    typeof n.staleDays === "number" ? `${n.staleDays} day${n.staleDays === 1 ? "" : "s"} since the last update` : null,
    editedAfter ? "edited after the as-of date" : null,
    // The bar's colour is not readable to a screen reader; the verdict is the
    // reason this card is lit, so it is said in words.
    severity ? `impact ${SEVERITY_META[severity].label.toLowerCase()}` : null,
  ].filter(Boolean).join(", ");

  if (loading) {
    return (
      /* The relation LEGEND is the graph's key, and it is the same four
         relations whatever the graph turns out to contain: colour, dash and
         code all come from REL. Drawing it as three grey pills hid the one
         thing that would have let the reader read the canvas the moment it
         appeared, and it was the wrong number of pills besides. Only the node
         volume on the right is a count, so only that waits. */
      <div className={`${card} min-w-[560px] overflow-hidden font-display ${className}`.trim()} aria-busy="true">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink/10 px-3.5 py-2">
          <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Relations</span>
          {REL_ORDER.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[12px] text-ink/75">
              <svg width={26} height={9} viewBox="0 0 26 9" aria-hidden>
                <line x1={1} y1={4.5} x2={25} y2={4.5} stroke={REL[k].color} strokeWidth={REL[k].width} strokeDasharray={REL[k].dash} />
              </svg>
              <span className="font-term text-[10px] font-medium tracking-[0.06em] text-ink/65">{REL[k].code}</span>
              {REL[k].label}
            </span>
          ))}
          <span className="ml-auto"><SkeletonLine w={64} h={11} /></span>
        </div>
        <div className="relative" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
          <Skeleton className="absolute inset-0 h-full w-full" rounded="rounded-none" />
        </div>
      </div>
    );
  }

  const hiddenCount = nodes.length - passing.length;
  const cappedCount = passing.length - visibleNodes.length;
  const quietEdges = visibleEdges.length > LABEL_LIMIT;
  /** Does the drawn graph stand inside the canvas box at this scale? A grid
      bigger than the box — one awaiting its zoom-to-fit, or one opened out
      because the reader zoomed away from it — is drawn at its own size, and
      clamping it back inside would stack its outer cards on the edges. */
  const inFrame = packed ? packed.inside : fitScale >= 1;

  /* Card boxes in viewBox units, so an edge label can be slid along its own
     edge to a spot that is not on top of a card. The edge layer is a 1000×560
     box stretched over the canvas, so the two axes scale by different amounts
     and a card is not the same shape in it that it is on screen. */
  const cardVB = {
    w: canvas.w ? (CARD_W / canvas.w) * VB_W : CARD_W,
    h: canvas.h ? (cardH / canvas.h) * VB_H : cardH,
  };
  const cardSpots = visibleNodes.map((n) => px(n));
  const clearOfCards = (x: number, y: number, halfW: number, halfH: number) =>
    !cardSpots.some((c) =>
      Math.abs(c.x - x) < cardVB.w / 2 + halfW && Math.abs(c.y - y) < cardVB.h / 2 + halfH);
  const legendRelations = mode === "overview"
    ? REL_ORDER.filter((rel) => visibleEdges.some((edge) => edge.rel === rel))
    : mode ? LINEAGE_RELATIONS : REL_ORDER;

  return (
    <div className={`${card} min-w-[560px] overflow-hidden font-display ${className}`.trim()}>
      {/* legend: color + dash + code, three channels per relation */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink/10 px-3.5 py-2">
        <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Relations</span>
        {legendRelations.map((k) => {
          const on = !controls.rels || controls.rels.includes(k);
          return (
            <span key={k} className={`inline-flex items-center gap-1.5 text-[12px] ${on ? "text-ink/75" : "text-ink/35 line-through"}`}>
              <svg width={26} height={9} viewBox="0 0 26 9" aria-hidden>
                <line x1={1} y1={4.5} x2={25} y2={4.5} stroke={on ? REL[k].color : "#9aa4ae"} strokeWidth={REL[k].width} strokeDasharray={REL[k].dash} />
              </svg>
              <span className="font-term text-[10px] font-medium tracking-[0.06em] text-ink/65">{REL[k].code}</span>
              {REL[k].label}
            </span>
          );
        })}
        {legendRelations.length === 0 && (
          <span className="text-[12px] text-ink/65">No cross-group dependencies</span>
        )}
        {/* The volume readout lives in the header, not over the canvas: a badge
            floating top-left would sit on the first lane of cards. */}
        <span className="ml-auto flex min-w-0 items-center gap-2">
          {cappedCount > 0 && (
            <Chip tone="attention" label="Capped" className="shrink-0 !px-1.5 !py-0.5 !text-[10px]" />
          )}
          <TruncateInline className="font-term text-[11px] text-ink/65">
            {/* While an analysis is on the canvas the colour is the severity,
                not the lens, and saying "Lens: source" then would describe a
                bar that is no longer coloured by source. */}
            {impactBy
              ? `Impact analysis · ${impactBy.size} of ${nodes.length} documents affected`
              : cappedCount > 0
              ? `Lens: ${effLens} · showing ${visibleNodes.length} of ${nodes.length} nodes, ${visibleEdges.length} of ${edges.length} links, best-connected first`
              : `Lens: ${effLens} · showing ${visibleNodes.length} of ${nodes.length} nodes`}
          </TruncateInline>
        </span>
      </div>

      {/* Unfolded roll-ups. Expanding a group happens in its drawer, which the
          reader then closes — so the only standing record that this overview
          is no longer purely rolled up is here, with the way back on it. */}
      {mode === "overview" && controls.expanded.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink/10 px-3.5 py-2">
          <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Expanded</span>
          {controls.expanded.map((group) => (
            <Chip
              key={group}
              tone="info"
              label={groupParts(group).repo}
              onRemove={() => setControls({ expanded: controls.expanded.filter((g) => g !== group) })}
              removeLabel={`Collapse ${groupParts(group).repo}`}
            />
          ))}
          <Button compact className="ml-auto" onClick={() => setControls({ expanded: [] })}>Collapse all</Button>
        </div>
      )}

      {/* canvas */}
      <div
        ref={canvasRef}
        role="group"
        // The whole page is this canvas, so it needs to describe itself: what
        // it is, how big it is, and what state it is in. Nothing else on the
        // page tells a reader who cannot see it what is on screen.
        aria-label={`Lineage graph${controls.asOf ? ` as of ${fmtDate(controls.asOf)}` : ""}: ${visibleNodes.length} documents, ${visibleEdges.length} links, ${impactBy ? `${impactBy.size} affected by the analysis, colored by impact severity` : `colored by ${effLens}`}`}
        /* Clipped and isolated: a panned card must slide under the legend
           header above, never over it, and nothing in here may stack above
           the card's own chrome. */
        className="relative isolate touch-none select-none overflow-hidden"
        style={{ aspectRatio: `${VB_W} / ${VB_H}`, cursor: "grab" }}
        onPointerDown={startPan}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* paper grid — stays put so panning reads against a stable ground */}
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <pattern id="lg-grid" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M26 0H0V26" fill="none" stroke="#10263B" strokeOpacity="0.05" strokeWidth="1" />
            </pattern>
            <marker id="lg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#lg-grid)" />
        </svg>

        {/* the viewport: pan + zoom transform over both layers */}
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center center" }}
        >
          {/* edges */}
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
            {visibleEdges.map((e) => {
              const a = byId[e.from], b = byId[e.to];
              if (!a || !b) return null;
              const p1 = px(a), p2 = px(b);
              const agg = e.id.startsWith("ge:") || (e.count ?? 0) > 1;
              const s = REL[e.rel];
              const selEdge = sel?.kind === "edge" && sel.id === e.id;
              const onPath = path?.edges.has(e.id) ?? false;
              // Two nodes on the route can also be joined by a link the route
              // does not use; that link is not the answer, so it recedes too.
              const dim = path ? !onPath : dimmed(e.from) || dimmed(e.to);
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;
              const c1 = `${midX} ${p1.y}`, c2 = `${midX} ${p2.y}`;
              const d = `M ${p1.x} ${p1.y} C ${c1}, ${c2}, ${p2.x} ${p2.y}`;
              return (
                <g key={e.id} style={{ color: s.color, opacity: dim ? 0.15 : 1 }}>
                  {!agg && (
                    /* fat invisible hit line — a 2px stroke is a hard click target */
                    <path
                      d={d} fill="none" stroke="transparent" strokeWidth={14}
                      vectorEffect="non-scaling-stroke" className="cursor-pointer"
                      onClick={() => { setSel({ kind: "edge", id: e.id }); onSelectEdge?.(e.id); }}
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={selEdge || onPath ? s.width + 1.6 : s.width}
                    strokeDasharray={s.dash}
                    markerEnd={isLineageRelation(e.rel) ? "url(#lg-arrow)" : undefined}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  {/* Past LABEL_LIMIT edges these labels stack into an
                      illegible smear; the legend keeps carrying them.

                      A label at rest used to be a 9.5px code painted with a
                      white halo, which on a crossing edge read as neither the
                      code nor the edge. It is a plain chip now — paper fill,
                      the relation's own hairline, the relation's word once it
                      stands for more than one link — and it is sized in
                      viewBox units, which the canvas scales down by 0.9, so
                      11 here is the 10px it needs to be legible. */}
                  {!quietEdges && (() => {
                    const label = agg && e.count && e.count > 1 ? `${s.label} ×${e.count}` : s.code;
                    // No text metrics in SVG without measuring, and the label
                    // is set in the mono face: 6.2 units per character is that
                    // face's advance at this size, plus the chip's padding.
                    const w = label.length * 6.2 + 11;
                    /* Slide the chip along its own edge to the first spot
                       clear of every card, instead of printing the relation
                       over the document it describes. Nothing clear anywhere:
                       it sits at the middle, which is where it always sat. */
                    const on = (t: number) => {
                      const u = 1 - t;
                      return {
                        x: u * u * u * p1.x + 3 * u * u * t * midX + 3 * u * t * t * midX + t * t * t * p2.x,
                        y: u * u * u * p1.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p2.y,
                      };
                    };
                    const spot = [0.5, 0.38, 0.62, 0.28, 0.72, 0.18, 0.82]
                      .map(on).find((q) => clearOfCards(q.x, q.y - 9, w / 2, 8))
                      ?? { x: midX, y: midY };
                    return (
                      <g pointerEvents="none">
                        <rect
                          x={spot.x - w / 2} y={spot.y - 17} width={w} height={16} rx={3}
                          fill="#ffffff" fillOpacity={0.94}
                          stroke={s.color} strokeOpacity={0.4} vectorEffect="non-scaling-stroke"
                        />
                        <text
                          x={spot.x} y={spot.y - 5.5} textAnchor="middle" fontSize="11"
                          fill={s.color} className="font-term"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>

          {/* nodes */}
          <div className="absolute inset-0" role="group" aria-label="Documents. Use the arrow keys to move between them.">
            {visibleNodes.map((n) => {
              const p = posOf(n);
              const isSel = sel?.kind === "node" && sel.id === n.id;
              const isFocal = focalId === n.id;
              const dim = dimmed(n.id);
              /* While an analysis is on the canvas it IS the lens: the card's
                 left bar takes the severity's colour, and the chip beside it
                 says the severity in words and in tone. Three channels for one
                 verdict, the same three every other lens uses (§4). */
              const severity = impactBy?.get(n.id) ?? null;
              const accent = severity ? SEVERITY_META[severity].color : accentColor(n, effLens);
              const changed = trace?.direction === "up" && closure?.has(n.id) &&
                n.date && byId[trace.originId]?.date && n.date > (byId[trace.originId].date as string);
              // A picked end of a path outranks selection and focus: while the
              // path finder is armed, "which two did I click" is the question.
              const isPick = controls.path?.includes(n.id) ?? false;
              const ring = isPick ? "#1E6FA8" : isSel && !pathMode ? "#35549d" : isFocal ? "#c8502e" : null;
              // Time travel: this document existed on the as-of date but its
              // latest edit is still in the future, so it is drawn dashed —
              // the other half of the scrubber caption's promise.
              const editedAfter = nodeEditedAfter(n, controls.asOf);
              return (
                <button
                  key={n.id}
                  ref={(el) => { nodeRefs.current[n.id] = el; }}
                  type="button"
                  aria-label={nodeLabel(n, editedAfter, severity)}
                  aria-pressed={isSel && !pathMode}
                  onPointerDown={(e) => startNode(e, n)}
                  onPointerMove={onMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onClick={() => selectNode(n.id)}
                  onKeyDown={(e) => {
                    const dir = ARROWS[e.key];
                    if (!dir) return;
                    e.preventDefault();
                    moveFocus(n, dir);
                  }}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover((h) => (h === n.id ? null : h))}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
                  style={{
                    /* The card is CARD_W wide and centred on its position, so
                       while the graph fits the canvas its centre is held at
                       least half a card inside — without this the rightmost
                       timeline column hung 26px past the canvas on a narrow
                       console. A grid too big for the canvas is a different
                       case: it is drawn at its own size and zoomed to fit, and
                       clamping it back inside would stack the outer cards on
                       the edges, which is the overlap this is here to stop. */
                    left: inFrame
                      ? `clamp(${CARD_HALF}px, ${p.x * 100}%, calc(100% - ${CARD_HALF}px))`
                      : `${p.x * 100}%`,
                    top: inFrame
                      ? `clamp(${cardH / 2}px, ${p.y * 100}%, calc(100% - ${cardH / 2}px))`
                      : `${p.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    opacity: dim ? 0.22 : 1,
                    backgroundColor: NODE_CREAM,
                    borderColor: ring ?? "rgba(16,38,59,0.22)",
                    borderStyle: editedAfter ? "dashed" : undefined,
                    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
                    cursor: "grab",
                  }}
                  // FLAT: no drop shadow, no gradient. Depth is not the signal.
                  /* Literal `w-[168px]`, not an interpolated CARD_W: Tailwind
                     reads these class strings at build time and cannot see a
                     width that only exists at runtime. CARD_W carries the same
                     number for the geometry that has to agree with it. */
                  className={`absolute z-10 flex w-[168px] items-stretch overflow-hidden rounded-[4px] text-left ${focusRing} ${
                    n.macro ? "border-2" : "border"
                  }`}
                >
                  {/* type/topic distinguisher: a solid bar down the LEFT edge */}
                  <span className="w-[5px] shrink-0" style={{ backgroundColor: accent }} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-1 px-2 py-1.5">
                    {/* Line one is the type mark and the name. */}
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-ink/75"><NodeGlyph node={n} size={15} /></span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium leading-tight text-ink" title={n.title}>
                        {n.title}
                      </span>
                    </span>
                    {/* Line two says in words and in tone what the bar's hue is
                        saying, then who holds it, then how fresh it is. Three
                        channels for one colour: chip word, chip tone, and a
                        freshness dot that never depends on the lens. */}
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Chip
                        tone={severity ? SEVERITY_META[severity].tone : accentTone(n, effLens)}
                        label={severity ? SEVERITY_META[severity].label : accentWord(n, effLens)}
                        className="shrink-0 !gap-1 !px-1.5 !py-0 !text-[9px] !leading-[15px] !tracking-[0.05em]"
                      />
                      {effLens !== "owner" && (
                        <span className="min-w-0 flex-1 truncate font-term text-[9.5px] leading-tight text-ink/70">
                          {n.macro ? n.repo : n.owner ?? "Unowned"}
                        </span>
                      )}
                      {/* The staleness lens already IS this number, in the
                          chip and in its colour; printing it twice on one card
                          is noise. Every other lens gets it here. */}
                      {effLens !== "stale" && typeof n.staleDays === "number" && (
                        <span
                          className="ml-auto inline-flex shrink-0 items-center gap-1 font-term text-[9.5px] leading-tight text-ink/70"
                          title={`Last updated ${n.staleDays} day${n.staleDays === 1 ? "" : "s"} ago`}
                        >
                          <span className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: staleColor(n.staleDays) }} aria-hidden />
                          {n.staleDays}d
                        </span>
                      )}
                    </span>
                  </span>
                  {n.warn && !n.macro && (
                    <span
                      className="absolute -right-1.5 -top-1.5 grid h-3.5 w-3.5 place-items-center rounded-[2px] border border-paper bg-[#c8502e] font-term text-[9px] font-bold leading-none text-white"
                      aria-label="Needs attention"
                    >
                      !
                    </span>
                  )}
                  {changed && (
                    <span
                      className="absolute -left-1.5 -top-1.5 grid h-3.5 w-3.5 place-items-center rounded-[2px] border border-paper bg-[#c0392b] font-term text-[9px] font-bold leading-none text-white"
                      aria-label="Changed after the origin"
                    >
                      ∆
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Edges are SVG paths with a click handler, which no keyboard and no
            screen reader can reach. The same links are offered here as real
            buttons: off-screen until one takes focus, then a plain panel, so a
            reader tabbing through never lands on something invisible. */}
        {visibleEdges.length > 0 && (
          <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:inset-x-3 focus-within:bottom-12 focus-within:z-30 focus-within:rounded-[5px] focus-within:border focus-within:border-ink/20 focus-within:bg-paper/95 focus-within:p-2 focus-within:backdrop-blur">
            <div className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">
              Links, {visibleEdges.length}
            </div>
            {/* Bounded and visibly scrolling once it overflows (§20). */}
            <Scrollable axis="y" className="max-h-[152px]">
              <ul>
                {visibleEdges.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => { setSel({ kind: "edge", id: e.id }); onSelectEdge?.(e.id); }}
                      className={`block w-full truncate rounded-[3px] px-1.5 py-1 text-left text-[12.5px] text-ink/85 hover:bg-flysch ${focusRing}`}
                    >
                      {`${byId[e.from]?.title ?? e.from} ${REL[e.rel].out.toLowerCase()} ${byId[e.to]?.title ?? e.to}`}
                    </button>
                  </li>
                ))}
              </ul>
            </Scrollable>
          </div>
        )}

        {/* nothing to draw: say so rather than showing blank paper */}
        {visibleNodes.length === 0 && (
          <div className="absolute inset-0 z-20 grid place-items-center">
            <div className="max-w-[320px] rounded-[5px] border border-ink/15 bg-paper/95 px-4 py-3 text-center backdrop-blur">
              <div className="text-[13px] font-semibold text-ink">
                {nodes.length === 0 ? "No documents in this graph" : "No documents match these filters"}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/70">
                {nodes.length === 0
                  ? "Connect a source, or widen the time range, to see lineage here."
                  : "Clear a source, relation or status filter in the toolbar above."}
              </p>
            </div>
          </div>
        )}

        {/* hover tooltip — outside the transform so it stays legible at any
            zoom, which means it has to do the transform's arithmetic itself:
            the card it labels has been scaled about the canvas centre and
            panned, and a tooltip printed at the raw fraction would sit away
            from its card at every scale but 100%. */}
        {hover && byId[hover] && visibleIds.has(hover) && (() => {
          const n = byId[hover];
          const p = posOf(n);
          const atX = (0.5 + (p.x - 0.5) * zoom) * 100;
          const atY = (0.5 + (p.y - 0.5) * zoom) * 100;
          const half = (cardH / 2) * zoom;
          // Above the card, unless the card is up against the top of the
          // canvas and there is nothing above it to be in.
          const under = (atY / 100) * canvas.h + pan.y - half < 56;
          const off = pan.y + (under ? half + 8 : -half - 8);
          return (
            <div
              className={`pointer-events-none absolute z-20 max-w-[240px] -translate-x-1/2 rounded-[4px] border border-ink/20 bg-paper px-2.5 py-1.5 ${
                under ? "" : "-translate-y-full"
              }`}
              style={{
                left: `clamp(120px, calc(${atX}% + ${pan.x}px), calc(100% - 120px))`,
                top: `calc(${atY}% + ${off}px)`,
              }}
            >
              <Truncate lines={2} className="text-[12px] font-semibold text-ink">{n.title}</Truncate>
              <div className="truncate font-term text-[10.5px] text-ink/70">
                {[n.meta, typeof n.staleDays === "number" ? `${n.staleDays}d stale` : null].filter(Boolean).join(" · ")}
              </div>
            </div>
          );
        })()}

        {/* impact analysis — the answer to the question the drawer asked,
            standing where the trace summary stands, because it is the same
            kind of statement: this is what is lit, and here is the way out. */}
        {impact && impactBy && !pathMode && (
          <div className="absolute bottom-3 left-3 z-20 max-w-[320px] rounded-[5px] border border-ink/20 bg-paper/95 p-3 backdrop-blur">
            <Truncate lines={2} className="text-[12.5px] font-semibold text-ink" title={impact.claim}>
              {`Impact of “${impact.claim}”`}
            </Truncate>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {SEVERITY_ORDER.map((severity) => {
                const count = impact.docs.filter((d) => d.severity === severity).length;
                if (!count) return null;
                return <Chip key={severity} label={`${SEVERITY_META[severity].label} ${count}`} tone={SEVERITY_META[severity].tone} dot />;
              })}
            </div>
            {onClearImpact && (
              <div className="mt-2">
                <Button compact onClick={onClearImpact}>Clear</Button>
              </div>
            )}
          </div>
        )}

        {/* trace summary — stood down while the path finder owns this corner */}
        {trace && closure && !pathMode && !impactBy && (() => {
          const origin = byId[trace.originId];
          const groups = new Map<string, number>();
          for (const e of visibleEdges) {
            if (closure.has(e.from) && closure.has(e.to)) groups.set(e.rel, (groups.get(e.rel) ?? 0) + 1);
          }
          return (
            <div className="absolute bottom-3 left-3 z-20 max-w-[300px] rounded-[5px] border border-ink/20 bg-paper/95 p-3 backdrop-blur">
              <Truncate lines={2} className="text-[12.5px] font-semibold text-ink" title={origin?.title}>
                {`${trace.direction === "down" ? "Impact of" : "Provenance of"} ${origin?.title ?? ""}`}
              </Truncate>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Chip label={`${closure.size - 1} docs`} tone="info" />
                {[...groups].map(([rel, count]) => (
                  <Chip key={rel} label={`${REL[rel as keyof typeof REL].label} ${count}`} tone="neutral" />
                ))}
              </div>
              <div className="mt-2">
                <Button compact onClick={() => setTrace(null)}>Clear</Button>
              </div>
            </div>
          );
        })()}

        {/* path readout — the answer sits on the canvas the picks were made on,
            not only in the toolbar row that armed the mode */}
        {pathMode && (
          <div className="absolute bottom-3 left-3 z-20 max-w-[320px] rounded-[5px] border border-biscay-2/45 bg-paper/95 p-3 backdrop-blur">
            <div className="text-[12.5px] font-semibold text-ink">
              {!controls.path?.length
                ? "Find path: click the first document"
                : controls.path.length === 1
                  ? "Find path: click the second document"
                  : path
                    ? `${path.hops} hop${path.hops === 1 ? "" : "s"} between them`
                    : "No route between those two"}
            </div>
            {path && (
              <Truncate lines={3} className="mt-1 font-term text-[11px] text-ink/70">
                {path.ids.map((id) => byId[id]?.title ?? id).join(" → ")}
              </Truncate>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <Button compact onClick={() => setControls({ path: [] })}>Start over</Button>
              <Button compact onClick={() => setControls({ path: null })}>Exit</Button>
            </div>
          </div>
        )}

        {/* filter readout — proves the toolbar and the scrubber reached the canvas */}
        {(hiddenCount > 0 || controls.query.trim() || controls.asOf) && (
          <div className="absolute left-3 top-3 z-20 max-w-[260px] truncate rounded-[4px] border border-ink/20 bg-paper/95 px-2.5 py-1.5 font-term text-[11px] text-ink/70 backdrop-blur">
            {[
              controls.asOf ? `As of ${fmtDate(controls.asOf)}` : null,
              hiddenCount > 0 ? `${hiddenCount} node${hiddenCount === 1 ? "" : "s"} hidden` : null,
              controls.query.trim() ? `matching “${controls.query.trim()}”` : null,
            ].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* A rejected pin says so over the canvas, where the drag happened. It
            is a failed WRITE with no input to accuse, so it is the banner (§8),
            not a 12px field caption. */}
        {pinWrite.failed && (
          <div className="absolute bottom-3 left-3 z-20 max-w-[320px]">
            <WriteError onDismiss={() => pinWrite.setFailed(null)}>{pinWrite.failed}</WriteError>
          </div>
        )}

        {/* drag hint */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-[4px] border border-ink/15 bg-paper/90 px-2 py-1 font-term text-[10.5px] text-ink/65 backdrop-blur">
          <Move size={12} /> Drag to pan · arrow keys walk the graph · click to {pathMode ? "pick" : "open"}
        </div>

        {/* zoom controls */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-[5px] border border-ink/20 bg-paper/95 p-1 backdrop-blur">
          <Button icon aria-label="Zoom out" onClick={() => setZoom(zoom - 0.2)}><Minus size={15} /></Button>
          <span className="w-11 text-center font-term text-[11px] text-ink/70">{Math.round(zoom * 100)}%</span>
          <Button icon aria-label="Zoom in" onClick={() => setZoom(zoom + 0.2)}><Plus size={15} /></Button>
          {/* Fit, not reset: this used to also throw away every dragged
              position, so the one control that promised to bring the graph
              back into view silently undid the reader's layout. Resetting the
              layout is its own control, in the toolbar. */}
          <Button icon aria-label="Fit graph to view" onClick={() => fitTo(null)}>
            <Maximize2 size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
