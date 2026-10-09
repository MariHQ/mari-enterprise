// Automated overflow audit across every page x state x view.
//
//   node scripts/overflow-audit.mjs [--view desktop|mobile|both] [--json out.json]
//
// Reports three classes of layout defect that contact sheets can only show one
// at a time:
//
//   PAGE_OVERFLOW  the document scrolls sideways at the device width
//   ESCAPE         an element's content is wider than its own box, i.e. it is
//                  spilling past a border (the visible "runs off the card" bug)
//   CRUSH          a flex/grid child squeezed so narrow that its text wraps a
//                  character or two per line. Detected as a very tall, very
//                  narrow text box. This is what turned one panel into a
//                  23,000px column.
//
// Everything is measured in the real browser, so it catches the cases that
// reading CSS does not.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import os from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const VIEW = opt("view", "both");
const JSON_OUT = opt("json", null);
const ONLY = opt("page", null);
// Comma-separated state ids. For shrink defects the layout furniture is the
// same across a page's lifecycle states, so `--state default,overflow,stress`
// finds the same bugs as the full matrix in a fraction of the frames.
const ONLY_STATE = (opt("state", null) || "").split(",").map((s) => s.trim()).filter(Boolean);
// Extra desktop widths to sweep. 1440 and 390 alone hide every defect that
// only appears while the window is being SHRUNK: a rail that stops fitting at
// 1180, a toolbar that wraps at 1024, a table that escapes its card at 900.
const WIDTHS = (opt("widths", null) || "").split(",").map((s) => Number(s.trim())).filter(Boolean);

// Overridable so two audits (e.g. a broad sweep and a --page iteration) can
// run at once without --strictPort killing the second one.
const PORT = Number(opt("port", 5496));
const BASE = `http://localhost:${PORT}`;
const SIZES = { desktop: { w: 1440, h: 900 }, mobile: { w: 390, h: 844 } };
const CONCURRENCY = Math.max(2, Math.min(8, (os.cpus()?.length || 4) - 1));

/* Ceiling for one frame: navigate, settle, probe. Generous — the catalog page
   is genuinely slow, since the probe calls getComputedStyle on every element —
   but finite, so a wedged frame costs 45s instead of the whole run. */
const FRAME_MS = Number(opt("frameMs", 45000));

function waitForServer(url, tries = 90) {
  return new Promise((res, rej) => {
    const tick = async (n) => {
      try { const r = await fetch(url); if (r.ok || r.status === 404) return res(); } catch {}
      if (n <= 0) return rej(new Error("vite did not start"));
      setTimeout(() => tick(n - 1), 400);
    };
    tick(tries);
  });
}

