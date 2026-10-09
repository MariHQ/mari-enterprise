# Switch

**Type:** Forms
**Source:** [`Switch.tsx`](./Switch.tsx) (this repo)

A toggle, wrapping [`@radix-ui/react-switch`](https://www.radix-ui.com/primitives/docs/components/switch) for real keyboard/ARIA behavior. Pass `label` for a clickable labeled row; omit it for a bare control (then pass `aria-label` instead).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `checked` | `boolean` | yes | Controlled. |
| `onCheckedChange` | `(checked: boolean) => void` | yes | |
| `label` | `ReactNode` | no | If set, wraps the control in a clickable `<label>`. |
| `disabled` | `boolean` | no | |
| `aria-label` | `string` | no | Required if `label` is omitted. |

## Usage

```tsx
import { Switch } from "@mari-design/components";
// or directly: from "./Switch"

<Switch checked={autoSync} onCheckedChange={setAutoSync} label="Auto-sync to production" />
<Switch checked={compact} onCheckedChange={setCompact} aria-label="Compact view" />
```

## Notes

- Requires `@radix-ui/react-switch` as a peer dependency (already present in both `mari-cc/console` and `mari/web`).
- Checked state fills `biscay` — the same fill color as `Button`'s primary variant, so an "on" switch and a primary action read as the same weight of affirmative state.
