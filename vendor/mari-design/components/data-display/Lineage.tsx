import type { ReactNode } from "react";
import { focusRing } from "../tokens/focusRing";
import { Scrollable } from "./Scrollable";

/* ── Lineage: upstream → focus → downstream dependency view ────────────────
   A horizontal graph for showing what a node depends on and what depends on
   it — data lineage, doc↔code lineage, a build's inputs/outputs. Sources fan
   into the focus node on the left; dependents fan out on the right. Node
   height is fixed so the connector lines converge precisely. */

export type LineageTone = "ok" | "attention" | "blocked" | "info" | "neutral";

export type LineageNode = {
  id: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  tone?: LineageTone;
};

export type LineageProps = {
  upstream?: LineageNode[];
  focus: LineageNode;
  downstream?: LineageNode[];
  onSelect?: (node: LineageNode) => void;
  ariaLabel?: string;
  /** Cards drawn per column before the rest roll up into one summary card.
   *  A 40-node column drawn literally is 2,700px tall; the roll-up keeps the
   *  view one screen high and still reports the true count. */
  maxPerColumn?: number;
};

const DEFAULT_MAX_PER_COLUMN = 7;

const NODE_H = 56; // px — must match the h-14 card below
const GAP = 14; // px — vertical gap between stacked nodes

const TONE: Record<LineageTone, string> = {
  neutral: "border-ink/15",
  ok: "border-moss/45",
  attention: "border-clay/45",
  blocked: "border-espelette/45",
  info: "border-biscay-2/45",
};

const DOT: Record<LineageTone, string> = {
  neutral: "bg-ink/30",
  ok: "bg-moss",
  attention: "bg-clay",
  blocked: "bg-espelette",
  info: "bg-biscay-2",
};

function colHeight(n: number) {
  return n * NODE_H + Math.max(0, n - 1) * GAP;
}

function NodeCard({ node, focus = false, onSelect }: { node: LineageNode; focus?: boolean; onSelect?: (n: LineageNode) => void }) {
  const tone = node.tone ?? "neutral";
  const surface = focus
    ? "border-biscay-2 ring-1 ring-biscay-2/40 bg-biscay-2/[0.04]"
    : `bg-paper ${TONE[tone]}`;
  const interactive = onSelect ? `hover:border-ink/45 cursor-pointer ${focusRing}` : "";
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      type={onSelect ? "button" : undefined}
      onClick={onSelect ? () => onSelect(node) : undefined}
      style={{ height: NODE_H }}
      className={`w-40 shrink-0 flex items-center gap-2 rounded-[5px] border px-3 text-left transition-colors ${surface} ${interactive}`.trim()}
    >
      {/* A BAR, not a dot: a circle reads as "choose me" (CONVENTIONS §6), and
          the tone is echoed by the card border so color is not the only channel. */}
      {node.icon
        ? <span className="shrink-0 text-ink/70" aria-hidden>{node.icon}</span>
        : <span className={`shrink-0 w-[3px] h-6 rounded-[1px] ${focus ? "bg-biscay-2" : DOT[tone]}`} aria-hidden />}
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink truncate">{node.label}</span>
        {node.sublabel && <span className="block font-term text-[10.5px] text-ink/65 truncate">{node.sublabel}</span>}
      </span>
    </Tag>
  );
}

/** Stands in for the members of a column that were not drawn. Same height and
    width as a node card, so the fan of connectors still converges precisely. */
function RollupCard({ n, word }: { n: number; word: string }) {
  return (
    <div
      style={{ height: NODE_H }}
      className="w-40 shrink-0 flex items-center gap-2 rounded-[5px] border border-dashed border-ink/25 bg-flysch/60 px-3 text-left"
      title={`${n} more ${word} documents are not drawn`}
    >
      <span className="shrink-0 w-[3px] h-6 rounded-[1px] bg-ink/25" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink truncate">{n} more</span>
        <span className="block font-term text-[10.5px] text-ink/65 truncate">{word}, not drawn</span>
      </span>
    </div>
  );
}

/* Fan of curves between a column of `count` nodes and the single focus node.
   dir="in": sources on the left flow rightward into the focus.
   dir="out": focus on the left flows rightward out to dependents. */
function Connector({ count, dir }: { count: number; dir: "in" | "out" }) {
  const W = 46;
  const total = colHeight(count);
  const focusY = total / 2;
  const arrow = 4;
  return (
    <svg width={W} height={total} className="shrink-0 self-center text-ink/25 overflow-visible" role="presentation">
      {Array.from({ length: count }).map((_, i) => {
        const nodeY = i * (NODE_H + GAP) + NODE_H / 2;
        // path always drawn left→right; endpoints depend on direction
        const [x1, y1, x2, y2] = dir === "in" ? [0, nodeY, W, focusY] : [0, focusY, W, nodeY];
        const cx = W / 2;
        const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} />
            <path
              d={`M ${x2 - arrow} ${y2 - arrow} L ${x2} ${y2} L ${x2 - arrow} ${y2 + arrow}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.25}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function Lineage({
  upstream = [], focus, downstream = [], onSelect, ariaLabel = "Lineage",
  maxPerColumn = DEFAULT_MAX_PER_COLUMN,
}: LineageProps) {
  /* Draw at most `maxPerColumn` cards per side. When a side is over budget the
     last slot becomes a roll-up card, so the column height is capped and the
     count is still honest. */
  const split = (list: LineageNode[]) => {
    if (list.length <= maxPerColumn) return { shown: list, rest: 0 };
    return { shown: list.slice(0, maxPerColumn - 1), rest: list.length - (maxPerColumn - 1) };
  };
  const up = split(upstream);
  const down = split(downstream);
  const upSlots = up.shown.length + (up.rest ? 1 : 0);
  const downSlots = down.shown.length + (down.rest ? 1 : 0);

  return (
    <Scrollable aria-label={ariaLabel}>
      <div className="inline-flex items-center gap-0 py-2">
        {upSlots > 0 && (
          <>
            <div className="flex flex-col justify-center" style={{ gap: GAP }}>
              {up.shown.map((n) => <NodeCard key={n.id} node={n} onSelect={onSelect} />)}
              {up.rest > 0 && <RollupCard n={up.rest} word="upstream" />}
            </div>
            <Connector count={upSlots} dir="in" />
          </>
        )}

        <NodeCard node={focus} focus onSelect={onSelect} />

        {downSlots > 0 && (
          <>
            <Connector count={downSlots} dir="out" />
            <div className="flex flex-col justify-center" style={{ gap: GAP }}>
              {down.shown.map((n) => <NodeCard key={n.id} node={n} onSelect={onSelect} />)}
              {down.rest > 0 && <RollupCard n={down.rest} word="downstream" />}
            </div>
          </>
        )}
      </div>
    </Scrollable>
  );
}
