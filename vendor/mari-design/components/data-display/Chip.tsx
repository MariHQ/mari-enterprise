import { useState, type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { resolveTone, resolveToneKey } from "./Badge";
import { focusRing } from "../tokens/focusRing";

export type ChipTone = "ok" | "attention" | "blocked" | "info" | "neutral";

const DOT: Record<ChipTone, string> = {
  ok: "bg-moss",
  attention: "bg-clay",
  blocked: "bg-espelette",
  info: "bg-biscay-2",
  neutral: "bg-ink/50",
};

export type ChipProps = {
  label: ReactNode;
  tone?: string;
  dot?: boolean;
  pulse?: boolean;
  caps?: boolean;
  icon?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

/* Chip: Badge's interactive sibling — same 5-tone scale (see Badge.tsx),
   plus a dot/pulse indicator, an icon slot, click-to-select, and a
   remove (×) affordance. Renders a <button> when onClick is given, a
   <span> otherwise. */
export function Chip({
  label, tone = "neutral", dot = false, pulse = false, caps = true, icon,
  selected = false, onClick, onRemove, removeLabel = "Remove", className = "",
}: ChipProps) {
  const toneKey = resolveToneKey(tone) as ChipTone;
  const toneClasses = resolveTone(tone);
  const dotColor = DOT[toneKey];

  const shared = [
    // min-w-0: as a flex item a nowrap chip otherwise floors at its full text
    // width (min-width:auto) and escapes its row; with it, the label span
    // truncates instead (CONVENTIONS.md §12).
    "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[3px] border px-2 py-[3px] font-term text-[11px] font-medium whitespace-nowrap transition-colors",
    caps && "uppercase tracking-[0.06em]",
    toneClasses,
    // Selection reads on ALL FOUR sides — a ring alone sat behind the chip's
    // own border on some edges and looked like a partial underline.
    selected && "border-biscay-2 ring-1 ring-biscay-2 bg-biscay-2/[0.10] text-biscay-2",
    className,
  ].filter(Boolean).join(" ");

  const body = (
    <>
      {dot && (
        <span className="relative inline-flex w-1.5 h-1.5 shrink-0">
          {pulse && <span className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${dotColor}`} />}
          <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${dotColor}`} />
        </span>
      )}
      {icon}
      <span className="min-w-0 truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e: MouseEvent) => { e.stopPropagation(); onRemove(); }}
          aria-label={removeLabel}
          className={`grid place-items-center -mr-0.5 w-3.5 h-3.5 rounded-full hover:bg-ink/10 ${focusRing}`}
        >
          <X size={10} />
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${shared} hover:border-ink/40 ${focusRing}`}>
        {body}
      </button>
    );
  }
  return <span className={shared}>{body}</span>;
}

/* ── ChipList: a chip row that cannot become a wall ─────────────────────
   Eighty chips wrapped into a block taller than the card they sit in, and
   pushed the row's date/author line off the bottom. A chip row therefore
   shows the first `max` and collapses the rest behind an honest "+N more"
   toggle (CONVENTIONS §13: say the real count; §12: never grow the box). */
export function ChipList({
  children, max = 8, className = "", moreLabel = "more",
}: {
  children: ReactNode[];
  /** Chips shown before the overflow toggle. */
  max?: number;
  className?: string;
  moreLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = children.filter((c) => c != null && c !== false);
  const hidden = items.length - max;
  const shown = open || hidden <= 0 ? items : items.slice(0, max);

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {shown}
      {hidden > 0 && (
        <Chip
          label={open ? "Show less" : `+${hidden} ${moreLabel}`}
          tone="neutral"
          onClick={() => setOpen((v) => !v)}
        />
      )}
    </div>
  );
}

/* ── StatusChip: named lifecycle states, mapped onto the 5-tone scale ────
   This is the single source of truth for every status pill in the console.
   If a page needs a status word, add it here rather than hand-rolling a span. */
export type ChipStatus =
  | "verified" | "canonical" | "approved" | "stale" | "draft" | "retired"
  | "running" | "failed" | "needs-review"
  // evidence / fact-check
  | "supported" | "contradiction" | "unsupported" | "unverified"
  // severity-ish document checks
  | "error" | "warn" | "advisory"
  // sync + run lifecycle
  | "healthy" | "syncing" | "paused" | "queued" | "succeeded" | "skipped"
  | "connected" | "disconnected" | "dry";

const STATUS: Record<ChipStatus, { tone: ChipTone; label: string; dot?: boolean; pulse?: boolean }> = {
  verified: { tone: "ok", label: "Verified", dot: true },
  canonical: { tone: "ok", label: "Canonical", dot: true },
  approved: { tone: "ok", label: "Approved", dot: true },
  stale: { tone: "attention", label: "Stale", dot: true },
  draft: { tone: "neutral", label: "Draft" },
  retired: { tone: "neutral", label: "Retired" },
  running: { tone: "ok", label: "Running", dot: true, pulse: true },
  failed: { tone: "blocked", label: "Failed", dot: true },
  "needs-review": { tone: "attention", label: "Needs review", dot: true },
  supported: { tone: "ok", label: "Supported", dot: true },
  contradiction: { tone: "blocked", label: "Contradiction", dot: true },
  unsupported: { tone: "attention", label: "Unsupported", dot: true },
  unverified: { tone: "neutral", label: "Unverified" },
  error: { tone: "blocked", label: "Error", dot: true },
  warn: { tone: "attention", label: "Warn", dot: true },
  advisory: { tone: "info", label: "Advisory", dot: true },
  healthy: { tone: "ok", label: "Healthy", dot: true },
  syncing: { tone: "attention", label: "Syncing", dot: true, pulse: true },
  paused: { tone: "neutral", label: "Paused" },
  queued: { tone: "neutral", label: "Queued" },
  succeeded: { tone: "ok", label: "Succeeded", dot: true },
  skipped: { tone: "neutral", label: "Skipped" },
  connected: { tone: "ok", label: "Connected", dot: true },
  disconnected: { tone: "blocked", label: "Disconnected", dot: true },
  dry: { tone: "info", label: "Dry run" },
};

export function StatusChip({ status, className }: { status: ChipStatus; className?: string }) {
  const s = STATUS[status];
  return <Chip label={s.label} tone={s.tone} dot={s.dot} pulse={s.pulse} className={className} />;
}

/* Dry-run marker. Its own component so every workflow surface (run panel, run
   history, guardrails table) renders the identical chip. */
export function DryChip({ className }: { className?: string }) {
  return <StatusChip status="dry" className={className} />;
}

/* ── SeverityChip ────────────────────────────────────────────────────── */
export type ChipSeverity = "high" | "med" | "low";

const SEVERITY: Record<ChipSeverity, { tone: ChipTone; label: string }> = {
  high: { tone: "blocked", label: "High" },
  med: { tone: "attention", label: "Med" },
  low: { tone: "neutral", label: "Low" },
};

export function SeverityChip({ severity, className }: { severity: ChipSeverity; className?: string }) {
  const s = SEVERITY[severity];
  return <Chip label={s.label} tone={s.tone} caps className={className} />;
}

/* ── CountChip: numeric bubble ──────────────────────────────────────── */
export function CountChip({ count, tone = "neutral", className = "" }: { count: number; tone?: string; className?: string }) {
  const toneClasses = resolveTone(tone);
  return (
    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full border font-term text-[10.5px] font-medium ${toneClasses} ${className}`}>
      {count}
    </span>
  );
}
