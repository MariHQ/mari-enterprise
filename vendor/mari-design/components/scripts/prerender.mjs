// Prerender pipeline: screenshot every page × state × view (FULL page height)
// into images the infinite canvas displays. Runs against a `vite preview`
// server of the built dist so the render route + code-split chunks resolve
// exactly as deployed.
//
//   node scripts/prerender.mjs
//
// Output: .preview/public/canvas/<page>__<state>__<view>.jpg + manifest.json
// (a subsequent `vite build` copies public/canvas/* into dist/canvas/).
//
// Fast: a pool of browser pages captures frames concurrently, `waitUntil:load`
// + a `body[data-ready]` flag instead of networkidle, and JPEG encoding (much
// faster than PNG for tall full-page shots, and far smaller to upload/load).

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, ".preview/public/canvas");
const PORT = 4318;
const BASE = `http://localhost:${PORT}`;
const CONCURRENCY = Math.max(2, Math.min(8, (os.cpus()?.length || 4) - 1));
const JPEG_QUALITY = 88;
// Decoded-pixel budget per frame. Browsers subsample bitmaps past their decode
// limits, which renders on the canvas as a squished frame; staying under this
// keeps every frame pixel-exact.
const MAX_FRAME_PX = 16_000_000;

const SIZES = { desktop: { w: 1440, h: 900 }, mobile: { w: 390, h: 844 } };

// Canvas layout constants (native px on the plane). The board reads as a flow
// diagram, so it is deliberately airy: tight packing made a branch look like
// the next step in the same sequence.
const FRAME_GAP = 120;
const MOBILE_GAP = 220;
const ROW_GAP = 420;
const TOP_PAD = 180;
// Vertical gap between the stacked lines inside one page block.
const LINE_GAP = 240;
// Extra room above a branch line, which carries its own caption and a
// connector elbow drawn up to its decision point.
const FLOW_GAP = 340;

// Lifecycle states are variations on the current screen, not steps in the
// journey, so they never count as the decision point a branch hangs off.
const LIFECYCLE = new Set(["loading", "error", "empty", "overflow", "stress", "skeleton"]);

