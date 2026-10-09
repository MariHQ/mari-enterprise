import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { focusRing } from "../tokens/focusRing";

/* A disabled pager arrow keeps its (darker) outline and greys out the inside,
   so the control still reads as a control instead of dissolving into the page.
   CONVENTIONS §6. */
export const pagerBtn =
  `grid place-items-center w-7 h-7 rounded-[4px] border border-ink/30 bg-paper text-ink/75 hover:bg-flysch hover:border-ink/45 transition-colors ` +
  `disabled:opacity-100 disabled:cursor-not-allowed disabled:border-ink/40 disabled:bg-ink/[0.07] disabled:text-ink/35 disabled:hover:bg-ink/[0.07] ${focusRing}`;

/* Standalone pager — DataTable has one of these built in; use this one for
   paginating anything that isn't a table (a card grid, a feed). */
export function Pagination({
  page, pageCount, onChange, itemLabel,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  itemLabel?: string;
}) {
  // Clamp: an out-of-range `page` used to render nonsense like "10 / 9".
  const total = Math.max(1, pageCount);
  const cur = Math.min(Math.max(0, page), total - 1);
  return (
    <div className="flex items-center justify-between gap-3 font-term text-[11.5px] text-ink/65">
      {itemLabel && <span className="min-w-0 break-words">{itemLabel}</span>}
      <div className="flex shrink-0 items-center gap-1 ml-auto">
        <button disabled={cur === 0} onClick={() => onChange(Math.max(0, cur - 1))} aria-label="Previous page" className={pagerBtn}><ChevronLeft size={14} /></button>
        <span className="px-2 whitespace-nowrap">{cur + 1} / {total}</span>
        <button disabled={cur >= total - 1} onClick={() => onChange(Math.min(total - 1, cur + 1))} aria-label="Next page" className={pagerBtn}><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

/* ── Volume controls ──────────────────────────────────────────────────────
   Real tables carry hundreds of rows, not the dozen a fixture ships with.
   Rendering all of them grows a card to ten thousand pixels and buries the
   thing the reader came for. Every list in the console therefore either
   paginates or scrolls inside a bounded box, and always says how many rows
   there really are (CONVENTIONS.md §13, §20).

   `usePaged` is the one pager brain: it clamps the page whenever the row set
   shrinks under it (filtering used to strand the reader on an empty page 9). */

export function usePaged<T>(rows: T[], pageSize = 25) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => (rows.length > pageSize ? rows.slice(cur * pageSize, cur * pageSize + pageSize) : rows),
    [rows, cur, pageSize],
  );
  return {
    page: cur,
    setPage,
    pageCount,
    pageRows,
    paged: rows.length > pageSize,
    from: rows.length === 0 ? 0 : cur * pageSize + 1,
    to: Math.min((cur + 1) * pageSize, rows.length),
    total: rows.length,
  };
}

/* ── THE COUNT RULE (CONVENTIONS §13) ──────────────────────────────────────
   One list, one count, in one place: the <ResultCount> strip directly above
   the list. A card header says what the card IS; it never says how many rows
   are under it. "7 tags" in a card header over a "7 tags" strip, a `3` badge
   beside "New server" over a "3 servers" strip, `Last 4 events` over
   "4 events" — all the same defect, and all of them are the header's to drop,
   not the strip's.

   The ONE permitted header count is on a COLLAPSIBLE section header, because a
   collapsed section has no strip left to carry the number. Such a section
   passes `whenTruncated` so its strip renders only when it is saying something
   the header cannot — that the rows on screen are a slice of a longer list.

   Three things this component now refuses to do, so no caller can get them
   wrong:
     1. Render empty. No noun, no strip.
     2. Render a bare number with no noun. The noun is the sentence.
     3. Render "1 findings". `total === 1` takes the singular. */

/* Regular English plural → singular. Every noun the console counts is regular
   ("doc sites", "verified facts", "candidate terms"); an irregular one passes
   `nounOne` rather than being guessed at here. */
export function singularize(noun: string): string {
  const [head, ...rest] = noun.split(" ").reverse();
  const one =
    /[^aeiou]ies$/i.test(head) ? head.slice(0, -3) + "y"
    : /(ch|sh|ss|x|z)es$/i.test(head) ? head.slice(0, -2)
    : /[^s]s$/i.test(head) ? head.slice(0, -1)
    : head;
  return [one, ...rest].reverse().join(" ");
}

/** `n` of `noun`, agreeing: 1 finding, 0 findings, 12 findings. */
export function countOf(n: number, noun: string, nounOne?: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? nounOne ?? singularize(noun) : noun}`;
}

/** Result-count strip. Renders ABOVE the list it describes (CONVENTIONS §13),
    and is the ONLY place that list's size is stated — see the count rule. */
export function ResultCount({
  from, to, total, noun = "rows", nounOne, note, actions, whenTruncated = false, className = "",
}: {
  from: number;
  to: number;
  total: number;
  /** Plural noun for the counted thing: "members", "events", "findings". */
  noun?: string;
  /** Singular form, for a noun this cannot derive ("people" ← "person"). */
  nounOne?: string;
  /** Extra clause appended after the count. */
  note?: string;
  actions?: ReactNode;
  /** The list sits under a collapsible section header that already carries the
      count. The strip then renders only while the view is truncated, so the
      two never state the same number twice. */
  whenTruncated?: boolean;
  className?: string;
}) {
  const all = from <= 1 && to >= total;
  // A strip with no noun would render a bare number, or (with `total === 0`)
  // an empty grey band. Neither is a sentence, so neither is drawn.
  if (!noun.trim()) return null;
  // The header above already said it. Nothing new to add.
  if (whenTruncated && all) return null;
  return (
    <div className={`flex items-center gap-3 border-b border-ink/10 bg-flysch/40 px-4 py-2 font-term text-[11.5px] text-ink/65 ${className}`.trim()}>
      <span className="min-w-0 truncate">
        {total === 0
          ? `No ${noun}`
          : all
            ? countOf(total, noun, nounOne)
            : `Showing ${from.toLocaleString("en-US")} to ${to.toLocaleString("en-US")} of ${countOf(total, noun, nounOne)}`}
        {note ? ` · ${note}` : ""}
      </span>
      {actions && <span className="ml-auto flex shrink-0 items-center gap-2">{actions}</span>}
    </div>
  );
}

/** The pager rail that closes a paginated card: page N of M, prev, next. */
export function PagerBar({
  page, pageCount, onChange, className = "",
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const total = Math.max(1, pageCount);
  const cur = Math.min(Math.max(0, page), total - 1);
  return (
    <div className={`flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-2.5 font-term text-[11.5px] text-ink/65 ${className}`.trim()}>
      <span className="min-w-0 truncate">Page {cur + 1} of {total}</span>
      <div className="flex shrink-0 items-center gap-1">
        <button disabled={cur === 0} onClick={() => onChange(Math.max(0, cur - 1))} aria-label="Previous page" className={pagerBtn}><ChevronLeft size={14} /></button>
        <button disabled={cur >= total - 1} onClick={() => onChange(Math.min(total - 1, cur + 1))} aria-label="Next page" className={pagerBtn}><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}
