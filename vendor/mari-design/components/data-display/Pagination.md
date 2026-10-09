# Pagination

**Type:** Data display
**Source:** [`Pagination.tsx`](./Pagination.tsx) (this repo)

A standalone pager. `DataTable` already has one of these built in for its own rows — reach for this one to paginate anything that isn't a table (a card grid, a gallery of results).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `page` | `number` | yes | 0-indexed. |
| `pageCount` | `number` | yes | |
| `onChange` | `(page: number) => void` | yes | |
| `itemLabel` | `string` | no | Left-aligned text, e.g. `"41–60 of 128"`. |

## Usage

```tsx
import { Pagination } from "@mari-design/components";
// or directly: from "./Pagination"

<Pagination page={page} pageCount={Math.ceil(total / pageSize)} onChange={setPage} itemLabel={`${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`} />
```

## Notes

- Same button treatment as `DataTable`'s built-in pager (`w-7 h-7 rounded-[4px] border border-ink/20`) — kept identical on purpose so both read as the same control.

## Disabled arrows

At the first/last page the arrow keeps its (slightly darker) outline and greys out
only the inside, so it still reads as a control instead of dissolving into the
page. The class is exported as `pagerBtn` and shared with `DataTable`'s built-in
pager.
