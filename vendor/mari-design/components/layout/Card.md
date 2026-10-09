# Card

**Type:** Layout
**Source:** [`Card.tsx`](./Card.tsx) (this repo)

Generic bordered container for grouping content — the workhorse wrapper for anything that isn't a full-page `Page` or a `Table`/`DataTable`. Optional header row (icon + eyebrow/title + hint + actions) renders only when at least one of those props is set.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `variant` | `"default" \| "plain" \| "flush"` | no | Controls body padding: `default` (`p-4`), `plain` (`p-5`, more breathing room), `flush` (`p-0`, for content that manages its own padding — tables, images). Default `"default"`. |
| `title` | `ReactNode` | no | `text-[15px] font-semibold text-ink`, truncates. |
| `eyebrow` | `string` | no | Small mono uppercase label above the title, `text-biscay-2` (console-mode kicker color — see BRAND-STYLE-GUIDE.md §2). |
| `icon` | `ReactNode` | no | Rendered left of the title block. |
| `actions` | `ReactNode` | no | Right-aligned slot in the header row. |
| `hint` | `ReactNode` | no | Small mono text between the title and actions. |
| `children` | `ReactNode` | yes | Body content. |
| ...rest | `HTMLAttributes<HTMLElement>` | no | Spread onto the root `<section>` (minus `title`, which is claimed by the prop above). |

## Usage

```tsx
import { Card, Button } from "@mari-design/components";
// or directly: from "./Card"

<Card eyebrow="Workspace" title="API keys" hint="3 active" actions={<Button compact>New key</Button>}>
  {/* key list */}
</Card>

<Card variant="flush">
  <Table head={["Name", "Status"]}>{/* ... */}</Table>
</Card>
```

## Notes

- No header renders at all if `title`/`eyebrow`/`icon`/`actions`/`hint` are all omitted — a plain bordered box with just `children`.
- This is the console-mode `Card`, not the marketing-mode one: 4–6px radius, hairline `ink/15` border, no drop shadow (BRAND-STYLE-GUIDE.md §3). Don't add a `shadow-*` utility to it.
- For a card that already contains its own header-like content (e.g. a `Table` with its own title row), use `variant="flush"` so `Card` doesn't double up on padding.
