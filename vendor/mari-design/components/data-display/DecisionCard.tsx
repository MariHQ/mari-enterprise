import type { ReactNode } from "react";
import { Check, CornerDownRight } from "lucide-react";
import { card } from "../tokens/card";
import { fmtDate, type DateInput } from "../tokens/format";
import { Chip } from "./Chip";
import { Avatar } from "./Avatar";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { CardBody, CardTitleBlock, CardMeta, CardActions } from "../layout/CardShell";
import { SkeletonLine, SkeletonText, SkeletonCircle, SkeletonChip, SkeletonButton } from "./Skeleton";

/* DecisionCard: one row in the decision ledger's timeline. A state marker on a
   spine, then the decision card laid out in the standard card order
   (CONVENTIONS.md §1): statement, context, source/status meta with date and
   owners, an optional impact strip, then the actions bottom left.

   Two things the ledger got wrong and this fixes:

   1. The spine marker was a filled circle, which reads as a radio button, i.e.
      "pick me" (CONVENTIONS.md §6). It is a square state marker now: a check
      inside it once the decision is ratified, the same left-marker /
      check-on-the-right pairing the style picker uses.
   2. The ledger said "Supersede" / "Superseded". The word for setting a
      decision aside is "Ignore" / "Ignored".

   Ratified decisions can host an impact strip via the `impact` slot (compose
   <ImpactPanel />). */

/** "superseded" is the old spelling of "ignored"; both render as Ignored. */
export type DecisionStatus = "proposed" | "ratified" | "ignored" | "superseded";

type ResolvedStatus = "proposed" | "ratified" | "ignored";

const resolve = (s: DecisionStatus): ResolvedStatus => (s === "superseded" ? "ignored" : s);

const STAMP_LABEL: Record<ResolvedStatus, string> = {
  proposed: "Proposed",
  ratified: "Ratified",
  ignored: "Ignored",
};

const STAMP_TONE: Record<ResolvedStatus, string> = {
  proposed: "attention",
  ratified: "ok",
  ignored: "neutral",
};

/* Square, not round: a circle on a list means "choose one". */
/* Timeline markers, NOT checkboxes.

   These were 24px rounded SQUARES, empty with an amber border when proposed
   and solid green with a tick when ratified — which is a checkbox in every
   visual respect, on a ledger where nothing is checkable. The status is
   already stated twice on each card (the stamp on the title line and the
   verb in the body), so the marker's only job is to sit on the spine and say
   where this record falls in the sequence. A dot does that; a tickbox invites
   a click that does not exist. */
