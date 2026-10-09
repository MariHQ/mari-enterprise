# FormField

**Type:** Forms
**Source:** [`FormField.tsx`](./FormField.tsx) (this repo)

A labeled editable-form row: `SectionLabel` + control + optional hint. **Not** to be confused with [`Field`](./Field.md) (this repo), which is a read-only key/value display row for detail panels — the two look similar but serve different contexts. Named `FormField` specifically to avoid that collision.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `label` | `string` | yes | |
| `hint` | `string` | no | Small `text-ink/50` line under the control. |
| `children` | `ReactNode` | yes | The control — `Input`, `Select`, `Textarea`, `Switch`, anything. |

## Usage

```tsx
import { FormField, Input, Select } from "@mari-design/components";
// or directly: from "./FormField"

<FormField label="Workspace name">
  <Input value={name} onChange={(e) => setName(e.target.value)} />
</FormField>

<FormField label="Environment" hint="Applies to new deployments only">
  <Select value={env} onChange={(e) => setEnv(e.target.value)}>
    <option value="staging">Staging</option>
    <option value="production">Production</option>
  </Select>
</FormField>
```
