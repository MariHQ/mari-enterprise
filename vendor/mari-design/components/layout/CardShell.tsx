import type { ReactNode } from "react";
import { TruncateInline } from "../data-display/Truncate";

/* Content-ordering primitives for cards, drawers, and inspector rails.
   CONVENTIONS.md §1 fixes the order; these components make it mechanical so
   every surface lands on the same rhythm instead of each one inventing its own.

     <CardBody>
       <CardTitleBlock title=… summary=… />
       <CardMeta source=… status=… date=… author=… />
       <CardSection label="References"> … </CardSection>
       <CardActions primary=… secondary=… />
     </CardBody>
*/

/** Vertical rhythm wrapper. Every direct child is separated identically. */
export function CardBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`flex flex-col gap-4 ${className}`.trim()}>{children}</div>;
}

/** Title of the doc/content plus its one-line summary (order slots 4 and 5). */
export function CardTitleBlock({
  title, summary, eyebrow, className = "",
}: { title: ReactNode; summary?: ReactNode; eyebrow?: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`.trim()}>
      {eyebrow && (
        <span className="block font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-biscay-2 mb-1">
          {eyebrow}
        </span>
      )}
      {/* Stays h3, which is now the correct rung: page title h1 (PageHeader),
          card heading h2 (Card), item heading h3 (ACC-01). */}
      <h3 className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
      {summary && <p className="mt-1 text-[13px] leading-relaxed text-ink/70">{summary}</p>}
    </div>
  );
}

/* Source + status chips on the LEFT, date and author/approver right-aligned on
   the SAME line (order slots 6 and 7). When there are too many tags they stack
   inside the left block, and the date/author group rides the BOTTOM tag row
   (items-end), never a line below the whole stack (CONVENTIONS.md §14). */
export function CardMeta({
  source, status, date, author, className = "",
}: {
  source?: ReactNode;
  status?: ReactNode;
  date?: ReactNode;
  author?: ReactNode;
  className?: string;
}) {
  const hasLeft = source || status;
  const hasRight = date || author;
  if (!hasLeft && !hasRight) return null;
  return (
    <div className={`flex flex-wrap items-end gap-x-3 gap-y-2 ${className}`.trim()}>
      {/* The tag block keeps an 8rem floor so a long date/author group can
          never crush the chips into a 2px column; past that, the right group
          truncates or wraps below instead. */}
      {hasLeft && <div className="flex min-w-[8rem] flex-1 flex-wrap items-center gap-1.5">{source}{status}</div>}
      {hasRight && (
        <div className="ml-auto flex min-w-0 items-center gap-2 font-term text-[11px] text-ink/65">
          {date != null && <span className="shrink-0 whitespace-nowrap">{date}</span>}
          {date && author && <span className="shrink-0 text-ink/30" aria-hidden>·</span>}
          {author != null && (
            typeof author === "string"
              ? <TruncateInline className="min-w-0">{author}</TruncateInline>
              : <span className="min-w-0 truncate">{author}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* A labelled block: References, Endpoints, Members/Connections, Owners.
   The mono label is the same everywhere so these read as one family. */
export function CardSection({
  label, count, action, className = "", children,
}: {
  label: string;
  count?: number;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-2">
        {/* h3, not h4: a CardSection is just as often a direct child of a card
            (h2) as it is a block under a CardTitleBlock (h3), and at h4 the
            first case skipped a level (ACC-01). At h3 it either descends by one
            or reads as a sibling of the item title — never a gap. */}
        <h3 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">{label}</h3>
        {count != null && (
          <span className="font-term text-[10.5px] font-medium text-ink/65 bg-flysch border border-ink/10 rounded-[3px] px-1.5">
            {count}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/* Action row. The primary/affirmative action is BOTTOM LEFT; secondary actions
   sit to its right on the same line (CONVENTIONS.md §2). */
export function CardActions({
  primary, secondary, className = "",
}: { primary?: ReactNode; secondary?: ReactNode; className?: string }) {
  if (!primary && !secondary) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 pt-1 ${className}`.trim()}>
      {primary}
      {secondary}
    </div>
  );
}
