# PageHeader

**Type:** Layout
**Source:** [`PageHeader.tsx`](./PageHeader.tsx) (this repo)

The header block on its own — same kicker/title/subtitle/actions typography as [`Page`](./Page.md), plus a `backLink` affordance and a custom `icon` slot Page doesn't have. Use this instead of `Page` when a screen needs more control over its own body layout (e.g. a custom grid) than Page's single `children` slot allows.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | yes | Same treatment as `Page`'s title. |
| `eyebrow` | `string` | no | Same kicker pattern as `Page`'s `kicker` prop (biscay-2, square bullet). |
| `description` | `string` | no | Equivalent to `Page`'s `subtitle`. |
| `icon` | `ReactNode` | no | Rendered left of the title block. No default icon — this library doesn't ship decorative marks (see BRAND-STYLE-GUIDE.md's no-ornament rule). |
| `actions` | `ReactNode` | no | Right-aligned slot. |
| `backLink` | `{ href: string; label: string }` | no | "← Back" affordance above the eyebrow/title. |

## Usage

```tsx
import { PageHeader } from "@mari-design/components";
// or directly: from "./PageHeader"

<PageHeader
  title="Source review"
  eyebrow="Governance"
  description="Pending changes awaiting approval before they sync to production."
  backLink={{ href: "/sources", label: "Sources" }}
  actions={<Button variant="primary">Approve all</Button>}
/>
```

## Notes

- **`Page` vs `PageHeader`:** `Page` owns the whole screen (padding + header + children) — reach for it first, it's the right call for almost every screen. `PageHeader` exists for the minority case where the body needs a layout `Page`'s single `children` slot can't express.
- Don't use both on the same screen — that's a double-header, the exact thing `ClaimsPage`'s no-own-header pattern (see `Page.md`) exists to avoid.
