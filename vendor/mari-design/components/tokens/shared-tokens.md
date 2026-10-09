# Shared tokens

**Type:** Tokens (not components — building blocks the components above are made of)
**Source:** [`card.ts`](./card.ts), [`focusRing.ts`](./focusRing.ts), [`format.ts`](./format.ts) (this repo)

## `card`

```ts
export const card = "bg-paper rounded-md border border-ink/15";
```

The base container treatment: paper background, `rounded-md` (the app/console 4–6px radius, not the marketing 0px), hairline `ink/15` border. `Table` and `DataTable` both build on this directly (`` `${card} mt-5 overflow-hidden` ``).

**Use this for any new container component** rather than hand-writing `bg-paper rounded-md border border-ink/15` inline — if the app-mode container treatment ever changes, it should change in one place.

## `focusRing`

```ts
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biscay-2/70 focus-visible:ring-offset-1";
```

The one keyboard-focus treatment for the whole console. Applied to: `buttons.ts`'s three variants, `DataTable`'s sort headers and pagination buttons, `Drawer`'s close button.

**Every interactive element that isn't already using `btn`/`btnPrimary`/`btnDanger` needs this appended to its className.** This is not optional visual polish — it's the only way keyboard users can see where they are. If you're building a new interactive component and it doesn't have a visible focus state, that's a bug, not a style choice.

## `format.ts`

`fmtDate`, `fmtDateTime`, `fmtAgo` — the canonical date-formatting functions for the console (not Tailwind class strings like the two above, just plain logic). See the header comment in the source for the exact output shapes and when to use which. Pure functions, no components; not covered by the BRAND-STYLE-GUIDE.md styling rules since there's no styling here to get wrong.

**Always use these instead of `toLocaleDateString`/`Intl.DateTimeFormat` at a call site** — the same-year-omits-year rule and the local-date parsing fix for date-only strings (`"2026-07-14"` must not shift a day under UTC conversion) are easy to get subtly wrong ad hoc.
