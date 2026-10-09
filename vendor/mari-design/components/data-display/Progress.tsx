import { useId } from "react";
import * as RP from "@radix-ui/react-progress";

export type ProgressTone = "ok" | "attention" | "blocked" | "info";

const FILL: Record<ProgressTone, string> = {
  ok: "bg-moss",
  attention: "bg-clay",
  blocked: "bg-espelette",
  info: "bg-biscay-2",
};

/* Determinate linear progress — distinct from Spinner (indeterminate) and
   Stepper (discrete steps). For an import/sync percentage. */
export function Progress({
  value, label, tone = "info", active = false, "aria-label": ariaLabel,
}: {
  value: number;
  label?: string;
  tone?: ProgressTone;
  /** The job is still working. A long model pass can hold one percentage for
      minutes, and a bar that does not move is indistinguishable from a bar
      whose job died — the pulse is the difference between the two. */
  active?: boolean;
  /** Name for a bar drawn without a visible `label`. */
  "aria-label"?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const labelId = useId();
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span id={labelId} className="text-[12.5px] text-ink/80">{label}</span>
          {/* ACC-05: a bar that fills as a job runs said nothing while it did.
              Screen readers do not announce a progressbar's value as it
              changes, so the percentage readout is the announcement — polite,
              so it queues behind whatever the user is doing rather than
              interrupting it. */}
          <span role="status" aria-live="polite" className="min-w-0 [overflow-wrap:anywhere] font-term text-[11px] text-ink/70">{Math.round(v)}%</span>
        </div>
      )}
      {/* ACC-06: the `label` was a detached sibling <span>, so every bar in the
          console was an anonymous "progressbar" — the one thing on screen that
          says which job is running had no connection to the job. */}
      <RP.Root
        value={v}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : (ariaLabel ?? "Progress")}
        aria-valuetext={`${Math.round(v)}%`}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]"
      >
        <RP.Indicator
          className={`h-full ${FILL[tone]} transition-transform duration-300${active ? " motion-safe:animate-pulse" : ""}`}
          style={{ transform: `translateX(-${100 - v}%)` }}
        />
      </RP.Root>
    </div>
  );
}
