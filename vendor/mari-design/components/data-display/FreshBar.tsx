import type { ChipTone } from "./Chip";

/* FreshBar — a segmented horizontal health/freshness bar with an optional
   legend. Ported from the console's Insights "Freshness by source" chart,
   redrawn to the blueprint (clean rounded segments, no sketch filter). Fully
   generic: pass any set of named segments. The canonical fresh/aging/stale
   split is the common case, so tones map onto the semantic scale. */

const TONE_BG: Record<ChipTone, string> = {
  ok: "bg-moss",
  attention: "bg-clay",
  blocked: "bg-espelette",
  info: "bg-biscay-2",
  neutral: "bg-ink/40",
};

export type FreshSegment = {
  label: string;
  value: number;
  /** Semantic tone; ignored when an explicit `color` is given. */
  tone?: ChipTone;
  /** Explicit CSS color, overrides `tone`. */
  color?: string;
};

export function LegendSwatch({ tone = "neutral", color, label }: { tone?: ChipTone; color?: string; label?: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-term text-[11px] text-ink/70" title={label}>
      <span
        className={`inline-block w-2.5 h-2.5 shrink-0 rounded-[2px] ${color ? "" : TONE_BG[tone]}`}
        style={color ? { backgroundColor: color } : undefined}
      />
      {/* A source name can run long; the legend truncates rather than
          reflowing the widget (CONVENTIONS §12). */}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export type FreshBarProps = {
  segments: FreshSegment[];
  /** Show the swatch + label legend below the bar. */
  legend?: boolean;
  /** Append each segment's value to its legend entry. */
  showCounts?: boolean;
  /** Bar height in pixels. */
  height?: number;
  /** Segments kept before the tail is folded into one "Other" band. */
  maxSegments?: number;
  /** Copy for the folded tail segment. */
  otherLabel?: string;
  className?: string;
};

export function FreshBar({
  segments: input, legend = true, showCounts = true, height = 10,
  maxSegments = 7, otherLabel = "Other", className = "",
}: FreshBarProps) {
  /* Forty sources make forty sub-pixel slivers and a legend taller than the
     widget. Keep the largest bands, fold the tail into one honest "Other"
     (CONVENTIONS §15: a box does not grow to fit its content). */
  const segments =
    input.length <= maxSegments
      ? input
      : (() => {
          const ranked = [...input].sort((a, b) => b.value - a.value);
          const head = ranked.slice(0, maxSegments - 1);
          const tail = ranked.slice(maxSegments - 1);
          return [
            ...input.filter((s) => head.includes(s)),
            { label: `${otherLabel} (${tail.length})`, value: tail.reduce((n, s) => n + Math.max(0, s.value), 0), tone: "neutral" as ChipTone },
          ];
        })();

  const total = segments.reduce((n, s) => n + Math.max(0, s.value), 0);

  return (
    <div className={className}>
      <div
        className="flex w-full overflow-hidden rounded-full bg-ink/[0.06] ring-1 ring-inset ring-ink/15"
        style={{ height }}
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      >
        {total > 0 &&
          segments.map((s, i) =>
            s.value > 0 ? (
              <span
                key={i}
                className={s.color ? "" : TONE_BG[s.tone ?? "neutral"]}
                /* A 0.2% band still has to be visible, so every drawn segment
                   keeps a 2px floor. */
                style={{ width: `${(s.value / total) * 100}%`, minWidth: 2, ...(s.color ? { backgroundColor: s.color } : {}) }}
              />
            ) : null,
          )}
      </div>
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((s, i) => (
            <LegendSwatch
              key={i}
              tone={s.tone}
              color={s.color}
              label={showCounts ? `${s.label} · ${s.value}` : s.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
