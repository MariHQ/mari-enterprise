# Stepper

**Type:** Data display
**Source:** [`Stepper.tsx`](./Stepper.tsx) (this repo)

Numbered steps with a top rule that fills in (moss) as each completes, biscay on the active step. Omit `onSelect` for a read-only progress indicator (e.g. inside a running import); pass it for a clickable wizard.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `labels` | `string[]` | yes | One per step. |
| `current` | `number` | yes | 0-indexed. |
| `onSelect` | `(step: number) => void` | no | Omit for a read-only stepper. |
| `ariaLabel` | `string` | no | Default `"Progress"`. |

## Usage

```tsx
import { Stepper } from "@mari-design/components";
// or directly: from "./Stepper"

<Stepper labels={["Connect", "Configure", "Review", "Done"]} current={1} onSelect={setStep} />
```
