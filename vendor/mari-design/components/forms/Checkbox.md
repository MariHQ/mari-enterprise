# Checkbox

**Type:** Forms
**Source:** [`Checkbox.tsx`](./Checkbox.tsx) (this repo)

Wraps [`@radix-ui/react-checkbox`](https://www.radix-ui.com/primitives/docs/components/checkbox). Supports a third `"indeterminate"` state (a table's select-all checkbox when some but not all rows are selected).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `checked` | `boolean \| "indeterminate"` | yes | Controlled. |
| `onCheckedChange` | `(checked: boolean) => void` | yes | Always receives a plain boolean, even from an indeterminate state (clicking resolves it). |
| `label` | `ReactNode` | no | Wraps in a clickable `<label>` when set. |
| `disabled` | `boolean` | no | |
| `aria-label` | `string` | no | Required if `label` is omitted. |

## Usage

```tsx
import { Checkbox } from "@mari-design/components";
// or directly: from "./Checkbox"

<Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all rows" />
<Checkbox checked={agreed} onCheckedChange={setAgreed} label="I understand this can't be undone" />
```
