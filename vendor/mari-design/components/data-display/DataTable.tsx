import { useMemo, useState, type ReactNode } from "react";
import { Inbox, Search } from "lucide-react";
import { card } from "../tokens/card";
import { cellText } from "./Table";
import { PagerBar, ResultCount } from "./Pagination";
import { Scrollable } from "./Scrollable";
import { Skeleton, SkeletonRows } from "./Skeleton";
import { SortHeader, tdPad, type Align, type SortState } from "./sortable";

export type Column<T> = {
  key: string;
  header: string;
  /** Columns sort by default; set false for action/decoration columns. */
  sortable?: boolean;
  /** Sort value. Falls back to the text of the rendered cell. */
  sort?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  align?: Align;
  cell?: string;
};

export const alignClass = (a?: Align) => (a === "center" ? "text-center" : a === "right" ? "text-right" : "");

/** Body cell class shared by every table type. */
export const cellClass = (c: { align?: Align; cell?: string }) =>
  [tdPad, alignClass(c.align), c.cell ?? ""].filter(Boolean).join(" ");

/** Sort accessors for a column set: explicit `sort`, else the rendered text. */
export function columnAccessors<T>(columns: Column<T>[]): Record<string, (row: T) => string | number> {
  const map: Record<string, (row: T) => string | number> = {};
  for (const c of columns) map[c.key] = c.sort ?? ((row: T) => cellText(c.render(row)).trim().toLowerCase());
  return map;
}

