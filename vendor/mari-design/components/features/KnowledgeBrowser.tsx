import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Search, X, Bookmark, ArrowUpDown } from "lucide-react";
import { Card } from "../layout/Card";
import { CardBody, CardTitleBlock, CardMeta } from "../layout/CardShell";
import { Button } from "../actions/Button";
import { Avatar } from "../data-display/Avatar";
import { Pill } from "../data-display/Pill";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { Tabs } from "../navigation/Tabs";
import { Menu, MenuRadioGroup, MenuRadioItem, MenuLabel } from "../navigation/Menu";
import { Link } from "../navigation/Link";
import { SourceMark } from "../icons/marks";
import { fmtDate } from "../tokens/format";
import { Skeleton, SkeletonLine, SkeletonText, SkeletonCircle, SkeletonChip } from "../data-display/Skeleton";
import { Truncate } from "../data-display/Truncate";
import { Scrollable } from "../data-display/Scrollable";
import { ReadError } from "../feedback/ReadError";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";

/* KnowledgeBrowser — the filter rail + results feed of the Knowledge page.
   A faceted filter rail, a debounced search box, result-type tabs, sort, and
   a scrollable feed of result cards, closed by a live corpus-stats strip.
   Slack results render as thread-sized "decision chunks". Fully local +
   standalone with baked demo corpus. */

type Kind = "page" | "thread" | "pr";

/** One search hit. Exported so pages and fixtures compose it. */
export type KnowledgeResult = {
  id: string;
  kind: Kind;
  source: string;
  title: string;
  snippet: string;
  author: string;
  date: string;
  tags: string[];
  status?: string;
  messageCount?: number;
  participantCount?: number;
};

const SORTS = [
  { id: "best", label: "Best match" },
  { id: "newest", label: "Newest" },
  { id: "title", label: "Title" },
];

/** KnowledgeResult cards rendered per page. */
const PAGE = 25;

/* Where a result opens: the library's own Doc Review page (its `route` in
   pages/DocReviewPage.tsx), with the document in the query string. This is a
   link from one page of this library to another, not an app URL — the page
   registry owns both ends of it — which is the same reason DocReviewPage can
   point its back-link at "/knowledge". */
const docHref = (id: string) => `/knowledge/doc?id=${encodeURIComponent(id)}`;

/* ── local sub-components ─────────────────────────────────────────────── */

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2.5 h-9 px-3 rounded-md border border-ink/20 bg-paper text-ink/65 focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
      <Search size={15} className="shrink-0" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search knowledge…" className="flex-1 bg-transparent outline-none text-[13px] text-ink placeholder:text-ink/65" />
      {value && <button type="button" aria-label="Clear" onClick={() => onChange("")} className="shrink-0 text-ink/65 hover:text-ink"><X size={14} /></button>}
    </label>
  );
}

type FacetRowData = { label: string; icon?: ReactNode; count?: number; active: boolean; onToggle: () => void; single?: boolean };

function FacetRow({ row }: { row: FacetRowData }) {
  return (
    <label className="flex items-center gap-2.5 py-[3px] cursor-pointer group">
      {row.icon ? (
        <span className={`grid place-items-center w-4 h-4 shrink-0 ${row.active ? "" : "opacity-70"}`}>{row.icon}</span>
      ) : (
        <span className={`grid place-items-center w-[15px] h-[15px] shrink-0 ${row.single ? "rounded-full" : "rounded-[3px]"} border ${row.active ? "border-biscay bg-biscay" : "border-ink/25 bg-paper"}`}>
          {/* A white square inside a filled square read as a hollow outline,
              not as a checked box. The check glyph is the checked state,
              matching forms/Checkbox; the radio keeps its dot. */}
          {row.active && (row.single
            ? <span className="w-1.5 h-1.5 rounded-full bg-white" />
            : <Check size={11} strokeWidth={3.5} className="text-white" />)}
        </span>
      )}
      <input type="checkbox" className="sr-only" checked={row.active} onChange={row.onToggle} />
      <span className={`flex-1 text-[12.5px] ${row.active ? "text-ink font-medium" : "text-ink/70 group-hover:text-ink"}`}>{row.label}</span>
      {row.count !== undefined && <span className="font-term text-[11px] text-ink/65">{row.count}</span>}
    </label>
  );
}

