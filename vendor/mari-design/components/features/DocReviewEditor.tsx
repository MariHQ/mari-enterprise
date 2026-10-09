// DocReview block editor — a from-scratch contentEditable editor over a
// document's markdown body, ported from mari-cloud/web/src/pages/docreview/
// Editor.tsx + index.tsx. Each editable block is its own contentEditable
// element; a toolbar drives block type, inline marks, lists, undo/redo and the
// source view; findings are underlined inline and echoed in a right margin
// column, aligned to their match with collision spreading.
//
// Three things here are deliberate and were fixed rather than inherited:
//
//   * No `document.execCommand`. It is deprecated and its output is
//     browser-specific — Safari's `<b>` versus Chrome's `<span style>` meant
//     bold survived a save in one browser and vanished in the other. Inline
//     marks are applied by hand with Range surgery, so the only tags that ever
//     reach the serializer are the ones the markdown module knows how to write
//     back. There is no Underline control, because markdown has no underline
//     and the old one silently threw the formatting away on save.
//   * Blocks the markdown parser marks opaque (tables, quotes, rules, front
//     matter, HTML) are shown read-only, not edited into oblivion. Source mode
//     is where you edit those, and it is the same `MarkdownEditor` the library
//     already shipped.
//   * Undo is the editor's own block-level history. The browser's native undo
//     stack cannot cross a block boundary, because a split or a merge goes
//     through React state and never touches the DOM the browser recorded.

import {
  createElement, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode,
} from "react";
import { ChevronDown, ExternalLink, Link2, Undo2, Redo2, Code2, ListOrdered, FileCode2 } from "lucide-react";
import {
  parseMarkdown, serializeBlocks, escapeHtml, type Block, type BlockType, type RawKind,
} from "../data-display/markdown";
import { MarkdownEditor } from "../data-display/MarkdownEditor";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Input } from "../forms/Input";
import { Chip } from "../data-display/Chip";
import { Menu, MenuRadioGroup, MenuRadioItem } from "../navigation/Menu";
import { Skeleton, SkeletonLine, SkeletonText } from "../data-display/Skeleton";
import { Truncate } from "../data-display/Truncate";
import { Scrollable } from "../data-display/Scrollable";
import { ShowRest } from "../data-display/ShowRest";

/* ————— ported local helpers (browser-only; use the DOM) ————— */

/** One inline finding underlined in the prose. */
export type EditorFinding = { id: number; kind: string; severity: string; text: string; note: string };

let blockSeq = 1_000_000;
const nid = () => blockSeq++;

const stripMarks = (html: string): string => {
  if (!html.includes("fmark")) return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("span.fmark").forEach((s) => {
    const parent = s.parentNode;
    if (!parent) return;
    while (s.firstChild) parent.insertBefore(s.firstChild, s);
    parent.removeChild(s);
  });
  return div.innerHTML;
};

const cleanText = (s: string) => s.replace(/^[…\s]+/, "").replace(/[…\s]+$/, "").trim();

/* ————— finding decoration —————

   The old version did `html.indexOf(findingText)` against the block's HTML.
   That found nothing whenever the quoted passage contained an inline mark (the
   HTML reads "the <b>RS256</b> token", the finding reads "the RS256 token"),
   and the finding was then dropped without a word while its margin chip was
   handed a made-up vertical position. Matching now happens on the block's PLAIN
   TEXT, and the underline is stitched back into the HTML one text run at a
   time, so a passage that spans a `<b>` gets underlined across it. A finding
   that genuinely is not in the text is reported as not located rather than
   floated somewhere in the margin. */

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

type Seg = { tag: boolean; s: string };
type Pos = { seg: number; off: number; len: number };

function tokenize(html: string): Seg[] {
  const segs: Seg[] = [];
  const re = /<[^>]*>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index > last) segs.push({ tag: false, s: html.slice(last, m.index) });
    segs.push({ tag: true, s: m[0] });
    last = re.lastIndex;
  }
  if (last < html.length) segs.push({ tag: false, s: html.slice(last) });
  return segs;
}

/** Plain text of the block plus, for every character of it, where that
    character lives in the HTML. Entities count as one character. */
function project(segs: Seg[]): { text: string; pos: Pos[] } {
  let text = "";
  const pos: Pos[] = [];
  const ent = /&(?:amp|lt|gt|quot|#39|nbsp);/g;
  segs.forEach((sg, si) => {
    if (sg.tag) return;
    let i = 0;
    while (i < sg.s.length) {
      ent.lastIndex = i;
      const m = ent.exec(sg.s);
      if (m && m.index === i) {
        text += ENTITIES[m[0]];
        pos.push({ seg: si, off: i, len: m[0].length });
        i += m[0].length;
      } else {
        text += sg.s[i];
        pos.push({ seg: si, off: i, len: 1 });
        i += 1;
      }
    }
  });
  return { text, pos };
}

/** Whitespace-insensitive search: a finding quoted from a re-wrapped paragraph
    does not carry the paragraph's line breaks. Returns indices into `text`. */
function findRange(text: string, needle: string, taken: [number, number][]): [number, number] | null {
  const norm: number[] = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    const ws = /\s/.test(text[i]);
    if (ws && flat.endsWith(" ")) continue;
    flat += ws ? " " : text[i];
    norm.push(i);
  }
  const want = needle.replace(/\s+/g, " ").trim();
  if (!want) return null;
  let from = 0;
  for (;;) {
    const ix = flat.indexOf(want, from);
    if (ix === -1) return null;
    const a = norm[ix];
    const b = (norm[ix + want.length - 1] ?? norm[norm.length - 1]) + 1;
    if (!taken.some(([x, y]) => a < y && x < b)) return [a, b];
    from = ix + 1;
  }
}

