import type { ReactNode } from "react";
import { SourceMark } from "../icons/marks";
import { CheckCircle2, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { card } from "../tokens/card";
import { fmtAgo, type DateInput } from "../tokens/format";
import { Spinner } from "../data-display/Spinner";
import { SkeletonList } from "../data-display/Skeleton";
import { Truncate } from "../data-display/Truncate";
import { Chip, type ChipTone } from "../data-display/Chip";
import { Progress, type ProgressTone } from "../data-display/Progress";
import { Button } from "../actions/Button";

/* SyncPanel — live per-source sync progress, ported from
   pages/welcome/SyncPanel.tsx (and its SyncSummaryLine). The source polled a
   single source via useSyncStatus/gql; here every number is prop-driven — pass
   a `sources` array and the panel renders one row each (provider, state,
   progress, counts, last-sync). No hooks, no network. SyncStatusLine is the
   compact single-line summary of the whole set. */

export type SyncState = "queued" | "syncing" | "done" | "error";

export type SyncSource = {
  id: string;
  /** Display name, e.g. "GitHub · acme/docs". */
  name: string;
  /** Provider key ("github", "slack", …). The panel draws the mark itself:
      a data shape that carries a React element cannot come from an API, which
      forced every caller to build JSX just to describe a row. */
  provider?: string;
  state: SyncState;
  /** Current phase label while syncing, e.g. "Embedding". */
  phase?: string;
  /** 0–100. When omitted it is derived from done/total. */
  progress?: number;
  done?: number;
  total?: number;
  docCount?: number;
  chunkCount?: number;
  embeddedCount?: number;
  lastSyncAt?: DateInput | null;
  /** Error detail shown on state === "error". */
  error?: string;
};

const STATE_META: Record<SyncState, { label: string; tone: ChipTone; progress: ProgressTone; icon: ReactNode }> = {
  queued: { label: "Queued", tone: "neutral", progress: "info", icon: <Clock size={12} /> },
  syncing: { label: "Syncing", tone: "info", progress: "info", icon: null },
  done: { label: "Synced", tone: "ok", progress: "ok", icon: <CheckCircle2 size={12} /> },
  error: { label: "Failed", tone: "blocked", progress: "blocked", icon: <AlertTriangle size={12} /> },
};

function pctOf(s: SyncSource): number {
  if (typeof s.progress === "number") return Math.max(0, Math.min(100, s.progress));
  if (s.total && s.total > 0) return Math.min(100, Math.round(((s.done ?? 0) / s.total) * 100));
  return 0;
}

function Counts({ s }: { s: SyncSource }) {
  const parts = [
    s.docCount != null && `${s.docCount.toLocaleString()} docs`,
    s.chunkCount != null && `${s.chunkCount.toLocaleString()} chunks`,
    s.embeddedCount != null && `${s.embeddedCount.toLocaleString()} embedded`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="mt-1.5 font-term text-[11.5px] text-ink/60">{parts.join(" · ")}</div>;
}

function SyncRow({ s, onRetry }: { s: SyncSource; onRetry?: (id: string) => void }) {
  const meta = STATE_META[s.state];
  const running = s.state === "syncing";
  const queued = s.state === "queued";
  const pct = pctOf(s);
  return (
    <div className="flex items-start gap-3 py-3 border-b border-ink/10 last:border-0">
      {s.provider && <span className="grid place-items-center shrink-0 w-6 h-6 mt-0.5"><SourceMark provider={s.provider} size={20} /></span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink truncate">{s.name}</span>
          <Chip
            label={running ? (s.phase ?? meta.label) : meta.label}
            tone={meta.tone}
            icon={running ? <Spinner size="sm" /> : meta.icon}
            dot={queued}
            className="min-w-0 shrink"
          />
          {s.lastSyncAt != null && s.lastSyncAt !== "" && (
            <span className="ml-auto shrink-0 font-term text-[11px] text-ink/65">{fmtAgo(s.lastSyncAt)}</span>
          )}
        </div>

        {(running || queued) && (
          <div className="mt-2.5">
            <Progress value={pct} tone={queued ? "info" : meta.progress} />
            <div className="mt-1.5 font-term text-[11px] text-ink/65">
              {queued
                ? "Waiting to start…"
                : s.total && s.total > 0
                  ? `${(s.done ?? 0).toLocaleString()}/${s.total.toLocaleString()} items`
                  : "Listing items…"}
            </div>
          </div>
        )}

        {s.state === "done" && <Counts s={s} />}

        {s.state === "error" && (
          <div className="mt-2 rounded-[4px] border border-espelette/30 bg-espelette/[0.05] px-3 py-2 text-[12.5px] text-espelette" role="alert">
            <b className="font-semibold">Sync failed.</b>{" "}
            <Truncate lines={2} className="inline align-bottom" title={s.error || undefined}>
              {s.error || "The server reported an error without details."}
            </Truncate>
            {onRetry && (
              <div className="mt-2">
                <Button compact onClick={() => onRetry(s.id)}>
                  <RefreshCw size={13} /> Retry sync
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export type SyncPanelProps = {
  sources: SyncSource[];
  /** Retry handler for failed sources; hides the retry button when omitted. */
  onRetry?: (id: string) => void;
  /** Render skeleton rows while the sync state is still loading. */
  loading?: boolean;
  className?: string;
};

export function SyncPanel({ sources, onRetry, loading = false, className = "" }: SyncPanelProps) {
  if (loading) {
    return <SkeletonList rows={sources.length || 3} className={className} />;
  }
  if (sources.length === 0) {
    return (
      <div className={`${card} px-4 py-6 text-center text-[13px] text-ink/65 ${className}`.trim()}>
        No sources are syncing.
      </div>
    );
  }
  return (
    <div className={`${card} px-4 ${className}`.trim()}>
      {sources.map((s) => (
        <SyncRow key={s.id} s={s} onRetry={onRetry} />
      ))}
    </div>
  );
}

export type SyncStatusLineProps = {
  sources: SyncSource[];
  className?: string;
};

/* Compact one-line summary of a set of sources — the SyncSummaryLine variant,
   aggregated. Spins while anything is running; otherwise reads out the tallies. */
export function SyncStatusLine({ sources, className = "" }: SyncStatusLineProps) {
  const tally = { queued: 0, syncing: 0, done: 0, error: 0 } as Record<SyncState, number>;
  for (const s of sources) tally[s.state] += 1;

  const parts = [
    tally.syncing > 0 && `${tally.syncing} syncing`,
    tally.queued > 0 && `${tally.queued} queued`,
    tally.done > 0 && `${tally.done} synced`,
    tally.error > 0 && `${tally.error} failed`,
  ].filter(Boolean) as string[];

  const tone = tally.error > 0 ? "text-espelette" : tally.syncing > 0 ? "text-biscay-2" : "text-ink/60";
  const icon =
    tally.syncing > 0 ? <Spinner size="sm" /> :
    tally.error > 0 ? <AlertTriangle size={13} /> :
    <CheckCircle2 size={13} />;

  return (
    <span className={`inline-flex items-center gap-1.5 font-term text-[12px] ${tone} ${className}`.trim()}>
      {icon}
      {sources.length === 0 ? "No sync activity" : parts.join(" · ")}
    </span>
  );
}
