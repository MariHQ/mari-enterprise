# Pure presenters: moving demo data out of the library

The library ships **no demo content**. A page or feature takes required data
props and renders them; it has no fallback, so it cannot silently show
invented numbers to a real user when a query returns nothing. All the content
the design canvas displays lives in `.preview/fixtures/`, which is not part of
the published surface.

`pages/OverviewPage.tsx` + `.preview/fixtures/overview.ts` are the worked
reference. Match them.

## The page contract

```ts
export type PageProps<TData> = {
  data: TData;              // required — a page never invents content
  loading?: boolean;        // first load, no data yet
  error?: string | null;    // shown to the user, so it must be real
  mobile?: boolean;
};
```

`state` is gone. It was a canvas concept leaking into the component: a magic
string that both selected fixture content *and* switched rendering mode. Now:

- **loading / error** are explicit props an app drives from its query state.
- **default / empty / overflow / stress** are *content*, so they are fixtures.
  The page decides what to render by looking at the data it was given.

That last point matters. The empty state must be **derived from the data**:

```ts
function isEmpty(d: OverviewData): boolean {
  return !d.tasks.length && !d.digest.length && /* … */ !d.flow;
}
```

so it is true in the real app for exactly the same reason it is true on the
canvas. A page that renders its empty state because it was handed
`state === "empty"` has never actually been tested.

## Steps, per page

1. **Define the data type.** One exported `type XxxData` naming every
   collection the page renders. Compose the feature components' own exported
   row types (`ReviewTask`, `RecentDoc`, …) — do not redeclare shapes.

2. **Strip demo data from the features the page uses.** Use the helper:

   ```sh
   node scripts/extract-demo.mjs features/OverviewRecentDocs.tsx DEMO_DOCS:docs
   ```

   It cuts the const, makes the prop required, and prints the block to paste
   into the fixture. It does not write the fixture — a fixture needs an honest
   state matrix, which is a judgement call.

   Re-run `npx tsc --noEmit` after each file. A const used somewhere *other*
   than the prop default (a lookup table, a `.length`, a `.map`) shows up as an
   error instead of silently changing behaviour.

3. **Rewrite the page** as a pure presenter over `data`. Delete its `StressBody`
   / `state === "…"` branches; that content becomes fixture entries.

4. **Write `.preview/fixtures/<pageId>.ts`** exporting
   `FIXTURES: PageFixtures<XxxData>` keyed by the state ids the page declares:

   ```ts
   export const FIXTURES: PageFixtures<OverviewData> = {
     default:  { data: DEFAULT },
     loading:  { data: DEFAULT, loading: true },
     error:    { data: EMPTY, error: "The dashboard is temporarily unavailable." },
     empty:    { data: EMPTY },
     overflow: { data: strained(false) },
     stress:   { data: strained(true) },
   };
   ```

   The page id must match `PAGES[].id`. `.preview/fixtures/index.ts` already
   imports every page's file — just create yours, do not edit the barrel.

5. **Long-text fixtures** import from `.preview/fixtures/stress.ts` (moved
   there from `pages/stress.ts`). `overflow` is long *natural* text; `stress`
   is pathological — unbreakable tokens, huge numbers, mixed scripts. Keep both
   honest; they are what the overflow audit exercises.

## The `error` prop and the error catalog

CONVENTIONS §8 says every user-visible failure message comes from
`feedback/errors.ts`. That looks like it conflicts with `error?: string | null`,
since a page cannot both use catalog copy and display an arbitrary string.
It does not: `<ErrorMessage>` takes a `children` detail slot.

```tsx
{error && <ErrorMessage id="server.unavailable" onAction={refetch}>{error}</ErrorMessage>}
```

The catalog supplies the human explanation and the recovery action, which is
what §8 is protecting; `error` carries the real technical detail (`HTTP 503`,
a network message) underneath it. Both are honest, and no page invents copy.

Do **not** render `{error}` as bare text — that bypasses the catalog, and the
raw string is rarely a sentence a user can act on. Do not use a catalog id as
the `error` value either; the prop is the detail, not the selector.

## What not to do

- Do not leave a default like `docs = []`. An empty array is still invented
  content: it makes "the query failed" indistinguishable from "there is
  nothing", and the caller stops being forced to decide.
- Do not add `state` back for convenience.
- Do not put fixtures anywhere but `.preview/fixtures/`. Anything under
  `features/`, `pages/`, or `data-display/` ships to consumers.
- Do not change visual output. This refactor moves data; it does not restyle.
  The canvas contact sheets must look the same before and after.

## Verifying

```sh
npx tsc --noEmit
node scripts/shot.mjs --port <yours> --out /tmp/x --sheet x page:<id>:default:desktop page:<id>:stress:desktop
```

Read the sheet. Same pixels as before the change, or you moved more than data.
