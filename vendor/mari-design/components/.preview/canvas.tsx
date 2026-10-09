import { StrictMode, useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";

/* Figma-like infinite canvas of prerendered page frames. Reads
   /canvas/manifest.json (produced by scripts/prerender.mjs) and lays every
   page × state × view frame onto a pannable/zoomable plane. Only frames that
   intersect the viewport are mounted, so the DOM stays small no matter how
   many frames exist. Trackpad: pinch to zoom, two-finger drag to pan; you can
   also drag the background. */

type Frame = {
  file: string; page: string; pageTitle: string; row: number;
  state: string; stateLabel: string; view: "desktop" | "mobile";
  x: number; y: number; w: number; h: number;
  /** Set when this frame belongs to an alternative flow stacked below the
      page's main line (e.g. "connect-github"). Null on the main line. */
  flow?: string | null;
  flowLabel?: string | null;
  /** On the first frame of a branch: the elbow back to its decision point. */
  branchFrom?: { x: number; y: number; toX: number; toY: number } | null;
};
type PageRow = { id: string; title: string; route: string; row: number; y: number };
type Manifest = { generatedFrames: number; pages: PageRow[]; frames: Frame[] };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** One caption per stacked alternative-flow line. */
type FlowLine = { page: string; flow: string; flowLabel: string; x: number; y: number; count: number };
function flowLinesOf(frames: Frame[]): FlowLine[] {
  const byKey = new Map<string, FlowLine>();
  for (const f of frames) {
    if (!f.flow || !f.flowLabel) continue;
    const key = `${f.page}:${f.flow}:${f.y}`;
    const e = byKey.get(key);
    if (e) { if (f.view === "desktop") e.count++; e.x = Math.min(e.x, f.x); continue; }
    byKey.set(key, { page: f.page, flow: f.flow, flowLabel: f.flowLabel, x: f.x, y: f.y, count: f.view === "desktop" ? 1 : 0 });
  }
  return [...byKey.values()];
}

function useManifest() {
  const [data, setData] = useState<Manifest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("./canvas/manifest.json", { cache: "no-cache" })
      .then((r) => { if (!r.ok) throw new Error(`manifest ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);
  return { data, err };
}

function Canvas({ data }: { data: Manifest }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [t, setT] = useState({ k: 0.18, x: 80, y: 60 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const downAt = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  // Bounds of all content, to frame the initial view.
  useLayoutEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Deep link: ?at=<pageId>[&k=<scale>] frames a page block on load, so a page
  // (and its stacked alternative-flow lines) can be linked to directly.
  useLayoutEffect(() => {
    const q = new URLSearchParams(location.search);
    const at = q.get("at");
    if (!at) return;
    const page = data.pages.find((p) => p.id === at);
    if (!page) return;
    const k = clamp(Number(q.get("k")) || 0.3, 0.03, 4);
    // Frame the page block: its label sits ~140px above the first frame row.
    setT({ k, x: 60, y: -(page.y - 200) * k + 40 });
  }, [data.pages]);

  // Wheel: ctrl/⌘ (or trackpad pinch) → zoom about cursor; else pan.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setT((prev) => {
        if (e.ctrlKey || e.metaKey) {
          const factor = Math.exp(-e.deltaY * 0.01);
          const k = clamp(prev.k * factor, 0.03, 4);
          return { k, x: cx - ((cx - prev.x) / prev.k) * k, y: cy - ((cy - prev.y) / prev.k) * k };
        }
        return { ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    downAt.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    if (Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) > 4) moved.current = true;
    setT((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
  }, []);
  const onPointerUp = useCallback(() => { drag.current = null; }, []);

  // Open the live, full-screen standalone render of a frame — unless the
  // pointer was dragging (panning the canvas).
  const openFrame = useCallback((f: Frame) => {
    if (moved.current) return;
    const url = `./render.html?page=${encodeURIComponent(f.page)}&state=${encodeURIComponent(f.state)}&view=${f.view}&full=1`;
    window.open(url, "_blank", "noopener");
  }, []);

  const zoomTo = (k: number) => setT((p) => {
    const cx = vp.w / 2, cy = vp.h / 2;
    return { k, x: cx - ((cx - p.x) / p.k) * k, y: cy - ((cy - p.y) / p.k) * k };
  });

  const fitAll = useCallback(() => {
    const fr = data.frames;
    if (!fr.length) return;
    const maxX = Math.max(...fr.map((f) => f.x + f.w));
    const maxY = Math.max(...fr.map((f) => f.y + f.h));
    const k = clamp(Math.min((vp.w - 120) / maxX, (vp.h - 120) / maxY), 0.03, 1);
    setT({ k, x: 60, y: 60 });
  }, [data, vp]);

  // Fit the whole board on load, unless a ?at= deep link asked for a page.
  const deepLinked = useRef(new URLSearchParams(location.search).has("at"));
  useEffect(() => {
    if (deepLinked.current) { deepLinked.current = false; return; }
    fitAll();
  }, [fitAll]);

  // Visible plane rect (+ margin) for virtualization.
  const margin = 600;
  const minPX = (-t.x) / t.k - margin;
  const minPY = (-t.y) / t.k - margin;
  const maxPX = (vp.w - t.x) / t.k + margin;
  const maxPY = (vp.h - t.y) / t.k + margin;
  const visible = data.frames.filter(
    (f) => f.x < maxPX && f.x + f.w > minPX && f.y < maxPY && f.y + f.h > minPY,
  );
  // Captions are cheap; derive them from the frames currently on screen.
  const flowLines = flowLinesOf(visible);

  return (
    <div
      ref={ref}
      className="canvas-vp"
      style={{ position: "fixed", inset: 0, cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}>
        {/* Row (page) labels */}
        {data.pages.map((p) => (
          <div key={p.id} style={{ position: "absolute", left: 0, top: p.y - 78, width: 1200 }}>
            <div style={{ font: "700 40px ui-sans-serif, system-ui", color: "#10263B" }}>{p.title}</div>
            <div style={{ font: "500 22px ui-monospace, monospace", color: "#10263B80", marginTop: 4 }}>{p.route}</div>
          </div>
        ))}
        {/* Branch connectors: an elbow from the decision point down to the
            first frame of the branch, so the split is obvious at any zoom. */}
        <svg
          style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
          width={1}
          height={1}
          aria-hidden
        >
          {visible.filter((f) => f.branchFrom).map((f) => {
            const b = f.branchFrom!;
            const midY = b.y + (b.toY - b.y) / 2;
            return (
              <g key={`b:${f.file}`}>
                <path
                  d={`M ${b.x} ${b.y} L ${b.x} ${midY} L ${b.toX} ${midY} L ${b.toX} ${b.toY}`}
                  fill="none"
                  stroke="#1E6FA8"
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="18 14"
                  opacity={0.55}
                />
                <circle cx={b.x} cy={b.y} r={12} fill="#1E6FA8" opacity={0.75} />
                <path
                  d={`M ${b.toX - 14} ${b.toY - 22} L ${b.toX} ${b.toY - 4} L ${b.toX + 14} ${b.toY - 22}`}
                  fill="none" stroke="#1E6FA8" strokeWidth={6}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.75}
                />
              </g>
            );
          })}
        </svg>
        {/* Captions for the alternative-flow lines stacked under each page.
            One per (page, flow, line-y), drawn to the left of the first frame. */}
        {flowLines.map((l) => (
          <div key={`${l.page}:${l.flow}:${l.y}`} style={{ position: "absolute", left: l.x, top: l.y - 96, width: 1400 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ font: "700 26px ui-monospace, monospace", color: "#1E6FA8" }}>↳</span>
              <span style={{ font: "700 26px ui-sans-serif, system-ui", color: "#1E6FA8" }}>{l.flowLabel}</span>
              <span style={{ font: "500 20px ui-monospace, monospace", color: "#10263B66" }}>
                alternative flow · {l.count} {l.count === 1 ? "step" : "steps"}
              </span>
            </div>
          </div>
        ))}
        {/* Frames — click to open the live full-screen page */}
        {visible.map((f) => (
          <div
            key={f.file}
            className="frame-hit"
            onClick={() => openFrame(f)}
            title={`${f.pageTitle} · ${f.stateLabel} · ${f.view} — click to open full screen`}
            style={{ position: "absolute", left: f.x, top: f.y, width: f.w, height: f.h, cursor: "pointer" }}
          >
            <div style={{ position: "absolute", left: 0, top: -34, font: "600 20px ui-monospace, monospace", color: "#10263B99", whiteSpace: "nowrap" }}>
              {f.view === "mobile" ? "▯ " : "▭ "}{f.stateLabel}
            </div>
            <img
              src={`./canvas/${f.file}`}
              width={f.w}
              height={f.h}
              loading="lazy"
              decoding="async"
              draggable={false}
              alt={`${f.pageTitle} · ${f.stateLabel} · ${f.view}`}
              style={{ display: "block", width: f.w, height: f.h, background: "#fff", borderRadius: 10, border: "1px solid #10263B26", boxShadow: "0 12px 40px -12px #10263B40" }}
            />
            <span className="frame-open">Open ↗</span>
          </div>
        ))}
      </div>

      {/* HUD */}
      <div style={{ position: "fixed", left: 16, top: 16, display: "flex", gap: 8, alignItems: "center", background: "#fff", border: "1px solid #10263B22", borderRadius: 10, padding: "8px 12px", boxShadow: "0 8px 24px -12px #10263B40", font: "500 13px ui-sans-serif, system-ui", color: "#10263B" }}>
        <b style={{ letterSpacing: 1, textTransform: "uppercase", fontSize: 11, color: "#B23A1E" }}>Mari</b>
        <span style={{ color: "#10263B99" }}>Page canvas — {data.generatedFrames} frames · {data.pages.length} pages</span>
        <span style={{ width: 1, height: 16, background: "#10263B22" }} />
        <button onClick={() => zoomTo(clamp(t.k * 1.3, 0.03, 4))} style={hudBtn}>+</button>
        <button onClick={() => zoomTo(clamp(t.k / 1.3, 0.03, 4))} style={hudBtn}>−</button>
        <span style={{ width: 44, textAlign: "center", color: "#10263B99" }}>{Math.round(t.k * 100)}%</span>
        <button onClick={fitAll} style={hudBtn}>Fit</button>
        <a href="./index.html" style={{ ...hudBtn, textDecoration: "none", color: "#1E6FA8" }}>Components</a>
      </div>
      <div style={{ position: "fixed", right: 16, bottom: 16, font: "500 12px ui-sans-serif, system-ui", color: "#10263B80", background: "#ffffffcc", borderRadius: 8, padding: "6px 10px" }}>
        pinch to zoom · two-finger drag to pan · drag background to move
      </div>
    </div>
  );
}

const hudBtn: React.CSSProperties = {
  border: "1px solid #10263B22", background: "#fff", borderRadius: 6,
  padding: "3px 9px", cursor: "pointer", font: "600 13px ui-sans-serif", color: "#10263B",
};

function App() {
  const { data, err } = useManifest();
  if (err) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", font: "500 14px ui-sans-serif", color: "#10263B", textAlign: "center", padding: 24 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>No canvas manifest yet</div>
          <div style={{ color: "#10263B99" }}>Run <code>npm run prerender</code> to generate the page frames.<br />({err})</div>
        </div>
      </div>
    );
  }
  if (!data) return <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", font: "500 14px ui-sans-serif", color: "#10263B99" }}>Loading canvas…</div>;
  return <Canvas data={data} />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
