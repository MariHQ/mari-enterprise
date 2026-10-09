# Spinner

**Type:** Data display
**Source:** [`Spinner.tsx`](./Spinner.tsx) (this repo)

The one spinner — a hairline ring with a `biscay-2` lead segment, two sizes.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `size` | `"sm" \| "md"` | no | `sm` (13px) for inline/button contexts, `md` (22px) for panel loads. Default `"sm"`. |
| `label` | `string` | no | `aria-label` on the `role="status"` element. Default `"Loading"`. |

## Usage

```tsx
import { Spinner, Button } from "@mari-design/components";
// or directly: from "./Spinner"

<Button disabled><Spinner size="sm" /> Saving…</Button>
<div className="grid place-items-center py-16"><Spinner size="md" label="Loading sources" /></div>
```

## Notes

- Pure CSS (`animate-spin` + border colors) — no SVG, no dependency.
