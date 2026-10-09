import { Workflow } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Progress } from "../data-display/Progress";
import { StatusChip } from "../data-display/Chip";
import type { RunStepRow } from "../workflow/RunHistory";
import { RUN_STATUS_CHIP, type RunStatus } from "../tokens/runStatus";

/* A background run, followed from the page that started it.
 *
 * Several pages offer a "scan the corpus" control. Each of those is a
 * multi-minute pass through a model that writes to a ledger, so each one is a
 * real flow with a run, a progress reading and a step history — not a link
 * that fires and forgets, which is what they used to be.
 *
 * The card lives here rather than in each page for the ordinary reason: two
 * pages showing the same run in two hand-built cards is how the two drift.
 */

/** A scan run, as the page that started it follows it. */
export type ScanRun = {
  /** Opaque run handle; the page hands it straight back to its progress
      handler. Opaque so the library never assumes a numeric id. */
  id: string;
  /** What to call the run on screen, e.g. "Fact scan · run #1803". */
  label: string;
  status: RunStatus;
  /** 0–100, as the run reports it. */
  progress: number;
  /** Per-step timeline. Empty until the engine has recorded a step. */
  steps: RunStepRow[];
  /** How many records the run captured. `null` until the run reports a
      number, so a running scan never claims a total it does not have. */
  added: number | null;
};

/* XA-25: was SCAN_CHIP, one of four independent copies of this mapping. */

export type ScanRunCardProps = {
  run: ScanRun;
  /** Dismiss the card once the run has stopped. */
  onDismiss: () => void;
  /** Start the scan again after a failure. Drawn only on a failed run and
      only with a handler (§2): retrying a run that passed is a new scan, and
      the page's own scan button already says so. */
  onRetry?: () => void;
  /** What the run is doing, under the progress bar. */
  label?: string;
  /** Singular noun for what it captures ("claim", "decision"). */
  noun?: string;
  /** Where captured records go next, for the outcome line. */
  destination?: string;
};

export function ScanRunCard({
  run, onDismiss, onRetry,
  label = "Scanning the corpus",
  noun = "record",
  destination = "waiting for review",
}: ScanRunCardProps) {
  const running = run.status === "running" || run.status === "pending";
  const tone = run.status === "failed" ? "blocked" : run.status === "passed" ? "ok" : "info";
  // Name the stage that is actually executing. A minutes-long model pass sat
  // behind the generic label with a motionless bar, which read as hung.
  const runningStep = run.steps.find((s) => s.status === "running");
  const barLabel = running && runningStep ? `${runningStep.step}…` : label;
  // Nothing is claimed until the run has reported a count: "0 captured" and
  // "still counting" are different answers and must not look the same.
  const outcome = run.added == null
    ? null
    : run.added === 0
      ? `No new ${noun}s. Everything it found is already recorded.`
      : `${run.added} new ${noun}${run.added === 1 ? "" : "s"} captured, ${destination}.`;

  return (
    <Card
      variant="plain"
      icon={<Workflow size={17} className="text-biscay-2" />}
      title={run.label}
      actions={!running && (
        <span className="flex items-center gap-3">
          {run.status === "failed" && onRetry
            && <Button variant="link" onClick={onRetry}>Retry</Button>}
          <Button variant="link" onClick={onDismiss}>Dismiss</Button>
        </span>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StatusChip status={RUN_STATUS_CHIP[run.status]} />
          {outcome && <span className="min-w-0 text-[12.5px] text-ink/70">{outcome}</span>}
        </div>
        <Progress value={run.progress} tone={tone} label={barLabel} active={running} />
        {run.steps.length > 0 && (
          <ul className="flex flex-col gap-1">
            {run.steps.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[12.5px]">
                <span className="w-[150px] shrink-0 truncate text-ink/85">{s.step}</span>
                <span className="shrink-0 font-term text-[11px] uppercase tracking-[0.06em] text-ink/65">{s.status}</span>
                <span className="min-w-0 flex-1 truncate text-ink/70">{s.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
