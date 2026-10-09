# Skeleton

**Type:** Data display
**Source:** [`Skeleton.tsx`](./Skeleton.tsx) (this repo)

A loading-placeholder block — distinct from `Spinner` (indeterminate, contextless) for content that's about to appear in its own place (a table row, a card, a stat before its number loads).

## The rule (CONVENTIONS.md §9)

A bar stands in for a **value the response has not returned**. Everything the
app already holds at first paint renders as itself: section headings, card
titles, column headers, field labels, tab names, the page title, units, static
helper text. So the composed blocks take real strings where the caller has
them:

```tsx
<SkeletonStat label="Open tasks" />          // caption real, number waiting
<SkeletonCard title="Glossary health" />     // heading real, body waiting
<SkeletonTable columns={["Actor", "Action", "Target", "When"]} />
```

and fall back to bars only where the caller genuinely does not know
(`<SkeletonCard />` with no title, a document name that is the response's to
give). Never the other way round: a count, name or date printed beside a body
of grey bars is invented data.

Because a loading region now holds real text, it is not `aria-hidden`
wholesale. `Skeleton` hides each bar itself; wrap the region in
`SkeletonRegion` (or set `aria-busy` on the component's own box) so the labels
stay readable and the state is announced once.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `width` | `CSSProperties["width"]` | no | |
| `height` | `CSSProperties["height"]` | no | |
| `className` | `string` | no | E.g. `rounded-full` to override the default `rounded-[4px]`. |

## Usage

```tsx
import { Skeleton } from "@mari-design/components";
// or directly: from "./Skeleton"

<div className="flex flex-col gap-2">
  <Skeleton height={14} width="60%" />
  <Skeleton height={14} width="40%" />
</div>
<Skeleton className="rounded-full" width={26} height={26} />
```
