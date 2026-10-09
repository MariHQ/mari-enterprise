# Badge

**Type:** Data display
**Source:** [`Badge.tsx`](./Badge.tsx) (this repo)

A small status pill. This is the single semantic tone scale for the whole console — see BRAND-STYLE-GUIDE.md §1 and §7.

## Props

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `label` | `string` | yes | — | The badge text. |
| `tone` | `string` | no | `"neutral"` | See tone table below. Unrecognized tones fall back to `neutral`. |

## Tones

| Tone | Color | Meaning | Legacy aliases (still accepted) |
|---|---|---|---|
| `ok` | moss | Healthy / approved / synced / live | `approved`, `good` |
| `attention` | clay | Pending / syncing / in review / needs update | `pending`, `review`, `warn` |
| `blocked` | espelette | Failing / flagged / stale / needs evidence | `flagged`, `bad`, `error` |
| `info` | biscay-2 | Informational / active-by-design | `primary`, `technical` |
| `neutral` | ink/70 | Drafts and everything else | `muted` |

## Usage

```tsx
import { Badge } from "@mari-design/components";
// or directly: from "./Badge"

<Badge label="Synced" tone="ok" />
<Badge label="3 issues" tone="blocked" />
<Badge label="Pending review" tone="attention" />
```

## Notes

- **Never invent a new tone name.** If a screen needs a status this scale doesn't cover, map it onto the closest one of the five — don't add a sixth color. The legacy aliases exist because older code used different words for the same five meanings; new code should use the canonical names (`ok`/`attention`/`blocked`/`info`/`neutral`) directly rather than adding to the alias table.
- Text is always `font-term` (JetBrains Mono), 11px, uppercase-agnostic (the component doesn't force-uppercase — pass the casing you want in `label`).
- `resolveTone`/`resolveToneKey` are exported alongside `Badge` so other components can share this exact tone scale rather than re-declaring it — [`Chip`](./Chip.md) is built on top of them.
