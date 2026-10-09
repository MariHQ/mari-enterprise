import type { SVGProps } from "react";

/* Brandmark — the canonical stroked M (the landing page's Mark), in
   currentColor so it reads on the dark biscay sidebar (light stroke) or a
   light page (ink stroke) alike. The corner squares are the blueprint
   "data point" idiom; the centre square sits at reduced opacity instead of
   a fixed brand blue so the mark stays one-colour on any surface. The
   previous cloud glyph was the retired Mari Cloud identity redrawn, and it
   kept the old brand alive in every sidebar (Eric, 2026-08-25). */
export function Brandmark({ size = 28, ...rest }: { size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
      {...rest}
    >
      <path d="M4 27 V7 L16 18 L28 7 V27" />
      <rect x="2.2" y="5.2" width="3.6" height="3.6" fill="currentColor" stroke="none" />
      <rect x="14.2" y="16.2" width="3.6" height="3.6" fill="currentColor" stroke="none" opacity={0.55} />
      <rect x="26.2" y="5.2" width="3.6" height="3.6" fill="currentColor" stroke="none" />
      <rect x="2.2" y="25.2" width="3.6" height="3.6" fill="currentColor" stroke="none" />
      <rect x="26.2" y="25.2" width="3.6" height="3.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export type LogoProps = {
  /** Mark height in px. */
  size?: number;
  /** Wordmark text; pass `false` to render the mark only. */
  wordmark?: string | false;
  className?: string;
};

/* Full lockup — mark + wordmark. `color` inherits, so it works on any
   surface. Drop it in the HeaderBar brand slot or the Sidebar header. */
export function Logo({ size = 26, wordmark = "Mari", className = "" }: LogoProps) {
  return (
    <span className={["inline-flex items-center gap-2 text-current", className].filter(Boolean).join(" ")}>
      <Brandmark size={size} />
      {wordmark !== false && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.01em]">{wordmark}</span>
      )}
    </span>
  );
}
