import type { CSSProperties, ReactNode } from "react";

export type IconRingTone = "ink" | "ok" | "attention" | "blocked" | "info";

const TONE: Record<IconRingTone, string> = {
  ink: "border-ink/25 text-ink/80",
  ok: "border-moss/35 text-moss",
  attention: "border-clay/35 text-clay",
  blocked: "border-espelette/35 text-espelette",
  info: "border-biscay-2/35 text-biscay-2",
};

/* A circle around an icon — card heads, notifications, feed rows. */
export function IconRing({
  tone = "ink", size = 31, children, className = "",
}: {
  tone?: IconRingTone;
  /** Diameter in px; defaults to the canonical 31. */
  size?: number;
  children: ReactNode;
  className?: string;
}) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <span style={style} aria-hidden="true" className={`grid place-items-center shrink-0 rounded-full border ${TONE[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}
