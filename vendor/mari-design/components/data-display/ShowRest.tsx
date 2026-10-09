import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../actions/Button";

/* The one "show the rest of this list" toggle (XA-08, CONVENTIONS §16).
 *
 * Eight phrasings were in use for one control: "Show all", "Show all {n}",
 * "Show more", "See all", "See all {n} uncovered questions", "View all
 * sources", "View all {n} revisions", and — collapsing back — "Show fewer",
 * "Show less". A reader who learns the affordance on one card had to learn it
 * again on the next.
 *
 * One wording, both directions: "Show all {n}" out, "Show fewer" back. The
 * count goes in the label because a toggle that does not say how much more
 * there is asks the reader to click to find out. The chevron points the way
 * the list is about to move, and `aria-expanded` says the same thing to a
 * screen reader.
 *
 * Pair it with <ResultCount> (Pagination.tsx) as that strip's `actions`: the
 * strip says what is on screen, this says how to see the rest, and §13 keeps
 * both ABOVE the list. */
export function ShowRest({ expanded, total, onToggle, className = "" }: {
  expanded: boolean;
  /** Rows there are in all, named in the collapsed label. Omit it when the
      thing being expanded is not a list — a clamped paragraph has no row
      count, and the first pass at this rendered "Show all 240" from the
      answer's CHARACTER length, which is a number about nothing. */
  total?: number;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="link"
      aria-expanded={expanded}
      onClick={onToggle}
      className={className}
    >
      {expanded
        ? <><ChevronUp size={13} aria-hidden /> Show fewer</>
        : <><ChevronDown size={13} aria-hidden /> Show all{total === undefined ? "" : ` ${total.toLocaleString("en-US")}`}</>}
    </Button>
  );
}
