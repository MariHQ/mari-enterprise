import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor } from "./PageFrame";
import { Network } from "lucide-react";
import { LineageToolbar } from "../features/LineageToolbar";
import { Scrollable } from "../data-display/Scrollable";
import { LineageGraph } from "../features/LineageGraph";
import { LineageTimeScrubber } from "../features/LineageTimeScrubber";
import { LineageNodeDrawer } from "../features/LineageNodeDrawer";
import { LineageEdgeDrawer } from "../features/LineageEdgeDrawer";
import { LineageGroupDrawer } from "../features/LineageGroupDrawer";
import { LineageAssertDrawer } from "../features/LineageAssertDrawer";
import {
  setLineageControls, getLineageControls, overviewGroupId, useLineageControls, impactOverlay,
  type DocHistoryRow, type GraphView, type ImpactDoc, type ImpactResult, type LEdge, type LNode,
  type LayoutMode, type Lens, type LineageMode,
} from "../features/LineageDataModel";
import { PageHeader } from "../layout/PageHeader";
import { Button } from "../actions/Button";
import { EmptyState } from "../data-display/EmptyState";
import { ReadError } from "../feedback/ReadError";
import { SkeletonPage } from "../data-display/Skeletons";
import { Card, Chip, AvatarGroup, Breadcrumb } from "../index";
import { buttonClasses } from "../actions/Button";
import { Link } from "../navigation/Link";

/* Product lineage (pages/lineage.md). The full-height graph "instrument":
   toolbar on top, the lineage canvas in the middle, the as-of time scrubber at
   the bottom, and the mutually-exclusive right drawers.

   This page is a pure presenter. It holds no demo content: the graph, the
   scrubber's event dates, the open drawer and its payload all arrive in
   `data`, so the view the user sees is a function of the data, not of a magic
   state string. `LNode`/`LEdge` are plain JSON end to end (no React elements
   in the data) because mari-cloud serves them from a real GraphQL query. The
   canvas supplies the same shape from `.preview/fixtures/lineage.ts`. */

