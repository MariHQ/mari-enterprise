import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Chip } from "../data-display/Chip";
import { Truncate } from "../data-display/Truncate";
import { SourceMark } from "../icons/marks";
import { fmtAgo } from "../tokens/format";
import { focusRing } from "../tokens/focusRing";
import type { ChatSourceData, SourceVariant } from "./types";

/* Sources — the "where this came from" block under an assistant reply.
 *
 * An answer that cites [1] and [3] is only checkable if the reader can get to
 * document 1 and document 3, so this is the other half of the reply, not a
 * footer: one flat list, citation number first, and every row carries enough
 * to decide whether to open it (what it is, who wrote it, how old it is)
 * without opening it.
 *
 * It stays a LIST and never becomes cards. Nine retrieved passages as nine
 * bordered boxes is nine times the chrome and no more information, and inside
 * a 360px dock it would push the answer itself off the screen.
 *
 * Cross-referencing runs both ways: <ChatMessage> turns each `[n]` in the
 * reply into a link, clicking it focuses this row, and clicking a row's [n]
 * badge asks the message to find that citation back in the prose. */

/** Beyond this many rows the list stops sorting by provider (citation order is
    what a long answer is read in) and collapses behind "Show all N". */
const PREVIEW = 6;

/** Which citation the reader just clicked in the answer. `seq` makes a second
    click on the same number a new request rather than a no-op. */
export type SourceFocus = { n: number; seq: number };

export type SourcesProps = {
  sources: ChatSourceData[];
  /** "console" links the console route; "public" links only `source_url`. */
  variant?: SourceVariant;
  /** Unique per message: the anchor ids the reply's `[n]` links point at. */
  idPrefix?: string;
  /** Open on first render. Defaults to open for a short list, shut for a long one. */
  defaultOpen?: boolean;
  focus?: SourceFocus | null;
  /** A row's [n] badge was clicked: find that citation in the reply. */
  onCite?: (n: number) => void;
  className?: string;
};

type Row = {
  key: string;
  /** Lowest citation number for this document. */
  n: number;
  /** Every citation number that resolved to it, after deduping. */
  all: number[];
  src: ChatSourceData;
};

/** The retriever hands back the passage as it was stored, so it arrives with
    the markdown, headings and quote markers of the document around it. None of
    that survives one line of preview: strip it to sentences. */
