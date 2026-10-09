# Buttons

**Type:** Actions
**Source:** [`buttons.ts`](./buttons.ts) (this repo)

Three Tailwind class-string variants, not React components — apply directly to a `<button>` or `<a>`. Kept in one file since they're variants of a single concept, not three separate components (see `mari-design/README.md` conventions).

## Variants

| Export | Use | Visual |
|---|---|---|
| `btn` | Default / secondary action | Hairline `ink/20` border, transparent fill, `ink/80` text. Hover darkens border + text to full ink. |
| `btnPrimary` | The one primary action per view | Solid `biscay` fill, white text. Hover shifts to `biscay-2`. |
| `btnDanger` | Destructive actions (delete, revoke) | Hairline `espelette/40` border, `espelette` text, transparent fill. Hover fills `espelette/[0.06]`. |

All three share: `h-9`, `rounded-[4px]`, `text-[13px]`, `inline-flex items-center gap-1.5`, and the shared `focusRing` token baked in.

## Usage

```tsx
import { btn, btnPrimary, btnDanger } from "@mari-design/components";
// or directly: from "./buttons"

<button className={btn}>Cancel</button>
<button className={btnPrimary}>Save changes</button>
<button className={btnDanger}>Delete list</button>
```

## Notes

- **One `btnPrimary` per screen/section.** If two actions feel equally important, that's a sign one of them should be `btn`, not that both should be primary.
- These are plain strings, not a `<Button>` component with a `variant` prop — apply them directly to whatever element you're rendering (`<button>`, `<a>`, even a `<label>` styled as a button). Don't wrap them in a new component unless you're adding real behavior (loading state, icon slot) beyond styling.
- No size variants exist yet (no `sm`/`lg`). If a screen needs a smaller button, that's a gap to fill here, not a reason to hand-write a one-off class string in a group file.
