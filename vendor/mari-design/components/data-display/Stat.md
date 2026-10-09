# Stat

**Type:** Data display
**Source:** [`Stat.tsx`](./Stat.tsx) (this repo)

A stat card — big display number, label, optional colored sub note. Pass `onClick` for the click-to-filter affordance (a strip of `Stat`s above a `DataTable` that each apply a facet filter when clicked).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `value` | `ReactNode` | yes | `text-[24px] font-bold`. |
| `label` | `ReactNode` | yes | |
| `sub` | `ReactNode` | no | Colored by `tone`. |
| `tone` | `"ok" \| "attention" \| "blocked" \| "info" \| "neutral"` | no | Colors `sub` only — same 5-tone scale as `Badge`/`Chip`. Default `"neutral"`. |
| `icon` | `ReactNode` | no | Top-right slot. |
| `onClick` | `MouseEventHandler<HTMLButtonElement>` | no | Renders a `<button>` instead of a `<div>` when set. |
| `className` | `string` | no | |

## Usage

```tsx
import { Stat } from "@mari-design/components";
import { TrendingUp } from "lucide-react";
// or directly: from "./Stat"

<div className="grid grid-cols-4 gap-3">
  <Stat value={128} label="Answers served" sub="+12% this week" tone="ok" icon={<TrendingUp size={16} />} />
  <Stat value={4} label="Needs review" tone="attention" onClick={() => setFacet("needs-review")} />
</div>
```

## Notes

- The reference implementation also had a `swatch` slot (a left-edge texture placeholder). Not carried over — this library has no texture system (brutalist is deliberately flat), so it collapsed into just `icon`.

## Width

Stat tiles are uniform: each carries `flex-1 basis-[200px] min-w-[200px]`, so a
row of them renders at equal width regardless of how long the value or label is.
