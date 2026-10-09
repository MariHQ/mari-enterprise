# Alert

**Type:** Feedback
**Source:** [`Alert.tsx`](./Alert.tsx) (this repo)

A persistent inline banner — `Toast`'s non-transient sibling. Use `Toast` for "this just happened"; use `Alert` for "this is true right now and stays true until you act" (a stale-sync warning at the top of a page, a blocked-state explanation). Same 5-tone scale as `Badge`/`Chip`/`Stat`.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `tone` | `string` | no | Any `Badge` tone or alias. Default `"neutral"`. |
| `title` | `ReactNode` | no | Bold first line. |
| `children` | `ReactNode` | yes | Body message. |
| `action` | `ReactNode` | no | E.g. a `Button` to resolve the issue. |
| `onDismiss` | `() => void` | no | Adds a close (×) button when set. |

## Usage

```tsx
import { Alert, Button } from "@mari-design/components";
// or directly: from "./Alert"

<Alert tone="attention" title="Sync is 3 days stale" action={<Button compact>Re-sync now</Button>}>
  The last successful sync to production was July 18.
</Alert>
```
