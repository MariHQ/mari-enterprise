# Tabs

**Type:** Navigation *(new type folder — Tabs is the first component that isn't layout/forms/actions/data-display/tokens)*
**Source:** [`Tabs.tsx`](./Tabs.tsx) (this repo)

Thin, restyled wrapper over [`@radix-ui/react-tabs`](https://www.radix-ui.com/primitives/docs/components/tabs) — Radix supplies keyboard nav (arrow keys, Home/End) and ARIA wiring; every visual class is Brutalist Blueprint console-mode. `@radix-ui/react-tabs` is a **new peer dependency** for this library (not needed by any other component here yet) — it's already present in both `mari-cc/console` and `mari/web`'s real dependency trees, so this isn't introducing anything unproven.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `ariaLabel` | `string` | yes | Passed to the underlying `Tabs.List` as `aria-label`. |
| `options` | `TabOption<T>[]` | yes | `{ id: T; label: string; count?: number; icon?: ReactNode }`. |
| `value` | `T` | yes | Controlled — the active tab id. |
| `onChange` | `(id: T) => void` | yes | Called on selection. |
| `variant` | `"seg" \| "underline"` | no | `seg` (default): bordered segmented track, active tab gets a filled paper background. `underline`: flat row with a `biscay-2` underline on the active tab — for dense page-header contexts. |
| `className` | `string` | no | Applied to the `Tabs.List` container. |

## Usage

```tsx
import { Tabs } from "@mari-design/components";
// or directly: from "./Tabs"

type ClaimsTab = "answers" | "decisions" | "facts";
const [tab, setTab] = useState<ClaimsTab>("answers");

<Tabs<ClaimsTab>
  ariaLabel="Claims view"
  variant="seg"
  value={tab}
  onChange={setTab}
  options={[
    { id: "answers", label: "Answers" },
    { id: "decisions", label: "Decisions", count: 4 },
    { id: "facts", label: "Facts" },
  ]}
/>
```

## Notes

- `activationMode="manual"`: arrow keys move focus between tabs without switching content until Enter/Space/click — matches how the reference console's tab rows behave, and avoids content flicker for screen-reader/keyboard users tabbing through quickly.
- Generic over `T extends string` so `value`/`onChange`/`options[].id` stay type-safe against a specific tab-id union, same pattern as the reference implementation.
- The reference implementation also has a third `"filter"` variant (a denser chip-style row for filter-bar contexts). Not implemented here yet — `seg` and `underline` cover the two variants actually seen in use across the console's real pages (segmented tab switches and dense settings/detail headers).