/** Underline every finding that is actually present, and say which were not. */
function decorateBlocks(blocks: Block[], findings: EditorFinding[]): { html: string[]; located: Set<number> } {
  const located = new Set<number>();
  const html = blocks.map((b) => {
    if (b.type === "code" || b.raw !== undefined) return b.html;
    const segs = tokenize(b.html);
    const { text, pos } = project(segs);
    const taken: [number, number][] = [];
    // Where each text segment gains an opening / closing span.
    const cuts: { seg: number; off: number; s: string }[] = [];
    for (const f of findings) {
      if (located.has(f.id)) continue;
      const range = findRange(text, cleanText(f.text), taken);
      if (!range) continue;
      taken.push(range);
      located.add(f.id);
      const red = f.kind === "fact" || f.severity === "error";
      const open = `<span class="fmark ${red ? "fmark--red" : "fmark--gold"}" data-fid="${f.id}">`;
      // One span per contiguous run inside a single text segment, so a match
      // that crosses a `<b>` stays valid HTML instead of interleaving tags.
      let runSeg = -1, runStart = 0, runEnd = 0;
      const closeRun = () => {
        if (runSeg === -1) return;
        cuts.push({ seg: runSeg, off: runStart, s: open });
        cuts.push({ seg: runSeg, off: runEnd, s: "</span>" });
        runSeg = -1;
      };
      for (let i = range[0]; i < range[1]; i++) {
        const p = pos[i];
        if (p.seg !== runSeg) { closeRun(); runSeg = p.seg; runStart = p.off; }
        runEnd = p.off + p.len;
      }
      closeRun();
    }
    if (!cuts.length) return b.html;
    // Apply back to front inside each segment so earlier offsets stay valid.
    const out = segs.map((sg) => sg.s);
    cuts.sort((x, y) => (x.seg === y.seg ? y.off - x.off : y.seg - x.seg));
    for (const c of cuts) out[c.seg] = out[c.seg].slice(0, c.off) + c.s + out[c.seg].slice(c.off);
    return out.join("");
  });
  return { html, located };
}

/* ————— inline marks, without execCommand ————— */

type Mark = "b" | "i" | "s" | "code";

function markAncestor(node: Node | null, tag: string, root: Node): HTMLElement | null {
  let el: Element | null = node instanceof Element ? node : node?.parentElement ?? null;
  while (el && el !== root) {
    if (el.tagName.toLowerCase() === tag) return el as HTMLElement;
    el = el.parentElement;
  }
  return null;
}

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** Toggle one mark over the current selection inside `root`. Produces exactly
    `<b>`, `<i>`, `<s>` or `<code>` — the four tags `blockToMarkdown` knows. */
function toggleMark(tag: Mark, root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;
  const existing = markAncestor(range.commonAncestorContainer, tag, root);
  if (existing) { unwrap(existing); root.normalize(); return true; }
  if (range.collapsed) return false;
  const holder = document.createElement("div");
  holder.appendChild(range.extractContents());
  holder.querySelectorAll(tag).forEach(unwrap); // never nest a mark in itself
  const el = document.createElement(tag);
  while (holder.firstChild) el.appendChild(holder.firstChild);
  range.insertNode(el);
  const r = document.createRange();
  r.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}

/** Wrap the saved selection in a link. Anchors are what `[text](url)` becomes. */
function applyLink(range: Range, href: string, root: HTMLElement): boolean {
  if (!root.contains(range.commonAncestorContainer)) return false;
  const existing = markAncestor(range.commonAncestorContainer, "a", root);
  if (existing) { existing.setAttribute("href", href); return true; }
  if (range.collapsed) return false;
  const a = document.createElement("a");
  a.setAttribute("href", href);
  a.appendChild(range.extractContents());
  a.querySelectorAll("a").forEach(unwrap);
  range.insertNode(a);
  return true;
}

/* ————— static maps ————— */

const BLOCK_TAG: Record<BlockType, keyof JSX.IntrinsicElements> = {
  h1: "h1", h2: "h2", h3: "h3", p: "p", li: "div", code: "pre",
};

const BLOCK_CLS: Record<BlockType, string> = {
  h1: "font-display text-[26px] font-semibold text-ink leading-tight mb-1 outline-none",
  h2: "font-display text-[18px] font-semibold text-ink leading-snug mt-5 mb-1 outline-none",
  h3: "font-display text-[15.5px] font-semibold text-ink leading-snug mt-4 mb-1 outline-none",
  p: "font-term text-[14.5px] text-ink/90 my-2 outline-none",
  // The marker is drawn from `data-marker`, because an ordered item has to show
  // its own number: one bullet glyph for every list is how "1." became "•" and
  // then a paragraph on save.
  li: "font-term text-[14.5px] text-ink/90 my-1 pl-6 relative outline-none before:content-[attr(data-marker)] before:absolute before:left-0 before:text-clay",
  code: "font-term text-[12.5px] text-ink/90 my-3 px-3 py-2.5 rounded-[6px] bg-flysch border border-ink/10 overflow-x-auto whitespace-pre outline-none",
};

