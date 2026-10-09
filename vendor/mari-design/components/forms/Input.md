# Input / Select / Textarea

**Type:** Forms
**Source:** [`Input.tsx`](./Input.tsx), [`Select.tsx`](./Select.tsx), [`Textarea.tsx`](./Textarea.tsx) (this repo)

Plain styled form controls — the pattern `DataTable`'s search box and facet `<select>` were already using inline, extracted here so it isn't duplicated a third time (this was an explicitly flagged gap in `Field.md`). Each wraps a native element with a `forwardRef`, so they work with any form library that needs a ref.

## Props

All three forward every native attribute for their element (`InputHTMLAttributes`, `SelectHTMLAttributes`, `TextareaHTMLAttributes`) plus:

| Component | Extra prop | Type | Notes |
|---|---|---|---|
| `Textarea` | `short` | `boolean` | 3 rows instead of the default 6. Ignored if you pass an explicit `rows`. |

## Usage

```tsx
import { Input, Select, Textarea, FormField } from "@mari-design/components";
// or directly: from "./Input" / "./Select" / "./Textarea"

<FormField label="Name">
  <Input placeholder="e.g. Acme Corp" value={name} onChange={(e) => setName(e.target.value)} />
</FormField>

<Select value={role} onChange={(e) => setRole(e.target.value)}>
  <option value="admin">Admin</option>
  <option value="viewer">Viewer</option>
</Select>

<Textarea short placeholder="Reason for this change…" />
```

## Notes

- Same `h-9`/`px-3`/`border-ink/20`/`focus:border-biscay-2` treatment as `DataTable`'s search box, so a form built from these sits visually consistent with the console's existing search/filter controls.
- No built-in error state — a validation-error variant isn't part of this library yet. If you need one, style the border red (`border-espelette`) at the call site rather than inventing a new prop here until there's a second consumer to generalize from.
