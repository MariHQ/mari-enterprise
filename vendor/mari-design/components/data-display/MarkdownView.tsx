import { Fragment, type ReactNode } from "react";
import { parseMarkdown, mdInline, type Block } from "./markdown";
import { SortHeader, useSort, tdPad } from "./sortable";
import { Scrollable } from "./Scrollable";
import { SkeletonLine, SkeletonText } from "./Skeleton";

// Blueprint prose styling: display font for headings, ink body text, a flysch
// tint behind code, biscay-2 for inline code accents. Inline HTML (links,
// images, **bold**, *italic*, ~~strike~~, `code`) is produced by the ported
// parser and injected verbatim.
//
// The markdown reaching this component is UNTRUSTED — it is synced from Slack,
// GitHub, Confluence, Drive and user uploads. `mdInline` escapes every
// character that could open a tag AND scheme-checks every href/src, so a
// `javascript:` or `data:` URL arrives here on `data-mdhref`/`data-mdsrc`
// rather than on `href`/`src` and is inert markup by the time it is injected
// (DD-68). This file styles that state instead of hiding it: an anchor with no
// href must not be painted as a working link.
//
// Everything the parser hands back as an OPAQUE block (`raw` set) is rendered
// here from its source rather than dumped as a paragraph of markdown
// punctuation: a rule is a rule, a quote is a quote, a pipe table is a real
// sortable table. The one exception is an HTML block, which is shown as source
// — this component never injects markup it did not generate itself.

const INLINE =
  "[&_b]:font-semibold [&_b]:text-ink [&_i]:italic [&_s]:line-through [&_s]:text-ink/65 " +
  "[&_a]:text-biscay-2 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-biscay-1 " +
  // A blocked URL (DD-68) keeps its text but must not look or behave like a
  // link: no link colour, no underline, no pointer, and a dotted rule so the
  // reader can see the difference rather than clicking a dead word.
  "[&_a[data-unsafe-url]]:text-ink/70 [&_a[data-unsafe-url]]:no-underline [&_a[data-unsafe-url]]:cursor-default " +
  "[&_a[data-unsafe-url]]:border-b [&_a[data-unsafe-url]]:border-dotted [&_a[data-unsafe-url]]:border-ink/35 " +
  "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-[4px] [&_img]:border [&_img]:border-ink/10 " +
  // A blocked image has no src, so the browser lays out an empty box; render
  // the alt text as ordinary inline prose instead.
  "[&_img[data-unsafe-url]]:my-0 [&_img[data-unsafe-url]]:inline [&_img[data-unsafe-url]]:border-0 " +
  "[&_code]:font-term [&_code]:text-[0.85em] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-[3px] [&_code]:bg-flysch [&_code]:text-biscay-2 [&_code]:border [&_code]:border-ink/10";

/* Six levels, because the parser reads six. h4–h6 arrive as `type: "h3"` with
   `level` set, which is why this is keyed by depth and not by block type. */
const HEADING: Record<number, string> = {
  1: "font-display font-semibold text-ink text-[27px] leading-tight mt-0 mb-4",
  2: "font-display font-semibold text-ink text-[18px] leading-snug mt-5 mb-2",
  3: "font-display font-semibold text-ink text-[15.5px] leading-snug mt-3 mb-1.5",
  4: "font-display font-semibold text-ink text-[14px] leading-snug mt-3 mb-1",
  5: "font-display font-semibold text-ink/85 text-[13px] leading-snug mt-2.5 mb-1",
  6: "font-term font-semibold uppercase tracking-[0.06em] text-ink/70 text-[11.5px] mt-2.5 mb-1",
};

const CODE_BOX = "my-3 rounded-[6px] bg-flysch border border-ink/10";
const CODE_TEXT = "font-term text-[12.5px] leading-[1.55] text-ink/90 whitespace-pre";

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function renderInline(html: string): ReactNode {
  return <span className={INLINE} dangerouslySetInnerHTML={{ __html: html }} />;
}

