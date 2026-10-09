// Removes em/en dashes from USER-VISIBLE copy (CONVENTIONS.md §5).
//
//   node scripts/dash-sweep.mjs [--write]
//
// Only rewrites dashes that appear inside JSX text or string/template
// literals. Code comments keep theirs: they are not user-visible and the
// house comment style leans on them.
//
// Replacement rules, in order:
//   "A — B"  -> "A: B"    when B starts lowercase and A is a short label
//   "A — B"  -> "A. B"    when B starts uppercase (two sentences)
//   "A – B"  -> "A to B"  when both sides look like a range (dates/numbers)
//   "— B"    -> "B"       leading dash
//   bare "—" -> ","

import { readFile, writeFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const ONLY = (() => { const i = process.argv.indexOf("--dir"); return i === -1 ? null : process.argv[i + 1]; })();
const DIRS = ONLY ? [ONLY] : ["features", "pages", "data-display", "layout", "forms", "actions",
  "navigation", "shell", "chat", "workflow", "feedback", "icons", "tokens"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".ts", ".tsx"].includes(extname(p))) out.push(p);
  }
  return out;
}

/** Strip comments so we only touch live code, then map edits back by index. */
function commentMask(src) {
  const mask = new Uint8Array(src.length); // 1 = inside a comment
  let i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") mask[i++] = 1;
    } else if (src[i] === "/" && src[i + 1] === "*") {
      mask[i++] = 1; mask[i++] = 1;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) mask[i++] = 1;
      mask[i++] = 1; if (i < src.length) mask[i++] = 1;
    } else if (src[i] === "{" && src[i + 1] === "/" && src[i + 2] === "*") {
      // JSX comment {/* … */}
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) mask[i++] = 1;
      mask[i++] = 1; mask[i++] = 1; if (i < src.length) mask[i++] = 1;
    } else i++;
  }
  return mask;
}

const RANGEY = /[\d)]\s*$/;

function fixAt(src, idx) {
  const ch = src[idx];
  const before = src.slice(Math.max(0, idx - 60), idx);
  const after = src.slice(idx + 1, idx + 60);

  // Range: "Jan 14 – Jul 20", "3 – 5"
  if (RANGEY.test(before.replace(/\s+$/, "") ) && /^\s*[\d{]/.test(after)) return " to ";

  const nextWord = after.replace(/^\s+/, "");
  const prevTrim = before.replace(/\s+$/, "");

  // Leading dash at the start of a string/JSX chunk: drop it.
  if (/[>"'`(]\s*$/.test(before)) return "";

  if (/^[A-Z]/.test(nextWord) && /[a-z0-9)\]]$/.test(prevTrim)) return ". ";
  if (/^[a-z0-9]/.test(nextWord)) return ": ";
  return ", ";
}

let changed = 0, hits = 0;
const report = [];

for (const dir of DIRS) {
  let files;
  try { files = walk(resolve(ROOT, dir)); } catch { continue; }
  for (const f of files) {
    const src = await readFile(f, "utf8");
    if (!/[—–]/.test(src)) continue;
    const mask = commentMask(src);
    let out = "", localHits = 0;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if ((c === "—" || c === "–") && !mask[i]) {
        // Collapse the surrounding spaces into the replacement.
        let start = out.length;
        while (out.length && /[ \t]$/.test(out)) out = out.slice(0, -1);
        const rep = fixAt(src, i);
        out += rep;
        let j = i + 1;
        while (j < src.length && /[ \t]/.test(src[j])) j++;
        if (rep && !/\s$/.test(rep) && rep !== "") out += "";
        i = j - 1;
        localHits++;
        void start;
      } else out += c;
    }
    if (localHits) {
      hits += localHits; changed++;
      report.push(`${f.replace(ROOT + "/", "")}: ${localHits}`);
      if (WRITE) await writeFile(f, out);
    }
  }
}

console.log(report.join("\n"));
console.log(`\n${hits} dashes in ${changed} files${WRITE ? " (rewritten)" : " (dry run, pass --write)"}`);
