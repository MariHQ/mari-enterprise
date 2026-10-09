# Separator

**Type:** Layout
**Source:** [`Separator.tsx`](./Separator.tsx) (this repo)

A hairline divider, wrapping [`@radix-ui/react-separator`](https://www.radix-ui.com/primitives/docs/components/separator) for correct `role`/`aria-orientation`. Replaces the ad-hoc `border-t border-ink/10` divs used inline throughout this library (e.g. `Menu`'s `MenuSeparator`, which predates this and stays as-is inside dropdowns).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `orientation` | `"horizontal" \| "vertical"` | no | Default `"horizontal"`. |
| `className` | `string` | no | |

## Usage

```tsx
import { Separator } from "@mari-design/components";
// or directly: from "./Separator"

<Separator className="my-4" />
<div className="flex items-center gap-3">
  <span>Sources</span>
  <Separator orientation="vertical" className="h-4" />
  <span>128 active</span>
</div>
```
