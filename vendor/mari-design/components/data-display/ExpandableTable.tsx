import { useMemo, useState, Fragment, type ReactNode } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { card } from "../tokens/card";
import { focusRing } from "../tokens/focusRing";
import { cellClass, sortRows, type Column } from "./DataTable";
import { PagerBar, ResultCount, usePaged } from "./Pagination";
import { Scrollable } from "./Scrollable";
import { SkeletonRows } from "./Skeleton";
import { SortHeader, tdPad, thPad, type SortState } from "./sortable";

/* ── ExpandableTable: rows that expand to an inline detail region ────────
   A chevron in the leading cell toggles a full-width detail row rendered by
   `renderDetail(row)`. Multiple rows may be open unless `single` is set. */
export function ExpandableTable<T>({
  rows, columns, rowKey, renderDetail, single = false, defaultExpanded = [],
  minW = 720, empty = "No results", expandLabel = "Toggle details", loading = false,
  pageSize = 12, noun = "rows",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  renderDetail: (row: T) => ReactNode;
  /** Only one row open at a time. */
  single?: boolean;
  defaultExpanded?: string[];
  minW?: number;
  empty?: string;
  expandLabel?: string;
  loading?: boolean;
  /** Rows per page: an expandable table of 400 rows must not grow its card. */
  pageSize?: number;
  /** Plural noun for the result-count strip. */
  noun?: string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set(defaultExpanded));

  const toggle = (key: string) => {
    setOpen((prev) => {
      if (single) return prev.has(key) ? new Set() : new Set([key]);
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const [sort, setSort] = useState<SortState>({ key: null, dir: "asc" });
  const onSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const visible = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const pager = usePaged(visible, pageSize);

  const colSpan = columns.length + 1;

  /* Real column headers over skeleton cells, in the real table box: the head
     is the caller's own literal and is known at first paint, and the expand
     gutter keeps its width so the grid does not shift on arrival. */
  if (loading) {
    return (
      <div className={`${card} mt-5 overflow-hidden`} aria-busy="true">
        <Scrollable>
          <table className="w-full text-left border-collapse" style={{ minWidth: minW }}>
            <thead>
              <tr>
                <th className={`${thPad} border-y border-ink/10 w-9`} aria-hidden />
                {columns.map((c) => (
                  <SortHeader key={c.key} label={c.header} align={c.align ?? "left"} sortable={false} />
                ))}
              </tr>
            </thead>
            <tbody><SkeletonRows rows={pageSize} cols={columns.length} lead /></tbody>
          </table>
        </Scrollable>
      </div>
    );
  }

  return (
    <div className={`${card} mt-5 overflow-hidden`}>
      {pager.paged && <ResultCount from={pager.from} to={pager.to} total={pager.total} noun={noun} />}
      <Scrollable>
        <table className="w-full text-left border-collapse" style={{ minWidth: minW }}>
          <thead>
            <tr>
              <th className={`${thPad} border-y border-ink/10 w-9`} aria-hidden />
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="grid place-items-center py-16 text-center">
                    <Inbox size={24} className="text-ink/25" />
                    <p className="mt-2 text-[13px] text-ink/70">{empty}</p>
                  </div>
                </td>
              </tr>
            ) : pager.pageRows.map((row) => {
              const key = rowKey(row);
              const isOpen = open.has(key);
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => toggle(key)}
                    className={`border-b border-ink/10 cursor-pointer hover:bg-flysch/50 ${isOpen ? "bg-flysch/40" : ""}`}
                  >
                    <td className={`${tdPad} w-9`}>
                      <button
                        type="button"
                        aria-label={expandLabel}
                        aria-expanded={isOpen}
                        onClick={(e) => { e.stopPropagation(); toggle(key); }}
                        className={`grid place-items-center w-6 h-6 rounded-[4px] text-ink/65 hover:bg-ink/[0.06] hover:text-ink ${focusRing}`}
                      >
                        <ChevronRight size={15} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </button>
                    </td>
                    {columns.map((c) => <td key={c.key} className={cellClass(c)}>{c.render(row)}</td>)}
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-ink/10 last:border-0">
                      <td colSpan={colSpan} className="px-4 py-3 bg-flysch/30">
                        <div className="pl-5">{renderDetail(row)}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Scrollable>
      {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}
    </div>
  );
}
