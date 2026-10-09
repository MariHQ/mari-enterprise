# ContextMenu

**Type:** Navigation
**Source:** [`ContextMenu.tsx`](./ContextMenu.tsx) (this repo)

A right-click menu, wrapping [`@radix-ui/react-context-menu`](https://www.radix-ui.com/primitives/docs/components/context-menu). Same visual language as `Menu` (identical item/separator classes) — the only difference is the trigger mechanism. Use `Menu` for a normal click-triggered dropdown; use `ContextMenu` only where a right-click affordance is the actual interaction (e.g. a canvas/graph node, a file-tree row).

## Props — `ContextMenu`

| Prop | Type | Required | Notes |
|---|---|---|---|
| `trigger` | `ReactNode` | yes | The right-clickable element — wraps it, doesn't need `asChild`/a forwarded ref like `Menu`'s trigger does. |
| `children` | `ReactNode` | yes | `ContextMenuItem`/`ContextMenuCheckboxItem`/`ContextMenuSeparator`. |

`ContextMenuItem` takes the same `icon`/`danger`/`disabled`/`onSelect` props as `MenuItem`. `ContextMenuCheckboxItem` takes `checked`/`onCheckedChange`, same as `MenuCheckboxItem`.

## Usage

```tsx
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "@mari-design/components";
import { Pencil, Trash2 } from "lucide-react";
// or directly: from "./ContextMenu"

<ContextMenu trigger={<div className="node">{label}</div>}>
  <ContextMenuItem icon={<Pencil size={14} />} onSelect={rename}>Rename</ContextMenuItem>
  <ContextMenuSeparator />
  <ContextMenuItem danger icon={<Trash2 size={14} />} onSelect={remove}>Delete</ContextMenuItem>
</ContextMenu>
```

## Notes

- No `MenuRadioGroup`/`MenuLabel` equivalents here — right-click menus in this console are action lists, not settings pickers. Add them only if a real screen needs one, following `Menu.tsx`'s pattern.