/** "connect-github" -> "Connect github flow" caption for a stacked flow line. */
function flowTitle(key) {
  const words = key.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function waitForServer(url, tries = 60) {
  return new Promise((res, rej) => {
    const tick = async (n) => {
      try {
        const r = await fetch(url);
        if (r.ok || r.status === 404) return res();
      } catch {}
      if (n <= 0) return rej(new Error("server did not start"));
      setTimeout(() => tick(n - 1), 500);
    };
    tick(tries);
  });
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT, stdio: "ignore", env: process.env,
  });
  const cleanup = () => { try { server.kill("SIGKILL"); } catch {} };
  process.on("exit", cleanup);

  try {
    await waitForServer(`${BASE}/render.html`);
    /* Headless Chrome is launched with `--hide-scrollbars`, which suppresses
       EVERY scrollbar in the frame — including the ones Scrollable styles into
       existence with ::-webkit-scrollbar. So a table, tab row or breadcrumb
       that scrolls correctly (CONVENTIONS §20) photographed as content sliced
       at a card edge with no affordance at all, and a visual review of these
       frames reported that as a clipping bug on six pages. The frames have to
       show what a real browser shows. */
    const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
    // Desktop at 1x (its tall frames would blow past browser image-size limits
    // at 2x); mobile at 2x DPR so the small 390px frames stay crisp when zoomed
    // in on the canvas (manifest stays CSS px — the image just carries 2x
    // pixels, i.e. retina).
    const ctxByView = {
      desktop: await browser.newContext({ deviceScaleFactor: 1 }),
      mobile: await browser.newContext({ deviceScaleFactor: 2 }),
      // Fallback for very tall mobile frames: past roughly 16MP a browser
      // subsamples the decoded bitmap, which shows up on the canvas as a
      // squished/blurry frame. Those frames are captured at 1x instead, so
      // they stay geometrically correct (just not retina).
      mobile1x: await browser.newContext({ deviceScaleFactor: 1 }),
    };
    const ctx = ctxByView.desktop;

    // Enumerate frames from the registry.
    const listPage = await ctx.newPage();
    await listPage.goto(`${BASE}/render.html?list=1`, { waitUntil: "load" });
    const frames = await listPage.evaluate(() => window.__FRAMES__);
    const pages = await listPage.evaluate(() => window.__PAGES__);
    await listPage.close();
    if (!frames?.length) throw new Error("no frames enumerated — is the registry empty?");
    console.log(`Prerendering ${frames.length} frames across ${pages.length} pages with ${CONCURRENCY} workers…`);

    const ordered = [...frames].sort((a, b) =>
      a.row - b.row || (a.view === b.view ? 0 : a.view === "desktop" ? -1 : 1),
    );

    // Worker pool: each page pulls frames off a shared cursor.
    const results = new Array(ordered.length);
    let cursor = 0;
    let done = 0;
    async function worker() {
      // One page per view (each from its own DPR context).
      const pageByView = {
        desktop: await ctxByView.desktop.newPage(),
        mobile: await ctxByView.mobile.newPage(),
        mobile1x: await ctxByView.mobile1x.newPage(),
      };
      for (;;) {
        const i = cursor++;
        if (i >= ordered.length) break;
        const f = ordered[i];
        const p = pageByView[f.view];
        const { w, h: devH } = SIZES[f.view];
        const file = `${f.page}__${f.state}__${f.view}.jpg`;
        const url = `${BASE}/render.html?page=${encodeURIComponent(f.page)}&state=${encodeURIComponent(f.state)}&view=${f.view}`;
        await p.setViewportSize({ width: w, height: devH });
        await p.goto(url, { waitUntil: "load" });
        await p.waitForSelector("body[data-ready]", { timeout: 15000 }).catch(() => {});
        await p.waitForTimeout(120);
        let fullH = Math.max(devH, await p.evaluate(() =>
          Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        ));

        // Re-shoot oversized retina mobile frames at 1x so the browser never
        // subsamples them (see MAX_FRAME_PX).
        let shooter = p;
        if (f.view === "mobile" && w * fullH * 4 > MAX_FRAME_PX) {
          shooter = pageByView.mobile1x;
          await shooter.setViewportSize({ width: w, height: devH });
          await shooter.goto(url, { waitUntil: "load" });
          await shooter.waitForSelector("body[data-ready]", { timeout: 15000 }).catch(() => {});
          await shooter.waitForTimeout(120);
          fullH = Math.max(devH, await shooter.evaluate(() =>
            Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
          ));
        }
        await shooter.screenshot({ path: resolve(OUT_DIR, file), fullPage: true, type: "jpeg", quality: JPEG_QUALITY });
        results[i] = {
          file, page: f.page, pageTitle: f.pageTitle, row: f.row,
          state: f.state, stateLabel: f.stateLabel, view: f.view, w, h: fullH,
        };
        done++;
        if (done % 25 === 0) process.stdout.write(`${done}/${ordered.length} `);
      }
      await pageByView.desktop.close();
      await pageByView.mobile.close();
      await pageByView.mobile1x.close();
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    process.stdout.write("\n");

    const captured = results.filter(Boolean);

    // Layout: one row per page, desktop states then mobile states; rows stack
    // with cumulative (variable) heights.
    const byRow = new Map();
    for (const c of captured) {
      if (!byRow.has(c.row)) byRow.set(c.row, []);
      byRow.get(c.row).push(c);
    }
    const rows = [...byRow.keys()].sort((a, b) => a - b);
    let y = TOP_PAD;
    const pagesOut = [];
    for (const r of rows) {
      const list = byRow.get(r);

      // Split a page's states into LINES so branching is legible:
      //   line 0        the page's main path (default plus its lifecycle
      //                 states: loading, error, empty, overflow, stress)
      //   lines 1..n    one per alternative flow, stacked directly beneath
      //                 the main line, so you can read a branch top-to-bottom
      //                 instead of scanning one very long horizontal strip.
      // A flow is a set of 2+ states sharing a prefix before the first "-"
      // (e.g. connect-github-configure / -sync / -done, or harvest-*).
      const seg = (state, n) => state.split("-").slice(0, n).join("-");
      const countBy = (n) => {
        const m = new Map();
        for (const c of list) {
          if (c.view !== "desktop") continue; // count states once, not per view
          if (!c.state.includes("-")) continue;
          const k = seg(c.state, n);
          m.set(k, (m.get(k) ?? 0) + 1);
        }
        return m;
      };
      const lvl1 = countBy(1);
      const lvl2 = countBy(2);
      // "connect-github-*", "connect-slack-* …" all share the prefix "connect",
      // which would pile 17 states onto one line and hide the branching. When a
      // first-level group gets that broad, split it one level deeper so each
      // provider reads as its own branch.
      const BROAD = 6;
      const flowOf = (state) => {
        if (!state.includes("-")) return null;
        const a = seg(state, 1);
        if ((lvl1.get(a) ?? 0) > BROAD) {
          const b = seg(state, 2);
          if ((lvl2.get(b) ?? 0) >= 2) return b;
        }
        return a;
      };
      const flowCount = new Map();
      for (const c of list) {
        if (c.view !== "desktop") continue;
        const k = flowOf(c.state);
        if (k) flowCount.set(k, (flowCount.get(k) ?? 0) + 1);
      }
      const isFlow = (k) => k && (flowCount.get(k) ?? 0) >= 2;

      const lines = new Map(); // key -> frames
      for (const c of list) {
        const k = flowOf(c.state);
        const key = isFlow(k) ? k : "";
        if (!lines.has(key)) lines.set(key, []);
        lines.get(key).push(c);
      }
      // Main line first, then flows in the order their first state appears.
      const order = [...lines.keys()].sort((a, b) => {
        if (a === "") return -1;
        if (b === "") return 1;
        const ai = list.findIndex((c) => flowOf(c.state) === a);
        const bi = list.findIndex((c) => flowOf(c.state) === b);
        return ai - bi;
      });

      const p = pages.find((pp) => pp.row === r);
      if (p) pagesOut.push({ ...p, y });

      // The main line reads left to right as the journey: the entry screen
      // first, then each subsequent step. Branch lines hang BELOW the step
      // they branch from and start at that step's x, so the board reads like
      // a flow chart instead of a wall of equally-weighted frames.
      const mainDesktop = [];
      let decisionX = 0, decisionY = y, decisionW = 0, decisionH = 0;

      for (const key of order) {
        const line = lines.get(key);
        line.sort((a, b) => (a.view === b.view ? 0 : a.view === "desktop" ? -1 : 1));
        const lineH = Math.max(...line.map((c) => c.h));

        // Where does this line start? The main line starts at the left margin.
        // A branch starts under the frame it most plausibly leaves from: the
        // main-line step whose id is the longest prefix of the branch key,
        // else the last real (non-lifecycle) step on the main line.
        let startX = 0;
        let origin = null;
        if (key) {
          origin =
            mainDesktop.find((c) => key.startsWith(c.state)) ??
            [...mainDesktop].reverse().find((c) => !LIFECYCLE.has(c.state)) ??
            mainDesktop[0];
          if (origin) startX = origin.x;
        }

        let x = startX; let prevView = null;
        for (const c of line) {
          if (prevView === "desktop" && c.view === "mobile") x += MOBILE_GAP;
          c.x = x; c.y = y;
          c.flow = key || null;
          c.flowLabel = key ? flowTitle(key) : null;
          x += c.w + FRAME_GAP; prevView = c.view;
          if (!key && c.view === "desktop") mainDesktop.push(c);
        }

        // Record the elbow so the canvas can draw decision point -> branch.
        if (key && origin) {
          const first = line[0];
          first.branchFrom = {
            x: origin.x + Math.min(origin.w, 1440) / 2,
            y: origin.y + origin.h,
            toX: first.x + Math.min(first.w, 1440) / 2,
            toY: first.y,
          };
        }

        if (!key) { decisionX = startX; decisionY = y; decisionW = 0; decisionH = lineH; }
        y += lineH + (key ? FLOW_GAP : LINE_GAP);
      }
      void decisionX; void decisionY; void decisionW; void decisionH;
      y += ROW_GAP - LINE_GAP;
    }

    const manifest = { generatedFrames: captured.length, pages: pagesOut, frames: captured };
    await writeFile(resolve(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`Wrote ${captured.length} JPEG frames + manifest.json to ${OUT_DIR}`);

    await browser.close();
  } finally {
    cleanup();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
