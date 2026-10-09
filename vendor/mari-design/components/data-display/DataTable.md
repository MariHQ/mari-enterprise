# DataTable

**Type:** Data display
**Source:** [`DataTable.tsx`](./DataTable.tsx) (this repo)

The interactive table: search, per-column sort, one facet filter, pagination, row click, and an empty state — all built in. Generic over the row type `T`.

## Props

| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `title` | `string` | no | — | Header title + optional count chip. |
| `count` | `number` | no | — | Count chip next to `title`. |
| `rows` | `T[]` | yes | — | The full unfiltered dataset — `DataTable` owns search/sort/filter/paginate internally. |
| `columns` | `Column<T>[]` | yes | — | See `Column` shape below. |
| `rowKey` | `(row: T) => string` | yes | — | Stable React key per row. |
| `search` | `(row: T) => string` | no | — | If set, shows a search box; searches the string this returns (case-insensitive substring match). |
| `searchPlaceholder` | `string` | no | `"Search…"` | |
| `facet` | `{ label, get, allLabel?, optionLabel? }` | no | — | If set, shows a single `<select>` filter. Options come from `get`'s distinct values. The default option is sentence case and pluralised ("Region" gives "All regions"); override with `allLabel`. Use `optionLabel` to map raw values to display text (e.g. `regionLabel` from `tokens/regions.ts`). |
| `actions` | `ReactNode` | no | — | Table-level action button. Rendered top right of the toolbar (CONVENTIONS §2). |
| `onRowClick` | `(row: T) => void` | no | — | If set, rows become clickable (cursor pointer, hover highlight). |
| `pageSize` | `number` | no | `8` | Rows per page. |
| `minW` | `number` | no | `720` | Minimum table width before horizontal scroll. |
| `empty` | `string` | no | `"No results"` | Shown when `rows` is empty. (A different message — "No matches. Try clearing filters." — shows automatically when a search/facet is active but returns zero rows; you don't need to handle that case yourself.) |

### `Column<T>`

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | `string` | yes | Unique per column. |
| `header` | `string` | yes | Column header text. |
| `sortable` | `boolean` | no | Defaults to **true**: every column shows the standard sort affordance. Set `false` for action/decoration columns. |
| `sort` | `(row: T) => string \| number` | no | The value to sort by. Falls back to the text of the rendered cell, so simple columns need nothing. |
| `render` | `(row: T) => ReactNode` | yes | Cell content. |
| `align` | `"left" \| "center" \| "right"` | no | Aligns header + cell. Numeric / middle "server"-type fields use `"center"` (CONVENTIONS §3). |
| `cell` | `string` | no | Extra className appended to the `<td>`. |

## Usage

```tsx
import { DataTable, type Column } from "@mari-design/components";
// or directly: from "./DataTable"

type Row = { id: string; name: string; hits: number; source: string };

const columns: Column<Row>[] = [
  { key: "name", header: "Name", sortable: true, sort: (r) => r.name, render: (r) => r.name },
  { key: "hits", header: "Hits", sortable: true, sort: (r) => r.hits, align: "right", render: (r) => r.hits.toLocaleString() },
  { key: "source", header: "Source", render: (r) => <Badge label={r.source} tone="neutral" /> },
];

<DataTable
  title="Rules"
  count={rows.length}
  rows={rows}
  columns={columns}
  rowKey={(r) => r.id}
  search={(r) => r.name}
  facet={{ label: "Sources", get: (r) => r.source }}
  onRowClick={(r) => openDrawer(r.id)}
/>
```

## Notes

- All filtering/sorting/pagination state is internal (`useState` inside the component) — you don't lift it up. If a screen needs to sync table state to the URL (deep-linkable sort/filter), that's not supported today; don't fake it by duplicating `DataTable`'s internals.
- Only **one** facet filter is supported. If a screen needs two independent filters, that's a real gap — raise it rather than bolting a second `<select>` onto the header row outside the component's control.