/* Inline anchors and strikes have to read as themselves inside the editable
   prose, or a link the user just made looks like plain text. */
const INLINE_MARKS =
  "[&_b]:font-semibold [&_i]:italic [&_s]:line-through [&_s]:text-ink/65 " +
  "[&_a]:text-biscay-2 [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_code]:font-term [&_code]:text-[0.9em] [&_code]:px-1 [&_code]:rounded-[3px] [&_code]:bg-flysch [&_code]:border [&_code]:border-ink/10";

/* Every heading the parser reads, so "#### Appendix" is a heading here instead
   of four literal hashes in the body. */
const TYPE_OPTIONS = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "h5", label: "Heading 5" },
  { value: "h6", label: "Heading 6" },
] as const;

const RAW_LABEL: Record<RawKind, string> = {
  frontmatter: "Front matter",
  hr: "Horizontal rule",
  quote: "Blockquote",
  table: "Table",
  html: "HTML",
  "indented-code": "Indented code",
  footnote: "Footnote",
  setext: "Heading",
  list: "List",
};

/** What the block-type trigger shows for the focused block. */
const blockLabel = (b: Block | null): string => {
  if (!b) return "¶";
  // §5: an em dash is not a label. A raw block is not a paragraph or a
  // heading, and the trigger has to say which of those it is.
  if (b.raw !== undefined) return "Raw";
  if (b.type === "code") return "‹›";
  if (b.type === "li") return /^\d/.test(b.marker ?? "-") ? "1." : "•";
  if (b.type === "p") return "¶";
  return `H${b.level ?? Number(b.type[1])}`;
};

/* toolbar glyph icons — line-art, matching the console's icon set */
const svg = (children: ReactNode) => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const BulletListIc = () => svg(<>
  <circle cx="5" cy="6.5" r="1" fill="currentColor" /><path d="M10 6.5 h9" />
  <circle cx="5" cy="12" r="1" fill="currentColor" /><path d="M10 12 h9" />
  <circle cx="5" cy="17.5" r="1" fill="currentColor" /><path d="M10 17.5 h9" />
</>);
const JustifyIc = () => svg(<><path d="M4 6.5 h16" /><path d="M4 12 h16" /><path d="M4 17.5 h16" /></>);
const LineHeightIc = () => svg(<>
  <path d="M10 6.5 h10" /><path d="M10 12 h10" /><path d="M10 17.5 h10" />
  <path d="M5.5 5.5 v13 M3.5 7.5 l2 -2 2 2 M3.5 16.5 l2 2 2 -2" />
</>);

/* fmark underline styling, applied on the prose container */
const MARKED =
  "[&_.fmark]:cursor-pointer [&_.fmark]:underline [&_.fmark]:decoration-wavy [&_.fmark]:decoration-2 [&_.fmark]:underline-offset-[3px] " +
  "[&_.fmark--red]:decoration-espelette [&_.fmark--gold]:decoration-clay " +
  "[&_.dr-flash]:!bg-clay/15 [&_.dr-flash]:rounded-[3px] [&_.dr-flash]:transition-colors";

type Annot = { fid: number; rule: string; tone: string; red: boolean; quote: string; top: number };

/* Each annotation kind gets its own chip tone so "fact check" never reads the
   same as "hedge" at a glance (CONVENTIONS.md §4). */
const ANNOT_TONE: Record<string, string> = {
  "fact check": "blocked",
  hedge: "attention",
  freshness: "info",
  "vague scope": "neutral",
};

/** Findings shown in the margin before the "show the rest" control appears. */
const ANNOT_CAP = 6;

/* ————— component ————— */

