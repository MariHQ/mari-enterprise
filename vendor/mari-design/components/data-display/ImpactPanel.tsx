import type { ReactNode } from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { Chip } from "./Chip";
import { ResultCount } from "./Pagination";
import { ShowRest } from "./ShowRest";
import { Scrollable } from "./Scrollable";
import { SortHeader, useSort, tdPad } from "./sortable";
import { SkeletonLine, SkeletonChip } from "./Skeleton";
import { Button } from "../actions/Button";
import { Truncate } from "./Truncate";

/* ImpactPanel: the one impact-analysis rendering, shared by Facts and
   Decisions in the console (it was duplicated inline on both pages). A short
   summary plus a real table of impacted documents.

   The document list is a <table>, not a flex row per document: the reason used
   to be right-aligned against a ragged left edge, so nothing lined up down the
   panel. Columns now share the system's header/cell padding (thPad / tdPad)
   and sort affordance, so this parses like every other table in the console
   (CONVENTIONS.md §3). Severity is the last column because impact rows have no
   clickable item. */

export type ImpactDoc = { title: string; source: string; severity: string; reason: string };

const SEVERITY: Record<string, { tone: string; label: string; rank: number }> = {
  "update-required": { tone: "blocked", label: "Update required", rank: 0 },
  review: { tone: "attention", label: "Review", rank: 1 },
  minor: { tone: "neutral", label: "Minor", rank: 2 },
};

const sev = (s: string) => SEVERITY[s] ?? SEVERITY.minor;

/** Table cells must be allowed to break inside a word, or one unbroken token
 *  stretches the whole table past its container. */
const WRAP = "[overflow-wrap:anywhere]";

/** Document rows drawn per page. */
const DOC_ROWS = 20;

export type ImpactPanelProps = {
  loading?: boolean;
  loadingText?: string;
  summary?: string;
  docs?: ImpactDoc[];
  onClose?: () => void;
  /** Extra actions under the doc list (e.g. Decisions' "Create N tasks").
   *  Rendered bottom left, primary first (CONVENTIONS.md §2). */
  footer?: ReactNode;
  /** Bordered inset box — for hosts without their own strip chrome (Facts). */
  boxed?: boolean;
  /** The panel's own heading. Pass `null` when the host has ALREADY named it:
      the Facts card says "Impact analysis" at the top and this printed the
      same two words again ~220px lower, inside it. */
  title?: ReactNode | null;
  className?: string;
};