function FacetGroup({ name, rows }: { name: string; rows: FacetRowData[] }) {
  const [open, setOpen] = useState(rows.length <= 4);
  const shown = open ? rows : rows.slice(0, 4);
  return (
    <div>
      <h4 className="font-term text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink/65 mb-1.5">{name}</h4>
      <div>{shown.map((r) => <FacetRow key={r.label} row={r} />)}</div>
      {/* XA-08: the rail had its own "Show more"/"Show fewer" wording and its
          own chevrons. One control, one phrasing, everywhere. */}
      {rows.length > 4 && (
        <ShowRest className="mt-1" expanded={open} total={rows.length} onToggle={() => setOpen((v) => !v)} />
      )}
    </div>
  );
}

function FooterStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[18px] font-bold text-ink leading-none">{value}</span>
      <span className="font-term text-[11px] text-ink/65 mt-0.5">{label}</span>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  airtable: "Airtable", asana: "Asana", confluence: "Confluence",
  docs: "Google Docs", gdrive: "Google Drive", github: "GitHub",
  jira: "Jira", linear: "Linear", notion: "Notion", slack: "Slack",
  trello: "Trello", upload: "Uploads", zendesk: "Zendesk",
};

/** Sources can be qualified (`github:owner/repo`); the connector key still
    owns the mark and the facet. Unknown providers remain visible instead of
    disappearing from the only source filter on the page. */
const sourceKey = (source: string) => source.split(":", 1)[0].toLowerCase();
const sourceLabel = (source: string) => {
  const key = sourceKey(source);
  return SOURCE_LABELS[key] ?? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};
const TYPE_ROWS: { label: string; match: (r: KnowledgeResult) => boolean }[] = [
  { label: "Documents", match: (r) => r.kind === "page" },
  { label: "Conversations", match: (r) => r.kind === "thread" },
  { label: "Pull requests", match: (r) => r.kind === "pr" },
];
/* Sentence case, like every other filter label (CONVENTIONS.md §3/§5) — the
   raw tag keys ("needs-review") were the only lower-case strings in the rail. */
/* Freshness was a radio group that set a variable nothing read: picking "Past
   week" moved a dot and left the same rows on screen, and every row's count was
   the whole result list. It filters on the result's own date now, which is the
   only date this component has. */
const FRESH_ROWS: { label: string; days: number | null }[] = [
  { label: "Any time", days: null },
  { label: "Past week", days: 7 },
  { label: "Past month", days: 30 },
];

/** Within `days` of now. A result whose date does not parse is never excluded
    by a freshness filter — an unreadable date is not evidence of age. */
function fresherThan(date: string, days: number | null): boolean {
  if (days === null) return true;
  const t = Date.parse(date);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= days * 86_400_000;
}

const STATUS_ROWS: { key: string; label: string }[] = [
  { key: "canonical", label: "Canonical" },
  { key: "verified", label: "Verified" },
  { key: "needs-review", label: "Needs review" },
  { key: "stale", label: "Stale" },
];

