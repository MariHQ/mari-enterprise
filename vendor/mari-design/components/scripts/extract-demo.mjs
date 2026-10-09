// Move a component's baked-in demo data out into a canvas fixture.
//
//   node scripts/extract-demo.mjs features/FooPanel.tsx DEMO_ROWS:rows
//
// For each `CONST:prop` pair it:
//   1. cuts `const CONST[: Type] = …;` out of the component file,
//   2. rewrites the destructured default `prop = CONST,` to a required `prop,`,
//   3. rewrites the prop's declaration `prop?: T` to `prop: T`,
//   4. prints the removed block to stdout so you can paste it into
//      `.preview/fixtures/<page>.ts`.
//
// It deliberately does NOT write the fixture file: fixtures need a state
// matrix (default / empty / overflow / stress) that only a human can author
// honestly. This just does the mechanical half without transcription errors.
//
// Always re-run `npx tsc --noEmit` afterwards: a const used somewhere OTHER
// than the prop default (a lookup table, a length, a `.map`) will surface as
// an error rather than silently changing behaviour.

import { readFile, writeFile } from "node:fs/promises";

const [file, ...pairs] = process.argv.slice(2);
if (!file || !pairs.length) {
  console.error("usage: extract-demo.mjs <file.tsx> CONST:prop [CONST:prop ...]");
  process.exit(1);
}

let src = await readFile(file, "utf8");
const removed = [];

for (const pair of pairs) {
  const [constName, prop] = pair.split(":");
  if (!constName || !prop) {
    console.error(`bad pair "${pair}" — expected CONST:prop`);
    process.exit(1);
  }

  // `const NAME: Type = <anything, including multiline literals>;` up to the
  // first `;` that is followed by a blank line or a new top-level declaration.
  const re = new RegExp(`^const ${constName}(: [^=]+)? = ([\\s\\S]*?);\\n`, "m");
  const m = src.match(re);
  if (!m) {
    console.error(`MISS: ${constName} not found in ${file}`);
    process.exit(1);
  }

  const type = (m[1] || "").replace(/^:\s*/, "").trim();
  removed.push({ constName, type, body: m[2] });
  src = src.slice(0, m.index) + src.slice(m.index + m[0].length);

  // Destructured default -> required.
  src = src.replace(new RegExp(`(\\n\\s*)${prop} = ${constName},`), `$1${prop},`);
  // Optional prop -> required prop.
  src = src.replace(new RegExp(`(\\W)${prop}\\?: `), `$1${prop}: `);
}

src = src.replace(/\n\n\n+/g, "\n\n");
await writeFile(file, src);

console.log(`// removed from ${file} — paste into the page's fixture file:\n`);
for (const r of removed) {
  console.log(`const ${r.constName}${r.type ? `: ${r.type}` : ""} = ${r.body};\n`);
}