export function ImpactPanel({
  loading = false,
  loadingText = "Mari is reading the graph, checking documents that depend on this claim…",
  summary,
  docs = [],
  onClose,
  footer,
  boxed = false,
  title = "Impact analysis",
  className = "",
}: ImpactPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { sort, onSort, sorted } = useSort(docs, {
    title: (d) => d.title,
    source: (d) => d.source,
    severity: (d) => sev(d.severity).rank,
    reason: (d) => d.reason,
  });

  /* An analysis over a real graph returns hundreds of documents. The panel
     caps at DOC_ROWS until the reader asks for the rest, and the expanded list
     scrolls in place rather than growing past the fold (§17, §20). */
  const shown = expanded ? sorted : sorted.slice(0, DOC_ROWS);
  const hidden = sorted.length - shown.length;

  const wrap = [
    "text-[13px] leading-[1.45]",
    boxed && "rounded-[10px] border border-ink/12 bg-flysch/60 px-3.5 py-2.5",
    className,
  ].filter(Boolean).join(" ");

  /* "Impact analysis" is this panel's own name and the four column headers
     are its own literals: none of them wait on the graph. Greying them out
     left a nameless grey block that could have been anything, next to a
     `title` attribute nobody hovers — while `loadingText` says exactly what is
     happening and belongs on screen. Only the summary and the rows are the
     analysis's to return, and they stay bars. Same table box, same colgroup
     widths, so the columns do not move when the documents land. */
  if (loading) {
    return (
      <div className={wrap} aria-busy="true">
        {title && (
          <div className="flex items-center gap-2.5">
            <b className="font-display text-[13.5px] font-semibold text-ink">{title}</b>
          </div>
        )}
        <p className="mt-1.5 max-w-[640px] text-[12.5px] italic text-ink/70">{loadingText}</p>
        <div className="mt-2 overflow-hidden">
          <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: 480 }}>
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "29%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
            <thead>
              <tr>
                <SortHeader label="Document" sortable={false} />
                <SortHeader label="Source" align="center" sortable={false} />
                <SortHeader label="Reason" sortable={false} />
                <SortHeader label="Severity" sortable={false} />
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i} className="border-b border-ink/[0.06] last:border-b-0">
                  <td className={tdPad}><SkeletonLine w="80%" h={11} /></td>
                  <td className={tdPad}><SkeletonLine w="60%" h={11} /></td>
                  <td className={tdPad}><SkeletonLine w="90%" h={11} /></td>
                  <td className={tdPad}><SkeletonChip w={88} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={wrap}>
      {(title || onClose) && (
        <div className="flex items-center gap-2.5">
          {title && <b className="font-display text-[13.5px] font-semibold text-ink">{title}</b>}
          {onClose && (
            <Button icon aria-label="Hide impact analysis" onClick={onClose} className="ml-auto w-7 h-7">
              <X size={14} />
            </Button>
          )}
        </div>
      )}
      {summary && <p className="mt-1.5 max-w-[640px] break-words text-ink/70">{summary}</p>}
      {docs.length === 0 && !summary && <span className="font-term text-[11px] text-ink/65">No impacted documents found.</span>}
      {/* §13: the count strip renders ABOVE the rows it describes. It used to
          sit under the table, next to the pager, where it read as a footnote
          on the button rather than a fact about the list. */}
      {docs.length > 0 && (
        <ResultCount
          className="mt-2 border-t border-ink/10"
          from={1}
          to={shown.length}
          total={sorted.length}
          noun="documents"
          /* XA-08: the expand control used to sit UNDER the table saying "Show
             8 more", so the strip and the way to act on it were at opposite
             ends of the panel and worded independently. */
          actions={hidden > 0 || expanded
            ? <ShowRest expanded={expanded} total={sorted.length} onToggle={() => setExpanded((v) => !v)} />
            : undefined}
        />
      )}
      {docs.length > 0 && (
        <Scrollable className="mt-2" axis="both" style={{ maxHeight: expanded ? 420 : undefined }}>
          {/* table-fixed + a colgroup: column widths are declared, not derived
              from the longest word, so one unbroken token can neither widen
              the table nor squeeze its neighbours to a letter per line. */}
          <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: 480 }}>
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "29%" }} />
              {/* wide enough for the longest severity chip, "Update required" */}
              <col style={{ width: "24%" }} />
            </colgroup>
            <thead>
              <tr>
                <SortHeader label="Document" sortKey="title" sort={sort} onSort={onSort} />
                <SortHeader label="Source" sortKey="source" sort={sort} onSort={onSort} align="center" />
                <SortHeader label="Reason" sortKey="reason" sort={sort} onSort={onSort} />
                <SortHeader label="Severity" sortKey="severity" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {shown.map((doc, i) => {
                const s = sev(doc.severity);
                return (
                  <tr key={`${doc.title}-${i}`} className="border-b border-ink/[0.06] last:border-b-0">
                    {/* overflow-wrap:anywhere, not break-words: only "anywhere"
                        shrinks a cell's min-content width, so a long unbroken
                        token stops widening the table until the severity
                        column falls off the panel. */}
                    <td className={`${tdPad} font-display text-[13px] font-semibold text-ink align-top ${WRAP}`}>{doc.title}</td>
                    <td className={`${tdPad} align-top text-center font-term text-[11.5px] text-ink/65`}>
                      <Truncate title={doc.source}>{doc.source}</Truncate>
                    </td>
                    <td className={`${tdPad} text-[12.5px] leading-[1.4] text-ink/70 align-top ${WRAP}`}>{doc.reason}</td>
                    <td className={`${tdPad} align-top`}><Chip label={s.label} tone={s.tone} caps /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scrollable>
      )}
      {footer && <div className="mt-2.5 flex flex-wrap items-center gap-2">{footer}</div>}
    </div>
  );
}
