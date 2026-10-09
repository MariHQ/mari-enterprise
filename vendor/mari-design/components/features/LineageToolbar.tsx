import { useEffect, useId, useMemo, useRef, useState, forwardRef, type ButtonHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ReactNode } from "react";
import { Search, Plus, Crosshair, RotateCcw, Sparkles, GitFork, Bookmark, ChevronDown, X, Trash2 } from "lucide-react";
import * as RPop from "@radix-ui/react-popover";
import { card } from "../tokens/card";
import { focusRing } from "../tokens/focusRing";
import { Button } from "../actions/Button";
import { Menu, MenuItem, MenuCheckboxItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "../navigation/Menu";
/* The console's shared filter control (navigation/FilterTrigger, the
   Workflows bar's idiom): Facts and Workflows wear the same one, so every
   page reads as one filter language. */
import { FilterTrigger as ControlTrigger } from "../navigation/FilterTrigger";
import { Badge } from "../data-display/Badge";
import { Chip } from "../data-display/Chip";
import { Input } from "../forms/Input";
import { WriteError } from "../feedback/WriteError";
import { why } from "../actions/useWrite";
import { Skeleton, SkeletonLine, SkeletonButton } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";
import { TruncateInline } from "../data-display/Truncate";
import {
  REL, REL_ORDER, SOURCE_LABELS, LENSES, STATUS_FILTERS, NodeGlyph,
  useLineageControls, nodeById, tracePath,
  type GraphView, type LEdge, type LineageControlState, type LNode, type Lens,
  type LayoutMode, type RelKey, type StatusFilter,
} from "./LineageDataModel";

/* ─────────────────────────────────────────────────────────────────────────
   Lineage toolbar (feature: lineage-toolbar)

   Three explicit rows, one gap, no wrap-roulette:

     1. FILTERS   search · Sources: · Relations: · Status:
     2. CANVAS    how much of the graph is drawn · fit · reset layout
     3. VIEW      Color by: · Layout: · Flow: · Views:
     4. ACTIONS   Assert impact · Find path · Derive links

   Rows 3 and 4 are expert controls and disclose together.

   Every control is a labelled dropdown in the console's shared filter idiom
   (navigation/FilterTrigger, the Workflows bar; the accent stripes retired
   with it), and every one of them writes to the shared lineage control store
   — so the canvas below actually filters, recolors, relayouts and zooms.
   Nothing here is decorative.
   ──────────────────────────────────────────────────────────────────────── */

type SearchResult = { id: string; node: LNode };

/* One quiet line under a suggestion: source, then owner only when it says
   something the source label does not (connector documents often carry the
   source name as their owner), then the date as a short calendar day rather
   than the raw ISO stamp the node stores for the time axis. */
function shortDay(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}
function suggestionMeta(node: LNode): string {
  const source = SOURCE_LABELS[node.source] ?? node.source;
  const owner = node.owner && node.owner.toLowerCase() !== source.toLowerCase() && node.owner.toLowerCase() !== node.source.toLowerCase() ? node.owner : "";
  return [source, owner, shortDay(node.date)].filter(Boolean).join(" · ");
}

/** Source rows a menu shows before it becomes a bounded scroll region. */
const SOURCE_MENU_ROWS = 9;

/** Which control keys a saved view restores. `path` is a live pick on the
    canvas and `asOf` belongs to the scrubber below the graph, which owns its
    own position — writing either back here would be undone on the next
    render, so neither is saved and neither is restored. */
const VIEW_KEYS = ["query", "sources", "rels", "status", "lens", "layout", "scope", "zoom"] as const;

/** A saved view's state is JSON the server round-trips verbatim, so by the
    time it comes back it may be anything. Read only the control keys, and
    report a state that will not parse rather than half-applying it. */
function parseViewState(state: string): Partial<LineageControlState> | null {
  try {
    const raw: unknown = JSON.parse(state);
    if (!raw || typeof raw !== "object") return null;
    const src = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of VIEW_KEYS) if (k in src) out[k] = src[k];
    return out as Partial<LineageControlState>;
  } catch {
    return null;
  }
}

/** Only the keys a view restores are written, so a saved view never carries a
    stale as-of or a half-finished path pick. */
const viewStateOf = (c: LineageControlState): string =>
  JSON.stringify(Object.fromEntries(VIEW_KEYS.map((k) => [k, c[k]])));

