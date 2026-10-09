// Token-efficient design-QA screenshot tool.
//
//   node scripts/shot.mjs --port 5301 --out /tmp/shots --sheet lineage <target>...
//
// The point of this tool: capture each component/feature/page **in isolation**
// and then TILE every capture into a single labelled contact sheet, so a
// reviewer looks at one image instead of thirty.
//
// Targets
//   comp:<slug>                  one component demo row from the library
//                                preview (index.html). slug = the row label
//                                lowercased, non-alphanumerics -> "-"
//                                (e.g. "Status chip" -> comp:status-chip).
//   comp:*                       every component demo row on the page.
//   comp:<sectionId>/*           every demo row inside one section
//                                (sections: actions, layout, forms, data, nav,
//                                feedback, tables, markdown, cards, chat,
//                                workflow, global-search, icons-ui, icons-marks,
//                                shell-chrome, connect, insights, additions)
//   state:<Component>            every declared state of one component,
//                                each rendered in its own isolated frame
//                                (see .preview/states/). state:* = everything.
//   sec:<sectionId>              a whole section (rarely what you want)
//   feat:<ExportName>            one page-level feature, isolated (pages.html)
//   feat:*                       every feature
//   page:<pageId>:<state>:<view> a full app page frame (render.html)
//   any target + "@mobile"       render it in a 390px-wide viewport instead
//
// Output
//   --sheet <name>   composite every capture in this run into
//                    <out>/<name>.sheet.jpg (or .sheet_1of2.jpg ... when the
//                    grid is too tall for one readable image). Each tile is
//                    captioned with its target so findings are attributable.
//                    THIS IS THE DEFAULT WAY TO LOOK AT RESULTS.
//   --tiles          also keep the individual per-target JPEGs.
//   --cols <n>       tiles per sheet row (default 3)
//   --tilew <px>     max tile width in the sheet (default 560)
//   --maxh <px>      max sheet height per image (default 2400)

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const FLAGS = new Set(["--tiles"]);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const PORT = Number(opt("port", 5300));
const OUT = resolve(opt("out", "/tmp/shots"));
const SHEET = opt("sheet", null);
const KEEP_TILES = has("tiles");
const COLS = opt("cols", null) ? Number(opt("cols")) : null;
const TILE_W = Number(opt("tilew", 560));
const MAX_H = Number(opt("maxh", 2400));

const targets = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1]?.startsWith("--") && !FLAGS.has(argv[i - 1])));
const BASE = `http://localhost:${PORT}`;
const TMP = join(OUT, ".tiles");

function waitForServer(url, tries = 90) {
  return new Promise((res, rej) => {
    const tick = async (n) => {
      try { const r = await fetch(url); if (r.ok || r.status === 404) return res(); } catch {}
      if (n <= 0) return rej(new Error("vite dev did not start"));
      setTimeout(() => tick(n - 1), 400);
    };
    tick(tries);
  });
}

const FREEZE = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

