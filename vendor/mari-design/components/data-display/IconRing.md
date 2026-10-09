# IconRing

**Type:** Data display
**Source:** [`IconRing.tsx`](./IconRing.tsx) (this repo)

A circle around an icon — card heads, notification rows, feed items.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `tone` | `"ink" \| "ok" \| "attention" \| "blocked" \| "info"` | no | Default `"ink"` (neutral). Same 5-tone family as `Badge`/`Chip`/`Stat`, minus `neutral` (ink already is the neutral/default here). |
| `size` | `number` | no | Diameter in px. Default `31`. |
| `children` | `ReactNode` | yes | The icon. |
| `className` | `string` | no | |

## Usage

```tsx
import { IconRing, Card } from "@mari-design/components";
import { FileText } from "lucide-react";
// or directly: from "./IconRing"

<Card icon={<IconRing tone="info"><FileText size={15} /></IconRing>} title="Refund policy" />
```

## Notes

- Tone names were remapped from the reference's `green`/`red`/`blue`/`gold` to the canonical `ok`/`blocked`/`info`/`attention` scale — same reasoning as `Chip`: one semantic vocabulary reused everywhere, not a second color system.
