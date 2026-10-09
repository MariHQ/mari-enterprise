# TreeView

**Type:** Data display
**Source:** [`TreeView.tsx`](./TreeView.tsx) (this repo)

A hierarchical disclosure list — doc lineage trees, folder structures. No Radix primitive covers this; it's a small recursive expand/collapse component.

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `data` | `TreeNode[]` | yes | `{ id, label, icon?, children?: TreeNode[] }`, recursive. |
| `onSelect` | `(node: TreeNode) => void` | no | Fires on row click (in addition to toggling expand/collapse if the row has children). |
| `selected` | `string` | no | Highlights the row whose `id` matches. |

## Usage

```tsx
import { TreeView } from "@mari-design/components";
// or directly: from "./TreeView"

<TreeView
  selected={selectedId}
  onSelect={(node) => setSelectedId(node.id)}
  data={[
    { id: "docs", label: "docs/", children: [
      { id: "docs/api.md", label: "api.md" },
      { id: "docs/guide.md", label: "guide.md" },
    ] },
  ]}
/>
```

## Notes

- Top-level (`depth === 0`) nodes start expanded; everything nested starts collapsed. There's no `defaultExpanded`/controlled-expansion prop yet — if a screen needs to programmatically expand a deep node (e.g. "reveal the search result"), that's a real gap to fill when it comes up, not a hypothetical to build for now.
- No drag-and-drop, no multi-select, no virtualization — this is a browsing tree, not a file manager. A large tree (thousands of nodes) will need virtualization added before it's usable; that's a known limit, not an oversight.
