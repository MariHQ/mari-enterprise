import type { ChipStatus } from "../data-display/Chip";

/* The one run-status vocabulary (XA-25, X2, CONVENTIONS §4).
 *
 * `Chip.tsx` declares StatusChip "the single source of truth for every status
 * pill in the console", and then four separate maps translated engine words
 * into it independently: `CHIP_OF` (workflow/RunHistory), `RUN_CHIP` and
 * `OUTCOME_STATUS` (both on the since-removed Flows surfaces) and `SCAN_CHIP`
 * (features/ScanRunCard). They disagreed, and the disagreement was visible in
 * the two places a user compares:
 *
 *   - A finished run was "Approved" in Flows and "Succeeded" in Facts,
 *     Decisions and Audit. Approval is a GATE outcome — a person said yes.
 *     A run that finished its steps succeeded whether or not anyone approved
 *     anything, so `passed` maps to `succeeded` everywhere and `approved`
 *     goes back to meaning only what it says.
 *   - Failure had five spellings and completion four. Both now have one.
 *
 * `RUN_STATUS_CHIP` is the map for the engine's own six-value enum.
 * `runStatusChip` is for surfaces handed a raw string (an outcome word off
 * the wire), and returns undefined for a word the vocabulary does not know
 * so the caller can render it verbatim rather than guess a state for it. */

export type RunStatus = "passed" | "running" | "waiting" | "failed" | "skipped" | "pending";

export const RUN_STATUS_CHIP: Record<RunStatus, ChipStatus> = {
  passed: "succeeded",
  running: "running",
  waiting: "needs-review",
  failed: "failed",
  skipped: "skipped",
  pending: "queued",
};

/* Every spelling the engines and connectors actually emit, folded onto the six
   above. Anything absent is deliberately absent: an unrecognised outcome word
   must render as itself, never as the nearest-looking state. */
const ALIAS: Record<string, RunStatus> = {
  // completion — was "passed" / "succeeded" / "success" / "ok" / "complete"
  passed: "passed", pass: "passed", succeeded: "passed", success: "passed",
  ok: "passed", complete: "passed", completed: "passed", done: "passed",
  // failure — was "failed" / "error" / "failure" / "errored" / "cancelled"
  failed: "failed", failure: "failed", error: "failed", errored: "failed",
  cancelled: "failed", canceled: "failed",
  // in flight
  running: "running", active: "running", "in-progress": "running",
  // blocked on a person
  waiting: "waiting", blocked: "waiting", "needs-approval": "waiting",
  // not started / not run
  pending: "pending", queued: "pending",
  skipped: "skipped",
};

/** Fold a raw outcome word onto the console's run vocabulary. */
export function toRunStatus(raw: string): RunStatus | undefined {
  return ALIAS[raw.trim().toLowerCase()];
}

/** Fold a raw outcome word straight onto its chip. Undefined = unknown word,
    which the caller renders verbatim in a neutral chip. */
export function runStatusChip(raw: string): ChipStatus | undefined {
  const s = toRunStatus(raw);
  return s && RUN_STATUS_CHIP[s];
}
