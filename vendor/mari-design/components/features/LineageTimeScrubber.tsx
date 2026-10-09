import { useEffect, useMemo, useState } from "react";
import { card } from "../tokens/card";
import { Scrubber as ScrubberControl } from "../data-display/Scrubber";
import { fmtDate } from "../tokens/format";
import { Chip } from "../data-display/Chip";
import { Skeleton, SkeletonLine, SkeletonChip } from "../data-display/Skeleton";
import { useLineageControls } from "./LineageDataModel";

/* ─────────────────────────────────────────────────────────────────────────
   Lineage time scrubber (feature: lineage-time-scrubber)

   A Wayback-Machine "as-of" control that snaps to real event dates (document
   updates/creations + edge dates) rather than a continuous calendar. It wraps
   the catalog `Scrubber` primitive (activity-density track + range slider +
   step arrows + reset-to-live) and frames it as the row that sits below the
   graph canvas inside the same card, adding the live "As of …" readout and the
   event-range caption.

   Dragging past the end resets to "All time" (live/latest) rather than pinning
   the last date — the core Wayback behavior — which the primitive already does
   via its `null` value.
   ──────────────────────────────────────────────────────────────────────── */

export type LineageTimeScrubberProps = {
  /** Sorted ISO event dates (snap targets). */
  dates: string[];
  /** Events per date, for the density track. */
  activity: { date: string; count: number }[];
  /** Selected index, or null = all time / live. Seeds the control and re-seeds
      it whenever it changes; the reader owns it in between. */
  value?: number | null;
  /** Render a content-shaped skeleton silhouette instead of the scrubber. */
  loading?: boolean;
  className?: string;
};

export function LineageTimeScrubber({
  dates, activity, value = null, loading = false, className = "",
}: LineageTimeScrubberProps) {
  const [, setControls] = useLineageControls();

  /* Seeded from the prop, and re-seeded when the prop moves: a refetch that
     changes the as-of position has to move the control, not be swallowed by
     the state it initialised once. */
  const [idx, setIdx] = useState<number | null>(value);
  const [seen, setSeen] = useState<number | null>(value);
  if (seen !== value) { setSeen(value); setIdx(value); }

  const lastIdx = Math.max(0, dates.length - 1);
  const effIdx = idx == null ? lastIdx : Math.min(Math.max(0, idx), lastIdx);
  const effAsof = idx == null ? null : dates[effIdx] ?? null;

  /* The scrubber used to keep `idx` entirely to itself, which made the caption
     below a claim about behaviour that did not exist. The chosen date goes
     into the shared control store instead, and the canvas hides and dashes
     against it — the same store the toolbar writes to. */
  useEffect(() => { setControls({ asOf: effAsof }); }, [effAsof, setControls]);
  /* Leaving the page leaves time travel: the store outlives this component, so
     an as-of left behind would silently hide documents on the next visit. */
  useEffect(() => () => setControls({ asOf: null }), [setControls]);

  const rangeLabel = useMemo(
    () => (dates.length ? `${fmtDate(dates[0])} to ${fmtDate(dates[lastIdx])}` : "No events"),
    [dates, lastIdx],
  );

  /* "Time travel" is the control's own name and is on screen before the graph
     is: greying it out left a nameless grey card under the canvas. The as-of
     chip, the event count and the date range are all the graph's to report,
     so those stay bars — printing "All time" here would be a claim about a
     history nobody has read yet. */
  if (loading) {
    return (
      <div className={`${card} min-w-[560px] p-3 font-display ${className}`.trim()} aria-busy="true">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Time travel</span>
            <SkeletonChip w={92} />
          </div>
          <span className="ml-auto"><SkeletonLine w={160} h={11} /></span>
        </div>
        <Skeleton height={38} className="rounded-md" />
        <SkeletonLine w="72%" h={11} className="mt-2" />
      </div>
    );
  }

  return (
    <div className={`${card} min-w-[560px] p-3 font-display ${className}`.trim()}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Time travel</span>
          <Chip
            tone={effAsof ? "info" : "neutral"}
            label={effAsof ? `As of ${fmtDate(effAsof)}` : "All time"}
          />
        </div>
        <span className="ml-auto whitespace-nowrap font-term text-[11px] text-ink/65">{dates.length} events · {rangeLabel}</span>
      </div>

      {/* The primitive's as-of marker is a 14px pill centred on the track
          position, so at the rightmost ("All time") stop its outer half sits
          7px past the track's own box. The track is the only child that may
          overflow, so clip it there rather than letting it escape the card.
          The real fix belongs in data-display/Scrubber.tsx (not owned here). */}
      <ScrubberControl
        dates={dates}
        activity={activity}
        value={idx}
        onChange={setIdx}
        className="[&>div.relative]:overflow-x-clip"
      />

      <div className="mt-2 font-term text-[11px] text-ink/65">
        {effAsof
          ? "Documents and links made after this date are hidden. A document edited after it is drawn with a dashed border."
          : "Showing the live graph. Drag or step back to travel in time."}
      </div>
    </div>
  );
}
