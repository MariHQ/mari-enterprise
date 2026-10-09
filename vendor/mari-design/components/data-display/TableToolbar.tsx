import { type ReactNode } from "react";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { allOptionLabel } from "./DataTable";

const controlBox =
  "h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper text-[12.5px] text-ink/75 outline-none focus:border-biscay-2 focus:ring-1 focus:ring-biscay-2/40";

export type ToolbarFacet = {
  /** Human label used for the "All …" option and the active-filter summary. */
  label: string;
  /** Override the sentence-case "All …" option copy. */
  allLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

export type ToolbarSort = {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  dir: "asc" | "desc";
  onDirChange: (dir: "asc" | "desc") => void;
};

/* ── TableToolbar: search + N facet selects + optional sort control ──────
   A standalone, fully-controlled bar to sit above any table. Unlike
   DataTable's single built-in facet, this drives an arbitrary number of
   facets, an optional sort key + direction toggle, an actions slot, and a
   removable active-filter summary row. */
export function TableToolbar({
  title, count, search, searchPlaceholder = "Search…", facets = [], sort,
  actions, onClearAll, className = "",
}: {
  title?: string;
  count?: number;
  search?: { value: string; onChange: (value: string) => void };
  searchPlaceholder?: string;
  facets?: ToolbarFacet[];
  sort?: ToolbarSort;
  actions?: ReactNode;
  /** When given, an active-filter summary appears with a "Clear all" button. */
  onClearAll?: () => void;
  className?: string;
}) {
  const active = facets.filter((f) => f.value);
  const hasActive = active.length > 0 || (!!search && !!search.value);

  return (
    <div className={["flex flex-col gap-2", className].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        {title && (
          <div className="flex items-center gap-2 mr-1">
            <h4 className="text-[15px] font-semibold text-ink">{title}</h4>
            {count != null && <span className="font-term text-[11px] font-medium text-ink/60 bg-flysch border border-ink/10 rounded-[3px] px-1.5 py-0.5">{count}</span>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {search && (
            <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
              <Search size={13} className="text-ink/65" />
              <input value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={searchPlaceholder} className="w-[130px] sm:w-[170px] bg-transparent text-[12.5px] text-ink placeholder:text-ink/65 outline-none" />
            </div>
          )}

          {facets.map((f) => (
            <select key={f.label} aria-label={f.allLabel ?? allOptionLabel(f.label)} value={f.value} onChange={(e) => f.onChange(e.target.value)} className={controlBox}>
              <option value="">{f.allLabel ?? allOptionLabel(f.label)}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}

          {sort && (
            <div className="flex items-center gap-1">
              <select aria-label="Sort by" value={sort.value} onChange={(e) => sort.onChange(e.target.value)} className={controlBox}>
                {sort.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                type="button"
                aria-label={`Sort ${sort.dir === "asc" ? "ascending" : "descending"}`}
                onClick={() => sort.onDirChange(sort.dir === "asc" ? "desc" : "asc")}
                className={`grid place-items-center w-8 h-8 rounded-[4px] border border-ink/20 text-ink/70 hover:bg-flysch ${focusRing}`}
              >
                {sort.dir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              </button>
            </div>
          )}

          {actions}
        </div>
      </div>

      {onClearAll && hasActive && (
        <div className="flex flex-wrap items-center gap-1.5 font-term text-[11px] text-ink/65">
          <span className="uppercase tracking-[0.06em]">Filters</span>
          {search?.value && (
            <button type="button" onClick={() => search.onChange("")} className={`inline-flex items-center gap-1 rounded-[3px] border border-ink/15 bg-flysch px-1.5 py-0.5 text-ink/70 hover:border-ink/35 ${focusRing}`}>
              “{search.value}” <X size={10} />
            </button>
          )}
          {active.map((f) => (
            <button key={f.label} type="button" onClick={() => f.onChange("")} className={`inline-flex items-center gap-1 rounded-[3px] border border-ink/15 bg-flysch px-1.5 py-0.5 text-ink/70 hover:border-ink/35 ${focusRing}`}>
              {f.label}: {f.options.find((o) => o.value === f.value)?.label ?? f.value} <X size={10} />
            </button>
          ))}
          <button type="button" onClick={onClearAll} className={`ml-1 text-biscay-2 hover:text-ink hover:underline underline-offset-[3px] rounded-[2px] ${focusRing}`}>Clear all</button>
        </div>
      )}
    </div>
  );
}
