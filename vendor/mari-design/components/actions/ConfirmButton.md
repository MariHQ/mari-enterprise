# ConfirmButton

**Type:** Actions
**Source:** [`ConfirmButton.tsx`](./ConfirmButton.tsx) (this repo)

Two-step destructive confirm — the one pattern for deletes/revokes in this console. First click arms the button (swaps to `confirmLabel`, `variant="danger"`); a second click within 4 seconds fires `onConfirm`; blurring or the 4s timeout disarms it. Replaces `window.confirm` and unguarded delete buttons.

## Props

Extends [`ButtonProps`](./Button.md) minus `onClick`/`variant` (both are owned by this component), plus:

| Prop | Type | Required | Notes |
|---|---|---|---|
| `confirmLabel` | `string` | no | Shown while armed. Default `"Really?"`. |
| `onConfirm` | `() => void` | yes | Fires on the second click. |

## Usage

```tsx
import { ConfirmButton } from "@mari-design/components";
// or directly: from "./ConfirmButton"

<ConfirmButton confirmLabel="Delete for good?" onConfirm={() => deleteSource(id)}>
  Delete source
</ConfirmButton>
```

## Notes

- If you pass `onBlur`, it still fires (chained after the disarm logic) — the reference implementation silently dropped a caller's `onBlur`; this one doesn't.
