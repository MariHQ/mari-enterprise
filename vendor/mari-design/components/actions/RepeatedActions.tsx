import type { MouseEvent } from "react";
import { ClipboardCheck, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button, buttonClasses, type ButtonProps } from "./Button";

/* Actions that appear on more than one pane, rendered from one place
   (CONVENTIONS §16, XA-23).
 *
 * Four actions were each written out three to six times with a different
 * icon, height, label and busy word every time:
 *
 *   "Create review task"  bottom-left with a ClipboardCheck in three Lineage
 *                         drawers, bottom-left without one in the findings
 *                         panel, right-aligned inside two tables. Done state
 *                         "Review task created" in one half of them and "Task
 *                         created" in the other; busy "Creating" against
 *                         "Creating…".
 *   "Open document"       three shapes, two different glyphs (ArrowRight and
 *                         ExternalLink), and `h-9` beside an `h-8` sibling,
 *                         which breaks §13's equal-height rule for a button
 *                         group.
 *   "Export"              four labels ("Export", "Export CSV", "Export
 *                         report", "Exported") and two glyphs that say the
 *                         wrong thing: <Plus> on an export, and <Send> on
 *                         something that downloads a file to the reader's own
 *                         machine.
 *   "Refresh"             rendered twice inside one feature, at the page
 *                         header and again on the table below it.
 *
 * Each component below fixes the icon, the label, the busy word and the done
 * word. Position stays with the caller because §1 and §2 already say where an
 * action goes; what these remove is the freedom to spell it differently.
 *
 * All of them take the rest of ButtonProps, so a caller can still set
 * `compact` — but a group must pick ONE size for every button in it (§13). */

type Common = Omit<ButtonProps, "children" | "variant">;

/** Primary "open a review task on this thing" action. Bottom left (§2). */
export function CreateReviewTaskButton({ state = "idle", ...rest }: Common & {
  /** idle → "Create review task", busy → "Creating…", done → the past tense. */
  state?: "idle" | "busy" | "done";
}) {
  return (
    <Button variant="primary" disabled={state !== "idle"} {...rest}>
      <ClipboardCheck size={13} aria-hidden />
      {state === "done" ? "Review task created" : state === "busy" ? "Creating…" : "Create review task"}
    </Button>
  );
}

/** Secondary "go read the source document" action. Sits to the RIGHT of the
    primary on the same line — §2 names this exact pair as its example. The
    glyph is ExternalLink because the document opens away from the console;
    ArrowRight means "next step in this flow" and said the wrong thing.

    Pass `href` when the document has a URL. It then renders an <a>, because a
    <button onClick={navigate}> silently removes cmd-click, middle-click, "copy
    link address" and the status-bar preview from something that is, to the
    reader, a link. The class string comes from `buttonClasses` so the anchor
    is exactly as tall as the button beside it (§13). */
export function OpenDocumentButton({ href, onOpen, compact = false, block = false, className }: {
  /** The document's URL. Given, this renders an <a> and keeps link behaviour. */
  href?: string;
  /** In-app navigation. Called instead of following `href`, which stays on the
      element so the browser's own link affordances keep working. */
  onOpen?: () => void;
  compact?: boolean;
  block?: boolean;
  className?: string;
}) {
  const label = <>Open document <ExternalLink size={13} aria-hidden /></>;
  const classes = buttonClasses({ compact, block, className });
  if (href) {
    return (
      <a
        href={href}
        className={classes}
        onClick={onOpen && ((e: MouseEvent<HTMLAnchorElement>) => {
          // Let the browser handle every click that means "somewhere else":
          // a modified click is the reader asking for a new tab or window.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onOpen();
        })}
      >
        {label}
      </a>
    );
  }
  return <Button compact={compact} block={block} className={className} onClick={onOpen}>{label}</Button>;
}

/** "Write what is on screen out to a file." Always a Download glyph: the file
    lands on the reader's machine, so neither <Plus> nor <Send> describes it. */
export function ExportButton({ state = "idle", format = "CSV", ...rest }: Common & {
  /** done → "Exported", so the control confirms in place. */
  state?: "idle" | "busy" | "done";
  /** Named in the label so the reader knows what they are about to get. */
  format?: string;
}) {
  return (
    <Button {...rest} disabled={rest.disabled || state === "busy"}>
      <Download size={13} aria-hidden />
      {state === "done" ? "Exported" : state === "busy" ? "Exporting…" : `Export ${format}`}
    </Button>
  );
}

/** "Fetch this again." One per pane, never one per level of a pane. */
export function RefreshButton({ busy = false, count = 0, ...rest }: Common & {
  busy?: boolean;
  /** Times it has been refreshed this session, shown so a reload that changes
      nothing visible still reads as having happened. 0 hides it. */
  count?: number;
}) {
  return (
    <Button {...rest} disabled={rest.disabled || busy}>
      <RefreshCw size={13} aria-hidden className={busy ? "animate-spin" : undefined} />
      {busy ? "Refreshing…" : `Refresh${count > 0 ? ` (${count})` : ""}`}
    </Button>
  );
}
