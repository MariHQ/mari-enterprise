import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Toaster } from "../feedback/Toast";
import { PAGES } from "../pages";
import { setStaticFrame } from "../pages/PageFrame";
import { FIXTURES, fixtureFor } from "./fixtures";

/* Single-page renderer. URL params:
     ?page=<id>&state=<id>&view=desktop|mobile   → a fixed-device-size static
       frame for the prerender pipeline (animations frozen, full height).
     &full=1                                     → a live, interactive
       full-viewport view (the "open full screen" target from the canvas). */

const params = new URLSearchParams(location.search);
const pageId = params.get("page") ?? "";
const stateId = params.get("state") ?? "default";
const view = params.get("view") === "mobile" ? "mobile" : "desktop";
const isFull = params.has("full");

// Screenshot frames grow to full content height (static frame); the live
// full-screen view uses the normal app shell (internal scroll).
setStaticFrame(!isFull);

// Freeze animations/caret only for screenshots — keep them live in full view.
if (!isFull) {
  const s = document.createElement("style");
  s.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
  document.head.appendChild(s);
}

const SIZES = { desktop: { w: 1440, h: 900 }, mobile: { w: 390, h: 844 } } as const;
const { w, h } = SIZES[view];

// Enumeration mode for the prerender script: expose every frame combo.
if (params.has("list")) {
  const views = ["desktop", "mobile"] as const;
  (window as unknown as { __FRAMES__: unknown }).__FRAMES__ = PAGES.flatMap((p, row) =>
    p.states.flatMap((s) =>
      views.map((v) => ({ page: p.id, pageTitle: p.title, row, state: s.id, stateLabel: s.label, view: v })),
    ),
  );
  (window as unknown as { __PAGES__: unknown }).__PAGES__ = PAGES.map((p, row) => ({ id: p.id, title: p.title, route: p.route, row }));
  document.body.dataset.ready = "1";
}

const mod = PAGES.find((p) => p.id === pageId);

function Ready() {
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => { document.body.dataset.ready = "1"; }),
    );
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

/* Floating "back to the board" control on the full-screen view. Closes the
   tab if the canvas opened it (window.opener), otherwise navigates back. */
function BackToCanvas() {
  const onClick = () => {
    if (window.opener) window.close();
    else window.location.href = "./canvas.html";
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClick(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <button
      onClick={onClick}
      title="Back to the page canvas (Esc)"
      style={{
        position: "fixed", left: 16, bottom: 16, zIndex: 99999,
        display: "inline-flex", alignItems: "center", gap: 8,
        font: "600 13px ui-sans-serif, system-ui", color: "#fff",
        background: "#10263B", border: "none", borderRadius: 999,
        padding: "9px 16px", cursor: "pointer", boxShadow: "0 10px 30px -8px #10263B99",
      }}
    >
      ← Canvas
    </button>
  );
}

function Frame() {
  if (!mod) {
    return <div style={{ padding: 24, fontFamily: "monospace" }}>Unknown page: {pageId || "(none)"}</div>;
  }
  const Cmp = mod.component;

  // Pages hold no demo data (MIGRATION.md): the canvas is just another caller,
  // and it supplies content from the fixture registry. A page+state with no
  // fixture is a real authoring gap, so say so rather than rendering blank.
  const fx = fixtureFor(FIXTURES, mod.id, stateId);
  if (!fx) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        No fixture for {mod.id}/{stateId} — add it to .preview/fixtures/{mod.id}.ts
      </div>
    );
  }
  const props = { data: fx.data, loading: fx.loading, error: fx.error };

  // Live full-screen view: fill the viewport (desktop responsive; mobile shown
  // as a centered 390px device column on a dark backdrop).
  if (isFull) {
    if (view === "mobile") {
      return (
        <div style={{ width: "100vw", height: "100vh", display: "grid", placeItems: "center", background: "#0e2032" }}>
          <div style={{ width: 390, height: "min(880px, 100vh)", overflow: "hidden", borderRadius: 22, border: "8px solid #0a1826", boxShadow: "0 30px 80px -20px #000" }} className="bg-paper text-ink">
            <Cmp {...props} mobile />
          </div>
          <BackToCanvas />
        </div>
      );
    }
    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }} className="bg-paper text-ink">
        <Cmp {...props} mobile={false} />
        <BackToCanvas />
      </div>
    );
  }

  // Screenshot frame: fixed device width, min-height = device height but free
  // to grow taller so the full page is captured. overflowX:"clip" keeps the
  // frame exactly device-width (like a Figma frame), so horizontal overflow
  // shows as content cut off at the edge instead of widening (and squishing)
  // the screenshot. (`clip` on x with default-visible y does NOT create a
  // vertical scroll container, so the full-height capture still works.)
  return (
    <div style={{ width: w, minHeight: h, overflowX: "clip" }} className="bg-paper text-ink">
      <Cmp {...props} mobile={view === "mobile"} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster>
      <Frame />
      <Ready />
    </Toaster>
  </StrictMode>,
);