const STATES = [
  { id: "default", label: "Default" },
  { id: "lens-owner", label: "Lens · Ownership" },
  { id: "lens-stale", label: "Lens · Staleness" },
  { id: "lens-health", label: "Lens · Health (warnings)" },
  { id: "layout-timeline", label: "Layout · Timeline" },
  { id: "as-of", label: "Time travel · as-of past" },
  { id: "trace-impact", label: "Impact trace (downstream)" },
  { id: "trace-provenance", label: "Provenance trace (upstream)" },
  { id: "search", label: "Search active" },
  { id: "inspect", label: "Node drawer open" },
  { id: "edge", label: "Edge drawer open" },
  { id: "group", label: "Roll-up drawer open" },
  { id: "assert", label: "Impact-analysis drawer" },
  { id: "assert-ready", label: "Impact analysis · not yet run" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Empty / no graph" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
  { id: "crumbs", label: "Drilled in · trail back out" },
  { id: "capped", label: "Capped · showing some of the graph" },
  { id: "expanded", label: "Roll-up expanded on the graph" },
] as const;

/** What the lineage instrument can DO. Every handler may throw and the control
    that called it shows the message. All optional: without actions each control
    keeps the local behaviour the library ships, because the design canvas
    renders this page with no server behind it. */
export type LineageActions = {
  /** Persist where a node sits, so a dragged layout survives a reload. */
  pinNode?: (args: { docId: number | string; x: number; y: number }) => void | Promise<void>;
  /** Hand a node back to the auto-layout. */
  unpinNode?: (docId: number | string) => void | Promise<void>;
  /** Follow or unfollow a document. */
  watchDocument?: (docId: number | string) => void | Promise<void>;
  /** Follow a lineage node through to the document it stands for. */
  openDocument?: (docId: number | string) => void;
  /** Persist the focal node in the route while the page filters locally. */
  setFocalNode?: (nodeId: string) => void;
  /** Persist which lineage question the reader is asking. */
  setMode?: (mode: LineageMode, focalId?: string) => void;
  /** Open a review task on a document. */
  createReviewTask?: (args: { title: string; assignee: string }) => void | Promise<void>;
  /** Ask Mari to propose new edges across the corpus. Long-running. Return the
      number of links proposed and the toolbar says so; return nothing and it
      only reports that the run finished. Omitted = no Derive links button. */
  deriveLinks?: () => void | number | Promise<void | number>;
  /** Save the current filter/view state under a name. Omitted = the Views menu
      offers no "Save current view". Pair it with `data.views`, which is what
      reads the saved views back. Return the id the store gave it and the same
      session can remove it again without waiting for a refetch. */
  saveView?: (args: { name: string; state: string }) => void | number | Promise<void | number>;
  /** Remove a saved view for good. Omitted = the Views menu offers no way to
      remove one, so a workspace can accumulate saved views it cannot clear.
      The toolbar confirms on the row before calling this. */
  deleteView?: (args: { id: number; name: string }) => void | Promise<void>;
  /** Fetch one document's revision history, for whichever node the drawer is
      showing. Without it the History tab says history was not loaded rather
      than drawing an empty timeline. */
  loadDocHistory?: (docId: number | string) => DocHistoryRow[] | Promise<DocHistoryRow[]>;
  /** Trace an assertion's blast radius. Long-running, and it is the one
      handler that answers: the drawer renders what it returns. */
  analyzeImpact?: (claim: string) => ImpactResult | Promise<ImpactResult>;
  /** Open one task per document an analysis named, and answer with how many
      were opened. Separate from `createReviewTask`, which is one task on one
      document from the node drawer: this one is a batch, and its kind follows
      each document's severity. Omitted = the drawer only echoes locally. */
  createImpactTasks?: (docs: ImpactDoc[]) => number | Promise<number>;
};

/** Which drawer is open, and everything that drawer needs. Exactly one at a
    time, which is why this is a tagged union rather than four nullable slots. */
export type LineageDrawer =
  /** `history: null` = this page does not carry that node's revisions, which
      the drawer reports as such instead of as an empty timeline. */
  | { kind: "node"; nodeId: string; history: DocHistoryRow[] | null }
  | { kind: "edge"; edgeId: string }
  | { kind: "group"; groupId: string; totalMembers: number; members: LNode[] }
  | {
      kind: "assert";
      result: ImpactResult;
      analyzed: boolean;
      claim: string;
      owners: { name: string; role: string }[];
      people: string[];
    };

/** One step of the lineage trail. `href` is the view this crumb goes back to;
    the last crumb is where the reader is and carries none. */
export type LineageCrumb = { label: string; href?: string };

/** A supporting card in the rail, carrying long text. Only the long-text
    states have one, which is why it is nullable. */
export type LineageExtras = {
  title: string;
  hint: string;
  body: string;
  tags: string[];
  people: string[];
  avatarMax: number;
};

/** Everything the lineage instrument renders. */
export type LineageData = {
  neighborhood?: {focal:string|null;limit:number;hasMore:boolean};
  nodes: LNode[];
  edges: LEdge[];
  /** Sorted ISO event dates the scrubber snaps to. */
  dates: string[];
  /** Events per date, for the scrubber's density track. */
  activity: { date: string; count: number }[];
  lens: Lens;
  layout: LayoutMode;
  /** Documents is the complete graph. Overview is aggregated. Provenance and
      impact require `focalId`. */
  mode: LineageMode;
  /** Workspace defaults. The page exposes these in Settings; the canvas
      consumes them without making every visit start with tuning controls. */
  tuning: { maxNodes: number; hopDepth: number; minConfidence: number };
  focalId: string | null;
  trace: { originId: string; direction: "down" | "up" } | null;
  /** Scrubber position (index into `dates`); null = live / all time. The
      scrubber writes the date it lands on into the shared control store, and
      the canvas hides and dashes against it. */
  asOf: number | null;
  /** A query to open the graph on, e.g. from a deep link. It seeds the
      toolbar's own typeahead: there is one search on this page, in the
      toolbar, and this is how the data reaches it. null = no query. */
  search: { query: string } | null;
  /** Saved views for this workspace, listed in the toolbar's Views menu.
      Omitted = only the built-in presets. */
  views?: GraphView[];
  /** Roll-up groups to open unfolded on the canvas, e.g. from a deep link.
      It seeds the shared control store the same way `search` does, and the
      reader owns it from there: the drawer's "Expand on the graph" and the
      canvas's Expanded chips both write to that store. */
  expanded?: string[];
  drawer: LineageDrawer | null;
  /** Trail above the instrument, from the whole graph down to whatever the
      reader has drilled into. Every crumb but the last carries the href that
      undoes one step of the drill-down, so there is always a way back out;
      `null` = nothing is drilled into, so there is no trail to draw. */
  crumbs: LineageCrumb[] | null;
  extras: LineageExtras | null;
  /** The document currently being traced, shown as the header's secondary
      action. The label used to be a bare string ending in "↗" — an arrow
      promising a destination that the button did not have. It carries the
      document id now, so the promise is keepable. `null` = nothing in focus. */
  action: { label: string; docId: number | string } | null;
};

/* There is no page-level search dropdown any more. This page used to render
   its own results panel at `left-2 top-[52px]`, directly on top of the
   toolbar's working typeahead, and it matched on `tags.includes("customer")`
   or `docKind === "decision"` as well as the query — so it listed documents
   that did not match what was typed. One search, in the toolbar; `data.search`
   seeds it (see `Body`). */

/* Which §11 rail width the open drawer takes: standard lineage drawer 420px,
   impact analysis 460px. `null` = no drawer, canvas runs the full container. */
function railFor(data: LineageData, drawer: LineageDrawer | null): number | null {
  if (data.extras) return 420;
  if (!drawer) return null;
  return drawer.kind === "assert" ? 460 : 420;
}

function Drawer({
  data, drawer, actions, onClose, focalId, onSetFocal, onSelectGroupMember,
  expandedInPlace, onExpandInPlace, onCollapseInPlace, onImpactResult, impactOwners,
}: {
  data: LineageData; drawer: LineageDrawer | null;
  actions?: LineageActions;
  onClose?: () => void;
  /** An analysis that just finished, on its way to the canvas. */
  onImpactResult: (result: ImpactResult) => void;
  /** The owners of the documents the live analysis named. Empty until one has
      run, when the drawer falls back to whatever the data carried. */
  impactOwners: { owners: { name: string; role: string }[]; people: string[] };
  focalId: string | null;
  onSetFocal: (nodeId: string) => void;
  onSelectGroupMember: (nodeId: string) => void;
  /** Whether the open roll-up is already unfolded on the canvas. */
  expandedInPlace: boolean;
  onExpandInPlace: (groupId: string) => void;
  onCollapseInPlace: (groupId: string) => void;
}) {
  // Fixed desktop widths (CONVENTIONS §10). Mobile-first `w-full … lg:w-[N]`
  // made these drawers render mobile-style in the desktop canvas.
  // Every drawer gets the close handler. All four shells have always drawn an
  // ✕, and none of them were given anything to call: once a node was clicked
  // the rail was stuck until another one was.
  const d = drawer;
  if (!d) return null;
  if (d.kind === "node") {
    return (
      <LineageNodeDrawer
        nodes={data.nodes}
        edges={data.edges}
        nodeId={d.nodeId}
        history={d.history}
        onLoadHistory={actions?.loadDocHistory}
        onPin={actions?.pinNode}
        onUnpin={actions?.unpinNode}
        onWatch={actions?.watchDocument}
        onOpenDocument={actions?.openDocument}
        onSetFocal={onSetFocal}
        isFocal={focalId === d.nodeId}
        onCreateReviewTask={actions?.createReviewTask}
        onClose={onClose}
      />
    );
  }
  if (d.kind === "edge") {
    return (
      <LineageEdgeDrawer
        nodes={data.nodes}
        edges={data.edges}
        edgeId={d.edgeId}
        onOpenDocument={actions?.openDocument}
        onClose={onClose}
      />
    );
  }
  if (d.kind === "group") {
    return (
      <LineageGroupDrawer
        groupId={d.groupId}
        totalMembers={d.totalMembers}
        members={d.members}
        nodes={data.nodes}
        edges={data.edges}
        onSelectMember={onSelectGroupMember}
        expandedInPlace={expandedInPlace}
        onExpandInPlace={onExpandInPlace}
        onCollapseInPlace={onCollapseInPlace}
        onClose={onClose}
      />
    );
  }
  return (
    <LineageAssertDrawer
      result={d.result}
      analyzed={d.analyzed}
      claim={d.claim}
      owners={impactOwners.owners.length ? impactOwners.owners : d.owners}
      people={impactOwners.people.length ? impactOwners.people : d.people}
      onAnalyze={actions?.analyzeImpact}
      onResult={onImpactResult}
      onCreateTasks={actions?.createImpactTasks}
      onClose={onClose}
    />
  );
}

function Extras({ extras }: { extras: LineageExtras }) {
  return (
    <Card title={extras.title} hint={extras.hint}>
      <p className="text-[12.5px] leading-snug text-ink/70 break-words">{extras.body}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {extras.tags.map((t) => <Chip key={t} label={t} />)}
      </div>
      <div className="mt-3">
        <AvatarGroup people={extras.people.map((initials) => ({ initials }))} max={extras.avatarMax} />
      </div>
    </Card>
  );
}

/* §11 two-column split. The rail keeps its declared width and always sits
   fully inside the container; the main column carries `minmax(0,1fr)` so the
   instrument can never push the drawer off-screen. LineageGraph has a hard
   720px minimum, so on a narrow console the *canvas alone* scrolls sideways
   inside its own column, leaving both outer edges of the page plumb. */
function Rig({ rail, canvas, drawer, compact = false }: {
  rail: number | null; canvas: React.ReactNode; drawer?: React.ReactNode; compact?: boolean;
}) {
  // Every branch scrolls, including the full-width one. It used to skip the
  // scroller on the assumption that a rail-less canvas always clears its
  // minimum — true at 1440, false as soon as the window shrinks: at 1024 the
  // column is 741px and the toolbar's own 840px floor spilled 99px out through
  // the page container. Scrolling the column keeps both outer page edges plumb
  // (§11) and matches what the rail branches already do (§16).
  const column = (
    <div className="min-w-0">
      <Scrollable className="pb-1">
        <div className={`relative flex flex-col gap-5 ${compact ? "min-w-0" : "min-w-[720px]"}`}>{canvas}</div>
      </Scrollable>
    </div>
  );
  if (rail === null) return column;
  // Literal class strings so Tailwind can see both rail widths at build time.
  const cols = rail === 460
    ? "grid-cols-[minmax(0,1fr)_460px]"
    : "grid-cols-[minmax(0,1fr)_420px]";
  return (
    <div className={`grid gap-5 ${cols}`}>
      {column}
      <div className="min-w-0">{drawer}</div>
    </div>
  );
}

/** No graph at all. Derived from the data, so it is true in the real app for
    exactly the same reason it is true on the canvas. */
const isEmpty = (d: LineageData) => !d.nodes.length && !d.edges.length && !d.drawer && !d.extras;

function Body({ data, error, actions, mobile }: {
  data: LineageData; error: string | null; actions?: LineageActions; mobile: boolean;
}) {
  /* Which drawer is open.
     `data.drawer` seeds it, so the canvas can still open on any drawer and an
     app can deep-link one. After that it is local, because opening a drawer is
     a selection on a canvas and not a trip to the server — and without it the
     graph was a picture: LineageGraph has emitted `onSelectNode`/`onSelectEdge`
     all along, this page just never listened, so clicking a node did nothing
     and the drawer beside it could only ever show what the data pinned. */
  /* Three states, not two: `undefined` follows `data.drawer`, a drawer is the
     reader's own selection, and `null` is "the reader closed it". Without the
     third, Close set `null` and fell straight back through to `data.drawer`,
     so a deep-linked drawer could never be dismissed. */
  const [picked, setPicked] = useState<LineageDrawer | null | undefined>(undefined);
  const [seenDrawer, setSeenDrawer] = useState(data.drawer);
  /* The analysis the assert drawer last returned, and the reason this page
     holds it rather than the drawer: an impact analysis is a statement about
     the graph, and the graph is the other half of this screen. The drawer
     hands it over, this resolves it against the nodes on the canvas, and the
     canvas lights them. An assert drawer that arrives already analyzed seeds
     it, so a page opened on a finished analysis draws one. */
  const seededAnalysis = (d: LineageDrawer | null) =>
    (d?.kind === "assert" && d.analyzed ? d.result : null);
  const [analysis, setAnalysis] = useState<ImpactResult | null>(seededAnalysis(data.drawer));
  if (seenDrawer !== data.drawer) {
    setSeenDrawer(data.drawer);
    setPicked(undefined);
    setAnalysis(seededAnalysis(data.drawer));
  }
  const drawerFor = picked === undefined ? data.drawer : picked;
  const [focalId, setFocalId] = useState<string | null>(data.focalId);
  const [seenFocal, setSeenFocal] = useState(data.focalId);
  if (seenFocal !== data.focalId) {
    setSeenFocal(data.focalId);
    setFocalId(data.focalId);
  }
  const setFocal = (nodeId: string) => {
    setFocalId(nodeId);
    setLineageControls({ scope: "focus" });
    actions?.setFocalNode?.(nodeId);
  };
  const selectGroupMember = (nodeId: string) => {
    setFocalId(nodeId);
    setPicked(null);
    setLineageControls({ scope: "focus" });
    actions?.setMode?.("provenance", nodeId);
  };

  const impact = useMemo(() => impactOverlay(analysis, data.nodes), [analysis, data.nodes]);
  const takeResult = (result: ImpactResult) => {
    setAnalysis(result);
    /* The analysis reaches across the whole corpus, so it has to be drawn on
       a canvas that can hold the whole corpus. Overview folds documents into
       roll-up cards and the two focused modes traverse a handful of links out
       from one node; in either, most of what the analysis named has no card to
       light. Documents is the mode that can answer, so that is the mode the
       reader lands in. */
    if (data.mode !== "documents") actions?.setMode?.("documents");
  };
  const clearImpact = () => setAnalysis(null);

  /* Who has to act on the analysis, read off the documents it named rather
     than authored beside it: the drawer's Owners section is a real list of
     the people who hold the impacted documents, or empty until there is one. */
  const impactOwners = useMemo(() => {
    const byId = new Map(data.nodes.map((node) => [node.id, node]));
    const counts = new Map<string, number>();
    for (const doc of impact?.docs ?? []) {
      const owner = byId.get(doc.id)?.owner?.trim();
      if (owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      owners: ranked.map(([name, count]) => ({ name, role: `${count} document${count === 1 ? "" : "s"}` })),
      people: ranked.map(([name]) => name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")),
    };
  }, [impact, data.nodes]);

  /* Opening the assert drawer from the toolbar. It is the reader's own
     selection, like every other drawer on this page, so it goes through the
     same `picked` slot; `data.drawer` can still deep-link one. Nothing is
     analyzed yet, so the payload it opens on is empty rather than a canned
     result the reader never asked for. */
  const toggleAssert = (open: boolean) => {
    if (!open) { setPicked(null); clearImpact(); return; }
    setPicked({
      kind: "assert", analyzed: false, claim: "",
      result: { claim: "", summary: "", docs: [] },
      owners: [], people: [],
    });
  };

  const openGroup = (groupId: string) => {
    const members = data.nodes.filter((node) => overviewGroupId(node) === groupId && !node.macro);
    setPicked({ kind: "group", groupId, totalMembers: members.length, members });
  };
  const overviewGroups = new Set(data.nodes.filter((node) => !node.macro).map(overviewGroupId)).size;

  /* Unfolding a roll-up in place. The canvas reads the shared control store,
     so the drawer's button and the canvas's own "Expanded" chips are two doors
     onto one piece of state rather than two copies of it. */
  const [controls, setControls] = useLineageControls();
  const expandGroup = (groupId: string) => {
    if (controls.expanded.includes(groupId)) return;
    setControls({ expanded: [...controls.expanded, groupId] });
  };
  const collapseGroup = (groupId: string) => {
    setControls({ expanded: controls.expanded.filter((g) => g !== groupId) });
  };

  /* What the canvas drew, so the toolbar can print an honest "showing N of M"
     and offer to draw more. Held in a ref-equal state: the canvas reports on
     every change and this must not turn that into a render loop. */
  const [volume, setVolume] = useState<{ shown: number; matching: number; total: number; cap: number } | null>(null);
  const onVolume = useCallback((next: { shown: number; matching: number; total: number; cap: number }) => {
    setVolume((prev) => (prev && prev.shown === next.shown && prev.matching === next.matching
      && prev.total === next.total && prev.cap === next.cap ? prev : next));
  }, []);

  /* Esc closes the open drawer, the exit its ✕ already offers to the mouse.
     Not while the path finder is armed (Esc leaves path mode there, and the
     toolbar says so on the button) and not while a field has focus, where Esc
     belongs to whatever is being typed. */
  const hasDrawer = (picked === undefined ? data.drawer : picked) !== null;
  useEffect(() => {
    if (!hasDrawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || getLineageControls().path !== null) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      setPicked(null);
      setAnalysis(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasDrawer]);

  /* One search on this page, and it lives in the toolbar. `data.search` seeds
     the shared control store the toolbar reads, so a deep-linked query still
     arrives, and re-seeds only when the data's query changes rather than
     fighting whatever the reader is typing. */
  const seededQuery = useRef<string | null | undefined>(undefined);
  const dataQuery = data.search?.query ?? null;
  useEffect(() => {
    if (seededQuery.current === dataQuery) return;
    seededQuery.current = dataQuery;
    if (dataQuery !== null) setLineageControls({ query: dataQuery });
  }, [dataQuery]);

  /* Same contract for the unfolded roll-ups: the data seeds them, the reader
     owns them from there. Keyed on the joined ids so a fresh array with the
     same groups in it does not undo an expansion the reader just collapsed. */
  const dataExpanded = (data.expanded ?? []).join("\u0000");
  const seededExpanded = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seededExpanded.current === dataExpanded) return;
    seededExpanded.current = dataExpanded;
    setLineageControls({ expanded: dataExpanded ? dataExpanded.split("\u0000") : [] });
  }, [dataExpanded]);

  const openNode = (id: string) => {
    const n = data.nodes.find((x) => x.id === id);
    // A macro node stands for a collapsed group, so it opens the group drawer.
    if (n?.macro) {
      const members = data.nodes.filter((x) => x.group === n.group && !x.macro);
      setPicked({ kind: "group", groupId: n.group, totalMembers: n.count ?? members.length, members });
      return;
    }
    /* History belongs to the document, and this page only carries it for the
       node `data.drawer` named. `null` for anything else, so the drawer either
       loads it (`actions.loadDocHistory`) or says it does not have it — it
       used to be handed `[]`, which reads as "this document has no history". */
    setPicked({
      kind: "node",
      nodeId: id,
      history: data.drawer?.kind === "node" && data.drawer.nodeId === id ? data.drawer.history : null,
    });
  };

  if (error) {
    return (
      <div className="mt-6">
        <Card>
          {/* XA-01: a failed read is not an empty graph. The EmptyState here
              said "no lineage" when the request simply did not come back. */}
          <ReadError>{error}</ReadError>
        </Card>
      </div>
    );
  }
  if (isEmpty(data)) {
    return (
      <div className="mt-6">
        <Card>
          {/* An empty state that teaches the interface rather than reporting
              an absence: it says what builds the graph and puts the first step
              inside reach. A real anchor, so it opens in a new tab like any
              other link (navigation/Link.tsx). */}
          <EmptyState
            icon={<Network size={22} />}
            title="No lineage yet"
            action={(
              <Link href="/sources" className={buttonClasses({ variant: "primary" })}>
                Connect a source
              </Link>
            )}
          >
            Mari draws this graph from what your sources already record: which
            document a page was derived from, which pull request changed it,
            which thread argued about it. Connect a source and sync, and the
            first links appear on the next run.
          </EmptyState>
        </Card>
      </div>
    );
  }

  // Mobile collapses to one column (§11): the rail drops below the canvas.
  const rail = mobile ? null : railFor(data, drawerFor);
  const railBody = data.extras
    ? <Extras extras={data.extras} />
    : <Drawer
        data={data}
        drawer={drawerFor}
        actions={actions}
        onImpactResult={takeResult}
        impactOwners={impactOwners}
        /* Closing the drawer takes the analysis off the canvas with it. The
           panel and the highlight are one answer, and leaving the graph lit
           with no way back to what lit it is the trap the ✕ used to set. */
        onClose={() => { setPicked(null); clearImpact(); }}
        focalId={focalId}
        onSetFocal={setFocal}
        onSelectGroupMember={selectGroupMember}
        expandedInPlace={drawerFor?.kind === "group" && controls.expanded.includes(drawerFor.groupId)}
        onExpandInPlace={expandGroup}
        onCollapseInPlace={collapseGroup}
      />;

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* The trail out of a drill-down. It is `data.crumbs` and not something
          this page derives, because only the app knows what URL each step back
          corresponds to — and a trail whose steps do not go anywhere is worse
          than no trail. */}
      {data.crumbs && data.crumbs.length > 0 && <Breadcrumb items={data.crumbs} />}
      <div className="rounded-[6px] border border-ink/15 bg-paper p-3" aria-label="Lineage question">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["documents", "Documents"],
            ["overview", "Overview"],
            ["provenance", "Provenance"],
            ["impact", "Impact"],
          ] as const).map(([mode, label]) => (
            <Button
              key={mode}
              compact
              variant={data.mode === mode ? "primary" : "default"}
              disabled={(mode === "provenance" || mode === "impact") && !focalId}
              aria-pressed={data.mode === mode}
              /* Picking a question takes the last answer down: an analysis
                 lit on a Documents canvas means nothing once the reader has
                 asked the graph something else. This row is the way back. */
              onClick={() => { clearImpact(); actions?.setMode?.(mode); }}
            >
              {label}
            </Button>
          ))}
          <span className="ml-1 text-[12.5px] text-ink/70">
            {data.mode === "documents"
              ? `${data.nodes.length.toLocaleString("en-US")} documents · ${data.edges.length.toLocaleString("en-US")} recorded relationships.`
              : data.mode === "overview"
              ? `${overviewGroups.toLocaleString("en-US")} group${overviewGroups === 1 ? "" : "s"} · ${data.nodes.length.toLocaleString("en-US")} document${data.nodes.length === 1 ? "" : "s"}, rolled up before individual documents.`
              : data.mode === "provenance"
                ? "Where the selected document came from."
                : "What depends on the selected document."}
          </span>
        </div>
        {(data.mode === "provenance" || data.mode === "impact") && focalId && (
          <div className="mt-2 font-term text-[11px] text-ink/65">
            Showing {data.tuning.hopDepth} dependency hop{data.tuning.hopDepth === 1 ? "" : "s"}; machine proposals below {Math.round(data.tuning.minConfidence * 100)}% confidence and contextual links are excluded.
          </div>
        )}
      </div>
      <Rig
        rail={rail}
        compact={mobile}
        canvas={(
          <>
            <LineageToolbar
              nodes={data.nodes}
              edges={data.edges}
              views={data.views}
              volume={volume ?? undefined}
              volumeStep={data.tuning.maxNodes}
              compact={mobile}
              onDeriveLinks={actions?.deriveLinks}
              onSaveView={actions?.saveView}
              onDeleteView={actions?.deleteView}
              assertOpen={drawerFor?.kind === "assert"}
              onAssert={toggleAssert}
            />
            {/* No `key` here. It used to be rebuilt from lens/layout/focal/
                trace, which remounted the canvas on every one of those changes
                and threw away pan, zoom, dragged positions and the selection.
                The graph takes them as props and seeds the shared control
                store from them instead, which is the one source of truth. */}
            <LineageGraph
              nodes={data.nodes}
              edges={data.edges}
              lens={data.lens}
              layout={data.layout}
              mode={data.mode}
              hopDepth={data.tuning.hopDepth}
              minConfidence={data.tuning.minConfidence}
              maxNodes={data.tuning.maxNodes}
              focalId={focalId}
              impact={impact}
              onClearImpact={clearImpact}
              onPinNode={actions?.pinNode}
              onSelectNode={openNode}
              onSelectGroup={openGroup}
              onSelectEdge={(id) => setPicked({ kind: "edge", edgeId: id })}
              onVolume={onVolume}
            />
            <LineageTimeScrubber dates={data.dates} activity={data.activity} value={data.asOf} />
          </>
        )}
        drawer={railBody}
      />
      {/* The lineage drawers are desktop-fixed (420/460px, §10). Below the
          canvas on a phone they scroll sideways inside their own row rather
          than spilling past the page gutter. */}
      {mobile && <Scrollable className="pb-1">{railBody}</Scrollable>}
    </div>
  );
}

