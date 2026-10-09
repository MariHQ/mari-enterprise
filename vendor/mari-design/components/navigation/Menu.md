# Menu

**Type:** Navigation
**Source:** [`Menu.tsx`](./Menu.tsx) (this repo)

The one dropdown menu — wraps [`@radix-ui/react-dropdown-menu`](https://www.radix-ui.com/primitives/docs/components/dropdown-menu). Outside click, Escape, and keyboard nav all come from Radix. Exports `Menu`, `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuRadioItem`, `MenuLabel`, `MenuSeparator`.

## Props — `Menu`

| Prop | Type | Required | Notes |
|---|---|---|---|
| `trigger` | `ReactNode` | yes | Rendered via Radix `asChild` — must accept a ref (a native element or a `forwardRef` component, e.g. `Button`). |
| `align` | `"start" \| "center" \| "end"` | no | Default `"end"`. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` | no | Default `"bottom"`. |
| `minWidth` | `number` | no | |
| `children` | `ReactNode` | yes | `MenuItem`/`MenuCheckboxItem`/`MenuRadioGroup`/`MenuLabel`/`MenuSeparator`. |

## Props — `MenuItem`

| Prop | Type | Required | Notes |
|---|---|---|---|
| `icon` | `ReactNode` | no | |
| `end` | `ReactNode` | no | Trailing slot (shortcut hint, chevron). |
| `danger` | `boolean` | no | Espelette text + highlight tint — for destructive actions. |
| `disabled` | `boolean` | no | |
| `onSelect` | `() => void` | no | |

`MenuCheckboxItem` takes `checked`/`onCheckedChange`; `MenuRadioGroup` takes `value`/`onValueChange` and wraps `MenuRadioItem`s (each takes `value`); `MenuLabel` and `MenuSeparator` take no props beyond `children`.

## Usage

```tsx
import { Menu, MenuItem, MenuSeparator, Button } from "@mari-design/components";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
// or directly: from "./Menu"

<Menu trigger={<Button icon aria-label="More"><MoreVertical size={15} /></Button>}>
  <MenuItem icon={<Pencil size={14} />} onSelect={rename}>Rename</MenuItem>
  <MenuSeparator />
  <MenuItem danger icon={<Trash2 size={14} />} onSelect={remove}>Delete</MenuItem>
</Menu>
```

## Notes

- Requires `@radix-ui/react-dropdown-menu` (present in both consuming apps' dependency trees).
- Reuses the `card` token for the content panel — same hairline-border, no-shadow treatment as every other floating surface in this library.
- For a hover-triggered hint use [`Tooltip`](./Tooltip.md); for a click-triggered arbitrary content panel (not a list of actions) use [`Popover`](./Popover.md).
