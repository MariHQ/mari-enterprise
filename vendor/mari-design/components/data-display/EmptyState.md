# EmptyState

**Type:** Data display
**Source:** [`EmptyState.tsx`](./EmptyState.tsx) (this repo)

Centered icon + bold title + muted message + optional action, for the inside of a `Card`/`Table`/`DataTable` body when there's nothing to show. `DataTable` has its own built-in empty state for search/filter results — reach for this one for a whole-panel empty condition instead (no records exist yet at all).

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `icon` | `ReactNode` | no | `text-ink/25` — muted, not decorative color. |
| `title` | `ReactNode` | no | Bold first line. |
| `children` | `ReactNode` | yes | The muted message body. |
| `action` | `ReactNode` | no | E.g. a `Button` to create the first record. |

## Usage

```tsx
import { EmptyState, Button, Card } from "@mari-design/components";
import { Inbox } from "lucide-react";
// or directly: from "./EmptyState"

<Card variant="flush">
  <EmptyState icon={<Inbox size={28} />} title="No sources yet" action={<Button variant="primary">Connect a source</Button>}>
    Connect a source to start ingesting documents.
  </EmptyState>
</Card>
```
