import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import * as RD from "@radix-ui/react-dialog";
import { Search, Clock, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { Kbd } from "./Kbd";
import { Scrollable } from "../data-display/Scrollable";

/* GlobalSearch — the scoped, grouped search overlay, and the library's only
   ⌘K surface. A `CommandPalette` twin used to sit beside it with the same
   Radix Dialog shell and the same hand-rolled listbox, claiming the same
   shortcut and reachable from nothing; this is the survivor. It searches
   ACROSS scopes (Docs, People, Sources, Actions…) and renders grouped
   result sections with per-result icon / title / subtitle / meta, a scope
   filter, and a recent-searches empty state. Grounded in the console's
   CommandK (App.tsx) which debounces a hybrid `search` query and routes
   Enter into Knowledge. Mount once; toggle `open` from a global ⌘K
   listener and the header SearchField. */

/** A search scope — the filterable buckets results are grouped into. */
export type SearchScope = { id: string; label: string; icon?: ReactNode };

/** A single result row. `scope` references a SearchScope id. */
export type SearchResult = {
  id: string;
  scope: string;
  title: string;
  subtitle?: string;
  /** Right-aligned meta — relative time, count, source label, etc. */
  meta?: string;
  icon?: ReactNode;
  /** Where selecting this result goes. An in-app href; the host follows it.
      Optional because a result can also be a pure action handled in
      `onSelect`. */
  href?: string;
};

/** Results for one scope, in render order. */
export type SearchResultGroup = { scope: SearchScope; results: SearchResult[] };

export type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Scopes offered in the filter row. Defaults to the scopes present in `results`. */
  scopes?: SearchScope[];
  /**
   * Static grouped results, filtered client-side by query text + active scope.
   * Ignored when `onQuery` is provided.
   */
  results?: SearchResultGroup[];
  /** Async/custom search — return grouped results for the query + active scope. */
  onQuery?: (query: string, scope: string | null) => SearchResultGroup[];
  onSelect: (result: SearchResult) => void;
  /** Submit the query itself when Enter arrives before an async result does.
      Without this, a fast typist presses Enter during the debounce and the
      search surface silently does nothing. */
  onSubmitQuery?: (query: string) => void;
  /** Shown (as clickable chips) when the query is empty. */
  recentSearches?: string[];
  onRecentSelect?: (query: string) => void;
  placeholder?: string;
  value?: string;
  onValueChange?: (query: string) => void;
  /** A search is in flight. Only meaningful when the host fetches results
      asynchronously; without it a slow backend is indistinguishable from
      "no results", which reads as a broken search. */
  loading?: boolean;
  error?: string | null;
  /** Right-hand note in the footer, e.g. what the host's search actually does.
      Only the host knows that, so nothing is shown when this is omitted. */
  footerNote?: ReactNode;
};

const flatOptionId = (listboxId: string, index: number) => `${listboxId}-option-${index}`;

