# Tooltip

**Type:** Navigation
**Source:** [`Tooltip.tsx`](./Tooltip.tsx) (this repo)

Hover/focus hint, wrapping [`@radix-ui/react-tooltip`](https://www.radix-ui.com/primitives/docs/components/tooltip). Inverted ink-on-paper (`bg-ink text-paper`) rather than the console's usual paper-on-ink, so it reads clearly as a floating layer over any surface underneath.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `label` | `ReactNode` | yes | Tooltip content. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | no | Default `"top"`. |
| `children` | `ReactNode` | yes | The trigger — must accept a ref (native element or `forwardRef` component). |

## Usage

```tsx
import { Tooltip, Button } from "@mari-design/components";
import { Info } from "lucide-react";
// or directly: from "./Tooltip"

<Tooltip label="Synced 3 minutes ago">
  <Button icon aria-label="Sync status"><Info size={14} /></Button>
</Tooltip>
```

## Notes

- Requires `@radix-ui/react-tooltip`. `delayDuration` is fixed at 250ms — don't make callers configure it, a consistent hover delay across the console is part of what makes it feel considered.
- The one component in this library that's dark-on-light instead of the console's usual light-on-dark-border treatment — deliberate, not an inconsistency: it needs to read as "floating above everything," including other floating surfaces like `Menu`/`Popover`.