const NODE: Record<ResolvedStatus, string> = {
  proposed: "border-clay bg-paper",
  ratified: "border-moss bg-moss",
  ignored: "border-ink/25 bg-flysch",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

export type DecisionCardProps = {
  statement: string;
  context?: string;
  status: DecisionStatus;
  /** Marks decisions Mari surfaced from a scan (sparkle before the statement). */
  fresh?: boolean;
  sourceLabel?: string;
  /** Optional source glyph rendered inside the source chip. */
  sourceIcon?: ReactNode;
  /** Owner names — rendered as overlapping avatars from their initials. */
  owners?: string[];
  decidedOn?: DateInput;
  /** The decision this one was set aside for. */
  ignoredForStatement?: string;
  /** @deprecated Use `ignoredForStatement`. */
  supersededByStatement?: string;
  ratifying?: boolean;
  onRatify?: () => void;
  /** Sets the decision aside. Shown as "Ignore". */
  onIgnore?: () => void;
  /** @deprecated Use `onIgnore`. */
  onSupersede?: () => void;
  /** Override the default action cluster (Ratify / Ignore). */
  actions?: ReactNode;
  /** Impact strip — compose <ImpactPanel /> here for ratified decisions. */
  impact?: ReactNode;
  /** Draws the connecting timeline spine below the node (for stacked lists). */
  spine?: boolean;
  /** Render a content-shaped skeleton placeholder instead of the card. */
  loading?: boolean;
  className?: string;
};

export function DecisionCard({
  statement, context, status, fresh = false, sourceLabel, sourceIcon,
  owners = [], decidedOn, ignoredForStatement, supersededByStatement, ratifying = false,
  onRatify, onIgnore, onSupersede, actions, impact, spine = true, loading = false, className = "",
}: DecisionCardProps) {
  if (loading) {
    return (
      <div className={`relative flex gap-4 ${className}`.trim()} aria-hidden="true">
        <div className="relative flex flex-col items-center">
          {spine && <span className="absolute top-6 bottom-0 w-px bg-ink/12" />}
          <SkeletonCircle size={24} />
        </div>
        <div className={`${card} min-w-0 flex-1 p-4 mb-4`}>
          <div className="flex items-start gap-3">
            <SkeletonLine w="68%" h={14} />
            <span className="ml-auto"><SkeletonChip w={64} /></span>
          </div>
          <SkeletonText lines={2} className="mt-2.5" lastWidth="72%" />
          <div className="mt-3 flex items-center gap-3">
            <SkeletonChip w={92} />
            <SkeletonCircle size={20} />
            <SkeletonCircle size={20} />
          </div>
          <div className="mt-3"><SkeletonButton w={82} /></div>
        </div>
      </div>
    );
  }

  const state = resolve(status);
  const ignored = state === "ignored";
  const replacedBy = ignoredForStatement ?? supersededByStatement;
  const ignore = onIgnore ?? onSupersede;

  return (
    <div className={`relative flex gap-4 ${className}`.trim()}>
      <div className="relative flex flex-col items-center">
        {/* The rail was bg-ink/12 — close enough to the page that the markers
            read as free-floating rather than as points on a timeline. */}
        {spine && <span className="absolute top-5 bottom-0 w-px bg-ink/20" aria-hidden="true" />}
        <span
          className={`relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 ${NODE[state]}`}
          role="img"
          aria-label={STAMP_LABEL[state]}
        />
      </div>

      <article className={`${card} min-w-0 flex-1 p-4 mb-4 ${ignored ? "opacity-80" : ""}`.trim()}>
        <CardBody>
          {/* 4 + 5: the decision itself, then its context. The state stamp sits
              on the right of the title line, opposite the spine marker. */}
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <CardTitleBlock
              className="flex-1 basis-[220px]"
              title={(
                /* break-words: an unbroken 90-character token used to punch
                   straight through the card's right edge. */
                <span className={`block break-words ${ignored ? "line-through decoration-ink/30" : ""}`.trim()}>
                  {fresh && <span title="Found by Mari scan" className="mr-1">✨</span>}
                  <q className="not-italic">{statement}</q>
                </span>
              )}
              summary={context && <span className="block break-words">{context}</span>}
            />
            <Chip
              label={STAMP_LABEL[state]}
              tone={STAMP_TONE[state]}
              icon={state === "ratified" ? <Check size={11} strokeWidth={2.6} aria-hidden /> : undefined}
              dot={state !== "ratified"}
              className="shrink-0"
            />
          </div>

          {ignored && replacedBy && (
            <div className="flex items-start gap-1.5 text-[12.5px] text-ink/70">
              <CornerDownRight size={14} className="mt-[2px] shrink-0" aria-hidden />
              <span className="min-w-0 break-words">Ignored in favour of <b className="text-ink/85">{`“${replacedBy}”`}</b></span>
            </div>
          )}

          {/* 6 + 7: source and status chips left, date and owners right. */}
          <CardMeta
            source={sourceLabel ? <Chip label={sourceLabel} icon={sourceIcon} /> : undefined}
            date={decidedOn ? `Decided ${fmtDate(decidedOn)}` : undefined}
            author={owners.length > 0 ? (
              <span className="flex items-center -space-x-1.5">
                {owners.map((o) => <Avatar key={o} initials={initialsOf(o)} />)}
              </span>
            ) : undefined}
          />

          {impact && <div className="border-t border-ink/10 pt-3">{impact}</div>}

          {/* 11 + 12: buttons last, biggest action first and bottom LEFT. */}
          {actions ? (
            <CardActions primary={actions} />
          ) : (
            <CardActions
              primary={state === "proposed" && onRatify ? (
                <Button variant="success" compact onClick={onRatify} disabled={ratifying}>
                  <Check size={13} /> {ratifying ? "Ratifying…" : "Ratify"}
                </Button>
              ) : undefined}
              secondary={state !== "ignored" && ignore ? (
                <ConfirmButton compact confirmLabel="Ignore this decision?" onConfirm={ignore}>
                  Ignore
                </ConfirmButton>
              ) : undefined}
            />
          )}
        </CardBody>
      </article>
    </div>
  );
}
