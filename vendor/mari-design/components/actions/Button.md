# Button

**Type:** Actions
**Source:** [`Button.tsx`](./Button.tsx) (this repo)

The full interactive button component — five variants, three size modes. For a raw class string to apply to a non-`<button>` element (an `<a>`, a `<label>`), use [`btn`/`btnPrimary`/`btnDanger`](./Buttons.md) instead; those three are the visual equivalents of `variant="default"|"primary"|"danger"` here.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `variant` | `"default" \| "primary" \| "success" \| "danger" \| "link"` | no | Default `"default"` (bordered, neutral). `primary` = biscay fill. `success` = moss fill. `danger` = espelette outline. `link` = no chrome, biscay-2 text. |
| `compact` | `boolean` | no | Shorter height (`h-7`) and tighter padding, for toolbars/table rows. |
| `icon` | `boolean` | no | Square `w-9 h-9`, no text padding — for an icon-only button. Pair with `aria-label`. |
| `block` | `boolean` | no | `width: 100%`. |
| ...rest | `ButtonHTMLAttributes<HTMLButtonElement>` | no | `type` defaults to `"button"` (never submits a form by accident). Forwards a ref. |

## Usage

```tsx
import { Button } from "@mari-design/components";
// or directly: from "./Button"

<Button variant="primary">Save changes</Button>
<Button variant="danger" compact onClick={onDelete}>Delete</Button>
<Button variant="link" onClick={onExpand}>View all</Button>
<Button icon aria-label="Close" onClick={onClose}><X size={16} /></Button>
```

## Notes

- `compact` and `icon` are mutually exclusive sizing modes — if both are set, `icon` wins (checked first in the source).
- `focusRing` is applied unconditionally; don't strip it for a "cleaner" look.
- There's no `Button` equivalent of the reference `success` variant's exact hover shade documented in BRAND-STYLE-GUIDE.md — `#235939` is a deliberately darker hand-picked moss used consistently as the hover state for moss-filled surfaces across the console; treat it as a de facto token even though it isn't in the core palette table.
