import { Children, cloneElement, isValidElement, useMemo, type ReactElement, type ReactNode } from "react";
import { card } from "../tokens/card";
import { PagerBar, ResultCount, usePaged } from "./Pagination";
import { Scrollable } from "./Scrollable";
import { SkeletonRows } from "./Skeleton";
import { SortHeader, tdPad, useSort, type Align } from "./sortable";

const cellWrap = "[overflow-wrap:anywhere]";

/** A column header. A bare string is shorthand for `{ label }`. */
export type TableHeadCol = {
  label: string;
  /** Sort identity. Defaults to the label. */
  key?: string;
  align?: Align;
  /** Set false for decoration/action columns. */
  sortable?: boolean;
};
export type TableHead = string | TableHeadCol;

type Col = { label: string; key: string; align: Align | null; sortable: boolean };

function normalize(h: TableHead, i: number): Col {
  if (typeof h === "string") return { label: h, key: h || `col-${i}`, align: null, sortable: h.trim() !== "" };
  return {
    label: h.label,
    key: h.key ?? h.label ?? `col-${i}`,
    align: h.align ?? null,
    sortable: h.sortable ?? h.label.trim() !== "",
  };
}

/** Best-effort plain text of rendered cell content, used for sorting. */
export function cellText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(cellText).join(" ");
  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    for (const k of ["children", "label", "value", "status", "title"]) {
      const v = props[k];
      if (v != null && typeof v !== "function") return cellText(v as ReactNode);
    }
  }
  return "";
}

const NUMERIC = /^[-+]?\$?[\d,]*\.?\d+\s*[%a-zA-Z]{0,3}$/;
/** Cell padding is owned by the table, not the caller: strip any p-* the row
    brought with it so every table in the console lines up. */
const stripPad = (cls: unknown) =>
  typeof cls === "string" ? cls.replace(/\bp[xytrbl]?-\[?[\d./]+\]?\b/g, "").replace(/\s+/g, " ").trim() : "";

type RowEl = ReactElement<{ children?: ReactNode; className?: string }>;

/* Row dividers are owned by the table, matching DataTable exactly: rows get
   a hairline under each, none under the last. A caller that already styles
   its own border-b keeps it. */
const ROW_BORDER = "border-b border-ink/10 last:border-0";
const rowCls = (cls?: string) =>
  !cls ? ROW_BORDER : cls.includes("border-b") ? cls : `${cls} ${ROW_BORDER}`;

/* ── Table: the plain, caller-composed table ─────────────────────────────
   Callers still pass `<tr>` rows as children; `head` accepts plain strings
   (legacy) or column objects. Headers always render through <SortHeader>, so
   every column carries the standard sort affordance and the shared spacing.
   Columns whose cells are all numeric center themselves (CONVENTIONS §3). */
export function Table({
  title, count, head, actions, footer, minW = 700, loading = false, pageSize = 25, noun = "rows", children,
}: {
  title?: string;
  count?: number;
  head: TableHead[];
  /** Table-level action button. Rendered top right (CONVENTIONS §2). */
  actions?: ReactNode;
  footer?: ReactNode;
  minW?: number;
  loading?: boolean;
  /** Rows per page. A real table carries hundreds of rows and must not grow
      its card to ten thousand pixels; only plain <tr> children paginate. */
  pageSize?: number;
  /** Plural noun for the result-count strip. */
  noun?: string;
  children: ReactNode;
}) {
  const cols = useMemo(() => head.map(normalize), [head]);

  // Rows are only re-orderable / re-alignable when they are plain <tr>s.
  const kids = Children.toArray(children);
  const rowEls = kids.filter((k): k is RowEl => isValidElement(k) && k.type === "tr");
  const composable = rowEls.length === kids.length && rowEls.length > 0;

  const cellsOf = (row: RowEl) =>
    Children.toArray(row.props.children).filter((c): c is ReactElement<{ className?: string; children?: ReactNode }> =>
      isValidElement(c),
    );

  // Cell text per row, keyed by the row's React key so the comparator stays
  // valid across re-renders (elements are new objects every render).
  const texts = new Map<string, string[]>();
  if (composable) {
    rowEls.forEach((r, i) => texts.set(String(r.key ?? i), cellsOf(r).map((c) => cellText(c.props.children).trim())));
  }

  const numericCol = cols.map((_, i) => {
    const vals = [...texts.values()].map((t) => t[i] ?? "").filter(Boolean);
    return vals.length > 0 && vals.every((v) => NUMERIC.test(v));
  });

  const accessors: Record<string, (row: RowEl) => string | number> = {};
  cols.forEach((c, i) => {
    accessors[c.key] = (row) => {
      const t = texts.get(String(row.key ?? ""))?.[i] ?? "";
      if (!numericCol[i]) return t.toLowerCase();
      const n = Number(t.replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
  });

  const { sort, onSort, sorted } = useSort(rowEls, accessors);

  const alignOf = (i: number): Align => cols[i].align ?? (numericCol[i] ? "center" : "left");
  const alignClass = (a: Align) => (a === "center" ? "text-center" : a === "right" ? "text-right" : "");

  const pager = usePaged(sorted, pageSize);

  const body = composable
    ? pager.pageRows.map((row) =>
        cloneElement(
          row,
          { className: rowCls(row.props.className) },
          cellsOf(row).map((cell, i) => {
            const cls = [tdPad, alignClass(alignOf(i)), stripPad(cell.props.className)]
              .filter(Boolean)
              .join(" ");
            return cloneElement(cell, { className: cls });
          }),
        ),
      )
    : children;

  return (
    /* Not aria-hidden: the head now carries real column names, which are
       content. aria-busy says the cells under them are still arriving. */
    <div className={`${card} mt-5 overflow-hidden`} aria-busy={loading || undefined}>
      {(title || actions) && (
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          {/* The title is the caller's own word and renders straight away; the
              count is a RESULT, and a table that says "128" beside a body of
              grey bars has told the reader a number nobody has returned yet. */}
          {title && <h4 className="text-[15px] font-semibold text-ink">{title}</h4>}
          {count != null && !loading && <span className="font-term text-[11px] font-medium text-ink/60 bg-flysch border border-ink/10 rounded-[3px] px-1.5 py-0.5">{count}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {!loading && composable && pager.paged && (
        <ResultCount from={pager.from} to={pager.to} total={pager.total} noun={noun} />
      )}
      <Scrollable>
        <table className="w-full text-left border-collapse" style={{ minWidth: minW }}>
          <thead>
            <tr>
              {cols.map((c, i) => (
                <SortHeader
                  key={c.key}
                  /* The column headers are the caller's literals, known
                     before the query returns. They used to grey out with the
                     rows, which hid what the table was about and reflowed
                     every column when the words arrived. */
                  label={c.label}
                  sortKey={c.key}
                  sort={sort}
                  onSort={onSort}
                  align={alignOf(i)}
                  sortable={!loading && composable && c.sortable}
                />
              ))}
            </tr>
          </thead>
          {/* Fallback dividers for non-<tr> children the composable path
              cannot clone. */}
          <tbody className={composable || loading ? undefined : "divide-y divide-ink/10"}>
            {loading ? <SkeletonRows rows={8} cols={cols.length} /> : body}
          </tbody>
        </table>
      </Scrollable>
      {!loading && composable && pager.paged && (
        <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />
      )}
      {!loading && footer}
    </div>
  );
}