export type LineageToolbarProps = {
  /** The graph the source/owner filters are built from. */
  nodes: LNode[];
  /** The same graph's links. "Find path" resolves against these, so a toolbar
      rendered without them can arm path mode but has nothing to route over. */
  edges?: LEdge[];
  /** Ask Mari to propose new edges across the corpus. Long-running: the button
      says it is reading. May throw; the toolbar shows the message. Return how
      many links were proposed and the toolbar reports that number; return
      nothing and it says only that the run finished, because a count it was
      not given is a count it must not print. Omitted entirely = no Derive
      links button, since there is nothing for it to run (§2). */
  onDeriveLinks?: () => void | number | Promise<void | number>;
  /** Persist the current filter/view state under a name. Omitted = the Views
      menu offers no "Save current view", because nothing would receive it.
      Return the id the store gave it and the row can be removed again in this
      same session; return nothing and it can only be removed after a refetch
      hands it back with an id. */
  onSaveView?: (args: { name: string; state: string }) => void | number | Promise<void | number>;
  /** The views already saved for this workspace, listed in the Views menu.
      Without them "Save view" wrote into a void: nothing ever read a saved
      view back. */
  views?: GraphView[];
  /** Remove a saved view for good. Omitted = the Views menu offers no way to
      manage them, because nothing would receive the removal (§2). The toolbar
      confirms in place before calling this; it never asks the browser. */
  onDeleteView?: (args: { id: number; name: string }) => void | Promise<void>;
  /** Whether the impact-analysis drawer is open. Passing it makes the button
      report the page's own state instead of a toggle it keeps to itself, so
      closing the drawer with its ✕ also un-presses the button that opened it.
      Omitted = the toolbar tracks it locally, which is what the canvas does. */
  assertOpen?: boolean;
  /** Open or close the impact-analysis drawer. Omitted = the button only
      marks itself, which is all it can do without a rail to open into. */
  onAssert?: (open: boolean) => void;
  /** What the canvas actually drew: how many cards are on screen, how many
      documents passed the filters, how many the graph holds, and the node cap
      in force. Omitted = no volume readout, because a count this toolbar has
      not been given is a count it must not print. */
  volume?: { shown: number; matching: number; total: number; cap: number };
  /** How many more cards one "Show more" asks for. Defaults to the workspace
      cap, so the first press doubles what is on screen. */
  volumeStep?: number;
  /** Render a content-shaped skeleton silhouette instead of the controls. */
  loading?: boolean;
  /** Let the filters wrap within a phone viewport instead of making the
      entire toolbar an 840px horizontal strip. The graph canvas may still
      pan horizontally; its primary controls should not. */
  compact?: boolean;
  className?: string;
};

/** One filter/view control: a text label, then the live selection.

    forwardRef is required, not stylistic: this is used as a Radix menu
    trigger, and Radix passes a ref to position the popup and to return focus
    on close. A plain function component drops that ref with a console warning
    and the menu loses its anchor. */

/* One labelled band. The rows are separated by a hairline so the three
   groups (filters / view / actions) read as three decisions, not one wall. */
