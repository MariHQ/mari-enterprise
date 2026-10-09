import { useState, type ReactNode } from "react";
import type { ChipTone } from "./Chip";
import { SkeletonLine } from "./Skeleton";
import { Scrollable } from "./Scrollable";
import { ResultCount } from "./Pagination";
import { ShowRest } from "./ShowRest";

/* Timeline — a vertical event timeline: a hairline rail with tone-colored
   nodes, each carrying a title, optional time, description and icon. Distinct
   from Stepper (bounded, ordered process) — this is an open-ended log of
   things that happened. Prop-driven; nodes can carry a custom icon in place
   of the dot. */

const TONE_BG: Record<ChipTone, string> = {
  ok: "bg-moss",
  attention: "bg-clay",
  blocked: "bg-espelette",
  info: "bg-biscay-2",
  neutral: "bg-ink/40",
};

export type TimelineItem = {
  title: ReactNode;
  /** Timestamp / relative time, shown muted beside or under the title. */
  time?: ReactNode;
  description?: ReactNode;
  /** Custom node glyph; replaces the tone dot. */
  icon?: ReactNode;
  tone?: ChipTone;
};

export type TimelineProps = {
  items: TimelineItem[];
  className?: string;
  loading?: boolean;
  /** Events rendered before "Show all". */
  max?: number;
  /** Height cap, in px, once the timeline is long enough to scroll. */
  maxHeight?: number;
};

const titleWidths = ["58%", "44%", "66%", "50%"];

/** Events past which the timeline scrolls inside a bounded region (§20). */
const BOUND_AT = 12;

export function Timeline({ items, className = "", loading = false, max = 25, maxHeight = 440 }: TimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const bounded = Math.min(items.length, expanded ? items.length : max) > BOUND_AT;

  if (loading) {
    return (
      <ol className={`relative ${className}`.trim()} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => {
          const last = i === 3;
          return (
            <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
              {!last && <span className="absolute left-[8px] top-5 bottom-0 w-px bg-ink/12" />}
              <span className="relative z-10 shrink-0 mt-0.5 grid place-items-center w-[17px] h-[17px]">
                <span className="w-2.5 h-2.5 rounded-full ring-2 ring-paper bg-ink/25" />
              </span>
              <div className="min-w-0 flex-1 -mt-px space-y-1.5">
                <SkeletonLine w={titleWidths[i % titleWidths.length]} h={12} />
                {i % 2 === 0 && <SkeletonLine w="82%" h={10} />}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  const capped = items.length > max;
  const shown = capped && !expanded ? items.slice(0, max) : items;

  const list = (
    <ol className={`relative min-w-0 ${bounded ? "" : className}`.trim()}>
      {shown.map((it, i) => {
        const last = i === shown.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {/* rail */}
            {!last && <span className="absolute left-[8px] top-5 bottom-0 w-px bg-ink/12" aria-hidden />}
            {/* node */}
            <span className="relative z-10 shrink-0 mt-0.5 grid place-items-center w-[17px] h-[17px]">
              {it.icon ? (
                <span className="grid place-items-center w-[17px] h-[17px] rounded-full bg-paper border border-ink/20 text-ink/70">{it.icon}</span>
              ) : (
                <span className={`w-2.5 h-2.5 rounded-full ring-2 ring-paper ${TONE_BG[it.tone ?? "neutral"]}`} />
              )}
            </span>
            <div className="min-w-0 flex-1 -mt-px">
              <div className="flex items-baseline justify-between gap-3">
                {/* min-w-0: without it the title is a flex item at its
                    intrinsic width, so break-words never fires and a long
                    token runs past the rail. */}
                <span className="min-w-0 text-[13.5px] font-medium text-ink break-words">{it.title}</span>
                {/* text-ink/65 is the meta-text contrast floor (§6). */}
                {it.time && <span className="shrink-0 font-term text-[11px] text-ink/65 whitespace-nowrap">{it.time}</span>}
              </div>
              {it.description && <div className="mt-0.5 text-[13px] text-ink/70 break-words">{it.description}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );

  if (!capped && !bounded) return list;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`.trim()}>
      {/* Count strip above the events it describes (§13). XA-05/XA-08: the
          count sentence and the toggle were both hand-rolled here, worded
          differently from the three other copies of the same strip. */}
      {capped && (
        <ResultCount
          from={1}
          to={shown.length}
          total={items.length}
          noun="events"
          actions={<ShowRest expanded={expanded} total={items.length} onToggle={() => setExpanded((v) => !v)} />}
        />
      )}
      {bounded
        ? <Scrollable axis="y" style={{ maxHeight }} scrollerClassName="pr-2">{list}</Scrollable>
        : list}
    </div>
  );
}
