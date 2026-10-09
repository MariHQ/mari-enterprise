# Drawer

**Type:** Layout (overlay)
**Source:** [`Drawer.tsx`](./Drawer.tsx) (this repo)

Right-side slide-over for viewing/editing a single record without leaving the list behind it. Full focus-trap: traps Tab/Shift+Tab inside the panel, restores focus to the trigger on close, closes on Escape.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `open` | `boolean` | yes | Controlled — the component renders `null` when `false`. |
| `onClose` | `() => void` | yes | Called on Escape, backdrop click, or the header close button. |
| `title` | `string` | yes | Header title, truncates with an ellipsis rather than wrapping. |
| `subtitle` | `string` | no | Small uppercase mono line under the title (`font-term text-[11px] uppercase tracking-[0.08em] text-ink/55`). |
| `icon` | `ReactNode` | no | Rendered left of the title in the header. |
| `footer` | `ReactNode` | no | Sticky footer row, e.g. Save/Cancel actions. |
| `children` | `ReactNode` | yes | Scrollable body. |

## Usage

```tsx
import { Drawer } from "@mari-design/components";
// or directly: from "./Drawer"

<Drawer
  open={selected != null}
  onClose={() => setSelected(null)}
  title={selected?.name ?? ""}
  subtitle="Word list"
  footer={<Button variant="primary" onClick={save}>Save</Button>}
>
  {/* record detail / edit form */}
</Drawer>
```

## Notes

- Width is fixed at `max-w-[460px]` (or full width under that on small viewports) — don't override per-instance; if content needs more room, it belongs on its own screen, not a wider drawer.
- No backdrop blur — a plain `ink/30` scrim only (see BRAND-STYLE-GUIDE.md §7, "Drawers/modals").
- The focus-trap logic (`FOCUSABLE` selector + keydown handler) is load-bearing accessibility code — don't strip it out when copying this component for a one-off variant.
