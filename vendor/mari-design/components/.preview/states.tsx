import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Toaster } from "../feedback/Toast";
import { COMPONENT_STATES } from "./states/index";

/* Isolated component-state renderer — the component-level twin of render.html.
     ?comp=<id>&state=<id>   render exactly one state, at that state's width
     ?list=1                 expose the whole matrix for the shot tool
   Every component declares its own states (default, loading, empty, error,
   disabled, selected, and the overflow/long-content cases) in .preview/states/. */

const q = new URLSearchParams(location.search);

if (q.has("list")) {
  const merged = new Map<string, { id: string; title: string; states: unknown[] }>();
  for (const c of COMPONENT_STATES) {
    const entry = merged.get(c.id) ?? { id: c.id, title: c.title, states: [] };
    entry.states.push(...c.states.map((s) => ({ id: s.id, label: s.label, width: s.width ?? c.width ?? 720 })));
    merged.set(c.id, entry);
  }
  (window as unknown as { __STATES__: unknown }).__STATES__ = [...merged.values()];
  document.body.dataset.ready = "1";
}

// Group files may each declare a spec for the same component id; pick the one
// that actually holds the requested state, else fall back to the first match.
const compId = q.get("comp");
const stateId = q.get("state");
const spec =
  COMPONENT_STATES.find((c) => c.id === compId && c.states.some((s) => s.id === stateId)) ??
  COMPONENT_STATES.find((c) => c.id === compId);
const state = spec?.states.find((s) => s.id === stateId);
const width = state?.width ?? spec?.width ?? 720;

function Ready() {
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => { document.body.dataset.ready = "1"; }));
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

function Frame() {
  if (!spec || !state) {
    return <div style={{ padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      unknown: comp={q.get("comp")} state={q.get("state")}
    </div>;
  }
  // overflowX clip = the frame stays exactly `width`, so overflowing content
  // shows as clipped (a real bug) instead of silently widening the capture.
  return (
    <div style={{ width, padding: 16, overflowX: "clip" }} className="bg-paper text-ink">
      {state.node}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><Toaster><Frame /><Ready /></Toaster></StrictMode>,
);