export type KnowledgeFilters = {source:string[]; owner:string[]; status:string[]; content_type:string[]; tab:string; sort:string};
export type KnowledgeBrowserProps = {
  results: KnowledgeResult[];
  error?: string|null;
  filters?: KnowledgeFilters;
  onFiltersChange?: (filters:KnowledgeFilters) => void;
  facets?: {source:string[];owner:string[]};
  facetsTruncated?: boolean;
  onRefresh?: () => void;

  loading?: boolean;
  /** Stack the facet rail above the results instead of beside them. Pages own
      this (CONVENTIONS.md §10) — the component never breakpoints itself. */
  stacked?: boolean;
  /** Which result is being inspected. Pass it to CONTROL the selection: the
      browser then highlights what its owner says is selected, and a page can
      keep that in the URL so it survives a reload.

      Leave it undefined and the selection stays local, which is what makes the
      cards respond on the design canvas with nobody listening (§2). */
  selectedId?: string | null;
  /** A result was picked. Emitted for every pick, controlled or not, so a page
      can fill an inspector beside the feed. */
  onSelect?: (id: string) => void;
  /** The search text. Same contract as `selectedId`: pass it to CONTROL the
      box, and the query becomes the owner's — it can go in the URL, be shared,
      and above all be handed to a search backend.

      Controlled also means `results` are ALREADY the answer to this query, so
      the browser stops re-filtering them by substring: a hybrid-search hit that
      matched semantically has no literal substring to find, and filtering it
      out locally would delete the best result on the page.

      Undefined keeps the box local, which is what the design canvas renders. */
  query?: string;
  /** The search text changed. Debouncing and requerying belong to the owner. */
  onQueryChange?: (query: string) => void;
  /** The freshness window in days (7, 30) or null for any time. Same contract
      as `query`: pass it (with the handler) to CONTROL the facet, and the
      window becomes the owner's — it can live in the URL and, above all, be
      handed to the search backend, which is the only place a freshness filter
      over a paged corpus can be honest. Uncontrolled, the facet filters the
      loaded rows, which is all a canvas has. */
  freshness?: number | null;
  onFreshnessChange?: (days: number | null) => void;
  /** How many documents match this search corpus-wide. Pass it when `results`
      is one PAGE of a larger answer: the count line then describes the corpus
      instead of claiming the loaded page is all there is, and the facet rail
      says which rows its counts cover.

      Undefined means `results` is the whole answer and the browser pages it
      locally, as before. */
  total?: number;
  pagination?: {page:number;pageSize:number;offset:number;hasMore?:boolean;nextCursor?:string|null};
  onPageChange?: (page:number,cursor?:string|null) => void;
  /** Fetch the next page of results. Without it the feed shows what it has and
      offers no control it cannot honour. */
  onShowMore?: () => void;
  className?: string;
};

/* One grid for the browser and its skeleton: a fixed 220px facet rail beside
   the results, or a single column when the page asks for the stacked layout. */
const shell = (stacked: boolean, className: string) =>
  /* The rail track is minmax(0,220px), not a hard 220px: on a frame narrower
     than the rail plus a usable results column the rail gives way instead of
     pushing the feed past the page edge (§17). */
  `grid gap-4 items-start ${stacked ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[minmax(0,220px)_minmax(0,1fr)]"} ${className}`.replace(/\s+/g, " ").trim();