export function cleanSnippet(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*[>#]+[ \t]*/gm, "")
    .replace(/^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+/gm, "")
    .replace(/\*\*|__|~~/g, "")
    // A passage is usually a heading and the lines under it. Flattened with
    // spaces those run together ("Trial length Every new workspace…"); a
    // separator keeps the heading readable as a heading.
    .replace(/\n[ \t]*\n+/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/(^ ?· )|( ·$)/g, "")
    .trim();
}

/** One row per document. The same document can be cited more than once, and a
    list that repeats it is a list that lies about how many things were read. */
function dedupe(sources: ChatSourceData[]): { rows: Row[]; byN: Map<number, Row> } {
  const rows: Row[] = [];
  const byKey = new Map<string, Row>();
  const byN = new Map<number, Row>();
  for (const src of sources) {
    const key = src.document_id != null && src.document_id !== ""
      ? `d:${src.document_id}`
      : `${src.source}:${src.title}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.all.push(src.n);
      existing.n = Math.min(existing.n, src.n);
    } else {
      const row: Row = { key, n: src.n, all: [src.n], src };
      byKey.set(key, row);
      rows.push(row);
    }
    byN.set(src.n, byKey.get(key)!);
  }
  for (const row of rows) row.all.sort((a, b) => a - b);
  return { rows, byN };
}

/** Every citation number in the payload mapped to the number of the row it
    actually lands on, so a reply that cites the same document as [1] and [4]
    links both to row 1 instead of leaving [4] pointing at nothing. Exported
    because <ChatMessage> builds the links and <Sources> owns the deduping. */
export function citeIndex(sources: ChatSourceData[]): Map<number, number> {
  const { byN } = dedupe(sources);
  const index = new Map<number, number>();
  byN.forEach((row, n) => index.set(n, row.n));
  return index;
}

/** Where this row's title points, and whether that is somewhere the reader can
    actually go. A console route means nothing to an anonymous visitor, so the
    public variant offers the provider's own URL or no link at all. */
function linkFor(src: ChatSourceData, variant: SourceVariant): { url: string; external: boolean } | null {
  const canonical = src.source_url || "";
  if (variant === "public") return canonical ? { url: canonical, external: true } : null;
  if (src.href) return { url: src.href, external: false };
  return canonical ? { url: canonical, external: true } : null;
}

const LABEL = "font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65";
const DOT = <span aria-hidden="true" className="text-ink/35">·</span>;

export function Sources({
  sources,
  variant = "console",
  idPrefix = "cite",
  defaultOpen,
  focus = null,
  onCite,
  className = "",
}: SourcesProps) {
  const { rows, byN } = useMemo(() => dedupe(sources), [sources]);

  /* Citation order, always. Grouping by provider was tried and is wrong here:
     the rows are NUMBERED, so a reader who has just read "[2]" scans for 2 and
     finds it third, behind a grouping they did not ask for and cannot see. A
     numbered list that is not in number order reads as a bug. The provider is
     already legible per row, from the mark and the chip. */
  const ordered = useMemo(() => [...rows].sort((a, b) => a.n - b.n), [rows]);

  const [open, setOpen] = useState(defaultOpen ?? rows.length <= PREVIEW);
  const [showAll, setShowAll] = useState(false);
  const [flash, setFlash] = useState<{ key: string; seq: number } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement | null>());
  // Which request has already been served, so a re-render caused by a new
  // token does not scroll the reader back to a row they have moved on from.
  const handled = useRef(-1);

  // A citation was clicked in the reply: open whatever is hiding the row.
  useEffect(() => {
    if (!focus || focus.seq === handled.current) return;
    const row = byN.get(focus.n);
    if (!row) return;
    handled.current = focus.seq;
    setOpen(true);
    if (ordered.indexOf(row) >= PREVIEW) setShowAll(true);
    setFlash({ key: row.key, seq: focus.seq });
  }, [focus, byN, ordered]);

  // Scroll after the row is definitely mounted, and let the highlight fade.
  useEffect(() => {
    if (!flash) return;
    const el = rowRefs.current.get(flash.key);
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    const timer = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(timer);
  }, [flash]);

  if (rows.length === 0) return null;

  const shown = showAll ? ordered : ordered.slice(0, PREVIEW);
  const hidden = ordered.length - shown.length;

  return (
    <section className={`mt-1.5 pt-1.5 border-t border-dashed border-ink/15 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-2 w-full py-0.5 text-left ${focusRing}`}
      >
        <span
          aria-hidden="true"
          className={`inline-flex text-ink/65 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
        >
          <ChevronRight size={12} />
        </span>
        <span className={LABEL}>Sources</span>
        <span className="font-term text-[10.5px] font-medium text-ink/65 bg-flysch border border-ink/10 rounded-[3px] px-1.5">
          {rows.length}
        </span>
      </button>

      {open && (
        <>
          <ol aria-label="Sources" className="mt-1">
            {shown.map((row) => {
              const src = row.src;
              const link = linkFor(src, variant);
              const snippet = cleanSnippet(src.snippet ?? src.meta ?? "");
              const ago = src.updated ? fmtAgo(src.updated) : "";
              const lit = flash?.key === row.key;
              const cited = row.all.map((v) => `[${v}]`).join(" ");
              return (
                <li
                  key={row.key}
                  id={`${idPrefix}-${row.n}`}
                  ref={(el) => { rowRefs.current.set(row.key, el); }}
                  /* The highlight is the whole row, briefly, so the eye lands
                     on the answer to "which one is [3]" and not on a marker it
                     then has to read past. */
                  className={[
                    "flex gap-2 -mx-1.5 px-1.5 py-1.5 rounded-[4px] border-t border-dashed border-ink/12 first:border-t-0",
                    "transition-colors duration-300 motion-reduce:transition-none",
                    lit ? "bg-biscay-2/[0.09] ring-1 ring-biscay-2/45" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => onCite?.(row.n)}
                    title={row.all.length > 1 ? `Cited as ${cited}` : undefined}
                    aria-label={`Find citation ${row.n} in the answer`}
                    className={`shrink-0 grid place-items-center min-w-[24px] h-[19px] mt-[1px] px-1 rounded-[3px] border border-ink/15 bg-flysch font-term text-[11px] font-semibold text-biscay-2 hover:border-biscay-2 hover:bg-biscay-2/[0.08] ${focusRing}`}
                  >
                    {row.n}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span aria-hidden="true" className="shrink-0 inline-flex">
                        <SourceMark provider={src.source} size={14} />
                      </span>
                      {link ? (
                        <a
                          href={link.url}
                          {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                          className={`min-w-0 inline-flex items-center gap-1 text-[13px] font-medium text-biscay-2 hover:text-biscay hover:underline underline-offset-2 ${focusRing}`}
                        >
                          <Truncate className="font-medium">{src.title}</Truncate>
                          {link.external && (
                            <ExternalLink size={11} aria-hidden="true" className="shrink-0 text-ink/50" />
                          )}
                        </a>
                      ) : (
                        <Truncate className="text-[13px] font-medium text-ink">{src.title}</Truncate>
                      )}
                    </div>

                    {snippet && (
                      <Truncate className="mt-0.5 text-[12.5px] leading-snug text-ink/70">
                        {snippet}
                      </Truncate>
                    )}

                    <div className="flex items-center gap-1.5 mt-1 min-w-0 font-term text-[11px] text-ink/65 whitespace-nowrap">
                      <Chip label={src.source} tone="neutral" className="shrink-0" />
                      {src.kind && <>{DOT}<span className="shrink-0">{src.kind}</span></>}
                      {src.author && <>{DOT}<Truncate className="min-w-0">{src.author}</Truncate></>}
                      {ago && <>{DOT}<span className="shrink-0">{ago}</span></>}
                    </div>

                    {src.tags && src.tags.length > 0 && (
                      /* §14: the tag block sits bottom left of the row, in the
                         same place on every row. */
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {src.tags.slice(0, 4).map((tag) => (
                          <Chip key={tag} label={tag} tone="neutral" />
                        ))}
                        {src.tags.length > 4 && (
                          <span className="font-term text-[11px] text-ink/65">
                            +{src.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={`mt-1.5 font-term text-[11.5px] text-biscay-2 hover:text-biscay hover:underline underline-offset-2 ${focusRing}`}
            >
              Show all {ordered.length} sources
            </button>
          )}
          {showAll && ordered.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className={`mt-1.5 font-term text-[11.5px] text-biscay-2 hover:text-biscay hover:underline underline-offset-2 ${focusRing}`}
            >
              Show fewer sources
            </button>
          )}
        </>
      )}
    </section>
  );
}