/** Sort a row set by the current sort state. */
export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState): T[] {
  if (!sort.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col || col.sortable === false) return rows;
  const get = columnAccessors(columns)[sort.key];
  return [...rows].sort((a, b) => {
    const av = get(a), bv = get(b);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

/** "Region" → "All regions", "Sources" → "All sources" (CONVENTIONS §3). */
export function allOptionLabel(label: string) {
  const l = label.trim().toLowerCase();
  // A facet label that already reads "All regions" must not become
  // "All all regions"; only add the prefix (and plural) when it's missing.
  if (l.startsWith("all ")) return `All ${l.slice(4)}`;
  return `All ${l.endsWith("s") ? l : `${l}s`}`;
}

/* ── DataTable: search, sort, filter, paginate, empty state ────────────── */
export function DataTable<T>({
  title, count, rows, columns, rowKey, search, searchPlaceholder = "Search…",
  facet, actions, onRowClick, pageSize = 8, minW = 720, empty = "No results", loading = false,
  noun = "rows",
}: {
  title?: string;
  count?: number;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  facet?: {
    label: string;
    get: (row: T) => string;
    /** Override the "All …" option copy. */
    allLabel?: string;
    /** Display form of an option value (e.g. regionLabel from tokens/regions). */
    optionLabel?: (value: string) => string;
  };
  /** Table-level action button. Rendered top right (CONVENTIONS §2). */
  actions?: ReactNode;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  minW?: number;
  empty?: string;
  loading?: boolean;
  /** Plural noun for the result-count strip: "members", "keys", "events". */
  noun?: string;
}) {
  const [query, setQuery] = useState("");
  const [facetVal, setFacetVal] = useState("");
  const [sort, setSort] = useState<SortState>({ key: null, dir: "asc" });
  const [page, setPage] = useState(0);

  const facetOptions = useMemo(() => (facet ? Array.from(new Set(rows.map(facet.get))) : []), [rows, facet]);

  const filtered = useMemo(() => {
    let r = rows;
    if (query && search) { const q = query.toLowerCase(); r = r.filter((x) => search(x).toLowerCase().includes(q)); }
    if (facet && facetVal) r = r.filter((x) => facet.get(x) === facetVal);
    return sortRows(r, columns, sort);
  }, [rows, query, facet, facetVal, sort, columns, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  const onSort = (key: string) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(0);
  };

  /* Loading used to replace the whole table with a grey silhouette: no title
     bar, no search box, no facet, and column headers drawn as bars. All of
     that is chrome the caller spelled out in this render — it is known before
     the response and it renders. What is unknown is the ROWS, the count, and
     which values the facet can offer. Same box, same header, same padding, so
     nothing moves when the rows land. */
  if (loading) {
    return (
      <div className={`${card} mt-5 overflow-hidden`} aria-busy="true">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-ink/10">
          {title && (
            <div className="flex items-center gap-2 mr-1">
              <h4 className="text-[15px] font-semibold text-ink">{title}</h4>
              {/* No count: the number of rows is precisely what is in flight. */}
              <Skeleton width={26} height={19} rounded="rounded-[3px]" />
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {search && (
              <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper">
                <Search size={13} className="text-ink/65" />
                <input disabled placeholder={searchPlaceholder} className="w-[130px] sm:w-[170px] bg-transparent text-[12.5px] text-ink placeholder:text-ink/65 outline-none disabled:opacity-100" />
              </div>
            )}
            {/* The "All sources" option is the facet's own label, not one of
                its values: the values come from the rows, so the list holds
                only the one option it can honestly offer. */}
            {facet && (
              <select disabled aria-label={facet.allLabel ?? allOptionLabel(facet.label)} className="h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper text-[12.5px] text-ink/75 outline-none disabled:opacity-100">
                <option>{facet.allLabel ?? allOptionLabel(facet.label)}</option>
              </select>
            )}
            {actions}
          </div>
        </div>
        <Scrollable>
          <table className="w-full text-left border-collapse" style={{ minWidth: minW }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <SortHeader key={c.key} label={c.header} align={c.align ?? "left"} sortable={false} />
                ))}
              </tr>
            </thead>
            <tbody><SkeletonRows rows={pageSize} cols={columns.length} /></tbody>
          </table>
        </Scrollable>
      </div>
    );
  }

  return (
    <div className={`${card} mt-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-ink/10">
        {title && (
          <div className="flex items-center gap-2 mr-1">
            <h4 className="text-[15px] font-semibold text-ink">{title}</h4>
            {count != null && <span className="font-term text-[11px] font-medium text-ink/60 bg-flysch border border-ink/10 rounded-[3px] px-1.5 py-0.5">{count}</span>}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {search && (
            <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
              <Search size={13} className="text-ink/65" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder={searchPlaceholder} className="w-[130px] sm:w-[170px] bg-transparent text-[12.5px] text-ink placeholder:text-ink/65 outline-none" />
            </div>
          )}
          {facet && (
            <select aria-label={facet.allLabel ?? allOptionLabel(facet.label)} value={facetVal} onChange={(e) => { setFacetVal(e.target.value); setPage(0); }} className={`h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper text-[12.5px] text-ink/75 outline-none focus:border-biscay-2 focus:ring-1 focus:ring-biscay-2/40`}>
              <option value="">{facet.allLabel ?? allOptionLabel(facet.label)}</option>
              {facetOptions.map((o) => <option key={o} value={o}>{facet.optionLabel ? facet.optionLabel(o) : o}</option>)}
            </select>
          )}
          {actions}
        </div>
      </div>

      {pageRows.length === 0 ? (
        <div className="grid place-items-center py-16 text-center">
          <Inbox size={24} className="text-ink/25" />
          <p className="mt-2 text-[13px] text-ink/70">{query || facetVal ? "No matches. Try clearing filters." : empty}</p>
        </div>
      ) : (
        <>
        {/* Result count above the rows, never under them (CONVENTIONS §13). */}
        <ResultCount
          from={cur * pageSize + 1}
          to={Math.min((cur + 1) * pageSize, filtered.length)}
          total={filtered.length}
          noun={noun}
          note={query || facetVal ? `filtered from ${rows.length.toLocaleString("en-US")}` : undefined}
        />
        <Scrollable>
          <table className="w-full text-left border-collapse" style={{ minWidth: minW }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <SortHeader
                    key={c.key}
                    label={c.header}
                    sortKey={c.key}
                    sort={sort}
                    onSort={onSort}
                    align={c.align ?? "left"}
                    sortable={c.sortable !== false && c.header.trim() !== ""}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={`border-b border-ink/10 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-flysch/50 group" : ""}`}>
                  {columns.map((c) => <td key={c.key} className={cellClass(c)}>{c.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Scrollable>
        </>
      )}

      {filtered.length > pageSize && (
        <PagerBar page={cur} pageCount={pageCount} onChange={setPage} />
      )}
    </div>
  );
}
