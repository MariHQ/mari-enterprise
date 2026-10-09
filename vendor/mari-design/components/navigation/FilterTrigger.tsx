import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Select } from "../forms/Select";
import { Input } from "../forms/Input";
import { focusRing } from "../tokens/focusRing";

/* The console's one filter idiom (2026-09-01): the Workflows bar.
 *
 * A flat wrapping row of labelled standard controls — a plain text label with
 * the forms Select or Input beside it, search leftmost and stretching when a
 * bar has one. No frames, no accent stripes: the earlier striped pill (grown
 * in the lineage toolbar) is retired, because four pages in four styles is
 * exactly the inconsistency this file exists to end, and Workflows is the
 * bar the product standardized on.
 *
 * - FilterSelect  — labelled native select, the ordinary case.
 * - FilterTrigger — labelled dropdown button for filters a native select
 *                   cannot express (multi-check menus); wrap it in <Menu>.
 * - FilterField   — labelled bordered box for filters carrying their own
 *                   inputs (a date range).
 * - FilterSearch  — the debounced search with the inline magnifier.
 */

const LABEL = "flex shrink-0 items-center gap-2 text-[12.5px] text-ink/70";

/** Local midnight for a date input's "YYYY-MM-DD" value.
 *
 *  `new Date("2026-09-01")` is UTC midnight, but every date a filtered column
 *  renders is the reader's LOCAL day — so a UTC-day window dropped a fact
 *  captured at 6 PM Pacific from a range whose To visibly included it, and
 *  pulled last evening's rows into a From that visibly excluded them. A date
 *  range means the reader's own days; parse it that way. */
export function localDayStart(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

export function FilterSelect({ label, children, ...rest }:
  { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={LABEL}>
      {label}
      <Select {...rest}>{children}</Select>
    </label>
  );
}

export const FilterTrigger = forwardRef<
  HTMLButtonElement,
  { label: string; value: string } & ButtonHTMLAttributes<HTMLButtonElement>
>(function FilterTrigger({ label, value, className = "", ...rest }, ref) {
  return (
    <label className={LABEL}>
      {label}
      <button
        ref={ref}
        type="button"
        {...rest}
        className={`inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-ink/20 bg-paper px-3 text-[13px] text-ink transition-colors hover:border-ink/45 active:bg-ink/[0.05] data-[state=open]:border-ink/45 data-[state=open]:bg-flysch ${focusRing} ${className}`.trim()}
      >
        <span className="max-w-[140px] truncate" title={value}>{value}</span>
        <ChevronDown size={13} className="text-ink/65" />
      </button>
    </label>
  );
});

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={LABEL}>
      <span>{label}</span>
      <div className="flex h-9 items-center gap-1 rounded-[4px] border border-ink/20 bg-paper px-2.5 text-[13px] text-ink focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
        {children}
      </div>
    </div>
  );
}

export function FilterSearch({ value, onSearch, "aria-label": ariaLabel, placeholder, className = "" }: {
  value: string;
  onSearch?: (query: string) => void;
  "aria-label": string;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setQuery(value); }

  useEffect(() => {
    if (query === value) return;
    const timer = window.setTimeout(() => onSearch?.(query), 300);
    return () => window.clearTimeout(timer);
  }, [query, value, onSearch]);

  return (
    <div className={`relative min-w-[220px] flex-1 ${className}`.trim()}>
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/65" aria-hidden />
      <Input
        aria-label={ariaLabel}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="w-full pl-8"
      />
    </div>
  );
}
