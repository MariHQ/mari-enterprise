# TagInput

**Type:** Forms
**Source:** [`TagInput.tsx`](./TagInput.tsx) (this repo)

An editable, multi-value chip list bound to a form field. `Chip` itself is display-only ([Chip.md](../data-display/Chip.md)); this is the input control that produces a list of them — tags, allow-listed domains, recipient lists.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `value` | `string[]` | yes | Controlled. |
| `onChange` | `(tags: string[]) => void` | yes | |
| `placeholder` | `string` | no | Shown only when `value` is empty. Default `"Add and press Enter…"`. |

## Usage

```tsx
import { TagInput } from "@mari-design/components";
// or directly: from "./TagInput"

<TagInput value={domains} onChange={setDomains} placeholder="Add an allowed domain…" />
```

## Notes

- Commits a tag on Enter, comma, or blur. Backspace on an empty draft removes the last tag (standard tag-input keyboard behavior).
- No dedupe-warning UI, no per-tag validation (e.g. domain format) — both are call-site concerns; this component only prevents literal duplicate strings.
