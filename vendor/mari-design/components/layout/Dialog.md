# Dialog

**Type:** Layout
**Source:** [`Dialog.tsx`](./Dialog.tsx) (this repo)

Centered modal, wrapping [`@radix-ui/react-dialog`](https://www.radix-ui.com/primitives/docs/components/dialog) for focus-trap/Escape/scroll-lock. For a longer detail view that should stay open alongside the list behind it, use [`Drawer`](./Drawer.md) instead — `Dialog` is for a short confirm/create flow that blocks the rest of the screen.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `open` | `boolean` | yes | Controlled. |
| `onOpenChange` | `(open: boolean) => void` | yes | Fires on Escape, backdrop click, or the header close button. |
| `title` | `string` | yes | |
| `description` | `string` | no | |
| `footer` | `ReactNode` | no | Right-aligned action row (e.g. Cancel/Save buttons). |
| `width` | `number` | no | Max width in px. Default `440`. |
| `children` | `ReactNode` | yes | Body. |

## Usage

```tsx
import { Dialog, Button } from "@mari-design/components";
// or directly: from "./Dialog"

<Dialog
  open={open}
  onOpenChange={setOpen}
  title="Create workspace"
  footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={create}>Create</Button></>}
>
  {/* form fields */}
</Dialog>
```

## Notes

- `open`/`onOpenChange` (not `onClose`) is deliberate — this is the idiomatic Radix naming already used elsewhere in this library (`Switch.onCheckedChange`, `Menu`'s checkbox items), and unlike `Drawer`, `Dialog` is commonly opened from many different trigger points (a table row action, a keyboard shortcut) rather than one fixed place, so controlled open state is the natural shape.
