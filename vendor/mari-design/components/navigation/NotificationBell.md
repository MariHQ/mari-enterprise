# NotificationBell

**Type:** Navigation
**Source:** [`NotificationBell.tsx`](./NotificationBell.tsx) (this repo) — grounded in the real product (`NotificationsBell.tsx`/`NotificationsPanel.tsx` exist in `mari/web/web/src/saas/components`)

Topbar bell icon with an unread-count badge and a dropdown panel, wrapping `@radix-ui/react-popover`.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `items` | `NotificationItem[]` | yes | `{ id, title, body?, time, unread?, icon? }`. Unread count badge derives from `items.filter(i => i.unread).length`, capped at "9+". |
| `onItemClick` | `(item: NotificationItem) => void` | no | |

## Usage

```tsx
import { NotificationBell } from "@mari-design/components";
// or directly: from "./NotificationBell"

<NotificationBell
  items={[
    { id: "1", title: "Sync completed", body: "128 documents updated", time: "2m ago", unread: true },
    { id: "2", title: "Review requested", time: "1h ago" },
  ]}
  onItemClick={(n) => markRead(n.id)}
/>
```

## Notes

- `time` is a pre-formatted string, not a `Date` — pass it through `fmtAgo` from `tokens/format.ts` at the call site rather than formatting inside this component, keeping it a pure display component.
