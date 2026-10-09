/* Canonical date formatting for the console.
 *
 * - fmtDate:      "Jul 16, 2026"     — the year is ALWAYS shown.
 * - fmtDateTime:  "Jul 16, 2:17 PM"  — timestamps belong in feeds/activity
 *                 rows only; everywhere else use fmtDate.
 * - fmtAgo:       "5m ago", "3h ago" — status-chip relative time, falls
 *                 back to fmtDate past a week.
 */

export type DateInput = Date | string | number;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Exported for the filter kit: a range filter must parse a value the same
    way the cell renders it, or "2026-08-18" sits on different days in the
    column and in the comparison. */
export function toDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    // Parse date-only strings as LOCAL dates ("2026-07-14" must not shift a day).
    const m = DATE_ONLY.exec(input);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(input);
}

/* WHAT A DATE FORMATTER RENDERS FOR SOMETHING THAT IS NOT A DATE: nothing.
 *
 * Every function here used to fall back to `String(input)`, which put the raw
 * value into a slot the surrounding chrome labels as a date — so a count of
 * 12,847,392 rendered under "LAST UPDATED" and as a revision-timeline entry,
 * reading as a date the reader could not parse rather than as the bad value it
 * is. Echoing the input is the one thing a formatter must not do: it launders
 * garbage into the shape of an answer.
 *
 * So all four functions agree: unparsable in, "" out. The caller renders
 * nothing, and a caller that draws a separator or a caption beside the date
 * must check for "" and drop the whole row (see `DocReviewOutlinePanel`,
 * `KnowledgeInspector`). An empty slot says "we do not have this"; "12,847,392"
 * says "this is when it happened", and only one of those is true. */
export function fmtDate(input: DateInput, _now: Date = new Date()): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  // Always carry the year: an undated "Jul 16" is ambiguous once content spans
  // more than one year, and audit/lineage views routinely do.
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtTime(input: DateInput): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m} ${h24 < 12 ? "AM" : "PM"}`;
}

export function fmtDateTime(input: DateInput, now: Date = new Date()): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return `${fmtDate(d, now)}, ${fmtTime(d)}`;
}

/** Returns "" for unparsable input so callers can render nothing instead of a
    lie — the rule the three formatters above now follow too. */
export function fmtAgo(input: DateInput, now: Date = new Date()): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(d, now);
}
