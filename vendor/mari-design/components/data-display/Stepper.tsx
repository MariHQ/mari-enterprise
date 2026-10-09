/* The one stepper — numbered steps with a top rule that fills in as you
   complete each one. Omit onSelect to render a read-only stepper. */
export function Stepper({
  labels, current, onSelect, ariaLabel = "Progress",
}: {
  labels: string[];
  current: number;
  onSelect?: (step: number) => void;
  ariaLabel?: string;
}) {
  return (
    <ol aria-label={ariaLabel} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
      {labels.map((label, index) => {
        const state = index === current ? "active" : index < current ? "complete" : "upcoming";
        return (
          <li key={label} className="min-w-0">
            <button
              type="button"
              onClick={onSelect ? () => onSelect(index) : undefined}
              aria-current={index === current ? "step" : undefined}
              className={`w-full min-w-0 flex flex-col items-center gap-1.5 pt-2.5 border-t-2 ${
                state === "active" ? "border-biscay" : state === "complete" ? "border-moss" : "border-ink/15"
              } ${onSelect ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`grid place-items-center w-6 h-6 rounded-full font-term text-[11px] font-medium ${
                  state === "active" ? "bg-biscay text-white" : state === "complete" ? "bg-moss text-white" : "bg-ink/[0.08] text-ink/70"
                }`}
              >
                {state === "complete" ? "✓" : index + 1}
              </span>
              {/* w-full, not just min-w-0: a long single-word label must be constrained
                  so it breaks instead of overflowing into the next step. */}
              <span className={`w-full break-words text-center text-[11.5px] font-medium ${state === "upcoming" ? "text-ink/70" : "text-ink"}`}>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
