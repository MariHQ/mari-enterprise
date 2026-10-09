# Page

**Type:** Layout
**Source:** [`Page.tsx`](./Page.tsx) (this repo)

The top-level wrapper for every console screen. Provides the kicker/title/subtitle header block and a right-aligned actions slot; children render below.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | yes | The screen name. Rendered at 22px/800, `text-ink`. |
| `subtitle` | `string` | yes | One-line description under the title. `text-[13px] text-ink/60`, capped at `max-w-[680px]`. |
| `kicker` | `string` | no | Uppercase mono eyebrow above the title, with the square-bullet prefix (see BRAND-STYLE-GUIDE.md §2, "the kicker/eyebrow pattern"). Omit for screens that don't need a category label. |
| `actions` | `ReactNode` | no | Right-aligned slot next to the title row — buttons, filters. |
| `children` | `ReactNode` | yes | Screen body, rendered below the header block. |

## Usage

```tsx
import { Page } from "@mari-design/components";
// or directly: from "./Page"

<Page title="Localization" subtitle="Translation structure and staleness across common documentation layouts." kicker="docs">
  {/* screen body */}
</Page>
```

## Notes

- `Page` owns `min-h-full` and the base padding (`p-4 sm:p-6`) — don't re-add page-level padding inside `children`.
- The kicker bullet color is contextual: **biscay-2** inside the console (this component), **espelette** on marketing surfaces. `Page` is console-only, so don't change its kicker color to espelette to match a marketing mock.
- One `Page` per screen. Nested/second `Page` wrappers are a sign the screen should be split into tabs instead (see how `ClaimsPage` in `web-v2` avoids double headers by omitting its own `Page`/`PageHeader` when composing sub-screens).
