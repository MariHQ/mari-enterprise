import { useState, type ReactNode } from "react";
import { SkeletonLine } from "./Skeleton";
import { Scrollable } from "./Scrollable";
import { ResultCount } from "./Pagination";
import { ShowRest } from "./ShowRest";
import { Truncate } from "./Truncate";

export type ActivityItem = { id: string; actor?: string; action: string; time: string; icon?: ReactNode };

const actionWidths = ["72%", "58%", "80%", "48%", "66%"];

/** Rows past this count scroll inside a bounded region instead of growing the
    feed forever (CONVENTIONS.md §20). */
const BOUND_AT = 8;

export type ActivityFeedProps = {
  items: ActivityItem[];
  loading?: boolean;
  /** Rows rendered before "Show all". A real feed has hundreds of events; the
      DOM only ever carries this many until the reader asks for the rest. */
  max?: number;
  /** Height cap of the scroll region, in px. */
  maxHeight?: number;
};

/* Chronological event log — grounded in the real product (LiveActivityFeed.tsx
   / AuditActivityFeed.tsx exist in mari/web/web/src/saas). A different
   layout from Table/DataTable: a connected timeline, not rows/columns.

   Volume: a workspace feed is hundreds of events long. The feed never grows
   past `maxHeight`; it scrolls through <Scrollable> and says honestly how many
   of how many it is showing, in a strip ABOVE the list (§13). */
export function ActivityFeed({ items, loading = false, max = 25, maxHeight = 420 }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <ol className="relative pl-6" aria-hidden="true">
        <span className="absolute left-[9px] top-1 bottom-1 w-px bg-ink/10" />
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="relative pb-5 last:pb-0">
            <span className="absolute -left-6 top-0.5 grid place-items-center w-[19px] h-[19px] rounded-full border border-ink/15 bg-paper">
              <span className="w-[6px] h-[6px] rounded-full bg-ink/20" />
            </span>
            <div className="space-y-1.5 pt-0.5">
              <SkeletonLine w={actionWidths[i % actionWidths.length]} h={11} />
              <SkeletonLine w={64} h={9} />
            </div>
          </li>
        ))}
      </ol>
    );
  }

  const capped = items.length > max;
  const shown = capped && !expanded ? items.slice(0, max) : items;

  const list = (
    <ol className="relative min-w-0 pl-6">
      <span className="absolute left-[9px] top-1 bottom-1 w-px bg-ink/10" aria-hidden="true" />
      {shown.map((item) => (
        <li key={item.id} className="relative min-w-0 pb-5 last:pb-0">
          <span className="absolute -left-6 top-0.5 grid place-items-center w-[19px] h-[19px] rounded-full border border-ink/15 bg-paper text-ink/65" aria-hidden="true">
            {item.icon ?? <span className="w-[6px] h-[6px] rounded-full bg-ink/30" />}
          </span>
          {/* An event line is microcontent, not prose: it clamps at two lines
              with the full text on hover (§12). Unclamped `break-words` let a
              single long event run six lines, so eight events filled a screen
              and the feed's own count strip scrolled out of sight. */}
          <Truncate
            lines={2}
            /* children is a fragment, so the hover text has to be explicit. */
            title={[item.actor, item.action].filter(Boolean).join(" ")}
            className="min-w-0 text-[13px] text-ink/85"
          >
            {item.actor && <span className="font-medium text-ink">{item.actor} </span>}
            {item.action}
          </Truncate>
          {/* Timestamps were text-ink/65, under the meta-text contrast floor. */}
          <span className="block min-w-0 truncate font-term text-[11px] text-ink/65">{item.time}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* Count strip above the list it describes (§13). XA-05/XA-08: this was a
          hand-rolled count sentence beside a hand-rolled toggle, one of four
          copies with its own wording; both now come from the shared pair. */}
      {capped && (
        <ResultCount
          from={1}
          to={shown.length}
          total={items.length}
          noun="events"
          actions={<ShowRest expanded={expanded} total={items.length} onToggle={() => setExpanded((v) => !v)} />}
        />
      )}
      {shown.length > BOUND_AT ? (
        <Scrollable axis="y" style={{ maxHeight }} scrollerClassName="pr-2">{list}</Scrollable>
      ) : (
        list
      )}
    </div>
  );
}