function Row({ label, children, divide = false }: { label: string; children: ReactNode; divide?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${divide ? "border-t border-ink/10 pt-2.5" : ""}`.trim()}>
      <span className="w-[54px] shrink-0 pt-2 font-term text-[10px] font-medium uppercase tracking-[0.1em] text-ink/65">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-2">{children}</div>
    </div>
  );
}

export function LineageToolbar({
  nodes, edges = [], onDeriveLinks, onSaveView, onDeleteView, views, volume, volumeStep,
  assertOpen: assertOpenProp, onAssert,
  loading = false, compact = false, className = "",
}: LineageToolbarProps) {
  const docs = useMemo(() => nodes.filter((n) => !n.macro), [nodes]);
  const sources = useMemo(() => Array.from(new Set(docs.map((n) => n.source))), [docs]);

  const [controls, setControls] = useLineageControls();
  const [view, setView] = useState<string>("All documents");
  const [deriving, setDeriving] = useState(false);
  /** What the last derive run reported. `null` = it has not been run. A number
      only ever comes from the handler; the run itself never counts anything. */
  const [derived, setDerived] = useState<{ count: number | null } | null>(null);
  /* The page's answer wins when it has one: the drawer can be closed from its
     own ✕, and a button that stayed pressed against a closed drawer was
     describing a panel that is not there. */
  const [assertLocal, setAssertLocal] = useState(false);
  const assertOpen = assertOpenProp ?? assertLocal;
  const [deriveErr, setDeriveErr] = useState<string | null>(null);
  const [saveName, setSaveName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [locallySaved, setLocallySaved] = useState<GraphView[]>([]);
  /* Managing saved views: a list with a remove on each row, and the removal
     confirmed on that row rather than in a browser dialog nobody asked for
     (§19, NN/g on confirmation). */
  const [managing, setManaging] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<GraphView | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeErr, setRemoveErr] = useState<string | null>(null);
  const [locallyRemoved, setLocallyRemoved] = useState<string[]>([]);

  /* The workspace's saved views, plus anything saved in this session that the
     server has not handed back yet, minus anything removed in this session
     that it is still handing back. Same name = one row, newest wins. */
  const savedViews = useMemo(() => {
    const byName = new Map<string, GraphView>();
    for (const v of [...(views ?? []), ...locallySaved]) byName.set(v.name, v);
    for (const name of locallyRemoved) byName.delete(name);
    return [...byName.values()];
  }, [views, locallySaved, locallyRemoved]);

  const onSources = controls.sources ?? sources;
  const onRels = controls.rels ?? REL_ORDER;

  /* Find path. The picks live in the shared control store because the picking
     happens on the CANVAS: this button used to keep a private counter and
     offered a "simulate pick" link beside it, so the feature could never do
     anything to the graph however many nodes you clicked. Now the button arms
     the mode, the canvas records the two picks, and this row reports what the
     canvas resolved. */
  const picked = controls.path;
  const path = useMemo(() => tracePath(picked, edges), [picked, edges]);
  const byId = useMemo(() => nodeById(nodes), [nodes]);
  const titleOf = (id: string) => byId[id]?.title ?? id;

  // Esc leaves path mode, which is the exit the button's own label promises.
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setControls({ path: null }); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picked, setControls]);

  /* "/" jumps to the search box, the shortcut every tool with a search box
     has. It is deliberately inert while the reader is already typing into a
     field or editing content, where "/" is just a slash. */
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results: SearchResult[] = useMemo(() => {
    const q = controls.query.trim().toLowerCase();
    if (!q) return [];
    return docs
      .filter((n) =>
        n.title.toLowerCase().includes(q) ||
        (n.owner ?? "").toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b.inbound ?? 0) - (a.inbound ?? 0))
      .slice(0, 7)
      .map((node) => ({ id: node.id, node }));
  }, [controls.query, docs]);

  /* The suggestions are an overlay, so they need their own open state rather
     than being a function of the query: Escape and a click on the graph have
     to put them away while the query, and everything it is filtering, stays
     exactly where the reader left it. */
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(0);
  const activeIdx = Math.min(active, results.length - 1);
  const uid = useId().replace(/:/g, "");
  const listboxId = `lineage-search-results-${uid}`;
  const optionId = (i: number) => `${listboxId}-option-${i}`;

  // A new query starts at the top of a new list.
  useEffect(() => { setActive(0); }, [controls.query]);
  /* Emptying the box closes the panel, including when something outside this
     toolbar clears the shared query. */
  useEffect(() => { if (!controls.query.trim()) setSuggestOpen(false); }, [controls.query]);

  /* Radix dismisses on Escape from a document CAPTURE listener, so it runs
     before this input's own keydown and can re-render the box as closed in
     between. Read as state, one press would then both put the panel away and
     empty the field. The panel marks the press it consumed; the input skips
     exactly that one and keeps the query. */
  const escapeConsumed = useRef<KeyboardEvent | null>(null);

  const activeOptionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { activeOptionRef.current?.scrollIntoView({ block: "nearest" }); }, [activeIdx, suggestOpen]);

  const choose = (r: SearchResult) => {
    setControls({ query: r.node.title });
    setSuggestOpen(false);
    searchRef.current?.focus();
  };

  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      /* First Escape puts the suggestions away, second clears the field.
         Reversing that would throw away a query the reader was still reading
         results for. */
      if (escapeConsumed.current === e.nativeEvent) { escapeConsumed.current = null; e.preventDefault(); return; }
      setControls({ query: "" });
      e.currentTarget.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!suggestOpen) { if (controls.query.trim()) setSuggestOpen(true); return; }
      setActive((a) => Math.min(results.length - 1, a + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      if (!suggestOpen) return;
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
      return;
    }
    if (e.key === "Enter" && suggestOpen && results[activeIdx]) {
      e.preventDefault();
      choose(results[activeIdx]);
    }
  };

  const toggleSource = (s: string, on: boolean) => {
    const next = new Set(onSources);
    if (on) next.add(s); else next.delete(s);
    setControls({ sources: next.size === sources.length ? null : [...next] });
    setView("Custom");
  };

  const toggleRel = (k: RelKey, on: boolean) => {
    const next = new Set(onRels);
    if (on) next.add(k); else next.delete(k);
    setControls({ rels: next.size === REL_ORDER.length ? null : [...next] });
    setView("Custom");
  };

  const applyView = (name: string, patch: Parameters<typeof setControls>[0]) => {
    setControls(patch);
    setView(name);
  };

  /* Mari reads the whole corpus to propose edges, so the button has to say it
     is working rather than sit there looking clicked.

     It reports only what the handler hands back. This used to wait 1600ms with
     nothing wired and then announce "3 links proposed" — three links that no
     one had proposed, printed by a button that had done nothing at all. */
  const derive = async () => {
    if (deriving || !onDeriveLinks) return;
    setDeriving(true);
    setDeriveErr(null);
    try {
      const count = await onDeriveLinks();
      setDerived({ count: typeof count === "number" ? count : null });
    } catch (err) {
      setDeriveErr(why(err, "Mari could not read the graph."));
    } finally {
      setDeriving(false);
    }
  };

  /* Saving a view needs a name, so the menu item opens a name field rather
     than silently writing "Saved view" over the last one. */
  const saveView = async (name: string) => {
    if (!onSaveView) return;
    setSaving(true);
    setSaveErr(null);
    const state = viewStateOf(controls);
    try {
      const id = await onSaveView({ name, state });
      /* A saved view has to appear in the menu it was saved from, before any
         refetch brings it back from the server. The store's own id when the
         handler returns one, so the row can be removed again straight away;
         a negative placeholder when it does not, and the server's copy
         replaces it by name. */
      setLocallySaved((rows) => [
        ...rows.filter((r) => r.name !== name),
        { id: typeof id === "number" ? id : -(rows.length + 1), name, state },
      ]);
      setLocallyRemoved((names) => names.filter((n) => n !== name));
      setSavedAs(name);
      setSaveName(null);
      setView(name);
    } catch (err) {
      setSaveErr(why(err, "That view could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  /* Removing one, once the reader has confirmed it on the row. A view saved
     in this session that the store never gave an id to has nothing to delete
     on the server, so that row is only dropped from this menu. */
  const removeView = async (v: GraphView) => {
    if (!onDeleteView) return;
    setRemoving(true);
    setRemoveErr(null);
    try {
      if (v.id >= 0) await onDeleteView({ id: v.id, name: v.name });
      setLocallySaved((rows) => rows.filter((r) => r.name !== v.name));
      setLocallyRemoved((names) => [...names, v.name]);
      setPendingRemove(null);
      if (view === v.name) setView("Custom");
    } catch (err) {
      setRemoveErr(why(err, `“${v.name}” could not be removed.`));
    } finally {
      setRemoving(false);
    }
  };

  /* Applying one. Without this the Views menu listed four hardcoded presets
     and nothing else, so "Save current view" wrote somewhere no control ever
     read back. */
  const applySaved = (v: GraphView) => {
    const patch = parseViewState(v.state);
    if (!patch) {
      setSaveErr(`“${v.name}” could not be read, so nothing was applied.`);
      return;
    }
    setSaveErr(null);
    applyView(v.name, patch);
  };

  const sourceValue = controls.sources === null
    ? "All"
    : controls.sources.length === 0
      ? "None"
      : controls.sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ");
  const relValue = controls.rels === null
    ? "All"
    : controls.rels.length === 0
      ? "None"
      : controls.rels.map((k) => REL[k].label).join(", ");
  const statusValue = STATUS_FILTERS.find((s) => s.key === controls.status)?.label ?? "All";
  const lensValue = LENSES.find((l) => l.key === controls.lens)?.label ?? "Source";
  const layoutValue = controls.layout === "flow" ? "Flow" : "Timeline";
  const flowValue = controls.scope === "focus" ? "Focal closure" : "Whole graph";


  const pathLabel = !picked
    ? "Find path"
    : picked.length === 0
      ? "Pick two nodes (Esc)"
      : picked.length === 1
        ? "Pick one more (Esc)"
        : "Exit path";

  /* This toolbar's shape is entirely the component's own: three bands named
     Filter / View / Actions, holding controls named Sources, Relations,
     Status, Zoom, Color by, Layout, Flow, Views. Not one of those words comes
     from the graph — only each control's current SELECTION does. The old
     silhouette threw all of it away and drew nine anonymous grey pills of
     invented widths, which then jumped when the real controls (each sized to
     its own label) took their places. Labels render; the values are bars, at
     the ControlTrigger's own 32px height and the row's own gaps. */
  if (loading) {
    const Pending = ({ label }: { label: string }) => (
      <span className="flex shrink-0 items-center gap-2 text-[12.5px] text-ink/70">
        {label}
        <span className="inline-flex h-9 items-center rounded-[4px] border border-ink/20 bg-paper px-3">
          <SkeletonLine w={64} h={11} />
        </span>
      </span>
    );
    return (
      <div className={`${card} flex ${compact ? "min-w-0" : "min-w-[720px]"} flex-col gap-2.5 p-3 font-display ${className}`.trim()} aria-busy="true">
        <Row label="Filter">
          <Skeleton width={168} height={32} rounded="rounded-[4px]" />
          <Pending label="Sources" />
          <Pending label="Relations" />
          <Pending label="Status" />
        </Row>
        {/* The silhouette is the RESTING toolbar, not every row it can show:
            View and Actions live behind a disclosure, so drawing them here
            made the toolbar shrink by two rows the moment it loaded and threw
            the whole canvas up the page (§9). */}
        <Row label="Canvas" divide>
          <SkeletonLine w={196} h={12} />
          <span className="ml-auto flex items-center gap-2">
            <SkeletonButton w={124} />
            <SkeletonButton w={112} />
          </span>
        </Row>
        <div className="border-t border-ink/10 pt-2.5">
          <span className="font-term text-[11px] font-medium uppercase tracking-[0.08em] text-ink/45">
            Graph options and actions
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${card} flex ${compact ? "min-w-0" : "min-w-[720px]"} flex-col gap-2.5 p-3 font-display ${className}`.trim()}>
      {/* ── row 1: filters ─────────────────────────────────────────────── */}
      <Row label="Filter">
        {/* The suggestion list is a Radix popover anchored to the search box:
            the same portaled overlay layer the Sources and Relations menus
            sit on, so matches float over the graph instead of growing the
            filter block. It used to be a <Scrollable className="absolute …">
            rendered inline in this row, and Scrollable's own wrapper carries
            `relative` — Tailwind emits `.relative` after `.absolute`, so the
            absolute never applied, the list stayed in flow, and every search
            pushed the toolbar (and the canvas under it) taller (§13).

            Popover rather than Menu because the reader has to keep typing: a
            dropdown menu moves focus into its own list and eats the
            keystrokes, so the box it is attached to would stop accepting
            them. Focus stays in the input and the list is driven by
            aria-activedescendant; Radix still gives outside-click and
            Escape. */}
        <RPop.Root open={suggestOpen} onOpenChange={(o) => { if (!o) setSuggestOpen(false); }}>
          <RPop.Anchor asChild>
            <div className="flex h-9 w-[168px] items-center gap-1.5 rounded-[4px] border border-ink/20 bg-paper pl-2.5 pr-2 focus-within:border-biscay-2/60 focus-within:ring-1 focus-within:ring-biscay-2/40">
              <Search size={14} className="shrink-0 text-ink/65" />
              <input
                ref={searchRef}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestOpen}
                aria-controls={suggestOpen ? listboxId : undefined}
                aria-activedescendant={suggestOpen && results[activeIdx] ? optionId(activeIdx) : undefined}
                value={controls.query}
                onChange={(e) => { setControls({ query: e.target.value }); setSuggestOpen(e.target.value.trim().length > 0); }}
                onFocus={() => { if (controls.query.trim()) setSuggestOpen(true); }}
                onClick={() => { if (controls.query.trim()) setSuggestOpen(true); }}
                onKeyDown={onSearchKey}
                placeholder="Search graph"
                aria-label="Search the graph. Press slash to jump here."
                name="lineage-search"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink/65"
              />
              {controls.query ? (
                <button
                  type="button"
                  onClick={() => { setControls({ query: "" }); setSuggestOpen(false); }}
                  aria-label="Clear search"
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-ink/65 hover:bg-ink/10 hover:text-ink ${focusRing}`}
                >
                  <X size={11} />
                </button>
              ) : compact ? null : (
                /* The shortcut, shown as a key rather than smuggled into the
                   placeholder where it reads as part of the prompt. Decorative:
                   the input's own label already says it out loud. Not on a
                   phone, where there is no key to press. */
                <kbd
                  aria-hidden
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border border-ink/20 bg-flysch font-term text-[10px] leading-none text-ink/65"
                >
                  /
                </kbd>
              )}
            </div>
          </RPop.Anchor>
          <RPop.Portal>
            <RPop.Content
              align="start"
              side="bottom"
              sideOffset={7}
              /* The box keeps the caret. Radix focuses its panel on open and
                 hands focus back on close, either of which would take the
                 reader out of the field they are still typing in. */
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => { escapeConsumed.current = e; }}
              className={`${card} z-50 w-[320px]`}
            >
              <Scrollable axis="y" className="max-h-[300px]" scrollerClassName="p-1">
                <div id={listboxId} role="listbox" aria-label="Graph search results">
                  <span role="status" aria-live="polite" className="sr-only">
                    {results.length === 0 ? "No matches" : `${results.length} match${results.length === 1 ? "" : "es"}`}
                  </span>
                  {results.length === 0 ? (
                    <div className="px-3 py-3 text-[13px] text-ink/70">No matches in the graph.</div>
                  ) : results.map((r, i) => (
                    <button
                      key={r.id}
                      id={optionId(i)}
                      type="button"
                      role="option"
                      aria-selected={i === activeIdx}
                      /* Not a tab stop: the box below is the one focusable
                         control, and the arrow keys walk this list (ACC-03).
                         The mousedown preventDefault is what keeps the caret
                         in the search box when a suggestion is clicked, and
                         the click handler runs only for activation that
                         reports `detail === 0`. */
                      tabIndex={-1}
                      ref={i === activeIdx ? activeOptionRef : undefined}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => { e.preventDefault(); choose(r); }}
                      onClick={(e) => { if (e.detail === 0) choose(r); }}
                      className={`flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left active:bg-ink/[0.07] ${i === activeIdx ? "bg-flysch" : ""} ${focusRing}`}
                    >
                      <span className="shrink-0 text-ink/75"><NodeGlyph node={r.node} size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{r.node.title}</span>
                        <span className="block truncate font-term text-[11px] text-ink/70">
                          {suggestionMeta(r.node)}
                        </span>
                      </span>
                      <span className="shrink-0 font-term text-[11px] text-ink/65">{r.node.inbound ?? 0} inbound</span>
                    </button>
                  ))}
                </div>
              </Scrollable>
            </RPop.Content>
          </RPop.Portal>
        </RPop.Root>

        <Menu align="start" trigger={<ControlTrigger label="Sources" value={sourceValue} />}>
          {/* A workspace with 30 connected sources must not run a menu off the
              bottom of the screen: the list is bounded and scrolls (§20). */}
          <Scrollable axis="y" className={sources.length > SOURCE_MENU_ROWS ? "max-h-[264px] w-[228px]" : ""}>
            {sources.map((s) => (
              <MenuCheckboxItem key={s} checked={onSources.includes(s)} onCheckedChange={(c) => toggleSource(s, c)}>
                <span className="flex min-w-0 items-center gap-2">
                  <NodeGlyph node={{ source: s }} size={14} />
                  <TruncateInline>{SOURCE_LABELS[s] ?? s}</TruncateInline>
                  <span className="ml-auto shrink-0 font-term text-[11px] text-ink/65">{docs.filter((n) => n.source === s).length}</span>
                </span>
              </MenuCheckboxItem>
            ))}
          </Scrollable>
          <MenuSeparator />
          <MenuItem onSelect={() => applyView("All documents", { sources: null })}>All sources</MenuItem>
        </Menu>

        <Menu align="start" trigger={<ControlTrigger label="Relations" value={relValue} />}>
          {REL_ORDER.map((k) => (
            <MenuCheckboxItem key={k} checked={onRels.includes(k)} onCheckedChange={(c) => toggleRel(k, c)}>
              <span className="flex items-center gap-2">
                <svg width={26} height={9} viewBox="0 0 26 9" aria-hidden>
                  <line x1={1} y1={4.5} x2={25} y2={4.5} stroke={REL[k].color} strokeWidth={REL[k].width} strokeDasharray={REL[k].dash} />
                </svg>
                {REL[k].label}
                <span className="ml-auto font-term text-[10.5px] text-ink/65">{REL[k].code}</span>
              </span>
            </MenuCheckboxItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => setControls({ rels: null })}>All relations</MenuItem>
        </Menu>

        <Menu align="start" trigger={<ControlTrigger label="Status" value={statusValue} />}>
          <MenuRadioGroup value={controls.status} onValueChange={(v) => setControls({ status: v as StatusFilter })}>
            {STATUS_FILTERS.map((s) => <MenuRadioItem key={s.key} value={s.key}>{s.label}</MenuRadioItem>)}
          </MenuRadioGroup>
        </Menu>

      </Row>

      {/* ── row 2: the canvas itself ────────────────────────────────────
          How much of the graph is on screen, and the two ways to get it back
          into view. The count strip sits above the thing it describes and
          below the filter bar (§13), and it prints only numbers the canvas
          reported: a cap that silently dropped 93 documents while the header
          said nothing is a lie the reader cannot see. */}
      <Row label="Canvas" divide>
        {volume && (
          <span className="flex min-w-0 items-center gap-2">
            {volume.shown < volume.matching && <Chip tone="attention" label="Capped" className="shrink-0" />}
            <span className="font-term text-[11.5px] text-ink/75">
              {volume.shown === volume.total
                ? `Showing all ${volume.total.toLocaleString("en-US")} documents`
                : `Showing ${volume.shown.toLocaleString("en-US")} of ${volume.matching.toLocaleString("en-US")} matching documents`}
            </span>
          </span>
        )}
        {volume && volume.shown < volume.matching && (
          <Button
            compact
            onClick={() => setControls({ maxNodes: volume.cap + Math.max(1, volumeStep ?? volume.cap) })}
          >
            <Plus size={13} /> Show {Math.min(Math.max(1, volumeStep ?? volume.cap), volume.matching - volume.shown).toLocaleString("en-US")} more
          </Button>
        )}
        {controls.maxNodes !== null && (
          <Button compact onClick={() => setControls({ maxNodes: null })}>Back to the workspace cap</Button>
        )}
        {/* Direct children of the row, not a nested flex box: wrapped in one,
            the pair overflowed the toolbar as a unit instead of wrapping, and
            "Reset layout" sat past the right edge where only a sideways
            scroll would reach it. */}
        <Button compact className="ml-auto" onClick={() => setControls({ viewport: "selection" })}>
          <Crosshair size={13} /> Fit to selection
        </Button>
        <Button compact onClick={() => setControls({ viewport: "reset" })}>
          <RotateCcw size={13} /> Reset layout
        </Button>
      </Row>

      {/* The resting surface answers the common question with search and
          filters. Layout, coloring, saved views, and graph-building actions
          are expert controls, so they disclose together instead of competing
          with the task selector above the graph. */}
      <details className="border-t border-ink/10 pt-2.5">
        <summary className={`w-fit cursor-pointer rounded-[3px] font-term text-[11px] font-medium uppercase tracking-[0.08em] text-ink/70 hover:text-ink ${focusRing}`}>
          Graph options and actions
        </summary>
        <div className="mt-2.5 flex flex-col gap-2.5">
      {/* ── row 3: view ────────────────────────────────────────────────── */}
      <Row label="View">
        <Menu align="start" trigger={<ControlTrigger label="Color by" value={lensValue} />}>
          <MenuRadioGroup value={controls.lens} onValueChange={(v) => setControls({ lens: v as Lens })}>
            {LENSES.map((l) => <MenuRadioItem key={l.key} value={l.key}>{l.label}</MenuRadioItem>)}
          </MenuRadioGroup>
        </Menu>

        <Menu align="start" trigger={<ControlTrigger label="Layout" value={layoutValue} />}>
          <MenuRadioGroup value={controls.layout} onValueChange={(v) => setControls({ layout: v as LayoutMode })}>
            <MenuRadioItem value="flow">Flow</MenuRadioItem>
            <MenuRadioItem value="timeline">Timeline</MenuRadioItem>
          </MenuRadioGroup>
        </Menu>

        <Menu align="start" trigger={<ControlTrigger label="Flow" value={flowValue} />}>
          <MenuRadioGroup value={controls.scope} onValueChange={(v) => setControls({ scope: v as "focus" | "all" })}>
            <MenuRadioItem value="focus">Focal closure</MenuRadioItem>
            <MenuRadioItem value="all">Whole graph</MenuRadioItem>
          </MenuRadioGroup>
        </Menu>

        <Menu align="start" trigger={<ControlTrigger label="Views" value={view} />}>
          <MenuItem icon={<Bookmark size={14} />} onSelect={() => applyView("All documents", { sources: null, rels: null, status: "all", scope: "all", query: "" })}>
            All documents
          </MenuItem>
          <MenuItem icon={<Bookmark size={14} />} onSelect={() => applyView("Customer-facing docs", { sources: ["docs", "docsite", "notion"], status: "all" })}>
            Customer-facing docs
          </MenuItem>
          <MenuItem icon={<Bookmark size={14} />} onSelect={() => applyView("Needs review", { sources: null, status: "review" })}>
            Needs review
          </MenuItem>
          <MenuItem icon={<Bookmark size={14} />} onSelect={() => applyView("Contradictions", { sources: null, status: "all", rels: ["contradicts"] })}>
            Contradictions only
          </MenuItem>
          {savedViews.length > 0 && (
            <>
              <MenuSeparator />
              {/* Saved views, read back from the same store "Save view" writes
                  to. A workspace with dozens of them scrolls (§20). */}
              <Scrollable axis="y" className={savedViews.length > SOURCE_MENU_ROWS ? "max-h-[264px] w-[228px]" : ""}>
                {savedViews.map((v) => (
                  <MenuItem key={v.id} icon={<Bookmark size={14} />} onSelect={() => applySaved(v)}>
                    <TruncateInline>{v.name}</TruncateInline>
                  </MenuItem>
                ))}
              </Scrollable>
            </>
          )}
          {/* Offered only when something can receive it (§2). */}
          {(onSaveView || (onDeleteView && savedViews.length > 0)) && <MenuSeparator />}
          {onSaveView && (
            <MenuItem icon={<Plus size={14} />} onSelect={() => { setSaveName(view === "Custom" ? "" : view); setSaveErr(null); }}>
              Save current view
            </MenuItem>
          )}
          {onDeleteView && savedViews.length > 0 && (
            <MenuItem icon={<Trash2 size={14} />} onSelect={() => { setManaging(true); setPendingRemove(null); setRemoveErr(null); }}>
              Remove a saved view
            </MenuItem>
          )}
        </Menu>
      </Row>

      {/* ── row 4: actions ─────────────────────────────────────────────── */}
      <Row label="Actions" divide>
        <Button
          onClick={() => { setAssertLocal(!assertOpen); onAssert?.(!assertOpen); }}
          aria-pressed={assertOpen}
          className={assertOpen ? "border-biscay-2 bg-biscay-2/[0.10] text-biscay-2" : ""}
        >
          <Sparkles size={14} /> Assert impact
        </Button>
        <Button
          onClick={() => setControls({ path: picked ? null : [] })}
          className={picked ? "border-biscay-2 bg-biscay-2/[0.10] text-biscay-2" : ""}
        >
          <GitFork size={14} /> {pathLabel}
        </Button>
        {/* No handler, no button: there is nothing for it to run, and a button
            that only pretends to run is worse than one that is not there. */}
        {onDeriveLinks && (
          <Button onClick={() => void derive()} disabled={deriving}>
            <Sparkles size={14} /> {deriving ? "Mari is reading" : "Derive links"}
          </Button>
        )}
        {derived && !deriving && (
          <Badge
            tone="ok"
            label={derived.count === null
              ? "Mari finished reading the graph"
              : `${derived.count} link${derived.count === 1 ? "" : "s"} proposed`}
          />
        )}
        {assertOpen && <Badge tone="info" label="Impact analysis open" />}
        {savedAs && !saveName && <Badge tone="ok" label={`Saved as ${savedAs}`} />}
      </Row>

      {/* A refused derive or a refused save is a failed ACTION beside a
          button, not validation on the name field, so it is the banner every
          other failed write gets (§8). */}
      {(deriveErr || saveErr || removeErr) && (
        <div className="pl-[66px]">
          <WriteError onDismiss={() => { setDeriveErr(null); setSaveErr(null); setRemoveErr(null); }}>
            {deriveErr ?? saveErr ?? removeErr}
          </WriteError>
        </div>
      )}

      {/* Name-and-save row for "Save current view". */}
      {saveName !== null && (
        <Row label="Save" divide>
          <Input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && saveName.trim()) void saveView(saveName.trim()); }}
            placeholder="Name this view"
            aria-label="Name this view"
            name="lineage-view-name"
            className="w-[220px]"
          />
          {/* Confirm action bottom left of the row, cancel to its right (§2). */}
          <Button variant="primary" disabled={saving || !saveName.trim()} onClick={() => void saveView(saveName.trim())}>
            {saving ? "Saving…" : "Save view"}
          </Button>
          <Button onClick={() => { setSaveName(null); setSaveErr(null); }}>Cancel</Button>
        </Row>
      )}

      {/* Managing saved views. Removal is confirmed on the row it affects,
          naming the view being removed, with the safe choice on the right —
          not a browser confirm() that says "Are you sure?" about nothing in
          particular (§19). */}
      {managing && onDeleteView && (
        <Row label="Views" divide>
          {savedViews.length === 0 ? (
            <span className="text-[12.5px] text-ink/70">No saved views left.</span>
          ) : pendingRemove ? (
            <>
              <span className="min-w-0 text-[12.5px] text-ink/85">
                Remove “{pendingRemove.name}”? Anyone in this workspace loses it.
              </span>
              <Button
                variant="danger"
                compact
                disabled={removing}
                onClick={() => void removeView(pendingRemove)}
              >
                {removing ? "Removing…" : "Remove it"}
              </Button>
              <Button compact onClick={() => setPendingRemove(null)}>Keep it</Button>
            </>
          ) : (
            savedViews.map((v) => (
              <Chip
                key={v.id}
                label={v.name}
                onRemove={() => { setPendingRemove(v); setRemoveErr(null); }}
                removeLabel={`Remove ${v.name}`}
              />
            ))
          )}
          <Button compact className="ml-auto" onClick={() => { setManaging(false); setPendingRemove(null); }}>Done</Button>
        </Row>
      )}

      {/* path-mode pick state: what the canvas has recorded, and what routing
          the two picks resolved to. */}
      {picked && (
        <div className="flex flex-wrap items-center gap-2 pl-[66px]">
          <Badge tone="info" label={`Path mode · ${picked.length}/2 picked`} />
          {picked.length < 2 ? (
            <span className="min-w-0 font-term text-[11px] text-ink/65">
              {picked.length === 0
                ? "Click a node on the canvas to start."
                : `From “${titleOf(picked[0])}”. Click the other end.`}
            </span>
          ) : path ? (
            <>
              <Badge tone="ok" label={`${path.hops} hop${path.hops === 1 ? "" : "s"}`} />
              <TruncateInline className="font-term text-[11px] text-ink/70">
                {path.ids.map(titleOf).join(" → ")}
              </TruncateInline>
            </>
          ) : (
            <span className="min-w-0 font-term text-[11px] text-ink/70">
              No route links “{titleOf(picked[0])}” to “{titleOf(picked[1])}”.
            </span>
          )}
          {picked.length > 0 && (
            <Button compact onClick={() => setControls({ path: [] })}>Start over</Button>
          )}
        </div>
      )}
        </div>
      </details>
    </div>
  );
}
