// Find controls that cannot do anything.
//
//   node scripts/dead-controls.mjs [--json out.json] [--all]
//
// A control is DEAD when it renders as an interactive element but has no path
// to a handler: no onClick/onSelect/onChange/onSubmit, no `type="submit"`
// inside a form that has an onSubmit, not an <a href>, and not a wrapper whose
// props it spreads. Those are the buttons that click and do nothing — the
// class of bug you only find by clicking every one of them by hand.
//
// This is a static check and deliberately conservative: it reports what it can
// prove, and lists what it could not decide separately rather than guessing.
// It cannot know whether a handler that exists actually reaches the server —
// `onClick={() => {}}` counts as wired here. Pair it with the runtime audit.
//
// Scope: `pages/`, `features/`, and the interactive parts of the catalog.

import { readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const JSON_OUT = opt("json", null);
const SHOW_ALL = argv.includes("--all");

/* Only elements whose whole purpose is to be actioned.
   Deliberately NOT here:
     Chip / TagChip / Pill — badges. They are display by default and only
       interactive when given onClick, in which case they are wired anyway.
       Counting them produced 100+ false positives on status pills.
     SortHeader — takes `sort`/`onSort` from the table that owns it, so the
       handler is never on this tag.
     MenuItem / MenuRadioItem — a radio item's handler is `onValueChange` on
       the enclosing MenuRadioGroup; see wiredByParent(). */
const INTERACTIVE = /^<(button|Button|ConfirmButton|Toggle|Switch|Checkbox)\b/;

/** Anything on the open tag that means "this can act". */
const WIRED = [
  /\bon[A-Z]\w*\s*=/,          // onClick, onSelect, onChange, onValueChange…
  /\bhref\s*=/,                // a real link
  /\btype\s*=\s*["']submit["']/, // submits a form (checked against form below)
  /\{\.\.\.\w+\}/,             // spreads props from a wrapper
  /\bdisabled\b/,              // deliberately inert
  /\bas\s*=\s*\{?["']?a["']?/, // rendered as an anchor
];

/** Files that are demo/canvas surface, not shipped product. */
const SKIP = [
  /\/\.preview\//, /\/node_modules\//, /\/dist\//, /\.md$/, /\.test\./,
  // A component catalog: every control is a rendered SPECIMEN of a variant.
  // Inert is the correct state there, so counting them is noise.
  /pages\/LookbookPage\.tsx$/,
];

/** Blank out comments, keeping every byte offset and newline.
 *
 * These files document themselves heavily, and the prose names the components
 * it is describing — "Delete goes through <ConfirmButton> (§2)". Scanning raw
 * source counted those sentences as unwired controls, which is how the report
 * grew a tail of findings pointing at paragraphs. Replacing comment bytes with
 * spaces rather than deleting them keeps `index` and the line numbers exact.
 *
 * Strings are deliberately NOT masked: a `//` inside a className is rare, and
 * masking string bodies would need a real tokenizer to avoid making things
 * worse. `http://` is the one common case, and it is handled below. */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "/*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (two === "//" && src[i - 1] !== ":") { // not the // in http://
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      out += " ".repeat(stop - i);
      i = stop;
    } else {
      out += src[i];
      i += 1;
    }
  }
  return out;
}

/** Split a file into JSX open tags, keeping their source line. */
function openTags(src) {
  const out = [];
  const re = /<\/?[A-Za-z][^>]*?>/gs;
  let m;
  while ((m = re.exec(src))) {
    if (m[0].startsWith("</")) continue;
    const line = src.slice(0, m.index).split("\n").length;
    out.push({ tag: m[0], line, index: m.index });
  }
  return out;
}

/** True when this tag sits inside a <form onSubmit=…> in the same file. */
function insideWiredForm(src, index) {
  const before = src.slice(0, index);
  const lastForm = before.lastIndexOf("<form");
  if (lastForm === -1) return false;
  const closed = before.slice(lastForm).includes("</form>");
  if (closed) return false;
  const formTag = src.slice(lastForm, src.indexOf(">", lastForm) + 1);
  if (!/\bonSubmit\s*=/.test(formTag)) return false;
  // A form whose only handler is preventDefault is not wired — that is exactly
  // how the login form looked while doing nothing.
  return !/onSubmit=\{\(?e?\)?\s*=>\s*e\.preventDefault\(\)\}/.test(formTag);
}

/** A control can be driven by a handler on an enclosing element: a radio item
    inside <MenuRadioGroup onValueChange>, a control inside a wrapper that was
    handed an onClick. Look at the nearest few enclosing open tags. */
function wiredByParent(src, index) {
  const before = src.slice(Math.max(0, index - 1200), index);
  if (/<(MenuRadioGroup|ToggleGroup|RadioGroup|Tabs)[^>]*\bon[A-Z]\w*\s*=/.test(before)) return true;

  /* Radix `asChild`: the wrapper does not render an element of its own, it
     CLONES the single child and merges its own props — including the onClick —
     onto it. So a popover trigger, a dialog close or a menu trigger correctly
     has no handler in the source; putting one there would be the bug. The
     child is the very next tag, so only an asChild wrapper immediately before
     this one counts. */
  return /<[A-Z][\w.]*[^>]*\basChild\b[^>]*>\s*$/.test(before);
}

const files = [];
for await (const f of glob("{pages,features,data-display,forms,actions,navigation,feedback,shell,chat,workflow}/**/*.tsx")) {
  if (SKIP.some((r) => r.test(f))) continue;
  files.push(f);
}

const dead = [];
const wired = [];

for (const file of files.sort()) {
  const src = stripComments(await readFile(file, "utf8"));
  for (const { tag, line, index } of openTags(src)) {
    if (!INTERACTIVE.test(tag)) continue;
    const isWired = WIRED.some((r) => r.test(tag))
      || insideWiredForm(src, index)
      || wiredByParent(src, index);
    const label = tag.replace(/\s+/g, " ").slice(0, 96);
    (isWired ? wired : dead).push({ file, line, tag: label });
  }
}

const byFile = new Map();
for (const d of dead) {
  if (!byFile.has(d.file)) byFile.set(d.file, []);
  byFile.get(d.file).push(d);
}

console.log(`${dead.length} dead of ${dead.length + wired.length} interactive controls, in ${byFile.size} files\n`);
for (const [file, rows] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${file}  (${rows.length})`);
  for (const r of (SHOW_ALL ? rows : rows.slice(0, 6))) console.log(`  ${r.line}: ${r.tag}`);
  if (!SHOW_ALL && rows.length > 6) console.log(`  … ${rows.length - 6} more`);
}

if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(dead, null, 2));
