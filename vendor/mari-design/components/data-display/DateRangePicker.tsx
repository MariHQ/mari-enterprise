import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Popover } from "../navigation/Popover";
import { Button } from "../actions/Button";
import { Input } from "../forms/Input";
import { SectionLabel } from "../forms/SectionLabel";
import { focusRing } from "../tokens/focusRing";
import { fmtDate, type DateInput } from "../tokens/format";

/* DateRangePicker — the dropdown date selector every time-scoped surface was
   missing. A trigger button opens a popover of named presets plus a custom
   from/to range; nothing commits until Apply, and Apply closes the popover
   (that is what the controlled `open` on navigation/Popover.tsx is for).

   Copy follows CONVENTIONS.md §5: no dashes in ranges ("Jul 1, 2026 to
   Jul 8, 2026") and every date carries its year via `fmtDate`. */

export type DateRangePreset = "24h" | "7d" | "30d" | "90d" | "year" | "all" | "custom";

export type DateRange = {
  preset: DateRangePreset;
  /** ISO date (yyyy-mm-dd). Only meaningful when `preset` is "custom". */
  from?: string;
  to?: string;
};

export const DATE_RANGE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range" },
];

const PRESET_DAYS: Partial<Record<DateRangePreset, number>> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };

/** Inclusive lower bound of a range, or null when the range is unbounded. */
export function dateRangeStart(range: DateRange, now: DateInput = new Date()): Date | null {
  const end = now instanceof Date ? new Date(now) : new Date(now);
  if (range.preset === "all") return null;
  if (range.preset === "custom") return range.from ? new Date(`${range.from}T00:00:00`) : null;
  if (range.preset === "year") return new Date(end.getFullYear(), 0, 1);
  const days = PRESET_DAYS[range.preset];
  if (days == null) return null;
  const d = new Date(end);
  d.setDate(d.getDate() - days);
  return d;
}

/** Human label for a range: the preset name, or "Jul 1, 2026 to Jul 8, 2026". */
export function dateRangeLabel(range: DateRange): string {
  if (range.preset !== "custom") {
    return DATE_RANGE_PRESETS.find((p) => p.id === range.preset)?.label ?? "All time";
  }
  if (range.from && range.to) return `${fmtDate(range.from)} to ${fmtDate(range.to)}`;
  if (range.from) return `From ${fmtDate(range.from)}`;
  if (range.to) return `Until ${fmtDate(range.to)}`;
  return "Custom range";
}

export type DateRangePickerProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Which presets to offer, in order. Defaults to all seven. */
  presets?: DateRangePreset[];
  /** Trigger label override; defaults to `dateRangeLabel(value)`. */
  label?: string;
  align?: "start" | "center" | "end";
  disabled?: boolean;
  /** 28px trigger instead of the standard 36px one. */
  compact?: boolean;
  /** Force the panel open. Uncontrolled click-to-toggle when omitted. */
  open?: boolean;
  /** Render the panel inside this subtree instead of portalling it to <body>. */
  portal?: boolean;
  className?: string;
};

export function DateRangePicker({
  value, onChange, presets, label, align = "start", disabled = false, compact = false,
  open: openProp, portal = true, className = "",
}: DateRangePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (o: boolean) => { if (openProp === undefined) setInternalOpen(o); };
  const [draft, setDraft] = useState<DateRange>(value);

  // Re-seed the draft each time the popover OPENS so a cancelled edit is
  // genuinely discarded.
  //
  // DD-64: `value` used to be in the deps, and `value` is an object literal at
  // nearly every call site, so it is a new reference on every parent render.
  // Any re-render while the popover was open re-ran this and overwrote whatever
  // the user had typed into From/To. The seed is a function of the open edge
  // alone; `valueRef` is what makes reading the current value here legal
  // without re-subscribing to it.
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; });
  useEffect(() => { if (open) setDraft(valueRef.current); }, [open]);

  const list = presets
    ? DATE_RANGE_PRESETS.filter((p) => presets.includes(p.id))
    : DATE_RANGE_PRESETS;

  const invalidCustom =
    draft.preset === "custom" && !!draft.from && !!draft.to && draft.from > draft.to;
  const apply = () => { if (!invalidCustom) { onChange(draft); setOpen(false); } };

  const h = compact ? "h-7 text-[12.5px]" : "h-9 text-[13px]";

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      aria-label="Date range"
      aria-haspopup="dialog"
      className={[
        "inline-flex max-w-full items-center gap-2 rounded-[4px] border border-ink/25 bg-paper px-3 text-ink",
        h,
        "hover:border-ink/45 disabled:opacity-100 disabled:cursor-not-allowed disabled:bg-ink/[0.07] disabled:text-ink/70 disabled:border-ink/20",
        focusRing,
        className,
      ].filter(Boolean).join(" ")}
    >
      <Calendar size={18} className="shrink-0 text-ink/70" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{label ?? dateRangeLabel(value)}</span>
      <ChevronDown size={18} className="shrink-0 text-ink/70" aria-hidden />
    </button>
  );

  return (
    <Popover trigger={trigger} open={open} onOpenChange={setOpen} align={align} portal={portal} className="w-[268px] p-0">
      <div role="group" aria-label="Date range presets" className="flex flex-col p-1.5">
        {list.map((p) => {
          const on = draft.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setDraft((d) => ({ ...d, preset: p.id }))}
              className={[
                "flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
                on ? "bg-biscay-2/[0.10] font-medium text-biscay-2 ring-1 ring-inset ring-biscay-2" : "text-ink/80 hover:bg-flysch hover:text-ink",
                focusRing,
              ].join(" ")}
            >
              {/* Square marker, never a radio circle (CONVENTIONS.md §6). */}
              <span
                aria-hidden
                className={`grid h-3 w-3 shrink-0 place-items-center rounded-[2px] border ${on ? "border-biscay-2 bg-biscay-2" : "border-ink/30"}`}
              >
                {on && <span className="block h-1 w-1 rounded-[1px] bg-paper" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
            </button>
          );
        })}
      </div>

      {draft.preset === "custom" && (
        <div className="border-t border-ink/10 px-3 py-3">
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <SectionLabel>From</SectionLabel>
              <Input
                type="date"
                className="w-full"
                value={draft.from ?? ""}
                aria-invalid={invalidCustom || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <SectionLabel>To</SectionLabel>
              <Input
                type="date"
                className="w-full"
                value={draft.to ?? ""}
                aria-invalid={invalidCustom || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              />
            </label>
          </div>
          {invalidCustom && (
            <p role="alert" className="mt-2 text-[12px] text-espelette">
              The start date must come before the end date.
            </p>
          )}
        </div>
      )}

      {/* Primary action bottom LEFT, secondary to its right (CONVENTIONS.md §2). */}
      <div className="flex items-center gap-2 border-t border-ink/10 px-3 py-2.5">
        <Button variant="primary" compact onClick={apply} disabled={invalidCustom}>Apply</Button>
        <Button compact onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Popover>
  );
}
