import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { focusRing } from "../tokens/focusRing";

/* Shared table chrome. Every table in the console — plain, selectable,
   expandable, or hand-rolled inside a panel — uses these so column headers,
   spacing, and the sort affordance are identical everywhere.
   See CONVENTIONS.md §3. */

export const thClass =
  "font-term font-medium text-[11px] uppercase tracking-[0.08em] text-ink/65";
/** Uniform header cell padding. */
export const thPad = "px-4 py-2.5";
/** Uniform body cell padding. */
export const tdPad = "px-4 py-3";

export type SortDir = "asc" | "desc";
export type SortState = { key: string | null; dir: SortDir };

export type Align = "left" | "center" | "right";

const ALIGN: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};
const JUSTIFY: Record<Align, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

/** A sortable column header cell. Renders a `<th>` with the standard sort icon. */
export function SortHeader({
  label, sortKey, sort, onSort, align = "left", className = "", sortable = true,
}: {
  label: ReactNode;
  /** Column identity; omit only for non-sortable decoration columns. */
  sortKey?: string;
  sort?: SortState;
  onSort?: (key: string) => void;
  align?: Align;
  className?: string;
  sortable?: boolean;
}) {
  const active = !!sortKey && sort?.key === sortKey;
  const canSort = sortable && !!sortKey && !!onSort;
  const Icon = active ? (sort?.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`${thClass} ${thPad} ${ALIGN[align]} border-y border-ink/10 ${className}`}
    >
      {canSort ? (
        <button
          type="button"
          onClick={() => onSort!(sortKey!)}
          className={`inline-flex w-full items-center gap-1 ${JUSTIFY[align]} ${active ? "text-ink" : "hover:text-ink"} transition-colors ${focusRing}`}
        >
          <span className="uppercase">{label}</span>
          <Icon size={12} className={active ? "text-biscay-2" : "text-ink/65"} aria-hidden />
        </button>
      ) : (
        <span className={`inline-flex w-full items-center ${JUSTIFY[align]}`}>{label}</span>
      )}
    </th>
  );
}

/** Sort state + comparator for a locally-sorted table. */
export function useSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => string | number>,
  initial: SortState = { key: null, dir: "asc" },
) {
  const [sort, setSort] = useState<SortState>(initial);

  const onSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const sorted = useMemo(() => {
    const get = sort.key ? accessors[sort.key] : undefined;
    if (!get) return rows;
    return [...rows].sort((a, b) => {
      const av = get(a), bv = get(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    // accessors is a literal in every call site; keying on sort is enough.
  }, [rows, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  return { sort, onSort, sorted };
}
