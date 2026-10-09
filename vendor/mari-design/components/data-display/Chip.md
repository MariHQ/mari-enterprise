# Chip

**Type:** Data display
**Source:** [`Chip.tsx`](./Chip.tsx) (this repo)

`Badge`'s interactive sibling: same [5-tone semantic scale](./Badge.md) (`ok`/`attention`/`blocked`/`info`/`neutral`, plus the same alias table), with a status dot, an optional pulse animation, an icon slot, click-to-select, and a remove (×) affordance. Renders a `<button>` when `onClick` is passed, a `<span>` otherwise.

Three semantic wrappers cover the common cases without hand-picking a tone each time: `StatusChip`, `SeverityChip`, `CountChip`.

## Props — `Chip`

| Prop | Type | Required | Notes |
|---|---|---|---|
| `label` | `ReactNode` | yes | |
| `tone` | `string` | no | Any key from `TONE` or `TONE_ALIAS` in `Badge.tsx`. Default `"neutral"`. |
| `dot` | `boolean` | no | Small solid-color status dot before the label, colored to match `tone`. |
| `pulse` | `boolean` | no | Adds a ping ring around the dot (e.g. "Running"). Only visible when `dot` is also `true`. |
| `caps` | `boolean` | no | Uppercase + letter-spacing, for short severity-style labels. |
| `icon` | `ReactNode` | no | Rendered before the label, after the dot. |
| `selected` | `boolean` | no | Adds a `biscay-2` ring — for a filter chip that's currently active. |
| `onClick` | `() => void` | no | If set, renders as a `<button>` instead of a `<span>`. |
| `onRemove` | `() => void` | no | Adds a trailing × button; click is stopped from bubbling to `onClick`. |
| `removeLabel` | `string` | no | `aria-label` for the remove button. Default `"Remove"`. |

## Props — `StatusChip` / `SeverityChip` / `CountChip`

| Component | Prop | Type | Notes |
|---|---|---|---|
| `StatusChip` | `status` | `"verified" \| "canonical" \| "approved" \| "stale" \| "draft" \| "retired" \| "running" \| "failed" \| "needs-review"` | Maps each lifecycle state onto one of the 5 tones — see the `STATUS` table in the source. `running` pulses. |
| `SeverityChip` | `severity` | `"high" \| "med" \| "low"` | `high`→blocked, `med`→attention, `low`→neutral. Renders with `caps`. |
| `CountChip` | `count` | `number` | Numeric bubble, no label. Optional `tone` (default `"neutral"`). |

## Usage

```tsx
import { Chip, StatusChip, SeverityChip, CountChip } from "@mari-design/components";
// or directly: from "./Chip"

<StatusChip status="running" />
<SeverityChip severity="high" />
<CountChip count={12} tone="info" />

<Chip label="Owner: Priya" selected onClick={() => toggleFilter("priya")} />
<Chip label="draft-2026-07" onRemove={() => removeTag("draft-2026-07")} />
```

## Notes

- The 9 named `ChipStatus` values are the old reference implementation's wider vocabulary, deliberately **remapped onto the 5-tone scale** rather than reproduced as 9 separate colors — BRAND-STYLE-GUIDE.md §9 rules out ad-hoc new tones for "just this one chip." If a new status doesn't fit one of the 5 tones' meanings, that's a sign it needs a product conversation, not a new hex value.
- `Chip` and `Badge` intentionally look near-identical at rest (same `TONE` classes) — the difference is purely interaction. Reach for `Badge` for static labels, `Chip` when it's clickable, removable, or needs a live-state dot.
