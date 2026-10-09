import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Activity, Workflow, Send, ShieldCheck, Clipboard, RefreshCw, GitFork, Pencil } from "lucide-react";
import { Card } from "../layout/Card";
import { IconRing } from "../data-display/IconRing";
import { StatusChip } from "../data-display/Chip";
import { ActivityFeed, type ActivityItem } from "../data-display/ActivityFeed";
import { ReadError } from "../feedback/ReadError";
import { SkeletonLine, SkeletonCircle } from "../data-display/Skeleton";
import { fmtDateTime } from "../tokens/format";

/* Overview — Live activity feed ───────────────────────────────────────────
   A live, auto-refreshing feed of workspace work: runs, edits, deploys,
   facts, syncs, links, tasks. Slack chatter filtered out, capped at 8 rows,
   polled every 10s (simulated here by re-stamping times). Maps each item onto
   the catalog <ActivityFeed>.

   The header state is the shared pulsing <StatusChip status="running">, not a
   bespoke dot: a lone 2px dot at 60% opacity did not read as "this feed is
   live", and a status marker must carry a label, not colour alone (§4, §6). */

const FEED_ICONS: Record<string, ReactNode> = {
  run: <Workflow size={13} />,
  deploy: <Send size={13} />,
  fact: <ShieldCheck size={13} />,
  task: <Clipboard size={13} />,
  sync: <RefreshCw size={13} />,
  link: <GitFork size={13} />,
  edit: <Pencil size={13} />,
};

export type FeedItem = {
  id: number;
  kind: string;
  actor: string;
  text: string;
  target: string;
  /** Seconds ago, restamped to a real timestamp on render. */
  secondsAgo: number;
};

const isNoise = (e: FeedItem) => /slack/i.test(`${e.kind} ${e.text}`);

/** Events on screen before the feed's own expand control takes over. */
const FEED_ROWS = 8;

export type OverviewLiveActivityProps = {
  items: FeedItem[];
  loading?: boolean;
  offline?: boolean;
  /** Poll interval in ms (re-stamps times to feel live). 0 disables. */
  pollMs?: number;
  /** Wires the error banner's Retry control. Omitted = no button. */
  onRetry?: () => void;
  className?: string;
};

export function OverviewLiveActivity({
  items, loading = false, offline = false, pollMs = 10_000,
  onRetry, className = "",
}: OverviewLiveActivityProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pollMs) return;
    const t = setInterval(() => setNow(Date.now()), pollMs);
    return () => clearInterval(t);
  }, [pollMs]);

  /* The widget shows the newest FEED_ROWS events. It hands the whole feed to
     <ActivityFeed> rather than slicing it away, so the count strip can say
     honestly how many of how many are on screen (§13) and the reader can open
     the rest inside the feed's own bounded scroll region (§20). */
  const rows = items.filter((e) => !isNoise(e));
  // "Running" means the feed is live and has work to show; a feed with nothing
  // in it reads as paused rather than pretending to be busy.
  const running = !loading && !offline && rows.length > 0;
  const activityItems: ActivityItem[] = rows.map((e) => ({
    id: String(e.id),
    actor: e.actor,
    action: `${e.text} ${e.target}`,
    time: fmtDateTime(now - e.secondsAgo * 1000, new Date(now)),
    icon: FEED_ICONS[e.kind] ?? <Pencil size={13} />,
  }));

  return (
    <Card
      className={className}
      icon={<IconRing><Activity size={16} /></IconRing>}
      title="Live activity"
      hint={<span className="text-ink/70">Runs and edits, refreshes every 10s</span>}
      actions={running ? <StatusChip status="running" /> : <StatusChip status="paused" />}
    >
      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <SkeletonCircle size={22} />
              <span className="flex-1"><SkeletonLine w={["78%", "64%", "82%", "56%"][i]} h={11} /></span>
              <SkeletonLine w={40} h={9} />
            </div>
          ))}
        </div>
      ) : offline ? (
        /* §8: failure copy comes from the catalog, never a bespoke string. */
        <ReadError onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <p className="py-4 text-[13px] text-ink/70">Quiet for now, nothing running.</p>
      ) : (
        <ActivityFeed items={activityItems} max={FEED_ROWS} maxHeight={360} />
      )}
    </Card>
  );
}
