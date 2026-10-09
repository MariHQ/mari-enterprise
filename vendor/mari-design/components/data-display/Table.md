# Table

**Type:** Data display
**Source:** [`Table.tsx`](./Table.tsx) (this repo)

A caller-composed table shell: header row, hairline dividers, optional title/count/actions/footer chrome. Headers render through `SortHeader`, so every column carries the standard sort affordance and rows re-order in place (client-side, text-based). Columns whose cells are all numeric center themselves. For search, faceted filtering and pagination, use [`DataTable`](./DataTable.md) instead.

## Props

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `title` | `string` | no | — | Rendered above the table with an optional count chip. |
| `count` | `number` | no | — | Shown as a small mono chip next to `title` (only if `title` is also set). |
| `head` | `(string \| TableHeadCol)[]` | yes | — | A plain string is shorthand for `{ label }`. `TableHeadCol` is `{ label, key?, align?, sortable? }`. |
| `actions` | `ReactNode` | no | — | Table-level action button. Rendered top right (CONVENTIONS §2). |
| `footer` | `ReactNode` | no | — | Rendered below the table, e.g. pagination or a summary row. |
| `minW` | `number` | no | `700` | Minimum table width in px before horizontal scroll kicks in. |
| `children` | `ReactNode` | yes | — | `<tr>` rows: you write the `<tbody>` content yourself. Cell padding is applied by the table, so any `p-*` class on a `<td>` is stripped for uniform spacing. |

## Usage

```tsx
import { Table } from "@mari-design/components";
// or directly: from "./Table"

<Table title="Word lists" count={lists.length} head={["Name", { label: "Entries", align: "center" }, "Updated"]}>
  {lists.map((l) => (
    <tr key={l.id}>
      <td>{l.name}</td>
      <td>{l.entries.length}</td>
      <td>{l.updatedAt}</td>
    </tr>
  ))}
</Table>
```

## When to reach for `DataTable` instead

Use plain `Table` for short, static lists (under ~10 rows, no need to search/sort/filter). The moment a screen needs any of search, per-column sort, faceted filtering, pagination, row click, or an empty state — stop hand-rolling those inside `Table`'s `children` and switch to `DataTable`, which already has all of that built in.