export function DocReviewEditor({
  body,
  findings,
  onChange,
  onSave,
  onOpenLibrary,
  loading = false,
  compact = false,
}: {
  body: string;
  findings: EditorFinding[];
  /** The edited document, as markdown, whenever a block commits. The editor
      owns the blocks; this is how the body leaves it so a page can save it.
      Optional — with no listener the editor is exactly as local as before. */
  onChange?: (markdown: string) => void;
  /** ⌘S. Only bound when a page can actually save, so the shortcut never
      swallows the browser's own Save on a page that cannot write. */
  onSave?: () => void;
  /** "Open the knowledge library". An intent, not a route: the library is a
      page in the app, and the app is the only thing that knows its address. */
  onOpenLibrary?: () => void;
  loading?: boolean;
  /** Narrow-column composition: the margin annotations drop below the prose
      instead of holding a 190px gutter. The page owns this decision
      (CONVENTIONS.md §10) — the editor never breakpoints itself. */
  compact?: boolean;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(body));
  const [focusedId, setFocusedId] = useState<number | null>(() => blocks[0]?.id ?? null);
  const [marks, setMarks] = useState({ b: false, i: false, s: false, code: false, a: false });
  const [justify, setJustify] = useState(false);
  const [airy, setAiry] = useState(false);
  const [annTops, setAnnTops] = useState<Record<string, number>>({});
  const [hist, setHist] = useState<{ past: Block[][]; future: Block[][] }>({ past: [], future: [] });
  const [source, setSource] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [showAllAnnots, setShowAllAnnots] = useState(false);
  /* Bumped whenever state has to overwrite the DOM (undo, redo, leaving source
     mode, a new body from the server). The blocks are keyed by it, so React
     remounts them and the contentEditable text is rebuilt from state — without
     it an undo that restores html React already rendered leaves the user's
     typing on screen. */
  const [epoch, setEpoch] = useState(0);

  const blockEls = useRef(new Map<number, HTMLElement>());
  const focusNext = useRef<{ id: number; atEnd: boolean } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  /* The last range the caret held INSIDE the editor. The toolbar's keyboard
     path needs it: tabbing to a button moves focus out of the contenteditable
     and browsers do not agree on whether the range survives (ACC-03). */
  const lastRange = useRef<Range | null>(null);

  const focusedBlock = blocks.find((b) => b.id === focusedId) ?? null;

  /* The body is not a seed. Restoring a revision, or any refetch, has to reach
     the screen — the old `useState(() => parseMarkdown(body))` ran once and
     then wrote the stale text back on the next save (CONSOLE-REVIEW M8). This
     is the resync sentinel used across the console. */
  const [seenBody, setSeenBody] = useState(body);
  const reported = useRef(false);
  if (seenBody !== body) {
    setSeenBody(body);
    setBlocks(parseMarkdown(body));
    setSource(null);
    setHist({ past: [], future: [] });
    setEpoch((e) => e + 1);
    // The new body came FROM the page. Reporting it back would read as an edit
    // and mark a freshly-loaded document unsaved.
    reported.current = false;
  }

  /* Blocks back out as markdown, after the first render: the initial value is
     the body the page already has, and reporting it would read as an edit. */
  const markdown = useMemo(() => source ?? serializeBlocks(blocks), [source, blocks]);
  useEffect(() => {
    if (!reported.current) { reported.current = true; return; }
    onChange?.(markdown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown]);

  /* decorated html per block */
  const { html: rendered, located } = useMemo(() => decorateBlocks(blocks, findings), [blocks, findings]);

  /* ——— block refs + commit ——— */
  const bindRef = (id: number) => (el: HTMLElement | null) => {
    if (el) blockEls.current.set(id, el); else blockEls.current.delete(id);
  };
  const domHtml = (b: Block): string | null => {
    const el = blockEls.current.get(b.id);
    if (!el || b.raw !== undefined) return null;
    return b.type === "code" ? escapeHtml(el.innerText.replace(/\n+$/, "")) : stripMarks(el.innerHTML);
  };

  /** Every change to the block list goes through here, so undo has something
      to pop and the redo branch is dropped the moment the user edits again. */
  const apply = (next: (bs: Block[]) => Block[], remount = false) => {
    const nb = next(blocks);
    if (nb === blocks) return;
    setHist((h) => ({ past: [...h.past.slice(-49), blocks], future: [] }));
    setBlocks(nb);
    if (remount) setEpoch((e) => e + 1);
  };

  /** The block list with whatever is currently in the focused element folded
      in — the DOM is ahead of state between a keystroke and a blur. */
  const withCommitted = (bs: Block[]): Block[] => {
    let changed = false;
    const out = bs.map((b) => {
      const html = domHtml(b);
      if (html === null || html === b.html) return b;
      changed = true;
      return { ...b, html };
    });
    return changed ? out : bs;
  };

  const commitBlock = (id: number) => {
    apply((bs) => {
      let changed = false;
      const out = bs.map((b) => {
        if (b.id !== id) return b;
        const html = domHtml(b);
        if (html === null || html === b.html) return b;
        changed = true;
        return { ...b, html };
      });
      return changed ? out : bs;
    });
  };

  const undo = () => {
    const current = withCommitted(blocks);
    const past = current === blocks ? hist.past : [...hist.past, blocks];
    if (!past.length) return;
    setHist({ past: past.slice(0, -1), future: [current, ...hist.future].slice(0, 50) });
    setBlocks(past[past.length - 1]);
    setEpoch((e) => e + 1);
  };
  const redo = () => {
    if (!hist.future.length) return;
    setHist({ past: [...hist.past, blocks], future: hist.future.slice(1) });
    setBlocks(hist.future[0]);
    setEpoch((e) => e + 1);
  };

  const onBlockKeyDown = (e: KeyboardEvent, b: Block) => {
    const el = blockEls.current.get(b.id);
    if (!el) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "b" || key === "i") {
        e.preventDefault();
        if (toggleMark(key === "b" ? "b" : "i", el)) commitBlock(b.id);
        return;
      }
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (key === "s" && onSave) { e.preventDefault(); commitBlock(b.id); onSave(); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && b.type !== "code") {
      e.preventDefault();
      let tail = "";
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0);
        const rest = r.cloneRange();
        rest.selectNodeContents(el);
        rest.setStart(r.endContainer, r.endOffset);
        const tmp = document.createElement("div");
        tmp.appendChild(rest.extractContents());
        tail = stripMarks(tmp.innerHTML);
      }
      const head = stripMarks(el.innerHTML);
      const newId = nid();
      focusNext.current = { id: newId, atEnd: false };
      apply((bs) => {
        const ix = bs.findIndex((x) => x.id === b.id);
        if (ix === -1) return bs;
        // A new item in a list is an item of THAT list: same marker, same
        // indentation. Otherwise a nested ordered list turned into flat
        // top-level bullets the moment you pressed Enter.
        const nb: Block = b.type === "li"
          ? { id: newId, type: "li", html: tail, marker: b.marker, indent: b.indent }
          : { id: newId, type: "p", html: tail };
        return [...bs.slice(0, ix), { ...bs[ix], html: head }, nb, ...bs.slice(ix + 1)];
      });
    } else if (e.key === "Backspace" && (el.textContent ?? "").trim() === "" && blocks.length > 1) {
      e.preventDefault();
      apply((bs) => {
        const ix = bs.findIndex((x) => x.id === b.id);
        if (ix === -1) return bs;
        const prev = bs[ix - 1] ?? bs[ix + 1];
        if (prev) focusNext.current = { id: prev.id, atEnd: true };
        return bs.filter((x) => x.id !== b.id);
      });
    }
  };

  /* place caret in the freshly created / target block after render */
  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const el = blockEls.current.get(f.id);
    if (!el) return;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(!f.atEnd);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, [blocks]);

  /* ——— toolbar: which marks the caret sits inside ———
     Read from the DOM, not from `queryCommandState`: that is the same
     deprecated API whose per-browser answers this editor stopped trusting. */
  useEffect(() => {
    const onSel = () => {
      const root = editorRef.current;
      const sel = window.getSelection();
      const node = sel?.anchorNode ?? null;
      const inside = !!root && !!node && root.contains(node);
      if (inside && sel && sel.rangeCount) lastRange.current = sel.getRangeAt(0).cloneRange();
      const next = {
        b: inside && !!markAncestor(node, "b", root!),
        i: inside && !!markAncestor(node, "i", root!),
        s: inside && !!markAncestor(node, "s", root!),
        code: inside && !!markAncestor(node, "code", root!),
        a: inside && !!markAncestor(node, "a", root!),
      };
      setMarks((p) =>
        p.b === next.b && p.i === next.i && p.s === next.s && p.code === next.code && p.a === next.a ? p : next);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  /* Every formatting control in the toolbar binds through this (ACC-03).
     Keyboard activation of a <button> fires `click` and never `mousedown`, so
     a toolbar bound to onMouseDown alone was Tab-reachable and completely
     inoperable — bold, italic, strikethrough, code, link, both lists, undo and
     redo. The mousedown handler keeps its preventDefault, which is what stops
     the editor losing its selection when the button takes focus; the click
     handler runs ONLY for keyboard activation (a real mouse click reports
     `detail >= 1`, a keyboard one reports 0) and puts the caret's last
     in-editor range back before acting, since focus is on the button by then. */
  const toolbarAction = (run: () => void) => ({
    onMouseDown: (e: ReactMouseEvent) => { e.preventDefault(); run(); },
    onClick: (e: ReactMouseEvent) => {
      if (e.detail !== 0) return; // the pointer path already ran on mousedown
      const range = lastRange.current;
      const root = editorRef.current;
      if (range && root && root.contains(range.commonAncestorContainer)) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      run();
    },
  });

  const runMark = (tag: Mark) => {
    const root = editorRef.current;
    if (!root || !focusedBlock) return;
    if (toggleMark(tag, root)) commitBlock(focusedBlock.id);
  };

  /* The selection is lost the moment focus moves to the URL field, so it is
     captured on the way in and restored on submit. */
  const openLinkField = () => {
    const sel = window.getSelection();
    const root = editorRef.current;
    if (!sel || !sel.rangeCount || !root || !root.contains(sel.anchorNode)) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    const existing = markAncestor(sel.anchorNode, "a", root);
    setLinkUrl(existing?.getAttribute("href") ?? "");
  };
  const submitLink = () => {
    const root = editorRef.current;
    const range = savedRange.current;
    if (root && range && linkUrl && focusedBlock && applyLink(range, linkUrl, root)) commitBlock(focusedBlock.id);
    savedRange.current = null;
    setLinkUrl(null);
  };

  const setBlockType = (value: string) => {
    if (!focusedBlock || focusedBlock.type === "code" || focusedBlock.raw !== undefined) return;
    const level = value === "p" ? 0 : Number(value[1]);
    apply((bs) => bs.map((b) => {
      if (b.id !== focusedBlock.id) return b;
      const html = domHtml(b) ?? b.html;
      return level === 0
        ? { ...b, type: "p", html, level: undefined, marker: undefined, indent: undefined, tight: undefined }
        : {
          ...b, html, marker: undefined, indent: undefined,
          type: (["h1", "h2", "h3"] as const)[Math.min(level, 3) - 1],
          level: level > 3 ? level : undefined,
        };
    }));
  };

  const toggleList = (ordered: boolean) => {
    if (!focusedBlock || focusedBlock.type === "code" || focusedBlock.raw !== undefined) return;
    const already = focusedBlock.type === "li" && /^\d/.test(focusedBlock.marker ?? "-") === ordered;
    apply((bs) => bs.map((b) => {
      if (b.id !== focusedBlock.id) return b;
      const html = domHtml(b) ?? b.html;
      return already
        ? { ...b, type: "p", html, marker: undefined, indent: undefined }
        : { ...b, type: "li", html, level: undefined, tight: undefined, marker: ordered ? "1." : "-" };
    }));
  };

  /* ——— source mode ——— */
  const toSource = () => setSource(serializeBlocks(blocks));
  const toBlocks = () => {
    const md = source ?? "";
    setSource(null);
    apply(() => parseMarkdown(md), true);
  };

  /* ——— scroll-and-flash ——— */
  const flash = (el: Element | null | undefined) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("dr-flash");
    setTimeout(() => el.classList.remove("dr-flash"), 1400);
  };
  const jumpToFinding = (fid: number) =>
    flash(editorRef.current?.querySelector(`span.fmark[data-fid="${fid}"]`));

  /* ——— margin annotations aligned to their match ——— */
  useLayoutEffect(() => {
    const cont = editorRef.current;
    if (!cont) return;
    const crect = cont.getBoundingClientRect();
    const tops: Record<string, number> = {};
    cont.querySelectorAll<HTMLElement>("span.fmark").forEach((s) => {
      const fid = s.dataset.fid;
      if (fid && !(fid in tops)) tops[fid] = Math.max(6, Math.round(s.getBoundingClientRect().top - crect.top));
    });
    setAnnTops((prev) => (JSON.stringify(prev) === JSON.stringify(tops) ? prev : tops));
  }, [rendered, findings, source]);

  /* Only findings that were actually underlined get a margin position. The
     ones that could not be found in the text are listed separately below
     instead of being given a fabricated one. */
  const notable = useMemo(
    () => findings.filter((f) => f.severity === "warn" || f.severity === "error"),
    [findings]);

  const annotOf = (f: EditorFinding) => {
    const rule = f.id < 0 && f.kind === "prose" ? f.note : f.kind === "fact" ? "fact check" : f.kind;
    return {
      fid: f.id, rule, red: f.kind === "fact" || f.severity === "error",
      tone: ANNOT_TONE[rule] ?? "neutral", quote: `“${cleanText(f.text)}”`,
    };
  };

  const annots = useMemo<Annot[]>(() => {
    const items = notable
      .filter((f) => located.has(f.id) && annTops[String(f.id)] !== undefined)
      .map((f) => ({ ...annotOf(f), top: annTops[String(f.id)] }));
    // 64px minimum spread: at 46 the chip of one annotation sat on the quote of
    // the one above it.
    const GAP = 64;
    const placed = items.slice().sort((a, b) => a.top - b.top);
    let last = -GAP;
    for (const p of placed) { p.top = Math.max(p.top, last + GAP); last = p.top; }
    return placed;
  }, [notable, located, annTops]);

  const missing = useMemo(() => notable.filter((f) => !located.has(f.id)).map(annotOf), [notable, located]);

  const shownAnnots = showAllAnnots ? annots : annots.slice(0, ANNOT_CAP);
  const hiddenAnnots = annots.length - shownAnnots.length;
  const railBottom = shownAnnots.length ? shownAnnots[shownAnnots.length - 1].top + 56 : 0;

  const typeValue = focusedBlock && focusedBlock.raw === undefined && focusedBlock.type !== "code" && focusedBlock.type !== "li"
    ? (focusedBlock.type === "p" ? "p" : `h${focusedBlock.level ?? Number(focusedBlock.type[1])}`)
    : "";
  const toolBtn = (active: boolean) =>
    `border ${active ? "border-biscay-2/50 bg-biscay-2/[0.08] text-ink" : "border-ink/15 text-ink/70 hover:text-ink hover:border-ink/40"}`;

  if (loading) {
    return (
      <Card variant="flush" className="w-full" aria-busy="true">
        {/* The writing controls are the editor's own furniture: B, I, S and
            the block-type menu exist whatever the document turns out to say.
            They render, disabled — a control that cannot act yet must look
            like it cannot act (§2/§6: the explicit disabled palette, not a
            ghost) — at the toolbar's real 36px height, so the row does not
            resize when the document lands. Only the BLOCK TYPE reads as
            unknown, because which block the caret will land in depends on the
            document. */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink/12 px-3 py-2">
          <Button disabled aria-label="Block type"><SkeletonLine w={52} h={11} /> <ChevronDown size={11} /></Button>
          <Button icon disabled className="font-bold" aria-label="Bold selection">B</Button>
          <Button icon disabled className="italic font-serif" aria-label="Italic selection">I</Button>
          <Button icon disabled className="line-through" aria-label="Strikethrough selection">S</Button>
          <Button icon disabled aria-label="Inline code"><Code2 size={15} /></Button>
          <Button icon disabled aria-label="Link selection"><Link2 size={15} /></Button>
        </div>
        {/* Same measure floor as the live editor below, and the same scroller,
            so the skeleton and the thing it stands in for behave identically
            in a column too narrow for both columns. */}
        <Scrollable axis="x" scrollerClassName="p-5">
        <div className="grid grid-cols-[minmax(360px,1fr)_190px] gap-4" aria-hidden="true">
          <div className="space-y-3">
            <Skeleton width="55%" height={24} />
            <SkeletonText lines={4} /><SkeletonText lines={3} /><SkeletonText lines={5} />
          </div>
          <div className="space-y-6 border-l border-ink/10 pl-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5"><SkeletonLine w="55%" h={9} /><SkeletonLine w="90%" h={9} /></div>
            ))}
          </div>
        </div>
        </Scrollable>
      </Card>
    );
  }

  const inSource = source !== null;

  return (
    <Card variant="flush" className="w-full">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-ink/12">
        {/* The writing controls are dead in source mode: there is no block to
            apply them to. §2 — do not draw a control that cannot act. */}
        {!inSource && (
          <>
            <Menu
              align="start"
              trigger={
                /* Full-height button: every control in this toolbar group shares
                   the 36px height of the icon buttons (CONVENTIONS.md §13).
                   The compact 28px variant sat visibly shorter beside them. */
                <Button aria-label="Block type">
                  {blockLabel(focusedBlock)} <ChevronDown size={11} />
                </Button>
              }
            >
              <MenuRadioGroup value={typeValue} onValueChange={setBlockType}>
                {TYPE_OPTIONS.map((t) => (
                  <MenuRadioItem key={t.value} value={t.value}>{t.label}</MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </Menu>

            {/* Bold, italic, strikethrough and inline code — the four inline
                marks markdown can actually write back. */}
            {([
              ["b", "B", "Bold", "font-bold"],
              ["i", "I", "Italic", "italic font-serif"],
              ["s", "S", "Strikethrough", "line-through"],
            ] as const).map(([tag, glyph, label, cls]) => (
              <Button
                key={tag}
                icon
                className={`${toolBtn(marks[tag])} ${cls}`}
                aria-pressed={marks[tag]}
                aria-label={`${label} selection`}
                title={`${label} selection`}
                {...toolbarAction(() => runMark(tag))}
              >{glyph}</Button>
            ))}
            <Button
              icon
              className={toolBtn(marks.code)}
              aria-pressed={marks.code}
              aria-label="Inline code"
              title="Inline code"
              {...toolbarAction(() => runMark("code"))}
            ><Code2 size={15} /></Button>
            <Button
              icon
              className={toolBtn(marks.a || linkUrl !== null)}
              aria-pressed={marks.a}
              aria-label="Link selection"
              title="Link selection"
              {...toolbarAction(openLinkField)}
            ><Link2 size={15} /></Button>

            <span className="mx-1 h-5 w-px bg-ink/12" />

            <Button
              icon
              className={toolBtn(focusedBlock?.type === "li" && !/^\d/.test(focusedBlock.marker ?? "-"))}
              aria-pressed={focusedBlock?.type === "li" && !/^\d/.test(focusedBlock.marker ?? "-")}
              aria-label="Toggle bullet list"
              title="Toggle bullet list"
              {...toolbarAction(() => toggleList(false))}
            ><BulletListIc /></Button>
            <Button
              icon
              className={toolBtn(focusedBlock?.type === "li" && /^\d/.test(focusedBlock.marker ?? "-"))}
              aria-pressed={focusedBlock?.type === "li" && /^\d/.test(focusedBlock.marker ?? "-")}
              aria-label="Toggle numbered list"
              title="Toggle numbered list"
              {...toolbarAction(() => toggleList(true))}
            ><ListOrdered size={15} /></Button>

            <span className="mx-1 h-5 w-px bg-ink/12" />

            <Button
              icon className={toolBtn(false)} disabled={!hist.past.length}
              aria-label="Undo" title="Undo (⌘Z)"
              {...toolbarAction(undo)}
            ><Undo2 size={15} /></Button>
            <Button
              icon className={toolBtn(false)} disabled={!hist.future.length}
              aria-label="Redo" title="Redo (⇧⌘Z)"
              {...toolbarAction(redo)}
            ><Redo2 size={15} /></Button>
          </>
        )}

        {/* View options, not formatting. Justify and line height change how
            this reader sees the document and are never written to it, so they
            sit apart from the controls that do change the document
            (CONSOLE-REVIEW M6). */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            className={toolBtn(inSource)}
            aria-pressed={inSource}
            aria-label="Edit the markdown source"
            title="Edit the markdown source"
            onClick={() => (inSource ? toBlocks() : toSource())}
          ><FileCode2 size={15} /> Source</Button>
          <span className="mx-1 h-5 w-px bg-ink/12" />
          <Button icon className={toolBtn(justify)} aria-pressed={justify} aria-label="Justify text" title="Justify text" onClick={() => setJustify((v) => !v)}><JustifyIc /></Button>
          <Button icon className={toolBtn(airy)} aria-pressed={airy} aria-label="Relaxed line height" title="Relaxed line height" onClick={() => setAiry((v) => !v)}><LineHeightIc /></Button>
          {/* Drawn only where the app said what "open the library" means. */}
          {onOpenLibrary && (
            <Button icon className={toolBtn(false)} aria-label="Open the knowledge library" title="Open the knowledge library" onClick={onOpenLibrary}><ExternalLink size={13} /></Button>
          )}
        </div>
      </div>

      {/* The link field is a row of its own under the toolbar rather than a
          browser prompt: a prompt cannot be styled, cannot show the URL a
          selection already has, and blocks the page. */}
      {linkUrl !== null && !inSource && (
        <div className="flex items-center gap-2 border-b border-ink/12 bg-flysch/50 px-3 py-2">
          <label htmlFor="dr-link-url" className="text-[12.5px] font-medium text-ink/70">Link URL</label>
          <Input
            id="dr-link-url"
            autoFocus
            value={linkUrl}
            placeholder="https://"
            className="w-[320px]"
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); submitLink(); }
              if (e.key === "Escape") { savedRange.current = null; setLinkUrl(null); }
            }}
          />
          <Button variant="primary" compact onClick={submitLink} disabled={!linkUrl}>Add link</Button>
          <Button compact onClick={() => { savedRange.current = null; setLinkUrl(null); }}>Cancel</Button>
        </div>
      )}

      {inSource ? (
        /* Source mode is the lossless escape hatch, and it is the library's own
           MarkdownEditor rather than a second one written here (M11). Every
           construct the block editor shows read-only is editable in it. */
        <div className="p-5">
          <MarkdownEditor value={source ?? ""} onChange={setSource} />
        </div>
      ) : (
      /* prose + margin.
          The prose column carries a MEASURE FLOOR, not `minmax(0,1fr)`. With a
          zero floor the 190px margin gutter wins every fight: at a 1024px
          window this column collapsed to 59px and body text wrapped one or two
          characters per line into a 1,076px-tall ribbon. A floor means the
          column stops at a readable measure and the region scrolls instead
          (§20) — content never crushes to make itself fit. */
      <Scrollable axis="x" scrollerClassName="p-5">
        {/* The floor exists ONLY to stop the 190px annotation gutter from
            winning the width fight. In compact mode there is no gutter, so the
            prose column takes the card's full width and wraps normally — a
            floor there would force pointless sideways scrolling on a phone. */}
        <div className={`grid gap-4 ${compact ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[minmax(360px,1fr)_190px]"}`}>
          <div
            ref={editorRef}
          className={`relative min-w-0 ${INLINE_MARKS} ${MARKED}`}
          style={{
            textAlign: justify ? "justify" : undefined,
            lineHeight: airy ? 2 : 1.65,
          } as CSSProperties}
        >
          {blocks.map((b, i) =>
            b.raw !== undefined ? (
              /* Read-only, and labelled. The markdown module keeps this block
                 verbatim so a save cannot damage it; pretending it were an
                 editable paragraph is exactly how tables and front matter used
                 to disappear. */
              <div key={`${epoch}:${b.id}`} className="my-3 rounded-[6px] border border-dashed border-ink/25 bg-flysch/50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">
                    {RAW_LABEL[b.rawKind ?? "html"]}
                  </span>
                  <span className="text-[11px] text-ink/65">Edit in Source</span>
                </div>
                <pre className="mt-1.5 whitespace-pre-wrap font-term text-[12px] leading-[1.55] text-ink/80">{b.raw}</pre>
              </div>
            ) : createElement(BLOCK_TAG[b.type], {
              key: `${epoch}:${b.id}`,
              ref: bindRef(b.id),
              className: BLOCK_CLS[b.type],
              // Nesting is real: an item indented under another renders under
              // it, and the marker says which list it belongs to.
              "data-marker": b.type === "li" ? (/^\d/.test(b.marker ?? "-") ? b.marker : "•") : undefined,
              style: b.type === "li" ? { marginLeft: (b.indent ?? 0) * 8 } : undefined,
              contentEditable: true,
              suppressContentEditableWarning: true,
              // This is the prose surface of an editorial product; the browser's
              // spell checker belongs on it (CONSOLE-REVIEW M5).
              spellCheck: true,
              dangerouslySetInnerHTML: { __html: rendered[i] },
              onBlur: () => commitBlock(b.id),
              onFocus: () => setFocusedId(b.id),
              onKeyDown: (e: KeyboardEvent) => onBlockKeyDown(e, b),
            }),
          )}
          {blocks.length === 0 && (
            <div className="text-[13px] text-ink/70">This document is empty. Start typing to add the first block.</div>
          )}
        </div>

        {/* The annotations are absolutely positioned, so the rail needs an
            explicit height or the last chips spill out through the card. */}
        <div
          className={compact ? "flex flex-col gap-3 border-t border-ink/10 pt-3" : "relative border-l border-ink/10"}
          style={compact ? undefined : { minHeight: railBottom + (annots.length > ANNOT_CAP ? 36 : 0) }}
        >
          {shownAnnots.map((a) => (
            <button
              key={a.fid}
              type="button"
              className={compact ? "min-w-0 text-left group" : "absolute left-3 right-0 text-left group"}
              style={compact ? undefined : { top: a.top }}
              onClick={() => jumpToFinding(a.fid)}
            >
              <Chip label={a.rule} tone={a.tone} dot />
              <Truncate lines={2} className="mt-1.5 text-[11.5px] leading-snug text-ink/70 group-hover:text-ink">{a.quote}</Truncate>
            </button>
          ))}
          {/* The margin used to stop at six findings with nothing said about it,
              so findings 7 and up did not exist here (CONSOLE-REVIEW M9). */}
          {(hiddenAnnots > 0 || showAllAnnots) && annots.length > ANNOT_CAP && (
            <div
              className={compact ? "" : "absolute left-3 right-0"}
              style={compact ? undefined : { top: railBottom }}
            >
              {/* XA-08: one wording for "show the rest of this list", margin
                  annotations included. */}
              <ShowRest expanded={showAllAnnots} total={annots.length} onToggle={() => setShowAllAnnots((v) => !v)} />
            </div>
          )}
        </div>
        </div>
      </Scrollable>
      )}

      {/* Findings whose text is not in the document any more. They used to be
          scattered through the margin at invented positions; here they are
          told apart from the ones you can click through to. */}
      {missing.length > 0 && !inSource && (
        <div className="border-t border-ink/12 px-5 py-3">
          <p className="text-[12px] text-ink/70">
            {missing.length === 1 ? "1 finding no longer matches the text:" : `${missing.length} findings no longer match the text:`}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {missing.map((a) => (
              <li key={a.fid} className="flex min-w-0 items-baseline gap-2">
                <Chip label={a.rule} tone={a.tone} dot />
                <Truncate className="min-w-0 text-[11.5px] text-ink/70">{a.quote}</Truncate>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
