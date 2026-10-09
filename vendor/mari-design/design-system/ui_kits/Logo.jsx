/* Mari logo — schematic "M" mark (Brutalist Blueprint) + lowercase wordmark.
   Mirrors web/public/assets/mari-mark.svg. Sharp corners, ink lines,
   biscay center node. Use `mark="paper"` on dark backgrounds. */
function Logo({ size = 28, withWord = true, mark = "ink" }) {
  const px = size;
  const line = mark === "paper" ? "rgb(var(--c-paper))" : "rgb(var(--c-ink))";
  const node = mark === "paper" ? "rgb(var(--c-espelette))" : "rgb(var(--c-biscay))";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.42 }}>
      <svg xmlns="http://www.w3.org/2000/svg" width={px} height={px} viewBox="0 0 32 32">
        <rect x="1" y="1" width="30" height="30" fill="none" stroke={line} strokeWidth="2" />
        <path d="M7 25V9l9 9 9-9v16" fill="none" stroke={line} strokeWidth="2.4" strokeLinejoin="miter" />
        <rect x="5" y="7" width="4" height="4" fill={line} />
        <rect x="23" y="7" width="4" height="4" fill={line} />
        <rect x="5" y="23" width="4" height="4" fill={line} />
        <rect x="23" y="23" width="4" height="4" fill={line} />
        <rect x="14" y="16" width="4" height="4" fill={node} />
      </svg>
      {withWord && (
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: px * 0.92, letterSpacing: "-0.03em", lineHeight: 1, color: line }}>
          mari
        </span>
      )}
    </div>
  );
}

window.Logo = Logo;
