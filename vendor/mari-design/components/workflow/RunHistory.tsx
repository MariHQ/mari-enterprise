import type { DateInput } from "../tokens/format";
import type { RunStatus } from "../tokens/runStatus";

/* The workflow run vocabulary — the one place a run's shape is declared.
   `features/ScanRunCard` types against it.

   Types only, deliberately. This file used to also ship a `RunHistory` table
   and a `RunStatusChip`, with `PipelineView`, `RunPanel` and `WorkflowScreen`
   beside it; the Flows pipeline-editor surface that rendered its own copies of
   those has since been removed from the product. The types stay because they
   are the actual contract for anything that still reports a run. The status
   words moved to tokens/runStatus.ts (XA-25) and are re-exported here
   because this is the path every workflow surface already imports from. */

export type { RunStatus };

export type RunStepRow = {
  step: string;
  status: RunStatus;
  detail?: string;
  duration?: string;
};

export type RunStat = { label: string; value: number; bad?: boolean };

export type WorkflowRun = {
  id: string;
  number: number;
  workflowName: string;
  status: RunStatus;
  /** When the run started — anything fmtDateTime accepts. */
  started: DateInput;
  duration?: string;
  /** Provenance for auto-started runs; omit for manual runs. */
  triggeredBy?: string;
  /** Dry run — transforms execute but side effects become previews. */
  dry?: boolean;
  /** Per-step timeline; may be empty if the log wasn't retained. */
  rows?: RunStepRow[];
  /** Recorded outcome counters shown in the run panel. */
  stats?: RunStat[];
  /** One-line result summary for the history table. */
  headline?: string;
};
