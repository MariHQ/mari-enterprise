# Progress

**Type:** Data display
**Source:** [`Progress.tsx`](./Progress.tsx) (this repo)

A determinate linear progress bar, wrapping [`@radix-ui/react-progress`](https://www.radix-ui.com/primitives/docs/components/progress). Distinct from `Spinner` (indeterminate) and `Stepper` (discrete named steps) — use this for a real percentage (an import job, a sync in progress).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `value` | `number` | yes | 0–100; clamped. |
| `label` | `string` | no | Renders above the bar with the percentage right-aligned. |
| `tone` | `"ok" \| "attention" \| "blocked" \| "info"` | no | Fill color. Default `"info"`. |

## Usage

```tsx
import { Progress } from "@mari-design/components";
// or directly: from "./Progress"

<Progress value={62} label="Importing documents" tone="info" />
```
