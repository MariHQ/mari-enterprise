import { isValidElement, type ElementType, type ReactNode } from "react";

/* Long text is TRUNCATED WITH AN ELLIPSIS, not wrapped.
 *
 * The console is dense and mostly tabular. Wrapping a long document title,
 * URL, API key, or email reflows the row, breaks the alignment of every
 * neighbouring column, and in the worst case crushes a column until it wraps
 * one character per line. An ellipsis keeps the row exactly one line tall and
 * keeps every border plumb; the full value stays available on hover (and to
 * screen readers, via the same title text).
 *
 * Use this for any value that can be arbitrarily long:
 *   <Truncate>{doc.title}</Truncate>
 *   <Truncate as="td" lines={2}>{claim.text}</Truncate>
 *
 * Do NOT use it for short, known-length labels; plain text is fine there.
 * See CONVENTIONS.md §12.
 */

/** Flatten a child tree to its text, so the `title` carries the full value even
    when the child is an element (DD-34). The old version only handled a plain
    string, so `<Truncate><b>{name}</b> {email}</Truncate>` truncated on screen
    and then had nothing to show on hover — the exact case §12 exists for. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export type TruncateProps = {
  children: ReactNode;
  /** Element to render. Defaults to a span. */
  as?: ElementType;
  /** Clamp to N lines instead of one. */
  lines?: number;
  /** Tooltip text. Defaults to the child's text content. */
  title?: string;
  className?: string;
};

/* A table cell is `display: table-cell`, and that is what makes the column grid
   work. Forcing `display: block` on it — which this component used to do
   unconditionally — drops the cell out of the table layout entirely and
   collapses every column width in the row, so the documented
   `<Truncate as="td" lines={2}>` was the one usage that could not work (DD-33).
   For a cell the truncation therefore moves to an inner box and the cell itself
   is left alone. */
const CELL_TAGS = new Set(["td", "th"]);

export function Truncate({ children, as, lines = 1, title, className = "" }: TruncateProps) {
  const Tag = (as ?? "span") as ElementType;
  const tip = title ?? (textOf(children) || undefined);

  // One line: `truncate` (overflow hidden + ellipsis + nowrap).
  // Multi-line: the standard line-clamp box.
  const clamp =
    lines > 1
      ? "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical]"
      : "truncate";
  const style = lines > 1 ? { WebkitLineClamp: lines } : undefined;

  if (typeof Tag === "string" && CELL_TAGS.has(Tag)) {
    return (
      <Tag className={className || undefined} title={tip}>
        <div className={`block min-w-0 max-w-full ${clamp}`} style={style}>{children}</div>
      </Tag>
    );
  }

  return (
    <Tag className={`block min-w-0 max-w-full ${clamp} ${className}`.trim()} title={tip} style={style}>
      {children}
    </Tag>
  );
}

/** Inline variant for use inside a flex row that must not grow. */
export function TruncateInline({ children, title, className = "" }: Omit<TruncateProps, "as" | "lines">) {
  const tip = title ?? (textOf(children) || undefined);
  return (
    <span className={`inline-block min-w-0 max-w-full truncate align-bottom ${className}`.trim()} title={tip}>
      {children}
    </span>
  );
}
