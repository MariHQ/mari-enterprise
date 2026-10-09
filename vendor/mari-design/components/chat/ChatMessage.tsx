import { useMemo, useRef, useState, type MouseEvent } from "react";
import { MarkdownView } from "../data-display/MarkdownView";
import { ToolCall } from "./ToolCall";
import { Sources, citeIndex, type SourceFocus } from "./Sources";
import type { ChatMessageData, SourceVariant } from "./types";

/* ChatMessage: one transcript entry, rendered in three distinct treatments
   rather than opposing bubbles:

     user      a bold line, flush with the dock's left edge
     assistant the tool trace (⏺ rows) followed by the reply, indented one
               step in, with a blinking caret while streaming, and the
               Sources block under it
     warning   an inline clay-toned notice, on the assistant's indent

   The user line used to carry a decorative ❯ that did nothing but push the
   first line of the conversation off the dock's plumb line. It is gone: the
   user's turn is the outdented line, everything the agent says is indented
   under it, and the composer below shares the same left edge.

   The reply is MARKDOWN, not preformatted text. The agent writes lists, code
   and tables because those are the shapes the answer has, and `whitespace-
   pre-wrap` rendered all of it as punctuation: literal asterisks down the
   margin, a fenced block as three backticks and an unindented paragraph, a
   pipe table as a wall of pipes. It goes through <MarkdownView>, the same
   renderer Doc Review reads documents with, so a snippet quoted out of a
   document looks the way it looks in the document.

   Two things are adjusted on the way in:

     * Headings are demoted two levels. A reply that opens with `# Pricing`
       would otherwise set a 27px display heading directly under the dock's
       own 16px title, and the answer would outrank the surface it is in.
     * A bare `[3]` becomes a link to source row 3. A citation the reader
       cannot follow is decoration; this is what makes it an affordance. Only
       numbers that actually resolve to a source are linked, so an ordinary
       `[0]` in prose stays text. */

/** One indent step. Tool rows, reply text, and warnings all share it. */
export const CHAT_INDENT = "pl-[18px]";

/* The dock is 360px wide, so the document scale <MarkdownView> reads at
   (14.5px prose, generous block margins) is a size and a half too large here.
   Same renderer, same type family, tighter setting. */
const PROSE = [
  "[&>div>*:first-child]:mt-0 [&>div>*:last-child]:mb-0",
  "[&_p]:text-[13.5px] [&_p]:leading-[1.6] [&_p]:my-2",
  "[&_li]:text-[13.5px] [&_li]:leading-[1.6]",
  "[&_ul]:my-2 [&_ul]:pl-4 [&_ol]:my-2 [&_ol]:pl-4",
  "[&_h1]:text-[15px] [&_h2]:text-[14px] [&_h3]:text-[13.5px]",
  "[&_pre]:px-2.5 [&_pre]:py-2 [&_code]:text-[0.82em]",
  "[&_blockquote]:my-2 [&_blockquote]:pl-3",
  "[&_table]:text-[12.5px]",
].join(" ");

/* The citation link. `title` starts with "Source" so this can be styled and
   found without touching the shared markdown renderer, and it doubles as a
   useful tooltip: hovering [3] says which document [3] is. */
const CITE = [
  "[&_a[title^=Source]]:no-underline [&_a[title^=Source]]:font-term",
  "[&_a[title^=Source]]:text-[10.5px] [&_a[title^=Source]]:font-semibold",
  "[&_a[title^=Source]]:align-[0.3em] [&_a[title^=Source]]:mx-[1px]",
  "[&_a[title^=Source]]:px-[3px] [&_a[title^=Source]]:py-px",
  "[&_a[title^=Source]]:rounded-[3px] [&_a[title^=Source]]:border",
  "[&_a[title^=Source]]:border-ink/15 [&_a[title^=Source]]:bg-flysch",
  "[&_a[title^=Source]]:text-biscay-2",
  "[&_a[title^=Source]:hover]:border-biscay-2 [&_a[title^=Source]:hover]:bg-biscay-2/[0.08]",
  // Set for a moment when the reader clicks the matching row's [n] badge.
  "[&_a[data-lit]]:border-biscay-2 [&_a[data-lit]]:bg-biscay-2/[0.14] [&_a[data-lit]]:ring-1 [&_a[data-lit]]:ring-biscay-2/50",
].join(" ");

/* The caret rides the last block's ::after rather than sitting in its own
   element: a block-level sibling would drop it to a line of its own, which
   reads as a stray mark under the reply instead of the cursor at the end of
   the sentence being written. */
const CARET = [
  "[&>div>*:last-child]:after:inline-block [&>div>*:last-child]:after:w-[6px]",
  "[&>div>*:last-child]:after:h-[0.95em] [&>div>*:last-child]:after:ml-1",
  "[&>div>*:last-child]:after:align-[-0.12em] [&>div>*:last-child]:after:bg-espelette",
  "[&>div>*:last-child]:after:animate-pulse",
  "[&>div>*:last-child]:motion-reduce:after:animate-none",
].join(" ");

/** Split on fenced code so nothing inside a fence is rewritten: a shell
    snippet's `# comment` is not a heading and `arr[3]` is not a citation. */
