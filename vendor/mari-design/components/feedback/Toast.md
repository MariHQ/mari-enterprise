# Toast / useToast / Toaster

**Type:** Feedback *(new type folder — the first component that's a global transient-notification system rather than something rendered inline in a screen)*
**Source:** [`Toast.tsx`](./Toast.tsx) (this repo)

The one transient-feedback primitive, wrapping [`@radix-ui/react-toast`](https://www.radix-ui.com/primitives/docs/components/toast). Mount `<Toaster>` once near the root of the app; fire toasts from anywhere via `useToast()`.

## API

| Export | Type | Notes |
|---|---|---|
| `Toaster` | `({ children }) => JSX` | Wrap your app root in it once. Provides the toast context and renders the viewport. |
| `useToast` | `() => (text: string, tone?: ToastTone) => void` | Call the returned function to push a toast. |
| `ToastTone` | `"default" \| "success" \| "error"` | `default` = info icon/biscay-2, `success` = moss, `error` = espelette. |

At most 3 toasts stack; older ones drop off. Each auto-dismisses after 3.5s (Radix's swipe-to-dismiss also works).

## Usage

```tsx
import { Toaster, useToast } from "@mari-design/components";
// or directly: from "./Toast"

// once, near the app root:
<Toaster>
  <App />
</Toaster>

// anywhere inside:
function SaveButton() {
  const toast = useToast();
  return (
    <Button variant="primary" onClick={async () => {
      await save();
      toast("Workflow saved", "success");
    }}>
      Save
    </Button>
  );
}
```

## Notes

- Requires `@radix-ui/react-toast`. Toasts render bottom-right (`fixed bottom-4 right-4`) — this library doesn't expose a position option; if a screen needs a different corner, that's a sign of a layout problem elsewhere, not a reason to add a prop.
- No drop shadow, per the console's no-shadow rule — definition against the page comes entirely from the `bg-paper` fill + tone-colored hairline border.