/* Runs in the page. Keep it self-contained. */
function probe() {
  const out = { page: [], escapes: [], crushes: [] };
  const de = document.documentElement;
  const vw = de.clientWidth;
  if (de.scrollWidth > vw + 2) out.page.push({ scrollWidth: de.scrollWidth, clientWidth: vw });

  const label = (el) => {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
    const cls = (typeof el.className === "string" ? el.className : "").split(/\s+/).slice(0, 4).join(" ");
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} .${cls} :: ${t}`;
  };

  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    // ESCAPE: content wider than the box AND actually visible past the edge.
    // Deliberately excluded, because scrollWidth > clientWidth is the CORRECT
    // state for each of these and reporting them buries the real bugs:
    //   - overflow hidden/clip/auto/scroll: the element is containing it
    //     (`truncate` is overflow:hidden + ellipsis, working as intended)
    //   - form controls: long values always scroll inside the field
    const contained = /(auto|scroll|hidden|clip)/.test(cs.overflowX);
    const formControl = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    if (!contained && !formControl && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      // Only count it if the parent isn't clipping it anyway.
      const pc = el.parentElement ? getComputedStyle(el.parentElement) : null;
      const parentClips = pc && /(hidden|clip|auto|scroll)/.test(pc.overflowX);
      if (!parentClips) out.escapes.push({ by: el.scrollWidth - el.clientWidth, w: el.clientWidth, el: label(el) });
    }

    // CRUSH: a narrow box holding text far taller than it is wide.
    const hasText = el.children.length === 0 && (el.textContent || "").trim().length > 12;
    if (hasText && r.width > 0 && r.width < 90 && r.height > 4 * r.width) {
      out.crushes.push({ w: Math.round(r.width), h: Math.round(r.height), el: label(el) });
    }
  }
  const dedupe = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  out.escapes = dedupe(out.escapes, (x) => x.el).sort((a, b) => b.by - a.by).slice(0, 8);
  out.crushes = dedupe(out.crushes, (x) => x.el).sort((a, b) => b.h - a.h).slice(0, 8);
  return out;
}

async function main() {
  const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT, stdio: "ignore", env: { ...process.env, MARI_NO_OPEN: "1" },
  });
  const cleanup = () => { try { server.kill("SIGKILL"); } catch {} };
  process.on("exit", cleanup);

  try {
    await waitForServer(`${BASE}/render.html`);
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const list = await ctx.newPage();
    await list.goto(`${BASE}/render.html?list=1`, { waitUntil: "load" });
    let frames = await list.evaluate(() => window.__FRAMES__);
    await list.close();

    const views = VIEW === "both" ? ["desktop", "mobile"] : [VIEW];
    frames = frames.filter((f) => views.includes(f.view)
      && (!ONLY || f.page === ONLY)
      && (!ONLY_STATE.length || ONLY_STATE.includes(f.state)));

    // Each --widths entry re-runs every desktop frame at that viewport width.
    if (WIDTHS.length) {
      frames = frames.flatMap((f) =>
        f.view !== "desktop" ? [f] : WIDTHS.map((w) => ({ ...f, width: w })));
    }

    const findings = [];
    /* Frames the sweep could NOT measure. These have to be reported: a frame
       that errored produces no findings, which is indistinguishable in the
       final count from a frame that was measured and found clean. A sweep that
       silently skips is a false green. */
    const skipped = [];
    let cursor = 0, done = 0;

    /* One frame, measured. */
    const measure = async (page, url) => {
      await page.goto(url, { waitUntil: "load" });
      /* Wait for the WEB FONTS, not for a guess. `load` fires before a
         CSS-triggered font finishes downloading, and the fallback face has
         different metrics — so a frame measured too early comes out the wrong
         width and the probe reports escapes that do not exist. That is exactly
         what a full sweep produced (three hits, all clean when re-run alone,
         because by then the font was warm).

         Bounded, because `document.fonts.ready` on a frame whose font never
         settles would never resolve and `evaluate` has no default timeout.
         Falling through after 2s only restores the old behaviour: a possible
         false hit, rather than no answer at all. */
      await page.evaluate(() => Promise.race([
        document.fonts.ready.then(() => undefined),
        new Promise((r) => setTimeout(r, 2000)),
      ]));
      await page.waitForTimeout(120);
      return page.evaluate(probe);
    };

    /* A hard ceiling on one frame. Playwright's navigation timeout does not
       cover `evaluate`, and when the browser dies mid-sweep the pending call
       simply never settles: the run sat at 0% CPU with no Chromium process
       left, having printed 575/664 and nothing since. A sweep that hangs is
       worse than one that fails — you cannot tell it from a slow one. */
    const deadline = (promise, ms) => Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`frame exceeded ${ms}ms`)), ms)),
    ]);
    async function worker() {
      const page = await ctx.newPage();
      for (;;) {
        const i = cursor++;
        if (i >= frames.length) break;
        const f = frames[i];
        const { w, h } = SIZES[f.view];
        await page.setViewportSize({ width: f.width ?? w, height: h });
        // The dev server occasionally aborts a navigation mid-flight; retry
        // rather than losing the whole sweep to one flake.
        const url = `${BASE}/render.html?page=${encodeURIComponent(f.page)}&state=${encodeURIComponent(f.state)}&view=${f.view}&full=1`;
        let r = null;
        let lastErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            r = await deadline(measure(page, url), FRAME_MS);
            break;
          } catch (e) {
            lastErr = e;
            // A closed page or a gone browser will never come back on a retry,
            // so stop hammering it and let the worker report upward.
            if (page.isClosed() || !browser.isConnected()) break;
            await new Promise((res) => setTimeout(res, 300));
          }
        }
        if (r === null) {
          skipped.push({ page: f.page, state: f.state, view: f.view, why: String(lastErr).split("\n")[0] });
          if (!browser.isConnected()) throw new Error("the browser exited mid-sweep");
        }
        if (r && (r.page.length || r.escapes.length || r.crushes.length)) {
          const finding = {
            page: f.page, state: f.state, view: f.view, width: f.width ?? w,
            pageOverflow: r.page, escapes: r.escapes, crushes: r.crushes,
          };
          findings.push(finding);
          // Stream it. A long sweep that prints nothing until it exits is a
          // black box: you cannot tell a slow run from a hung one, and killing
          // it throws away everything it had already found.
          const kinds = [
            finding.pageOverflow.length ? `PAGE_OVERFLOW` : null,
            finding.escapes.length ? `ESCAPE x${finding.escapes.length}` : null,
            finding.crushes.length ? `CRUSH x${finding.crushes.length}` : null,
          ].filter(Boolean).join(" ");
          console.log(`  HIT ${finding.page}/${finding.state}@${finding.width} ${kinds}`);
        }
        if (++done % 25 === 0) console.log(`  .. ${done}/${frames.length} scanned, ${findings.length} hits`);
      }
      await page.close();
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    process.stdout.write("\n");

    // Roll up by page so the worst offenders are obvious.
    // NOTE: `f.page` is the page id, `f.pageOverflow` the document-level hits.
    const byPage = new Map();
    for (const f of findings) {
      const e = byPage.get(f.page) ?? { page: f.page, overflow: 0, escapes: 0, crushes: 0, worst: [] };
      e.overflow += f.pageOverflow?.length ?? 0;
      e.escapes += f.escapes.length;
      e.crushes += f.crushes.length;
      const at = `${f.state}/${f.view}@${f.width}`;
      if (f.pageOverflow?.length) e.worst.push(`${at} PAGE_OVERFLOW ${f.pageOverflow[0].scrollWidth}>${f.pageOverflow[0].clientWidth}`);
      for (const x of f.escapes.slice(0, 2)) e.worst.push(`${at} ESCAPE +${x.by}px ${x.el}`);
      for (const x of f.crushes.slice(0, 2)) e.worst.push(`${at} CRUSH ${x.w}x${x.h} ${x.el}`);
      byPage.set(f.page, e);
    }
    const rows = [...byPage.values()].sort((a, b) => (b.escapes + b.crushes) - (a.escapes + a.crushes));
    console.log(`\n${findings.length} frames with defects, of ${frames.length - skipped.length} measured` +
      (skipped.length ? ` (${skipped.length} NOT measured, listed below)` : ` of ${frames.length}`) + `\n`);
    for (const r of rows) {
      console.log(`${String(r.page).padEnd(20)} overflow=${String(r.overflow).padStart(3)}  escapes=${String(r.escapes).padStart(4)}  crushes=${String(r.crushes).padStart(4)}`);
      for (const w of r.worst.slice(0, 3)) console.log(`    ${w}`);
    }

    /* Never let an unmeasured frame pass for a clean one. */
    if (skipped.length) {
      console.log(`\n${skipped.length} frame(s) could not be measured — these are UNKNOWN, not clean:`);
      for (const s2 of skipped.slice(0, 20)) console.log(`  ${s2.page}/${s2.state}/${s2.view}: ${s2.why}`);
      if (skipped.length > 20) console.log(`  … ${skipped.length - 20} more`);
    }
    if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(findings, null, 2));

    await browser.close();
  } finally { cleanup(); }
}

main().catch((e) => { console.error(e); process.exit(1); });
