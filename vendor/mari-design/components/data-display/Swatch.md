# Swatch

**Type:** Data display
**Source:** [`Swatch.tsx`](./Swatch.tsx) (this repo)

A small color chip with an optional label — token displays, harvested brand-color candidates in an import/branding flow. Pass `onClick` to make it a pickable, `aria-pressed` button.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `color` | `string` | yes | Any CSS color (hex, `rgb()`, `var()`). |
| `label` | `ReactNode` | no | `font-term`, next to the chip. |
| `selected` | `boolean` | no | Biscay-2 ring. |
| `onClick` | `() => void` | no | Renders a `<button>` instead of a `<span>` when set. |
| `title` | `string` | no | Defaults to the raw `color` value. |
| `className` | `string` | no | |

## Usage

```tsx
import { Swatch } from "@mari-design/components";
// or directly: from "./Swatch"

<Swatch color="#1C3F60" label="biscay" selected onClick={() => pick("#1C3F60")} />
```
