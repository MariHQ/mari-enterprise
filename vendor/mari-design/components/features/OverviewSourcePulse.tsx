import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "../layout/Card";
import { IconRing } from "../data-display/IconRing";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { ReadError } from "../feedback/ReadError";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { Skeleton, SkeletonLine, SkeletonCircle } from "../data-display/Skeleton";
import { SourceMark } from "../icons/marks";
import { Scrollable } from "../data-display/Scrollable";

/* Overview — Source pulse ─────────────────────────────────────────────────
   A grid of per-source activity tiles showing each connected source's 7-day
   pulse: provider mark, name, a headline stat, an ALL-CAPS <Chip> status, and
   a mini bar chart. The chip sits to the LEFT of the chart so the status reads
   before the shape does, and it is the shared Chip (not a hand-rolled span) so
   it matches every other chip in the console (CONVENTIONS.md §4).
   Local Sparkbars (bar sparkline — catalog Sparkline is a line) + PulseTile.
   Source: web/src/pages/Overview.tsx (pulseQ, .card.pulse block). */

type PulseStatus = "active" | "moderate";

const BAR_HEX: Record<PulseStatus, string> = { active: "#2C6E49", moderate: "#A05E1C" };

/* ── Sparkbars — inline SVG bar sparkline; opacity ramps with value ── */
function Sparkbars({ values, width = 56, height = 22, tone = "active" }: {
  values: number[];
  width?: number;
  height?: number;
  tone?: PulseStatus;
}) {
  const bw = width / Math.max(values.length, 1);
  const max = Math.max(...values, 1);
  const color = BAR_HEX[tone];
  return (
    <svg width={width} height={height} aria-hidden style={{ display: "block" }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * bw + 1} y={height - h} width={Math.max(1, bw - 2)} height={h} rx="1"
            fill={color} opacity={0.5 + (v / max) * 0.5}
          />
        );
      })}
    </svg>
  );
}

export type PulseTileData = {
  key: string;
  name: string;
  stat: string;
  unit: string;
  status: PulseStatus;
  bars: number[];
};

function PulseTile({ tile }: { tile: PulseTileData }) {
  const active = tile.status !== "moderate";
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-md border border-ink/12 p-3">
      <span className="shrink-0"><SourceMark provider={tile.key} size={26} /></span>
      {/* min-w-0 + truncate: a long source name or unit shortens itself rather
          than wrapping one character per line and blowing the tile's height. */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{tile.name}</div>
        <div className="truncate font-term text-[11px] leading-tight text-ink/65">
          {tile.stat} {tile.unit}
        </div>
      </div>
      {/* Status chip first, chart second. Neither may be squeezed away. */}
      <span className="shrink-0">
        <Chip label={active ? "Active" : "Moderate"} tone={active ? "ok" : "attention"} dot />
      </span>
      <span className="shrink-0"><Sparkbars values={tile.bars} tone={tile.status} /></span>
    </div>
  );
}

export type OverviewSourcePulseProps = {
  tiles: PulseTileData[];
  loading?: boolean;
  offline?: boolean;
  onViewAll?: () => void;
  /** Wires the error banner's Retry control. Omitted = no button. */
  onRetry?: () => void;
  /** Start with every source tile showing. */
  defaultExpanded?: boolean;
  className?: string;
};

/** Collapsed height of the grid, in tiles, and the expanded page size. */
const PREVIEW_TILES = 4;
const EXPANDED_TILES = 24;

export function OverviewSourcePulse({
  tiles, loading = false, offline = false, onViewAll, onRetry,
  defaultExpanded = false, className = "",
}: OverviewSourcePulseProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hidden = Math.max(0, tiles.length - PREVIEW_TILES);
  const visible = expanded ? tiles.slice(0, EXPANDED_TILES) : tiles.slice(0, PREVIEW_TILES);

  const viewAll = () => {
    setExpanded((v) => !v);
    onViewAll?.();
  };

  return (
    <Card
      className={className}
      icon={<IconRing><Sparkles size={16} /></IconRing>}
      title="Source pulse"
      hint="Last 7 days"
    >
      {loading ? (
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border border-ink/12 p-3">
              <SkeletonCircle size={26} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <SkeletonLine w="55%" h={11} />
                <SkeletonLine w="38%" h={9} />
              </div>
              <Skeleton width={56} height={22} rounded="rounded-[3px]" />
              <SkeletonLine w={48} h={9} />
            </div>
          ))}
        </div>
      ) : offline ? (
        /* §8: failure copy comes from the catalog, never a bespoke string. */
        <ReadError onRetry={onRetry} />
      ) : tiles.length === 0 ? (
        <EmptyState>No sources connected yet. Connect one in Sources.</EmptyState>
      ) : (
        <>
          {/* Count strip + the control that changes it, above the grid (§13).
              Both used to be hand-rolled here: a fourth spelling of "Showing N
              of M" beside a fifth spelling of "show me the rest". */}
          <ResultCount
            from={1}
            to={visible.length}
            total={tiles.length}
            noun="sources"
            className="mb-2.5 rounded-[4px] border border-ink/10"
            actions={hidden > 0 && <ShowRest expanded={expanded} total={tiles.length} onToggle={viewAll} />}
          />
          {/* A workspace can connect dozens of sources: the grid scrolls inside
              a capped region instead of running past the fold (§20). */}
          <Scrollable axis="y" style={{ maxHeight: visible.length > 8 ? 380 : undefined }} scrollerClassName="pr-1">
            <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] items-stretch gap-2.5">
              {visible.map((t) => <PulseTile key={t.key} tile={t} />)}
            </div>
          </Scrollable>
        </>
      )}
    </Card>
  );
}