/** Content-shaped skeleton for the browser: filter rail + search + result cards. */
function KnowledgeBrowserSkeleton({ stacked = false, className = "" }: { stacked?: boolean; className?: string }) {
  return (
    <div className={shell(stacked, className)} aria-hidden="true">
      <Card className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine w="50%" h={9} />
            <SkeletonLine w="82%" /><SkeletonLine w="66%" /><SkeletonLine w="74%" />
          </div>
        ))}
      </Card>
      <div className="flex flex-col gap-3">
        <Skeleton height={36} rounded="rounded-md" />
        <SkeletonLine w={120} h={10} />
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} variant="flush" className="p-4">
              <div className="flex gap-3">
                <SkeletonCircle size={28} />
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonLine w="68%" h={13} />
                  <SkeletonText lines={2} />
                  <div className="flex gap-2"><SkeletonChip w={60} /><SkeletonChip w={48} /></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KnowledgeBrowser({
  results, error, loading = false, stacked = false, selectedId, onSelect,
  filters, onFiltersChange, facets, facetsTruncated, onRefresh, query, onQueryChange, freshness, onFreshnessChange, total, onShowMore, pagination, onPageChange, className = "",
}: KnowledgeBrowserProps) {
  /* Same fallback idiom as `selectedId`: the owner's query wins when there is
     one, and the local box still works when nobody is listening. */
  const [localQ, setLocalQ] = useState("");
  const served = query !== undefined;
  const q = served ? query : localQ;

  /* The box keeps its own draft so typing stays instant, and the query is
     COMMITTED on a pause. Without the debounce a controlled owner runs one
     search — and, if it keeps the query in the URL, one navigation — per
     keystroke. `seen` resyncs the draft when the query changes from outside
     (the back button, a cleared search). */
  const [draft, setDraft] = useState(q);
  const [seenQuery, setSeenQuery] = useState(q);
  if (seenQuery !== q) { setSeenQuery(q); setDraft(q); }

  // Held in a ref so a parent that passes a fresh arrow every render cannot
  // restart the timer and stop the commit from ever firing.
  const emit = useRef(onQueryChange);
  emit.current = onQueryChange;
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => { setLocalQ(draft); emit.current?.(draft); }, 220);
    return () => clearTimeout(t);
  }, [draft, q]);
  const [localSrcSel, setLocalSrcSel] = useState<Set<string>>(new Set());
  const srcSel = filters ? new Set(filters.source) : localSrcSel;
  const setSrcSel = (v:Set<string>) => filters ? onFiltersChange?.({...filters,source:[...v]}) : setLocalSrcSel(v);
  const [localTypeSel, setLocalTypeSel] = useState<Set<string>>(new Set());
  const typeSel = filters ? new Set(filters.content_type) : localTypeSel;
  const setTypeSel = (v:Set<string>) => filters ? onFiltersChange?.({...filters,content_type:[...v]}) : setLocalTypeSel(v);
  const [localOwnerSel, setLocalOwnerSel] = useState<Set<string>>(new Set());
  const ownerSel = filters ? new Set(filters.owner) : localOwnerSel;
  const setOwnerSel = (v:Set<string>) => filters ? onFiltersChange?.({...filters,owner:[...v]}) : setLocalOwnerSel(v);
  const [localStatusSel, setLocalStatusSel] = useState<Set<string>>(new Set());
  const statusSel = filters ? new Set(filters.status) : localStatusSel;
  const setStatusSel = (v:Set<string>) => filters ? onFiltersChange?.({...filters,status:[...v]}) : setLocalStatusSel(v);
  const [localFresh, setLocalFresh] = useState<number | null>(null);
  const freshServed = onFreshnessChange !== undefined;
  const freshDays = freshServed ? (freshness ?? null) : localFresh;
  const pickFresh = (days: number | null) =>
    freshServed ? onFreshnessChange(days) : setLocalFresh(days);
  const [localTab, setLocalTab] = useState("all");
  const [localSort, setLocalSort] = useState("best");
  const tab = filters?.tab ?? localTab;
  const sort = filters?.sort ?? localSort;
  const setTab = (tab:string) => filters ? onFiltersChange?.({...filters,tab}) : setLocalTab(tab);
  const setSort = (sort:string) => filters ? onFiltersChange?.({...filters,sort}) : setLocalSort(sort);
  /* The selection used to be this state alone, seeded with a fixture's id —
     so it named a row that exists in no real corpus, and picking a card moved
     a highlight that nothing outside this component could see. It is now the
     FALLBACK: whoever owns the selection passes `selectedId`, and without an
     owner the cards still respond exactly as before (§2). */
  const [localSel, setLocalSel] = useState<string | null>(null);
  const selId = selectedId !== undefined ? selectedId : localSel;
  const select = (id: string) => { setLocalSel(id); onSelect?.(id); };
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  const count = (pred: (r: KnowledgeResult) => boolean) => results.filter(pred).length;

  const baseFiltered = useMemo(() => results.filter((r) => {
    if (filters) return true;
    // Only when the box is local: a controlled query has already been answered
    // by whoever owns it (see `query`), and re-filtering would drop its hits.
    if (!served && q && !`${r.title} ${r.snippet} ${r.author}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (srcSel.size && !srcSel.has(sourceKey(r.source))) return false;
    if (typeSel.size) {
      const t = r.kind === "page" ? "Documents" : r.kind === "thread" ? "Conversations" : "Pull requests";
      if (!typeSel.has(t)) return false;
    }
    if (ownerSel.size && !ownerSel.has(r.author || "Unknown owner")) return false;
    if (statusSel.size && !(r.status && statusSel.has(r.status))) return false;
    // A controlled window was already answered by the backend, corpus-wide;
    // re-filtering the page here would only re-shrink the answer.
    if (!freshServed && !fresherThan(r.date, freshDays)) return false;
    return true;
  }), [results, filters, served, q, srcSel, typeSel, ownerSel, statusSel, freshServed, freshDays]);

  const tabMatch = (r: KnowledgeResult) => tab === "all"
    || (tab === "docs" && r.kind === "page")
    || (tab === "conv" && r.kind === "thread")
    || (tab === "prs" && r.kind === "pr");

  const sorted = useMemo(() => {
    if (filters) return baseFiltered;
    const rows = baseFiltered.filter(tabMatch);
    if (sort === "newest") return [...rows].sort((a, b) => b.date.localeCompare(a.date));
    if (sort === "title") return [...rows].sort((a, b) => a.title.localeCompare(b.title));
    return rows;
  }, [baseFiltered, tab, sort, filters]);

  const owners = facets?.owner ?? [...new Set([...results.map((result) => result.author || "Unknown owner"),...ownerSel])]
    .sort((a, b) => a.localeCompare(b));
  const sources = facets?.source ?? [...new Set([...results.map((result) => sourceKey(result.source)).filter(Boolean),...srcSel])]
    .sort((a, b) => sourceLabel(a).localeCompare(sourceLabel(b)));
  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? "Best match";
  /* Who is paging. With a `total` the owner fetched this page and holds the
     rest, so everything handed in is shown and "show more" asks for the next
     page; without one the whole answer is here and the feed pages it itself. */
  const paged = total !== undefined || pagination !== undefined;
  const visible = paged ? sorted : sorted.slice(0, limit);
  const loaded = results.length;
  /* Facet and tab counts are computed over `results`. When that is one page of
     a larger corpus they describe the loaded rows and nothing more — a source
     with thousands of documents can read 0 here because none of its documents
     came back on THIS page. The rail says so rather than passing the number off
     as a corpus count; making it a real count needs faceted counts from the
     search backend, which this component has no prop for. */
  const partial = !filters && total !== undefined && total > loaded;

  if (loading) return <KnowledgeBrowserSkeleton stacked={stacked} className={className} />;

  return (
    <div className={shell(stacked, className)}>
      {/* Filter rail */}
      <Card className="flex flex-col gap-4">
        {facetsTruncated && <p className="text-xs text-ink/65">Filter choices are limited to 1,000 values. Narrow the search to see more.</p>}
        {partial && (
          <p className="font-term text-[11px] leading-snug text-ink/65">
            Filters and counts apply to the {loaded.toLocaleString()} results on this page, out of {total!.toLocaleString()}.
          </p>
        )}
        <FacetGroup name="Source" rows={sources.map((key) => ({ label: sourceLabel(key), icon: <SourceMark provider={key} size={15} />, count: filters ? undefined : count((r) => sourceKey(r.source) === key), active: srcSel.has(key), onToggle: () => toggle(srcSel, setSrcSel, key) }))} />
        <FacetGroup name="Content type" rows={TYPE_ROWS.map((t) => ({ label: t.label, count: filters ? undefined : count(t.match), active: typeSel.has(t.label), onToggle: () => toggle(typeSel, setTypeSel, t.label) }))} />
        <FacetGroup name="Owner" rows={owners.map((owner) => ({ label: owner, count: filters ? undefined : count((r) => (r.author || "Unknown owner") === owner), active: ownerSel.has(owner), onToggle: () => toggle(ownerSel, setOwnerSel, owner) }))} />
        <FacetGroup name="Freshness" rows={FRESH_ROWS.map((f) => ({
          label: f.label,
          single: true,
          /* A controlled window is answered corpus-wide, so a count over the
             loaded page would be a different (and smaller) claim — no number
             beats a wrong number. */
          count: freshServed ? undefined : count((r) => fresherThan(r.date, f.days)),
          active: freshDays === f.days,
          onToggle: () => pickFresh(f.days),
        }))} />
        <FacetGroup name="Status" rows={STATUS_ROWS.map((s) => ({ label: s.label, count: filters ? undefined : count((r) => r.status === s.key), active: statusSel.has(s.key), onToggle: () => toggle(statusSel, setStatusSel, s.key) }))} />
      </Card>

      {/* Results column */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2"><div className="flex-1"><SearchBox value={draft} onChange={setDraft} /></div>{onRefresh && <Button compact onClick={onRefresh}>Refresh</Button>}</div>

        {/* A block, not a flex row: flex turned the sentence's three inline
            chunks (text, <b>, text) into three columns and broke the sentence
            around the bold term. */}


        {/* No flex-wrap: the sort control shares this line with the tabs and
            never drops to its own row (§13). The tab row scrolls inside
            itself; the sort button keeps its content width. */}
        <div className="flex items-center gap-3">
          {/* min-w-0 + its own scroll box: without it the 5-tab row sets the
              min-content width of the whole results column and pushes the feed
              past the card edge on a narrow viewport. */}
          <Scrollable className="flex-1">
          <Tabs
            ariaLabel="KnowledgeResult type"
            variant="underline"
            value={tab}
            onChange={setTab}
            options={[
              { id: "all", label: "All" },
              { id: "docs", label: "Documents", count: filters ? undefined : count((r) => r.kind === "page") },
              { id: "conv", label: "Conversations", count: filters ? undefined : count((r) => r.kind === "thread") },
              { id: "prs", label: "PRs", count: filters ? undefined : count((r) => r.kind === "pr") },
            ]}
          />
          </Scrollable>
          <div className="ml-auto shrink-0">
            {/* The label collapses to just "Sort" so it can never cover the
                tabs on its line; the dropdown carries the options and shows
                the active one (§13). Standard ArrowUpDown sort glyph (§3). */}
            <Menu trigger={<Button compact aria-label={`Sort results, currently ${sortLabel}`}><ArrowUpDown size={13} /> Sort</Button>}>
              <MenuLabel>Sort by</MenuLabel>
              <MenuRadioGroup value={sort} onValueChange={setSort}>
                {SORTS.filter(s=>!filters || s.id!=="best").map((s) => <MenuRadioItem key={s.id} value={s.id}>{s.label}</MenuRadioItem>)}
              </MenuRadioGroup>
            </Menu>
          </div>
        </div>

        {/* Corpus stats strip: above the results it describes, below the
            search/tabs/sort bar, never at the bottom of the list (§13). */}
        <Card variant="plain">
          {/* gap-y keeps the stats off the live-ingestion line when the strip
              wraps; without it the wrapped row sat on top of the labels. */}
          {/* Only what this component was given. The strip used to sit three
              hardcoded figures beside the real one — "1,284 verified facts",
              "87% fresh", "6 sources" — which read as workspace measurements
              and belonged to no workspace. A stat with no source is not shown. */}
          <div className="flex items-center gap-x-8 gap-y-3 flex-wrap">
            <FooterStat
              value={(total ?? results.length).toLocaleString()}
              label={pagination ? "records on this page" : paged ? "documents match" : "documents"}
            />
          </div>
        </Card>

        {/* KnowledgeResult count above the list (§13). A real corpus returns hundreds of
            documents, so the feed renders one page at a time and says how many
            of how many it is showing rather than laying out 400 cards. */}
        {/* XA-09: five hand-rolled count sentences with their own pluralisation
            and thousands separators. The shared strip owns all of that; the two
            numbers that must never be conflated (rows the filters left, rows the
            search matched corpus-wide) stay apart as the count and its note. */}
        {pagination ? <nav aria-label="Knowledge results pages" className="flex items-center gap-3">
          <Button compact disabled={pagination.page<=1} onClick={()=>onPageChange?.(pagination.page-1)}>Previous</Button>
          <span>Page {pagination.page} · {loaded} records</span>
          <Button compact disabled={!pagination.hasMore} onClick={()=>onPageChange?.(pagination.page+1,pagination.nextCursor)}>Next</Button>
        </nav> : <ResultCount
          from={sorted.length === 0 ? 0 : 1}
          to={visible.length ? visible.length : 0}
          total={paged ? total! : sorted.length}
          noun="results"
          note={paged && sorted.length < loaded ? `${loaded.toLocaleString("en-US")} loaded so far` : undefined}
          actions={paged
            ? loaded < total! && onShowMore && (
              <Button variant="link" onClick={onShowMore}>
                Show {Math.min(PAGE, total! - loaded)} more
              </Button>
            )
            : (
              <>
                {visible.length < sorted.length && (
                  <Button variant="link" onClick={() => setLimit((n) => n + PAGE)}>
                    Show {Math.min(PAGE, sorted.length - visible.length)} more
                  </Button>
                )}
                {limit > PAGE && (
                  <Button variant="link" onClick={() => setLimit(PAGE)}>Show fewer</Button>
                )}
              </>
            )}
        />}

        {error && <ReadError>{error}</ReadError>}
        {!error && sorted.length === 0 ? (
          <Card><EmptyState icon={<Search size={20} />} title="No results">
            {/* Name the actual cause. Blaming "these filters" when none are
                active sent readers hunting for a filter they never set. */}
            {(query ?? "").trim()
              ? <>Nothing in the knowledge base matches &ldquo;{(query ?? "").trim()}&rdquo;.</>
              : "No results match these filters."}
          </EmptyState></Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((r) => {
              const selected = selId === r.id;
              const isSaved = saved.has(r.id);
              const slack = r.kind === "thread";
              return (
                <Card
                  key={r.id}
                  variant="flush"
                  onClick={() => select(r.id)}
                  className={`p-4 cursor-pointer transition-colors ${selected ? "ring-1 ring-biscay-2/50 border-biscay-2/40" : "hover:border-ink/25"}`}
                >
                  {/* Content order per CONVENTIONS.md §1: title, summary, then
                      source + status chips on the left with date + author
                      right-aligned on the same line. The source used to be a
                      separate left gutter and the status chip rode next to the
                      bookmark, which collided on narrow cards. */}
                  <CardBody className="gap-3">
                    <div className="flex items-start gap-3">
                      <CardTitleBlock
                        className="flex-1"
                        /* The title OPENS the document. It was plain text with
                           a hover colour, which promised a link and delivered
                           nothing; it is now a real anchor, so it can be
                           middle-clicked, copied and opened in a new tab. The
                           rest of the card only selects, which is what fills
                           the inspector beside the feed. */
                        title={(
                          <Truncate title={r.title} className="hover:text-biscay-2">
                            <Link
                              href={docHref(r.id)}
                              /* The card behind the title selects, and that
                                 selection may be a navigation of its own: let
                                 the click bubble and it lands on the feed's
                                 own URL instead of the document's. */
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.title}
                            </Link>
                          </Truncate>
                        )}
                        summary={<Truncate lines={2}>{r.snippet}</Truncate>}
                      />
                      <button
                        type="button"
                        aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
                        onClick={(e) => { e.stopPropagation(); setSaved((prev) => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; }); }}
                        className="shrink-0 mt-0.5 text-ink/65 hover:text-ink"
                      >
                        <Bookmark size={15} className={isSaved ? "fill-espelette text-espelette" : ""} />
                      </button>
                    </div>
                    <CardMeta
                      /* The date/author group is whitespace-nowrap and carries no
                         min-width of its own, so a long author name pinned the
                         row at full width and the card spilled past its border.
                         Letting the nowrap boxes shrink is what makes the
                         truncation fire (CONVENTIONS.md §12). */
                      className="min-w-0 [&_.whitespace-nowrap]:min-w-0"
                      source={
                        <Chip
                          className="min-w-0"
                          label={sourceLabel(r.source)}
                          tone="neutral"
                          icon={<SourceMark provider={r.source} size={13} />}
                        />
                      }
                      status={
                        <>
                          {r.status && <Pill kind={r.status} />}
                          {slack && <Chip label="Decision excerpt" tone="info" />}
                          {/* Tags render in the same bottom-left block as the
                              status, deduped against it; overflow stacks and
                              the date/author line rides the bottom row (§14). */}
                          {r.tags.filter((t) => t !== r.status).map((t) => <Pill key={t} kind={t} />)}
                        </>
                      }
                      date={fmtDate(r.date)}
                      author={
                        /* min-w-0 + truncate: the meta line is whitespace-nowrap,
                           so an unbreakable author name or a 7-digit message
                           count set the row's min-content width and dragged the
                           card past its own border. */
                        slack ? (
                          <span className="min-w-0 truncate">{r.messageCount} messages · {r.participantCount} participants</span>
                        ) : (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Avatar initials={r.author.split(" ").map((w) => w[0]).slice(0, 2).join("")} />
                            <span className="min-w-0 truncate text-[12px] text-ink/70">{r.author}</span>
                          </span>
                        )
                      }
                    />
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

export default KnowledgeBrowser;
