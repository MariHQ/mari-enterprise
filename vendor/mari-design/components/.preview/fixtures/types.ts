/* Fixture registry — the canvas's demo data, and the ONLY place it lives.
 *
 * The library ships pure presenters: a page or feature takes required data
 * props and renders them. It has no fallback content, so it cannot silently
 * show invented numbers to a real user when a query returns nothing. Every
 * value the design canvas displays is authored here instead, keyed by page id
 * and by the state id the canvas is rendering.
 *
 * Nothing under `.preview/` is part of the published surface. A consuming app
 * imports `pages/` and `features/`; it never sees this directory.
 */

/** One page's fixtures: state id -> the `data` prop for that state. */
export type StateFixtures<TData> = Record<string, TData>;

/** How a page's states are backed. `loading` and `error` are props now, not
    states, so a state entry may also pin them (e.g. the "API offline" state
    supplies both a data shape and the error string to show). */
export type FixtureEntry<TData> = {
  data: TData;
  loading?: boolean;
  error?: string | null;
};

export type PageFixtures<TData = unknown> = Record<string, FixtureEntry<TData>>;

/** The whole registry: page id -> state id -> fixture. */
export type FixtureRegistry = Record<string, PageFixtures<any>>;

/** Resolve a page+state to its fixture, falling back to the page's `default`
    so a newly-added state renders something real instead of crashing. */
export function fixtureFor(
  registry: FixtureRegistry,
  pageId: string,
  stateId: string,
): FixtureEntry<any> | null {
  const page = registry[pageId];
  if (!page) return null;
  return page[stateId] ?? page.default ?? null;
}
