import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { fmtDate, type DateInput } from "../tokens/format";
import { DateRangePicker, dateRangeStart, type DateRange } from "./DateRangePicker";

/* Scrubber — an "as-of" timeline scrubber that snaps to real event dates and
   shows activity density beneath the track (Wayback-style). Ported from the
   console's lineage Scrubber, made fully controlled and router-free.

   `value` is the selected index into `dates`, or null for "all time" (the
   rightmost position). `onChange` emits the new index, or null when the
   scrubber lands on the latest date.

   The range control is <DateRangePicker>: picking "Last 30 days" snaps the
   as-of marker to the earliest event date inside that window, and "All time"
   resets it. The range is uncontrolled unless you pass `range`. */

export type ScrubberActivity = { date: string; count: number };

export type ScrubberProps = {
  /** Ordered event dates (ISO or Date-parseable), oldest first. */
  dates: DateInput[];
  /** Per-date activity counts, drawn as density bars under the track. */
  activity?: ScrubberActivity[];
  /** Selected index into `dates`, or null = "all time". */
  value: number | null;
  onChange: (index: number | null) => void;
  /** Controlled range selection. Omit to let the Scrubber own it. */
  range?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  /** Format a date for the label; defaults to fmtDate. */
  format?: (d: DateInput) => string;
  className?: string;
};

export function Scrubber({
  dates, activity = [], value, onChange, range, onRangeChange, format = fmtDate, className = "",
}: ScrubberProps) {
  const [internalRange, setInternalRange] = useState<DateRange>({ preset: "all" });
  const activeRange = range ?? internalRange;

  const lastIdx = Math.max(0, dates.length - 1);
  const effIdx = value == null ? lastIdx : Math.min(Math.max(0, value), lastIdx);
  const empty = dates.length === 0;
  const isoDates = dates.map(String);
  const maxActivity = Math.max(1, ...activity.map((a) => a.count));

  /* DD-13: "All time" is its own stop, one past the last event date.
     It used to share the last date's position — `next >= lastIdx` sent a step
     forward from `lastIdx - 1` straight to null, and the slider mapped its
     rightmost notch to null as well — so the newest event date could never be
     selected as "As of …", and a null value drew the thumb on top of a date it
     was not showing. Giving null a stop of its own makes every date reachable
     and makes the thumb position mean one thing. */
  const allTimeStop = lastIdx + 1;
  const sliderPos = value == null ? allTimeStop : effIdx;

  const step = (delta: number) => {
    const next = sliderPos + delta;
    if (next <= 0) return onChange(0);
    if (next >= allTimeStop) return onChange(null);
    onChange(next);
  };

  /* Applying a range snaps the as-of marker to the earliest event inside the
     window; an unbounded range resets to "all time". */
  const applyRange = (next: DateRange) => {
    if (range === undefined) setInternalRange(next);
    onRangeChange?.(next);
    const start = dateRangeStart(next);
    if (!start || empty) return onChange(null);
    // DD-13: `i >= lastIdx` used to fall through to "All time", so a window
    // that contains only the newest event silently showed everything instead.
    const i = dates.findIndex((d) => new Date(String(d)).getTime() >= start.getTime());
    if (i < 0) return onChange(null);
    onChange(i);
  };

  const label = value == null ? "All time" : `As of ${format(dates[effIdx])}`;
  const btn = `grid place-items-center w-9 h-9 shrink-0 rounded-[4px] border border-ink/25 bg-paper text-ink/75 hover:border-ink/45 hover:text-ink disabled:opacity-100 disabled:cursor-not-allowed disabled:bg-ink/[0.07] disabled:text-ink/70 disabled:border-ink/20 ${focusRing}`;

  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 ${className}`.trim()}>
      <button type="button" className={btn} onClick={() => step(-1)} disabled={empty} aria-label="Step back one event date">
        <ChevronLeft size={18} />
      </button>

      <DateRangePicker
        value={activeRange}
        onChange={applyRange}
        disabled={empty}
        className="w-[11.5rem] min-w-[7rem] shrink"
      />

      <div className="relative h-9 min-w-[6rem] flex-[1_1_10rem]">
        {/* activity density */}
        <svg className="absolute inset-x-0 bottom-2.5 h-4 w-full" viewBox="0 0 100 16" preserveAspectRatio="none" aria-hidden>
          {activity.map((a) => {
            const i = isoDates.indexOf(a.date);
            if (i < 0) return null;
            // Bars line up with the slider's stops, and the slider now has one
            // stop more than there are dates (the "All time" stop, DD-13).
            const x = (i / allTimeStop) * 97 + 1.5;
            const h = 2 + (a.count / maxActivity) * 12;
            return <rect key={a.date} x={x - 0.6} y={14 - h} width={1.2} height={h} rx={0.5} className="fill-espelette" opacity={0.55} />;
          })}
        </svg>
        {/* baseline */}
        <div className="absolute inset-x-0 bottom-[11px] h-px bg-ink/20" />
        {/* selection window */}
        {!empty && (
          <div
            className="pointer-events-none absolute bottom-[7px] h-1.5 rounded-full bg-biscay-2/25 ring-1 ring-inset ring-biscay-2/40"
            // clamp: at the first/last stop a 14px centred marker would sit half
            // outside the track and read as an overflow.
            style={{ left: `clamp(7px, ${(sliderPos / allTimeStop) * 100}%, calc(100% - 7px))`, width: 14, transform: "translateX(-50%)" }}
          />
        )}
        <input
          type="range"
          className={`absolute inset-x-0 bottom-1 w-full cursor-pointer accent-biscay-2 ${focusRing}`}
          min={0}
          max={allTimeStop}
          value={sliderPos}
          disabled={empty}
          aria-label="As-of date (snaps to event dates)"
          aria-valuetext={label}
          onChange={(e) => {
            const i = Number(e.target.value);
            onChange(i >= allTimeStop ? null : i);
          }}
        />
      </div>

      <button type="button" className={btn} onClick={() => step(1)} disabled={empty} aria-label="Step forward one event date">
        <ChevronRight size={18} />
      </button>

      <span className="min-w-0 shrink-0 truncate font-term text-[12px] text-ink/70" aria-live="polite">{label}</span>
    </div>
  );
}
