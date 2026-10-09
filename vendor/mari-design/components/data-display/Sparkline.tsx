const COLOR: Record<"ok" | "attention" | "blocked" | "info" | "neutral", string> = {
  ok: "#2C6E49",
  attention: "#A05E1C",
  blocked: "#B23A1E",
  info: "#1E6FA8",
  neutral: "#10263BB3",
};

/* Small inline trend line for compact readouts (answers served/week, source
   pulse). Tone follows the same 5-tone scale as Badge/Chip/Stat. */
export function Sparkline({ values, width = 92, height = 26, tone = "ok" }: {
  values: number[];
  width?: number;
  height?: number;
  tone?: keyof typeof COLOR;
}) {
  if (values.length < 2) return null;
  /* A year of hourly samples is 8,760 points drawn into 92 pixels: the SVG
     path string dwarfs the component and every point lands on the same pixel.
     Bucket-average down to at most one point per 2px instead. */
  const cap = Math.max(2, Math.floor(width / 2));
  const pts0 =
    values.length <= cap
      ? values
      : Array.from({ length: cap }, (_, i) => {
          const a = Math.floor((i * values.length) / cap);
          const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / cap));
          const slice = values.slice(a, b);
          return slice.reduce((n, v) => n + v, 0) / slice.length;
        });
  const max = Math.max(...pts0, 1);
  const pts = pts0.map((v, i) => `${(i / (pts0.length - 1)) * (width - 4) + 2},${height - 3 - (v / max) * (height - 8)}`);
  return (
    <svg width={width} height={height} aria-hidden style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={COLOR[tone]} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
