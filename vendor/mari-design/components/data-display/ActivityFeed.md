# ActivityFeed

**Type:** Data display
**Source:** [`ActivityFeed.tsx`](./ActivityFeed.tsx) (this repo) — grounded in the real product (`LiveActivityFeed.tsx`/`AuditActivityFeed.tsx` exist in `mari/web/web/src/saas/components`)

A chronological event-log list with a connecting timeline — a different layout from `Table`/`DataTable`, for an audit trail or activity stream rather than structured rows/columns.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `items` | `ActivityItem[]` | yes | `{ id, actor?, action, time, icon? }`. `actor` renders bold before `action` when present ("**Priya** approved the change"). |

## Usage

```tsx
import { ActivityFeed } from "@mari-design/components";
// or directly: from "./ActivityFeed"

<ActivityFeed items={[
  { id: "1", actor: "Priya Nair", action: "approved the pending change", time: "2m ago" },
  { id: "2", action: "Sync completed — 128 documents updated", time: "1h ago" },
]} />
```

## Notes

- `time` is pre-formatted (use `fmtAgo`/`fmtDateTime` from `tokens/format.ts` at the call site), same reasoning as `NotificationBell`.
- No pagination or virtualization built in — for a long-running audit log, page the `items` array at the call site (pair with `Pagination` or `DataTable`'s built-in pager on a wrapping fetch).
