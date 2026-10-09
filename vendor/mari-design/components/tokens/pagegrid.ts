/* ── Shared page layout grid (CONVENTIONS.md §11) ──────────────────────────
   One container width and one set of grid recipes for every console page, so
   the outer borders and internal plumb lines never move between pages.

   These live in tokens/ rather than in pages/PageFrame.tsx because the LOADING
   state has to sit on the same grid as the loaded page (DD-39: SkeletonPage
   used `max-w-6xl` plus its own breakpoint stacking, so every page came up at
   one width and settled at another). A skeleton in data-display cannot import
   pages/PageFrame without dragging the whole app shell behind it, so the
   numbers live here and PageFrame re-exports them.

   These are also where the console handles a SHRINKING window. Components stay
   desktop-first and fixed-width (§10); the page grid is the only thing that
   reflows. The numbers that matter: the console sidebar is a fixed 218px and
   the container adds 40-64px of padding, so the usable content column is
   roughly `viewport - 282`. A 320px rail therefore leaves

       1440 -> 838   1280 -> 658   1180 -> 558   1024 -> 402   900 -> 278

   for the main column. Below `xl` (1280) the rail stops being a rail and
   becomes a section stacked under the main column; below `lg` (1024) a
   three-up dashboard row stops being three-up. Mobile (the `mobile` prop) is
   already covered by the same classes, since 390px is below every breakpoint.

   Tailwind only sees class names it can find as literal strings, which is why
   these are spelled out per rail width instead of built from a variable. */

/** The one container every console page (and every page skeleton) sits in. */
export const PAGE_CONTAINER = "mx-auto max-w-[1400px] px-5 py-6 sm:px-8";

/** Main column + supporting rail. Keyed by the rail width (§11). */
export const SPLIT = {
  320: "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]",
  360: "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]",
  420: "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]",
  460: "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_460px]",
} as const;

/** Dashboard grids (§11). Three-up down to two-up down to one-up. */
export const DASH3 = "grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3";
/** Two-up row (stat pairs, side-by-side panels) that collapses to one column. */
export const DASH2 = "grid grid-cols-1 gap-5 lg:grid-cols-2";

/** Column spans inside DASH3, clamped so a widget never spans more columns
    than the grid currently has (which would spawn an implicit column and push
    the document sideways). */
export const SPAN = {
  1: "col-span-1 min-w-0",
  2: "col-span-1 min-w-0 lg:col-span-2",
  3: "col-span-1 min-w-0 lg:col-span-2 xl:col-span-3",
} as const;
