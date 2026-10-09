# Avatar

**Type:** Data display
**Source:** [`Avatar.tsx`](./Avatar.tsx) — ported verbatim from `mari/web/web/src/saas/components/console-ui.tsx` (this repo's real, already-built console reference)

Initials disc. **One flat treatment for every avatar, deliberately** — not tinted per person. A `color` prop is accepted (so call sites that already pass one don't need to change) but intentionally unused.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `initials` | `string` | yes | Rendered as-is — compute initials from a name at the call site. |
| `color` | `string` | no | Accepted, ignored. Kept for call-site compatibility, not for future use. |

## Usage

```tsx
import { Avatar } from "@mari-design/components";
// or directly: from "./Avatar"

<Avatar initials="PN" />
```

## Notes

- **Don't add a tint/color system back in.** An earlier draft of this component added a 4-color name-hash tint (borrowed from a different, unrelated reference implementation) — this was a mistake, reverted once checked against the actual designed console: `console-ui.tsx`'s own comment explains a per-owner color rainbow "added noise to each table without carrying meaning." One flat treatment is the considered choice, not a placeholder.
- If a screen genuinely needs to visually distinguish people at a glance (not just label them), that's a case for a real product decision, not a prop on this component.
