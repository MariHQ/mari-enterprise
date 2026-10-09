import { useState, type ReactNode } from "react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { Skeleton, SkeletonLine } from "./Skeleton";
import { Scrollable } from "./Scrollable";

export type TreeNode = { id: string; label: string; icon?: ReactNode; children?: TreeNode[] };

/* Indent stops growing after this depth. A lineage tree can nest 20 levels;
   at 16px a level that left 30px of room for the label, which then wrapped one
   character per line and grew the panel to thousands of pixels (§12). Past the
   cap every level shares one indent and the chevron carries the hierarchy. */
const MAX_INDENT_DEPTH = 8;

function TreeRow({ node, depth, onSelect, selected }: { node: TreeNode; depth: number; onSelect?: (node: TreeNode) => void; selected?: string }) {
  const hasChildren = Boolean(node.children?.length);
  const [open, setOpen] = useState(depth === 0);
  return (
    <li className="min-w-0">
      <div
        className={`flex min-w-0 items-center gap-1.5 h-7 rounded-[4px] text-[13px] cursor-pointer ${selected === node.id ? "bg-flysch text-ink" : "text-ink/80 hover:bg-flysch/60"}`}
        style={{ paddingLeft: Math.min(depth, MAX_INDENT_DEPTH) * 16 + 4 }}
        onClick={() => { if (hasChildren) setOpen((o) => !o); onSelect?.(node); }}
      >
        {hasChildren ? (
          <button
            aria-label={open ? "Collapse" : "Expand"}
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            className={`grid place-items-center w-4 h-4 shrink-0 text-ink/65 rounded-[2px] ${focusRing}`}
          >
            <ChevronRight size={13} className={`transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="shrink-0 text-ink/65" aria-hidden="true">{node.icon ?? (hasChildren ? <Folder size={14} /> : <FileText size={14} />)}</span>
        {/* min-w-0: a truncating flex item sits at its intrinsic width without
            it, so the ellipsis never engages and the label escapes the row. */}
        <span className="min-w-0 truncate" title={node.label}>{node.label}</span>
      </div>
      {hasChildren && open && (
        <ul className="min-w-0">
          {node.children!.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} />
          ))}
        </ul>
      )}
    </li>
  );
}

/* Hierarchical disclosure list — doc lineage trees, folder structures.
   No Radix primitive for this; a small recursive expand/collapse component. */
/** Depth per skeleton row + label width, to mimic a partially-expanded tree. */
const skeletonRows: { depth: number; w: number }[] = [
  { depth: 0, w: 120 },
  { depth: 1, w: 96 },
  { depth: 1, w: 140 },
  { depth: 2, w: 84 },
  { depth: 1, w: 108 },
  { depth: 0, w: 132 },
];

/** Total nodes in the tree, used to decide whether the tree scrolls in place. */
function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((n, node) => n + 1 + (node.children ? countNodes(node.children) : 0), 0);
}

export function TreeView({
  data, onSelect, selected, loading = false, maxHeight = 440,
}: {
  data: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  selected?: string;
  loading?: boolean;
  /** Height cap, in px, once the tree is big enough to scroll. */
  maxHeight?: number;
}) {
  if (loading) {
    return (
      <ul role="tree" aria-busy="true" className="flex flex-col gap-0.5">
        {skeletonRows.map((r, i) => (
          <li key={i}>
            <div className="flex items-center gap-1.5 h-7 rounded-[4px]" style={{ paddingLeft: r.depth * 16 + 4 }} aria-hidden="true">
              <Skeleton width={13} height={13} rounded="rounded-[2px]" className="shrink-0" />
              <Skeleton width={14} height={14} rounded="rounded-[3px]" className="shrink-0" />
              <SkeletonLine w={r.w} h={11} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const tree = (
    <ul role="tree" className="flex min-w-0 flex-col gap-0.5">
      {data.map((node) => <TreeRow key={node.id} node={node} depth={0} onSelect={onSelect} selected={selected} />)}
    </ul>
  );

  /* A folder tree with hundreds of nodes scrolls inside a bounded region with
     a visible scrollbar rather than growing its panel forever (§20). */
  if (countNodes(data) <= 24) return tree;
  return (
    <Scrollable axis="y" style={{ maxHeight }} scrollerClassName="pr-2">{tree}</Scrollable>
  );
}
