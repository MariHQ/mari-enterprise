# Field

**Type:** Forms
**Source:** [`Field.tsx`](./Field.tsx) (this repo)

A labeled row for read-only key/value display inside a `Drawer` or detail panel — not a form input wrapper. For an editable row (label + control + hint), see [`FormField`](./FormField.md) plus [`Input`/`Select`/`Textarea`](./Input.md).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `label` | `string` | yes | Uppercase mono label above the value (`font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/55`). |
| `children` | `ReactNode` | yes | The value — text, a `Badge`, a link, anything. |

## Usage

```tsx
import { Field } from "@mari-design/components";
// or directly: from "./Field"

<Field label="Owner">{doc.owner}</Field>
<Field label="Status"><Badge label={doc.status} tone="ok" /></Field>
```

## Notes

- Each `Field` gets a hairline bottom border (`border-b border-ink/10`) except the last child in its container (`last:border-0`) — stack them directly, no manual `<hr>` or spacer divs between.
- Shares its label styling with `FormField`/`SectionLabel` via the shared `SectionLabel` component, so the two row types stay visually consistent even though they serve different purposes (read-only vs. editable).
