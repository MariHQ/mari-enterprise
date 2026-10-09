# SectionLabel

**Type:** Forms
**Source:** [`SectionLabel.tsx`](./SectionLabel.tsx) (this repo)

The uppercase mono label on its own — list headers, filter-group headings, anywhere the `Field`/`FormField` label treatment is needed without the rest of the row. `Field` and `FormField` both build on this rather than duplicating the class string.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `children` | `ReactNode` | yes | |
| `className` | `string` | no | Appended to the base classes. |

## Usage

```tsx
import { SectionLabel } from "@mari-design/components";
// or directly: from "./SectionLabel"

<SectionLabel>Filters</SectionLabel>
```
