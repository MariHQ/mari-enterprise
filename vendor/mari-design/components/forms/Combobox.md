# Combobox

**Type:** Forms
**Source:** [`Combobox.tsx`](./Combobox.tsx) (this repo)

A searchable select. `Select` wraps the native `<select>` (fine for short lists); reach for `Combobox` once a list is long enough that scanning it top-to-bottom isn't practical. No native Radix combobox primitive exists — this composes `Popover` plus a hand-rolled listbox (same shape as `GlobalSearch`, smaller scope: single-select, no keyboard arrow nav, click/type-to-filter only).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `value` | `string \| null` | yes | Controlled. |
| `onChange` | `(value: string) => void` | yes | |
| `options` | `{ value: string; label: string }[]` | yes | |
| `placeholder` | `string` | no | Default `"Select…"`. |
| `searchPlaceholder` | `string` | no | Default `"Search…"`. |
| `ariaLabel` | `string` | yes | |

## Usage

```tsx
import { Combobox } from "@mari-design/components";
// or directly: from "./Combobox"

<Combobox
  ariaLabel="Owner"
  value={ownerId}
  onChange={setOwnerId}
  options={members.map((m) => ({ value: m.id, label: m.name }))}
  placeholder="Assign an owner…"
/>
```

## Notes

- The dropdown width matches the trigger's width (`var(--radix-popover-trigger-width)`) — don't fix a manual width, it'll drift out of sync if the trigger's own width changes.
