# Sparkline

**Type:** Data display
**Source:** [`Sparkline.tsx`](./Sparkline.tsx) (this repo)

A small inline SVG trend line for compact readouts — answers served/week, source sync pulse. No dependency; renders a bare `<polyline>`.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `values` | `number[]` | yes | Returns `null` if fewer than 2 points. |
| `width` | `number` | no | Default `92`. |
| `height` | `number` | no | Default `26`. |
| `tone` | `"ok" \| "attention" \| "blocked" \| "info" \| "neutral"` | no | Same 5-tone scale as `Badge`/`Chip`/`Stat`. Default `"ok"`. |

## Usage

```tsx
import { Sparkline } from "@mari-design/components";
// or directly: from "./Sparkline"

<Sparkline values={[12, 18, 14, 22, 27, 24, 31]} tone="ok" />
```

## Notes

- Colors are hardcoded hex values matching BRAND-STYLE-GUIDE.md's palette table, not Tailwind classes or CSS custom properties — SVG `stroke` needs a real color value, and this library doesn't assume the consuming app wires the brand palette as CSS variables (only as Tailwind config, which utility classes read directly but raw SVG attributes can't).
