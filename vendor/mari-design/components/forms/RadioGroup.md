# RadioGroup

**Type:** Forms
**Source:** [`RadioGroup.tsx`](./RadioGroup.tsx) (this repo)

A standalone radio button group, wrapping [`@radix-ui/react-radio-group`](https://www.radix-ui.com/primitives/docs/components/radio-group). For a radio choice inside a dropdown menu, use `Menu`'s `MenuRadioGroup`/`MenuRadioItem` instead — this is for a form.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `value` | `string` | yes | Controlled. |
| `onValueChange` | `(value: string) => void` | yes | |
| `options` | `{ value: string; label: string; hint?: string }[]` | yes | `hint` renders a small muted line under the label. |
| `ariaLabel` | `string` | yes | |
| `disabled` | `boolean` | no | |

## Usage

```tsx
import { RadioGroup } from "@mari-design/components";
// or directly: from "./RadioGroup"

<RadioGroup
  ariaLabel="Deployment target"
  value={target}
  onValueChange={setTarget}
  options={[
    { value: "staging", label: "Staging" },
    { value: "production", label: "Production", hint: "Requires an approved change request" },
  ]}
/>
```
