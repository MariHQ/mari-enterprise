# Toggle / ToggleGroup

**Type:** Actions
**Source:** [`Toggle.tsx`](./Toggle.tsx) (this repo)

`Toggle` is a single on/off press-button (wraps [`@radix-ui/react-toggle`](https://www.radix-ui.com/primitives/docs/components/toggle)). `ToggleGroup` is a set of them sharing one selection state (wraps [`@radix-ui/react-toggle-group`](https://www.radix-ui.com/primitives/docs/components/toggle-group)).

**`ToggleGroup` vs. `Tabs`:** visually similar to `Tabs`' `"seg"` variant, but semantically different — `Tabs` switches between separate content panels (only one panel exists at a time); `ToggleGroup` narrows or filters content that's already on screen (a view-density toggle, a "show archived" filter). Picking the wrong one is a real usability difference: a `Tabs` selection usually changes the URL/route, a `ToggleGroup` selection usually doesn't.

## Props — `Toggle`

| Prop | Type | Required | Notes |
|---|---|---|---|
| `pressed` | `boolean` | yes | |
| `onPressedChange` | `(pressed: boolean) => void` | yes | |
| `aria-label` | `string` | no | |

## Props — `ToggleGroup`

Discriminated on `type`:

| Prop | Type | Notes |
|---|---|---|
| `type: "single"` | — | `value: string`, `onValueChange: (value: string) => void` |
| `type: "multiple"` | — | `value: string[]`, `onValueChange: (value: string[]) => void` |
| `options` | `{ value: string; label: ReactNode; "aria-label"?: string }[]` | |
| `ariaLabel` | `string` | |

## Usage

```tsx
import { Toggle, ToggleGroup } from "@mari-design/components";
import { LayoutGrid, List } from "lucide-react";
// or directly: from "./Toggle"

<Toggle pressed={showArchived} onPressedChange={setShowArchived} aria-label="Show archived">Archived</Toggle>

<ToggleGroup
  type="single"
  ariaLabel="Layout"
  value={layout}
  onValueChange={setLayout}
  options={[
    { value: "grid", label: <LayoutGrid size={14} />, "aria-label": "Grid" },
    { value: "list", label: <List size={14} />, "aria-label": "List" },
  ]}
/>
```