async function main() {
  if (!targets.length) { console.error("no targets given"); process.exit(1); }
  await mkdir(TMP, { recursive: true });

  const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT, stdio: "ignore",
    // Headless QA: never pop a real browser window at the user.
    env: { ...process.env, MARI_NO_OPEN: "1", BROWSER: "none" },
  });
  const cleanup = () => { try { server.kill("SIGKILL"); } catch {} };
  process.on("exit", cleanup);

  const captures = []; // { label, file, w, h }
  let STATE_MATRIX = [];

  try {
    await waitForServer(`${BASE}/index.html`);
    /* Same reason as prerender.mjs: headless Chrome's default
       `--hide-scrollbars` suppresses the styled ::-webkit-scrollbar that
       Scrollable relies on, so a region that scrolls correctly (§20)
       photographs as content sliced at an edge with no affordance. A QA shot
       that cannot show the affordance cannot be used to check for it. */
    const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });

    // Expand wildcard targets against the live DOM.
    const expanded = [];
    for (const t of targets) {
      const [spec, view] = t.split("@");
      const suffix = view ? `@${view}` : "";
      if (spec.startsWith("state:") && !STATE_MATRIX.length) STATE_MATRIX = await listStates(browser);
      if (spec === "comp:*" || /^comp:[\w-]+\/\*$/.test(spec)) {
        const section = spec === "comp:*" ? null : spec.slice(5, -2);
        const ids = await listIds(browser, "index.html", section);
        expanded.push(...ids.map((id) => `comp:${id.replace(/^c-/, "")}${suffix}`));
      } else if (spec.startsWith("state:")) {
        const want = spec.slice(6);
        for (const c of STATE_MATRIX) {
          if (want !== "*" && c.id !== want) continue;
          for (const st of c.states) expanded.push(`state:${c.id}:${st.id}${suffix}`);
        }
      } else if (spec === "feat:*" || spec === "psec:*") {
        const ids = await listFeatureIds(browser);
        expanded.push(...ids.map((id) => `feat:${id}${suffix}`));
      } else expanded.push(t);
    }

    for (const t of expanded) {
      try {
        const c = await capture(browser, t);
        if (c) captures.push(c);
      } catch (e) { console.log(`FAIL  ${t}: ${e.message}`); }
    }

    if (SHEET && captures.length) {
      const sheets = await composeSheets(browser, captures, SHEET);
      console.log(sheets.join(" "));
    } else {
      console.log(captures.map((c) => c.file).join(" "));
    }

    if (!KEEP_TILES && SHEET) await rm(TMP, { recursive: true, force: true });
    await browser.close();
  } finally { cleanup(); }

  /* ── enumeration ─────────────────────────────────────────────────── */
  async function listIds(browser, html, section) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${html}`, { waitUntil: "load" });
    await p.waitForTimeout(700);
    const ids = await p.evaluate((sec) => {
      const scope = sec ? document.getElementById(sec) : document;
      if (!scope) return [];
      return [...scope.querySelectorAll('[id^="c-"]')].map((e) => e.id);
    }, section);
    await ctx.close();
    return ids;
  }

  async function listStates(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/states.html?list=1`, { waitUntil: "load" });
    await p.waitForSelector("body[data-ready]", { timeout: 15000 }).catch(() => {});
    const m = await p.evaluate(() => window.__STATES__);
    await ctx.close();
    return m || [];
  }

  async function listFeatureIds(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/pages.html`, { waitUntil: "load" });
    await p.waitForTimeout(900);
    const ids = await p.evaluate(() =>
      [...document.querySelectorAll("section[id] > div[id]")].map((e) => e.id));
    await ctx.close();
    return ids;
  }

  /** Declared frame width for a state, from the enumerated matrix. */
  function stateWidth(compId, stateId) {
    const c = STATE_MATRIX.find((x) => x.id === compId);
    return c?.states.find((s) => s.id === stateId)?.width ?? null;
  }

  /* ── capture one target in isolation ─────────────────────────────── */
  async function capture(browser, target) {
    const [spec, view] = target.split("@");
    const mobile = view === "mobile";
    const [kind, ...rest] = spec.split(":");
    const safe = target.replace(/[^a-z0-9]+/gi, "_");
    const file = join(TMP, `${safe}.png`);

    if (kind === "state") {
      const [compId, stateId] = rest;
      // Narrow probes must run in a genuinely narrow VIEWPORT, not just a narrow
      // box on a wide page: Tailwind's sm:/lg: prefixes key off viewport width,
      // so a 320px frame inside a 1500px window would still render desktop
      // layout and the overflow test would lie.
      const declared = stateWidth(compId, stateId);
      const vw = declared && declared <= 520 ? declared + 40 : 1500;
      const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, deviceScaleFactor: 2 });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/states.html?comp=${encodeURIComponent(compId)}&state=${encodeURIComponent(stateId)}`, { waitUntil: "load" });
      await p.addStyleTag({ content: FREEZE });
      await p.waitForSelector("body[data-ready]", { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(120);
      const el = await p.$("#root > div");
      if (!el) { await ctx.close(); console.log(`MISS  ${target}`); return null; }
      const box = await el.boundingBox();
      await el.screenshot({ path: file });
      await ctx.close();
      return { label: `${compId} · ${stateId}`, file, w: Math.round(box.width), h: Math.round(box.height) };
    }

    if (kind === "page") {
      const [pageId, state = "default", pview = "desktop"] = rest;
      const isM = pview === "mobile" || mobile;
      const ctx = await browser.newContext({
        viewport: { width: isM ? 390 : 1440, height: isM ? 844 : 900 },
        deviceScaleFactor: 1,
      });
      const p = await ctx.newPage();
      // A page that throws during render screenshots as a blank white frame,
      // which is indistinguishable from a page that legitimately renders
      // nothing. Surface the error instead of tiling an empty rectangle.
      const pageErrors = [];
      p.on("pageerror", (e) => pageErrors.push(String(e.message || e)));
      p.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });
      await p.goto(`${BASE}/render.html?page=${encodeURIComponent(pageId)}&state=${encodeURIComponent(state)}&view=${isM ? "mobile" : "desktop"}`, { waitUntil: "load" });
      await p.waitForSelector("body[data-ready]", { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(250);
      if (pageErrors.length) {
        console.error(`\n!! ${target} threw while rendering:`);
        for (const e of [...new Set(pageErrors)].slice(0, 4)) console.error(`   ${e}`);
      }
      await p.screenshot({ path: file, fullPage: true });
      const dims = await p.evaluate(() => [
        document.documentElement.clientWidth,
        Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      ]);
      await ctx.close();
      return { label: target, file, w: dims[0], h: dims[1] };
    }

    // `psec:` is the legacy spelling of `feat:` and stays supported.
    const k = kind === "psec" ? "feat" : kind;
    const html = k === "feat" ? "pages.html" : "index.html";
    const selector =
      k === "comp" ? `#c-${rest[0]}` :
      k === "feat" ? `#${rest[0]}` :
      k === "sec" ? `#${rest[0]}` : null;
    if (!selector) { console.log(`SKIP  unknown target kind: ${target}`); return null; }

    const ctx = await browser.newContext({
      viewport: { width: mobile ? 390 : 1440, height: 900 },
      deviceScaleFactor: mobile ? 2 : 1,
    });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${html}`, { waitUntil: "load" });
    await p.addStyleTag({ content: FREEZE });
    await p.waitForTimeout(700);
    const el = await p.$(selector);
    if (!el) { console.log(`MISS  ${target} (no ${selector})`); await ctx.close(); return null; }
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(120);
    const box = await el.boundingBox();
    if (!box || box.height < 4) { console.log(`MISS  ${target} (empty)`); await ctx.close(); return null; }
    await el.screenshot({ path: file });
    await ctx.close();
    return { label: target, file, w: Math.round(box.width), h: Math.round(box.height) };
  }

  /* ── tile everything into labelled contact sheets ────────────────── */
  async function composeSheets(browser, caps, name) {
    // Scale every tile to at most TILE_W wide, then pack into rows.
    const tiles = caps.map((c) => {
      const scale = Math.min(1, TILE_W / c.w);
      return { ...c, dw: Math.round(c.w * scale), dh: Math.round(c.h * scale) };
    });

    const perRow = COLS ?? 3;
    // Split into sheets so no single image exceeds MAX_H.
    const sheets = [];
    let cur = [], curH = 0;
    for (let i = 0; i < tiles.length; i += perRow) {
      const row = tiles.slice(i, i + perRow);
      const rowH = Math.max(...row.map((t) => Math.min(t.dh, MAX_H - 80))) + 34;
      if (curH + rowH > MAX_H && cur.length) { sheets.push(cur); cur = []; curH = 0; }
      cur.push(...row); curH += rowH;
    }
    if (cur.length) sheets.push(cur);

    const out = [];
    for (let s = 0; s < sheets.length; s++) {
      const items = await Promise.all(sheets[s].map(async (t) => ({
        label: t.label, dw: t.dw, dh: t.dh,
        src: `data:image/png;base64,${(await readFile(t.file)).toString("base64")}`,
      })));
      const html = sheetHtml(items, perRow, `${name}${sheets.length > 1 ? ` (${s + 1}/${sheets.length})` : ""}`);
      const htmlFile = join(TMP, `sheet-${s}.html`);
      await writeFile(htmlFile, html);
      const ctx = await browser.newContext({ viewport: { width: perRow * (TILE_W + 24) + 32, height: 200 } });
      const p = await ctx.newPage();
      await p.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
      await p.waitForTimeout(200);
      const file = join(OUT, sheets.length > 1 ? `${name}.sheet_${s + 1}of${sheets.length}.jpg` : `${name}.sheet.jpg`);
      await p.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 86 });
      await ctx.close();
      out.push(file);
    }
    return out;
  }

  function sheetHtml(items, perRow, title) {
    const cells = items.map((t) => `
      <figure style="margin:0;width:${TILE_W}px">
        <figcaption style="font:600 12px ui-monospace,monospace;color:#B23A1E;padding:3px 0 5px">${t.label}</figcaption>
        <div style="border:1px solid #10263B33;background:#fff;overflow:hidden;max-height:${MAX_H - 80}px">
          <img src="${t.src}" style="display:block;width:${t.dw}px;height:${t.dh}px">
        </div>
      </figure>`).join("");
    return `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;background:#e9ecef;font-family:ui-sans-serif,system-ui">
      <h1 style="font:700 15px ui-monospace,monospace;color:#10263B;margin:0 0 12px">${title}</h1>
      <div style="display:grid;grid-template-columns:repeat(${perRow},${TILE_W}px);gap:16px 24px;align-items:start">${cells}</div>
    </body>`;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