function LineagePage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<LineageData, LineageActions>) {
  /* `data.action` names the document being traced; an empty one is a workspace
     with nothing in focus, and there is nothing to offer then. */
  const headerActions = data.action && actions?.openDocument
    ? (
      <Button variant="default" onClick={() => actions.openDocument!(data.action!.docId)}>
        {data.action.label}
      </Button>
    )
    : undefined;
  return (
    <PageFrame chrome={chrome} active={navFor("lineage")} title="Lineage" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="graph"
          eyebrow="Lineage"
          title="Product lineage"
          description="The document graph: provenance, impact, and drift across every source."
          /* The header's one button is labelled by `data.action.label` — the
             response's word, not this file's — so it stays a bar. */
          actions={1}
          mobile={mobile}
        />
      ) : (
        <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
          <PageHeader
            eyebrow="Lineage"
            title="Product lineage"
            description="The document graph: provenance, impact, and drift across every source."
            actions={mobile ? undefined : headerActions}
          />
          {mobile && headerActions && <div className="mt-4 flex flex-wrap items-center gap-2">{headerActions}</div>}
          {data.neighborhood && <div className="my-4 space-y-3 text-sm">
            <form action="/lineage" className="flex flex-wrap gap-2">
              <label>Record ID <input name="focal" defaultValue={data.neighborhood.focal ?? ''} required className="rounded border border-ink/20 px-2 py-1" /></label>
              <button type="submit" className="underline">Load neighborhood</button>
              <a className="underline" href="/knowledge">Find a record</a>
            </form>
            {data.neighborhood.focal ? <p>One-hop neighborhood, up to {data.neighborhood.limit} edges. Select another record to explore its neighborhood.</p>
              : <p>Choose a record to load its lineage. Expected mapping: Record → related Record, with a relation type.</p>}
            {data.neighborhood.hasMore && <p>More edges exist. {data.neighborhood.limit < 100 && <a className="underline" href={`/lineage?focal=${encodeURIComponent(data.neighborhood.focal!)}&limit=${Math.min(data.neighborhood.limit+30,100)}`}>Load more edges</a>}</p>}
          </div>}
          {(!data.neighborhood || data.neighborhood.focal) && <Body data={data} error={error} actions={actions} mobile={mobile} />}
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<LineageData, LineageActions> = {
  id: "lineage",
  title: "Lineage",
  route: "/lineage",
  component: LineagePage,
  states: STATES.map((s) => ({ ...s })),
};
