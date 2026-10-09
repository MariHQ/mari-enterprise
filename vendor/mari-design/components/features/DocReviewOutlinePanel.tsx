// DocReview outline + revision panels — the left rail: a live document outline
// derived from heading blocks (auto-numbered, skipping headings that carry their
// own number), and a revision-history list. Ported from
// mari-cloud/web/src/pages/docreview/OutlinePanel.tsx + the outline derivation in
// index.tsx. Renders standalone from a baked-in document body + revisions; the
// jump handler is optional (defaults to highlighting the clicked outline item).

import { useMemo, useState } from "react";
import { parseMarkdown } from "../data-display/markdown";
import { Card } from "../layout/Card";
import { Avatar } from "../data-display/Avatar";
import { ShowRest } from "../data-display/ShowRest";
import { fmtDate } from "../tokens/format";
import { Chip } from "../data-display/Chip";
import { SkeletonLine, SkeletonCircle } from "../data-display/Skeleton";

/* ————— ported helpers ————— */

/* Strip tags without touching the DOM.
 *
 * This used to round-trip through `document.createElement("div")`, which threw
 * `ReferenceError: document is not defined` the moment anything server-rendered
 * the panel — during a render pass, so there was no way for a caller to guard
 * it. An outline is derived from a heading's text, and that is a string
 * operation; it never needed a live document.
 *
 * Block HTML here comes from `parseMarkdown`, so the tag set is known and
 * closed (no scripts, no comments, no CDATA). Entities are decoded for the
 * handful the renderer can emit. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

const blockText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
const hasOwnNumbering = (s: string) => /^\s*\d+(\.\d+)*[.)]?(\s|$)/.test(s);
const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

type OutlineItem = { id: number; n: string; t: string; sub: boolean };
/** One revision-history row. */
export type DocRevision = { id: number; actor: string; verb: string; at: string };

/* ————— demo data ————— */

/* Every timestamp carries its year (CONVENTIONS.md §5) — the list used to mix
   "2h ago" and "Jul 18, 11:03 AM", so two rows could not be compared. */

export function DocReviewOutlinePanel({
  body,
  revisions,
  onJump,
  loading = false,
}: {
  body: string;
  revisions: DocRevision[];
  onJump?: (id: number) => void;
  loading?: boolean;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const outline = useMemo<OutlineItem[]>(() => {
    const blocks = parseMarkdown(body);
    const items: OutlineItem[] = [];
    let h2 = 0, h3 = 0;
    for (const b of blocks) {
      if (b.type !== "h2" && b.type !== "h3") continue;
      const text = blockText(b.html);
      if (b.type === "h2") {
        h2++; h3 = 0;
        items.push({ id: b.id, n: hasOwnNumbering(text) ? "" : `${h2}.`, t: text, sub: false });
      } else {
        h3++;
        items.push({ id: b.id, n: hasOwnNumbering(text) ? "" : `${h2}.${h3}`, t: text, sub: true });
      }
    }
    return items;
  }, [body]);

  const jump = (id: number) => { setActiveId(id); onJump?.(id); };
  const visibleRevs = showAll ? revisions : revisions.slice(0, 4);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4" aria-hidden="true">
        <Card title="Document outline">
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonLine key={i} w={`${88 - (i % 3) * 16}%`} h={11} className={i % 2 ? "ml-4" : ""} />
            ))}
          </div>
        </Card>
        <Card title="Revision history">
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2.5">
                <SkeletonCircle size={26} />
                <div className="flex-1 space-y-1.5"><SkeletonLine w="55%" h={11} /><SkeletonLine w="75%" h={9} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Card title="Document outline">
        <div className="space-y-0.5">
          {outline.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => jump(o.id)}
              className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-[13px] transition-colors ${
                o.sub ? "pl-6" : ""
              } ${activeId === o.id ? "bg-biscay-2/[0.08] text-ink" : "text-ink/70 hover:bg-flysch hover:text-ink"}`}
            >
              {/* A square bar, not a dot: a circle reads as "choose me"
                  (CONVENTIONS.md §6). */}
              {!o.sub && <span className="inline-block h-2.5 w-[3px] shrink-0 rounded-[1px] bg-clay" />}
              {o.n && <span className="shrink-0 font-term text-[11px] text-ink/65">{o.n}</span>}
              <span className="min-w-0 truncate">{o.t}</span>
            </button>
          ))}
          {outline.length === 0 && (
            <div className="text-[12.5px] text-ink/70">No headings yet. Add a section with the H1 menu.</div>
          )}
        </div>
      </Card>

      <Card title="Revision history">
        <div className="space-y-3">
          {visibleRevs.map((r, i) => (
            <div key={r.id} className="flex items-start gap-2.5">
              <Avatar initials={initialsOf(r.actor)} />
              <span className="min-w-0 flex-1">
                {/* The name truncates and the chip stays put: a long name used
                    to shove "Current" onto its own ragged line. */}
                <span className="flex items-center gap-1.5 text-[13px] text-ink">
                  <span className="min-w-0 truncate">{r.actor}</span>
                  {i === 0 && <span className="shrink-0"><Chip label="Current" tone="ok" dot pulse /></span>}
                </span>
                {/* `fmtDate` returns "" for anything that is not a date, so the
                    separator goes with it: "ran Tighten ·" trailing into
                    nothing reads as a value that failed to load rather than a
                    revision with no timestamp. */}
                <span className="mt-0.5 block break-words text-[11px] text-ink/70">
                  {[r.verb, fmtDate(r.at)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </div>
          ))}
          {visibleRevs.length === 0 && (
            <div className="text-[12.5px] text-ink/70">No revisions yet. Edits show up here as soon as they are saved.</div>
          )}
        </div>
        {/* XA-08: "View all N revisions" was one of eight spellings of this one
            control. Same words, same chevron, every list. */}
        {revisions.length > 4 && (
          <div className="mt-3">
            <ShowRest expanded={showAll} total={revisions.length} onToggle={() => setShowAll((v) => !v)} />
          </div>
        )}
      </Card>
    </div>
  );
}