function CodeBox({ text }: { text: string }) {
  return (
    <Scrollable fade="flysch" className={CODE_BOX}>
      <pre className="px-3 py-2.5"><code className={CODE_TEXT}>{text}</code></pre>
    </Scrollable>
  );
}

/* ————— pipe tables ————— */

type TableModel = { head: string[]; align: ("left" | "center" | "right")[]; rows: string[][] };

const cells = (line: string): string[] =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/** A GitHub pipe table, as head + alignment + rows. Null when the source is not
    one after all, so the caller can fall back to showing the text. */
function readTable(src: string): TableModel | null {
  const lines = src.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;
  const head = cells(lines[0]);
  const align = cells(lines[1]).map((c) =>
    c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left");
  return { head, align, rows: lines.slice(2).map(cells) };
}

/** A table written in prose is still a table: §3 says every column header
    carries the standard sort affordance, so a long reference table in a
    document is sortable exactly like one in a panel. */
function MdTable({ model }: { model: TableModel }) {
  const { head, align, rows } = model;
  const accessors = Object.fromEntries(
    head.map((_, i) => [String(i), (r: string[]) => decode(r[i] ?? "")] as const),
  );
  const { sort, onSort, sorted } = useSort(rows, accessors);
  return (
    <Scrollable className="my-3 rounded-[6px] border border-ink/12">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {head.map((h, i) => (
              <SortHeader
                key={i} label={decode(h)} sortKey={String(i)} sort={sort} onSort={onSort}
                align={align[i] ?? "left"} className="border-t-0"
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, ri) => (
            <tr key={ri} className="border-b border-ink/10 last:border-0">
              {head.map((_, ci) => (
                <td key={ci} className={`${tdPad} font-term text-[13px] text-ink/90 ${align[ci] === "right" ? "text-right" : align[ci] === "center" ? "text-center" : ""}`}>
                  {renderInline(mdInline(r[ci] ?? ""))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Scrollable>
  );
}

/* ————— lists ————— */

type LiNode = { block: Block; children: LiNode[] };

/** Flat list items back into the tree their indentation described. The parser
    keeps `indent` so nesting survives a save; this is where it becomes nesting
    again instead of one flat bullet run. */
function nest(items: Block[]): LiNode[] {
  const roots: LiNode[] = [];
  const stack: { indent: number; node: LiNode }[] = [];
  for (const b of items) {
    const indent = b.indent ?? 0;
    const node: LiNode = { block: b, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ indent, node });
  }
  return roots;
}

const isOrdered = (b: Block) => /^\d/.test(b.marker ?? "-");

function List({ nodes }: { nodes: LiNode[] }) {
  const ordered = isOrdered(nodes[0].block);
  const start = ordered ? parseInt(nodes[0].block.marker ?? "1", 10) : undefined;
  const cls = "my-2.5 pl-5 space-y-1 " + (ordered ? "list-decimal marker:text-ink/65" : "list-disc marker:text-clay");
  const body = nodes.map((nd) => (
    <li key={nd.block.id} className="font-term text-[14.5px] leading-[1.65] text-ink/90">
      {renderInline(nd.block.html)}
      {nd.children.length > 0 && <List nodes={nd.children} />}
    </li>
  ));
  return ordered ? <ol className={cls} start={start}>{body}</ol> : <ul className={cls}>{body}</ul>;
}

/* ————— opaque blocks ————— */

function Raw({ block }: { block: Block }) {
  const src = block.raw ?? "";
  switch (block.rawKind) {
    // Front matter is the document's metadata, not its prose. Rendering it
    // would put "title: …" at the top of every page as if the author wrote it.
    case "frontmatter":
      return null;
    case "hr":
      return <hr className="my-5 border-0 border-t border-ink/15" />;
    case "quote":
      return (
        <blockquote className="my-3 border-l-2 border-clay/60 pl-3.5 text-ink/80">
          {renderBlocks(parseMarkdown(src.replace(/^[ \t]{0,3}> ?/gm, "")))}
        </blockquote>
      );
    case "setext": {
      const lines = src.split("\n");
      const level = /^[ \t]{0,3}=/.test(lines[lines.length - 1]) ? 1 : 2;
      const text = mdInline(lines.slice(0, -1).join("\n"));
      return level === 1
        ? <h1 className={HEADING[1]}>{renderInline(text)}</h1>
        : <h2 className={HEADING[2]}>{renderInline(text)}</h2>;
    }
    case "table": {
      const model = readTable(src);
      return model ? <MdTable model={model} /> : <CodeBox text={src} />;
    }
    case "indented-code":
      return <CodeBox text={src.replace(/^(?: {4}|\t)/gm, "")} />;
    case "footnote":
      return <p className="my-2 font-term text-[12.5px] leading-[1.6] text-ink/70">{renderInline(mdInline(src))}</p>;
    // An HTML block is shown as source on purpose. This component only injects
    // markup its own parser produced; markup from the document is not that.
    default:
      return <CodeBox text={src} />;
  }
}

/** Group the flat block list: consecutive `li` blocks fold back into one
    (possibly nested) list, opaque blocks render as themselves. */
function renderBlocks(blocks: Block[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.raw !== undefined) {
      out.push(<Raw key={b.id} block={b} />);
      i++;
      continue;
    }
    if (b.type === "li") {
      const items: Block[] = [];
      while (i < blocks.length && blocks[i].type === "li" && blocks[i].raw === undefined) { items.push(blocks[i]); i++; }
      out.push(<List key={b.id} nodes={nest(items)} />);
      continue;
    }
    if (b.type === "code") {
      out.push(<CodeBox key={b.id} text={decode(b.html)} />);
      i++;
      continue;
    }
    if (b.type === "p") {
      out.push(
        <p key={b.id} className="font-term text-[14.5px] leading-[1.65] text-ink/90 my-2.5 first:mt-0 last:mb-0">
          {renderInline(b.html)}
        </p>,
      );
      i++;
      continue;
    }
    const level = b.level ?? Number(b.type[1]);
    const cls = HEADING[level] ?? HEADING[3];
    out.push(
      <Fragment key={b.id}>
        {level === 1 ? <h1 className={cls}>{renderInline(b.html)}</h1>
          : level === 2 ? <h2 className={cls}>{renderInline(b.html)}</h2>
            : level === 3 ? <h3 className={cls}>{renderInline(b.html)}</h3>
              : level === 4 ? <h4 className={cls}>{renderInline(b.html)}</h4>
                : level === 5 ? <h5 className={cls}>{renderInline(b.html)}</h5>
                  : <h6 className={cls}>{renderInline(b.html)}</h6>}
      </Fragment>,
    );
    i++;
  }
  return out;
}

export type MarkdownViewProps = {
  /** Raw markdown source. */
  children: string;
  /** Show a prose-shaped skeleton instead of parsing/rendering. */
  loading?: boolean;
  className?: string;
};

/** Render markdown as styled blueprint prose (headings, lists, tables, quotes,
    code, links, inline marks). The source does not have to be trusted: the
    parser escapes it and allowlists link/image URL schemes (DD-68). */
export function MarkdownView({ children, loading = false, className = "" }: MarkdownViewProps) {
  if (loading) {
    return (
      <div className={`text-ink ${className}`.trim()} aria-hidden="true">
        <SkeletonLine w="55%" h={22} className="mb-4" />
        <SkeletonText lines={3} className="mb-4" lastWidth="70%" />
        <SkeletonText lines={3} className="mb-4" lastWidth="45%" />
        <SkeletonText lines={2} lastWidth="60%" />
      </div>
    );
  }
  const blocks = parseMarkdown(children ?? "");
  return <div className={`text-ink ${className}`.trim()}>{renderBlocks(blocks)}</div>;
}