function outsideFences(md: string, fn: (chunk: string) => string): string {
  const out: string[] = [];
  let buf: string[] = [];
  let fence = "";
  const flush = () => { if (buf.length) { out.push(fn(buf.join("\n"))); buf = []; } };
  for (const line of md.split("\n")) {
    const open = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      out.push(line);
      if (open && line.trim().startsWith(fence)) fence = "";
    } else if (open) {
      flush();
      out.push(line);
      fence = open[1].slice(0, 3);
    } else {
      buf.push(line);
    }
  }
  flush();
  return out.join("\n");
}

/** `[3]` to a link, but never inside an inline code span and never where the
    author already wrote a real link (`[3](…)`). */
function linkCites(chunk: string, hrefFor: (n: number) => string | null): string {
  return chunk
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/\[(\d{1,3})\](?!\()/g, (whole, digits: string) => {
            const href = hrefFor(Number(digits));
            return href ? `[${digits}](${href})` : whole;
          }),
    )
    .join("");
}

export type ChatMessageProps = {
  message: ChatMessageData;
  /** Passed to <Sources>: "public" links only a document's own URL. */
  sourceVariant?: SourceVariant;
};

export function ChatMessage({ message, sourceVariant = "console" }: ChatMessageProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const [focus, setFocus] = useState<SourceFocus | null>(null);

  const sources = message.sources ?? [];
  // Only [A-Za-z0-9_-] so the id is safe to put straight into a CSS selector.
  const idPrefix = `cite-${message.id.replace(/[^A-Za-z0-9_-]/g, "")}`;

  const body = useMemo(() => {
    const index = citeIndex(sources);
    const titles = new Map(sources.map((s) => [s.n, s.title]));
    return outsideFences(message.content ?? "", (chunk) =>
      linkCites(
        // Demote every heading two levels, capped at h6.
        chunk.replace(/^([ \t]{0,3})(#{1,6})(?!#)/gm, (_m, indent: string, hashes: string) =>
          indent + "#".repeat(Math.min(6, hashes.length + 2))),
        (n) => {
          const row = index.get(n);
          if (row == null) return null;
          // A quote would end the markdown title early, so it cannot survive.
          const label = (titles.get(n) ?? "").replace(/"/g, "").slice(0, 80);
          return `#${idPrefix}-${row} "Source ${n}${label ? `: ${label}` : ""}"`;
        },
      ),
    );
  }, [message.content, sources, idPrefix]);

  const reduced = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** A citation in the reply was clicked: focus its row instead of jumping the
      whole dock to an anchor. */
  function onBodyClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const link = target?.closest?.(`a[href^="#${idPrefix}-"]`);
    if (!link) return;
    event.preventDefault();
    const n = Number(link.getAttribute("href")?.slice(idPrefix.length + 2));
    if (Number.isFinite(n)) setFocus({ n, seq: ++seq.current });
  }

  /** The other direction: a row's [n] badge was clicked, so light up the place
      in the prose that cites it. The prose is injected HTML, so this is the one
      thing here that touches the DOM directly. */
  function onCite(n: number) {
    const link = bodyRef.current?.querySelector<HTMLElement>(`a[href="#${idPrefix}-${n}"]`);
    if (!link) return;
    link.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    link.setAttribute("data-lit", "");
    window.setTimeout(() => link.removeAttribute("data-lit"), 1800);
  }

  if (message.role === "user") {
    return (
      /* break-words: whitespace-pre-wrap alone will not break a pasted token
         with no spaces, so it used to run out of the dock. */
      <div className="pt-1.5 pb-0.5 font-semibold text-ink whitespace-pre-wrap break-words">
        {message.content}
      </div>
    );
  }

  if (message.role === "warning") {
    return (
      <div className="ml-[18px] px-2.5 py-1.5 rounded-[4px] border border-clay/35 bg-clay/[0.07] text-[12.5px] text-clay break-words">
        {message.content}
      </div>
    );
  }

  // assistant
  const hasBody = Boolean(message.content);
  return (
    <div className="flex flex-col gap-1">
      {message.tools?.map((t, i) => (
        <ToolCall key={t.id ?? i} tool={t} />
      ))}

      {(hasBody || message.streaming) && (
        <div className={`${CHAT_INDENT} min-w-0 pt-0.5 pb-1`}>
          {hasBody ? (
            <div
              ref={bodyRef}
              onClick={onBodyClick}
              className={`min-w-0 break-words ${PROSE} ${CITE} ${message.streaming ? CARET : ""}`}
            >
              <MarkdownView>{body}</MarkdownView>
            </div>
          ) : (
            /* Nothing has landed yet: the caret has no last line to ride. */
            <span
              aria-hidden="true"
              className="inline-block w-[6px] h-[14px] align-text-bottom bg-espelette animate-pulse motion-reduce:animate-none"
            />
          )}
        </div>
      )}

      {sources.length > 0 && (
        <div className={`${CHAT_INDENT} min-w-0`}>
          <Sources
            sources={sources}
            variant={sourceVariant}
            idPrefix={idPrefix}
            focus={focus}
            onCite={onCite}
          />
        </div>
      )}
    </div>
  );
}
