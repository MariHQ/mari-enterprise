import { useEffect, useState, type ReactNode } from "react";
import { Check, Minus, Pause, Play, Square, X } from "lucide-react";
import { card } from "../tokens/card";
import { Spinner } from "../data-display/Spinner";
import { SkeletonLine, SkeletonCircle, SkeletonList } from "../data-display/Skeleton";
import { SectionLabel } from "../forms/SectionLabel";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { ErrorMessage } from "../feedback/ErrorMessage";
import { SyncPanel, type SyncSource } from "../feedback/SyncPanel";
import { Scrollable } from "../data-display/Scrollable";
import { SourceMark } from "../icons/marks";

/* SourcesSyncStatus — a visual read-out of the sync state model that powers the
   Sources page (pages/sources/syncStatus.ts). The real module is a headless,
   self-terminating poll; here it's rendered as the two things every consumer
   builds from it: an ordered <PhaseTracker> and the live <SyncPanel> row. The
   phase vocabulary (PHASES / PHASE_LABEL) is exported so it stays canonical.
   Standalone: a self-advancing demo walks a source through every phase. */

export const PHASES = ["listing", "fetching", "chunking", "embedding", "indexing"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase | "done", string> = {
  listing: "Listing", fetching: "Fetching", chunking: "Chunking",
  embedding: "Embedding", indexing: "Indexing", done: "Done",
};

type PhaseState = "pending" | "active" | "done" | "error" | "paused";

/* Square markers, never circles: a circle in a list reads as "pick me"
   (CONVENTIONS.md §6). Each state also carries a distinct glyph so the
   status is never signalled by colour alone. */
const STATE_STYLE: Record<PhaseState, { ring: string; text: string; icon: ReactNode }> = {
  pending: { ring: "border-ink/30 text-ink/65", text: "text-ink/65", icon: <Minus size={12} /> },
  active: { ring: "border-biscay-2 text-biscay-2", text: "text-ink", icon: <Spinner size="sm" /> },
  done: { ring: "border-moss/60 bg-moss/10 text-moss", text: "text-ink/70", icon: <Check size={12} strokeWidth={3} /> },
  error: { ring: "border-espelette/60 bg-espelette/10 text-espelette", text: "text-espelette", icon: <X size={12} strokeWidth={3} /> },
  paused: { ring: "border-ink/35 bg-flysch text-ink/65", text: "text-ink/70", icon: <Square size={10} strokeWidth={3} /> },
};

/** PhaseTracker — read-only ordered phase strip. Distinct from Stepper (which
    is a clickable numbered wizard control); this is a status trail. */
export function PhaseTracker({
  current, failed = false, paused = false, className = "",
}: {
  /** Index into PHASES of the active phase, or the number of phases when done. */
  current: number;
  failed?: boolean;
  /** The run is held: the active phase shows a stop marker, not a spinner. */
  paused?: boolean;
  className?: string;
}) {
  /* The phase row SCROLLS, it does not wrap (CONVENTIONS.md §20: a row of
     steps that cannot fit scrolls, it does not shrink each label). Wrapping
     looked safe but was not: a phase label is wider than its min-content
     floor, so once the column got under ~140px each `li` spilled out through
     the card border instead of moving to the next line. */
  return (
    <Scrollable axis="x">
      <ol className={`flex items-center gap-x-4 whitespace-nowrap ${className}`.trim()}>
      {PHASES.map((p, i) => {
        const state: PhaseState =
          failed && i === current ? "error"
            : paused && i === current ? "paused"
            : i < current ? "done" : i === current ? "active" : "pending";
        const st = STATE_STYLE[state];
        return (
          <li key={p} className="flex shrink-0 items-center gap-1.5">
            <span className={`grid place-items-center w-[18px] h-[18px] shrink-0 rounded-[3px] border ${st.ring}`}>{st.icon}</span>
            <span className={`font-term text-[11.5px] ${st.text}`}>{PHASE_LABEL[p]}</span>
          </li>
        );
      })}
      </ol>
    </Scrollable>
  );
}

export type SourcesSyncStatusProps = {
  /** Stop the self-advancing demo animation. */
  animate?: boolean;
  /** Start in the "not making progress" state (ERRORS["sync.stuck"]). */
  stuck?: boolean;
  loading?: boolean;
  className?: string;
};

export function SourcesSyncStatus({ animate = true, stuck = false, loading = false, className = "" }: SourcesSyncStatusProps) {
  const [idx, setIdx] = useState(3); // start mid-run on "embedding"
  /* A run must always be stoppable. The phase strip used to just cycle with
     no way out, which is exactly the trap the stuck state puts you in. */
  const [run, setRun] = useState<"running" | "paused" | "cancelled">("running");
  const isStuck = stuck && run === "running";

  useEffect(() => {
    if (!animate || run !== "running" || stuck) return;
    const t = window.setInterval(() => setIdx((i) => (i >= PHASES.length ? 3 : i + 1)), 1600);
    return () => window.clearInterval(t);
  }, [animate, run, stuck]);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-3 ${className}`.trim()} aria-hidden="true">
        <div className={`${card} p-4`}>
          <SkeletonLine w={80} h={10} />
          <div className="mt-3 flex flex-wrap gap-4">
            {Array.from({ length: PHASES.length }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <SkeletonCircle size={18} />
                <SkeletonLine w={54} h={9} />
              </div>
            ))}
          </div>
        </div>
        <SkeletonList rows={1} />
      </div>
    );
  }

  const done = run === "cancelled" ? false : idx >= PHASES.length;
  const perPhase = 100;
  const total = PHASES.length * perPhase;
  const doneCount = Math.min(total, idx * perPhase + (done ? 0 : 60));

  const source: SyncSource = run === "cancelled"
    ? {
        id: "gh", name: "GitHub · acme/handbook", provider: "github",
        state: "queued",
      }
    : done
    ? {
        id: "gh", name: "GitHub · acme/handbook", provider: "github",
        state: "done", docCount: 500, chunkCount: 8912, embeddedCount: 8912,
        lastSyncAt: new Date().toISOString(),
      }
    : {
        id: "gh", name: "GitHub · acme/handbook", provider: "github",
        state: "syncing", phase: PHASE_LABEL[PHASES[Math.min(idx, PHASES.length - 1)]],
        done: doneCount, total, chunkCount: 8912, embeddedCount: doneCount * 17,
      };

  return (
    <div className={`grid grid-cols-1 gap-3 ${className}`.trim()}>
      <div className={`${card} p-4`}>
        <SectionLabel>Sync phases</SectionLabel>
        <div className="mt-3">
          <PhaseTracker current={Math.min(idx, PHASES.length)} paused={run !== "running"} />
        </div>
        <p className="mt-3 font-term text-[11px] text-ink/65">
          Polls the server about every 1.5s while a sync is running, then stops. It is a self-terminating poll, not a fixed interval.
        </p>

        {isStuck && (
          <div className="mt-3">
            <ErrorMessage id="sync.stuck" onAction={() => setRun("paused")} />
          </div>
        )}

        {/* Always available, in every state: a run you cannot stop is a bug. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          {run === "running" ? (
            <Button variant="primary" compact onClick={() => setRun("paused")}><Pause size={13} /> Pause sync</Button>
          ) : (
            <Button variant="primary" compact disabled={run === "cancelled" && false} onClick={() => { setRun("running"); if (run === "cancelled") setIdx(0); }}>
              <Play size={13} /> {run === "cancelled" ? "Start a fresh run" : "Resume sync"}
            </Button>
          )}
          <ConfirmButton compact confirmLabel="Cancel run?" onConfirm={() => { setRun("cancelled"); setIdx(0); }}>
            <X size={13} /> Cancel run
          </ConfirmButton>
          <span className="font-term text-[11px] text-ink/65">
            {run === "running" ? (isStuck ? "Retrying the same page" : "Running") : run === "paused" ? "Paused, nothing is being indexed" : "Cancelled, no run in flight"}
          </span>
        </div>
      </div>
      <SyncPanel sources={[source]} />
    </div>
  );
}
