/* The canvas fixture registry.
 *
 * One file per page, each exporting `FIXTURES` of type `PageFixtures<TData>`
 * keyed by the state ids that page declares. The library components hold no
 * demo data at all (MIGRATION.md), so this is the single place the canvas's
 * content lives.
 *
 * Files are discovered, not listed. A hand-maintained import list would be a
 * shared file that every page migration has to touch, which serialises work
 * that is otherwise independent — and a missing line there fails as a blank
 * page rather than as an error. Dropping in `<pageId>.ts` is the whole step.
 *
 * The filename is the page id, camelCase standing in for kebab-case because
 * `doc-review.ts` is not a nice module name: `docReview.ts` -> `doc-review`,
 * matching `PAGES[].id` in `pages/index.ts`.
 */

import type { FixtureRegistry, PageFixtures } from "./types";

/* The three infrastructure modules are excluded IN THE GLOB, not filtered out
   afterwards. Matching `./index.ts` here makes this module import itself, and
   the resulting cycle evaluates `FIXTURES` as undefined — which renders as a
   silently blank page rather than an error. */
const modules = import.meta.glob<{ FIXTURES: PageFixtures<any> }>(
  ["./*.ts", "!./index.ts", "!./types.ts", "!./stress.ts"],
  { eager: true },
);

/** `settingsApiKeys` -> `settings-api-keys` */
const toPageId = (camel: string) =>
  camel.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export const FIXTURES: FixtureRegistry = Object.fromEntries(
  Object.entries(modules)
    .map(([path, mod]) => [path.replace(/^\.\//, "").replace(/\.ts$/, ""), mod] as const)
    .filter(([, mod]) => Boolean(mod?.FIXTURES))
    .map(([name, mod]) => [toPageId(name), mod.FIXTURES]),
);

export { fixtureFor } from "./types";
export type { FixtureEntry, PageFixtures, FixtureRegistry } from "./types";