export function GlobalSearch({
  open, onOpenChange, scopes, results = [], onQuery, onSelect, onSubmitQuery,
  recentSearches = [], onRecentSelect,
  placeholder = "Search knowledge, people, sources…",
  value, onValueChange, loading = false, error, footerNote,
}: GlobalSearchProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const query = value ?? internalQuery;
  const setQuery = (q: string) => { if (value === undefined) setInternalQuery(q); onValueChange?.(q); };

  const [scope, setScope] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const uid = useId().replace(/:/g, "");
  const listboxId = `global-search-results-${uid}`;
  const statusId = `global-search-status-${uid}`;
  const activeOptionId = flatOptionId(listboxId, active);

  /* NAV-02: this reset must fire on the OPEN edge only. `value` used to be in
     the deps and PageFrame drives GlobalSearch in its controlled form, so every
     keystroke changed `value`, re-ran this, and cleared the scope the user had
     just picked. Picking "Docs" and typing immediately unpicked "Docs". */
  const controlled = value !== undefined;
  useEffect(() => {
    if (!open) return;
    if (!controlled) setInternalQuery("");
    setScope(null);
    setActive(0);
  }, [open, controlled]);

  // Scope chips: explicit prop, else derived from whichever scopes have results.
  const scopeList = useMemo<SearchScope[]>(() => {
    if (scopes) return scopes;
    return results.map((g) => g.scope);
  }, [scopes, results]);

  // Grouped results after query + scope filtering.
  const groups = useMemo<SearchResultGroup[]>(() => {
    const raw = onQuery ? onQuery(query, scope) : filterGroups(results, query);
    const byScope = scope ? raw.filter((g) => g.scope.id === scope) : raw;
    return byScope.filter((g) => g.results.length > 0);
  }, [onQuery, results, query, scope]);

  // Flatten for keyboard navigation.
  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups]);
  useEffect(() => { setActive(0); }, [query, scope]);
  useEffect(() => { if (active > flat.length - 1) setActive(Math.max(0, flat.length - 1)); }, [flat.length, active]);

  const select = (r: SearchResult) => { onOpenChange(false); onSelect(r); };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const r = flat[active];
      if (r) select(r);
      else if (query.trim() && onSubmitQuery) {
        onOpenChange(false);
        onSubmitQuery(query.trim());
      }
    }
  };

  const hasQuery = query.trim().length > 0;
  let flatIndex = -1;

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-[80] bg-ink/30" />
        <RD.Content
          className="fixed z-[80] left-1/2 top-[14%] -translate-x-1/2 w-[calc(100vw-2rem)] max-w-[640px] bg-paper rounded-md border border-ink/15 outline-none overflow-hidden flex flex-col max-h-[72vh]"
          onKeyDown={onKeyDown}
        >
          <RD.Title className="sr-only">Global search</RD.Title>
          <RD.Description className="sr-only">Search across docs, people, sources, and actions.</RD.Description>

          {/* Input */}
          <div className="flex items-center gap-2.5 px-4 h-12 border-b border-ink/10 shrink-0">
            <Search size={16} className="text-ink/65 shrink-0" />
            <input
              autoFocus
              role="combobox"
              aria-label="Search"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-describedby={statusId}
              aria-activedescendant={hasQuery && flat[active] ? activeOptionId : undefined}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink/65 outline-none"
            />
            <Kbd keys="Esc" />
          </div>

          {/* Scope filter */}
          {scopeList.length > 0 && (
            <Scrollable className="shrink-0 border-b border-ink/10" scrollerClassName="flex items-center gap-1.5 px-3 py-2">
              <ScopeChip label="All" active={scope === null} onClick={() => setScope(null)} />
              {scopeList.map((s) => (
                <ScopeChip key={s.id} label={s.label} icon={s.icon} active={scope === s.id} onClick={() => setScope(s.id)} />
              ))}
            </Scrollable>
          )}

          {/* Body */}
          <Scrollable axis="y" className="flex-1 min-h-0">
            <div id={listboxId} role="listbox" aria-label="Search results" aria-busy={loading || undefined} className="p-1.5">
            <span id={statusId} role="status" aria-live="polite" className="sr-only">
              {hasQuery ? loading ? "Searching" : `${flat.length} result${flat.length === 1 ? "" : "s"}` : ""}
            </span>
            {!hasQuery && recentSearches.length > 0 && (
              <div>
                <div className="px-2.5 pt-2 pb-1 font-term text-[10px] font-medium uppercase tracking-[0.08em] text-ink/65">Recent</div>
                {recentSearches.map((r) => (
                  <button
                    key={r}
                    onClick={() => { onRecentSelect ? onRecentSelect(r) : setQuery(r); }}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-[4px] text-[13px] text-ink/80 hover:bg-flysch text-left"
                  >
                    <Clock size={14} className="shrink-0 text-ink/65" />
                    <span className="flex-1 min-w-0 truncate">{r}</span>
                  </button>
                ))}
              </div>
            )}

            {!hasQuery && recentSearches.length === 0 && (
              <div className="px-3 py-10 text-center text-[13px] text-ink/65">Type to search across {scopeList.length > 0 ? scopeList.map((s) => s.label).join(", ") : "everything"}.</div>
            )}

            {hasQuery && flat.length === 0 && loading && (
              <div className="px-3 py-10 text-center text-[13px] text-ink/65">Searching…</div>
            )}

            {hasQuery && error && <div role="alert" className="px-3 py-6 text-sm whitespace-pre-line">{error.replace(/^GRAPH_REQUIREMENTS:/, "")}</div>}

            {hasQuery && flat.length === 0 && !loading && !error && (
              <div className="px-3 py-10 text-center text-[13px] text-ink/65">
                No results for <span className="text-ink/70">“{query.trim()}”</span>
              </div>
            )}

            {hasQuery && !error && groups.map((g) => (
              <div key={g.scope.id}>
                <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1 font-term text-[10px] font-medium uppercase tracking-[0.08em] text-ink/65">
                  {g.scope.icon && <span className="text-ink/65">{g.scope.icon}</span>}
                  {g.scope.label}
                  <span className="text-ink/30">{g.results.length}</span>
                </div>
                {g.results.map((r) => {
                  flatIndex += 1;
                  const i = flatIndex;
                  return (
                    <div
                      key={r.id}
                      id={flatOptionId(listboxId, i)}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => select(r)}
                      className={[
                        "flex items-center gap-3 px-2.5 py-2 rounded-[4px] cursor-pointer",
                        i === active ? "bg-flysch" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {r.icon && <span className="shrink-0 text-ink/65 flex items-center">{r.icon}</span>}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-ink/90 truncate">{r.title}</span>
                        {r.subtitle && <span className="block text-[11.5px] text-ink/65 truncate">{r.subtitle}</span>}
                      </span>
                      {r.meta && <span className="shrink-0 font-term text-[10.5px] text-ink/65">{r.meta}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            </div>
          </Scrollable>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 h-9 border-t border-ink/10 font-term text-[10.5px] text-ink/65 shrink-0">
            <span className="flex items-center gap-1.5"><ArrowUp size={11} /><ArrowDown size={11} />to navigate</span>
            <span className="flex items-center gap-1.5"><CornerDownLeft size={11} />to open</span>
            {/* NAV-01: this used to read "Hybrid search · BM25 + embeddings"
                unconditionally. Results come from the host's `onQuery` (or from
                a static `results` array), so this component has no way to know
                what retrieval ran, and naming a ranking algorithm it cannot see
                is invented data. The host says it, or nothing is said. */}
            {footerNote && <span className="ml-auto">{footerNote}</span>}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

function ScopeChip({ label, icon, active, onClick }: { label: string; icon?: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-[12px] border transition-colors",
        active
          ? "bg-biscay text-paper border-biscay"
          : "bg-transparent text-ink/65 border-ink/15 hover:border-ink/30 hover:text-ink/85",
      ].join(" ")}
    >
      {icon && <span className={active ? "text-paper/80" : "text-ink/65"}>{icon}</span>}
      {label}
    </button>
  );
}

/** Client-side text filter over grouped results (title + subtitle substring). */
function filterGroups(groups: SearchResultGroup[], query: string): SearchResultGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups.map((g) => ({
    scope: g.scope,
    results: g.results.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.subtitle?.toLowerCase().includes(q) ?? false),
    ),
  }));
}
