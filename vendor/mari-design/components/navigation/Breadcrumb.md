# Breadcrumb

**Type:** Navigation
**Source:** [`Breadcrumb.tsx`](./Breadcrumb.tsx) (this repo)

A multi-level trail. `PageHeader`'s `backLink` covers the one-level-back case; use `Breadcrumb` when a screen is nested more than one level deep.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `items` | `{ label: string; href?: string }[]` | yes | The last item renders as the current page (`aria-current="page"`, no link) regardless of whether it has an `href`. |

## Usage

```tsx
import { Breadcrumb } from "@mari-design/components";
// or directly: from "./Breadcrumb"

<Breadcrumb items={[{ label: "Sources", href: "/sources" }, { label: "github.com/acme/docs", href: "/sources/gh-1" }, { label: "Review" }]} />
```
