/* In-app destinations the library itself can name.

   Components must not know an APP's URL scheme — that is why pages emit
   intents and the host routes them. But a handful of destinations belong to
   the LIBRARY: every page here declares its own `route` in its PageModule, so
   a link from one page to another is internal, not app-specific.

   These helpers exist so those links are written once. The alternative, seen
   throughout this repo before, was `href="#"`: a control that looks and
   focuses like a link and goes nowhere. */

/** A single document, as owned by DocReviewPage (route `/knowledge/doc`). */
export function docHref(docId: number | string): string {
  return `/knowledge/doc?id=${encodeURIComponent(String(docId))}`;
}
