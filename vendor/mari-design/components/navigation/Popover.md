# Popover

**Type:** Navigation
**Source:** [`Popover.tsx`](./Popover.tsx) (this repo)

Click-open card popover, wrapping [`@radix-ui/react-popover`](https://www.radix-ui.com/primitives/docs/components/popover). For hover hints use [`Tooltip`](./Tooltip.md); for a list of actions use [`Menu`](./Menu.md).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `trigger` | `ReactNode` | yes | Rendered via Radix `asChild` — must accept a ref. |
| `align` | `"start" \| "center" \| "end"` | no | Default `"end"`. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | no | Default `"bottom"`. |
| `className` | `string` | no | Appended to the content panel. |
| `children` | `ReactNode` | yes | Arbitrary content — the panel already has `p-4`. |

## Usage

```tsx
import { Popover, Button } from "@mari-design/components";
// or directly: from "./Popover"

<Popover trigger={<Button compact>Filters</Button>}>
  <SectionLabel>Status</SectionLabel>
  {/* filter controls */}
</Popover>
```

## Notes

- Requires `@radix-ui/react-popover`. Uses the same `card` token as `Menu`'s content panel.
