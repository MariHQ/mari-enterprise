import type { ReactNode } from "react";
import { focusRing } from "../tokens/focusRing";

/* A small color swatch — token displays, harvested brand-color candidates.
   Pass onClick to make it a pickable button. */
export function Swatch({
  color, label, selected = false, onClick, title, className = "",
}: {
  /** Any CSS color (hex or var()). */
  color: string;
  label?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const shared = `inline-flex items-center gap-2 rounded-[4px] border px-2 py-1.5 ${selected ? "border-biscay-2 ring-1 ring-biscay-2" : "border-ink/20"} ${className}`.trim();
  const body = (
    <>
      <span className="w-4 h-4 rounded-[3px] border border-ink/15 shrink-0" style={{ background: color }} aria-hidden="true" />
      {label && <span className="font-term text-[12px] text-ink/80">{label}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title ?? String(color)} aria-pressed={selected} className={`${shared} ${focusRing}`}>
        {body}
      </button>
    );
  }
  return <span className={shared} title={title ?? String(color)}>{body}</span>;
}
