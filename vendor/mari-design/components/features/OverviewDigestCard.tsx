import { useState, type ReactNode } from "react";
import { Shuffle } from "lucide-react";
import { Card } from "../layout/Card";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { ReadError } from "../feedback/ReadError";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { Spinner } from "../data-display/Spinner";
import { Button } from "../actions/Button";
import { CardBody, CardTitleBlock } from "../layout/CardShell";
import type { DigestTopic } from "../data-display/DigestCard";
export type { DigestTopic };
import { SkeletonLine, SkeletonText, SkeletonCircle, SkeletonChip } from "../data-display/Skeleton";
import { SourceMark } from "../icons/marks";
import { Scrollable } from "../data-display/Scrollable";
import { useResync } from "../actions/useResync";

/* Overview — This week's digest ──────────────────────────────────────────
   Mari's weekly, AI-generated summary of what changed across the workspace's
   knowledge. Self-contained: owns demo topics and a manual "Refresh digest"
   that simulates the server-side regenerate + refetch.

   Renders its own topic rows rather than the catalog <DigestCard> so the
   per-topic block can follow CONVENTIONS.md §1 ordering: title → summary →
   source chips → impact. The source row carries an explicit "Source" /
   "Sources" label (pluralized off the count), which the catalog card has no
   slot for. Source: web/src/pages/overview/DigestCard.tsx. */

const mark = (provider: string) => <SourceMark provider={provider} size={13} />;

/** Topics rendered before the expand toggle, and chips per row before it. */
const TOPIC_PAGE = 5;
const CHIP_CAP = 5;

/** The shared mono meta label used by both the Sources and Impact rows. */
const metaLabel = "font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65";

/* A capped chip row with the control that uncaps it.

   Both rows used to end in a bare "+N more" SPAN: a silent cap that named a
   number and gave the reader no way to see what it stood for. The cap stays
   (a topic touching 40 sources must not become six rows of confetti, §14) but
   it now comes with the console's one expand toggle (D6). */
function ChipRow({ label, chips }: { label: string; chips: ReactNode[] }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={metaLabel}>{label}</span>
      {showAll ? chips : chips.slice(0, CHIP_CAP)}
      {chips.length > CHIP_CAP && (
        <ShowRest expanded={showAll} total={chips.length} onToggle={() => setShowAll((v) => !v)} />
      )}
    </div>
  );
}

function TopicBlock({ topic, dim }: { topic: DigestTopic; dim: boolean }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0" style={{ opacity: dim ? 0.55 : 1 }}>
      <CardBody className="gap-2">
        {/* §1: title, then summary, then the source badges, then impact. */}
        <CardTitleBlock title={topic.title} summary={topic.summary} />
        {topic.where.length > 0 && (
          <ChipRow
            label={topic.where.length === 1 ? "Source" : "Sources"}
            chips={topic.where.map((w) => <Chip key={w.label} label={w.label} icon={mark(w.source)} />)}
          />
        )}
        {topic.impact.length > 0 && (
          <ChipRow
            label="Impact"
            chips={topic.impact.map((i) => <Chip key={i.name} label={i.name} tone={i.tone ?? "neutral"} dot />)}
          />
        )}
      </CardBody>
    </div>
  );
}

export type OverviewDigestCardProps = {
  topics: DigestTopic[];
  loading?: boolean;
  error?: boolean;
  /** Wires the error banner's Retry control. Omitted = no button. */
  onRetry?: () => void;
  className?: string;
};

export function OverviewDigestCard({
  topics, loading = false, error = false, onRetry, className = "",
}: OverviewDigestCardProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [current, setCurrent] = useState<DigestTopic[]>(topics);
  const [showAll, setShowAll] = useState(false);

  /* The card kept its own copy so Regenerate could settle optimistically, but
     that copy was taken once, at mount: the overview polls, and every later
     digest was drawn and then discarded (C1). Nothing here is editable, so
     there is no `hold`. Identity is safe: `web/src/data/overview.ts` memoises
     the mapped page data on the raw query answer. */
  useResync(topics, setCurrent);

  const topics_ = showAll ? current : current.slice(0, TOPIC_PAGE);

  if (loading) {
    return (
      <div className={`rounded-md border border-ink/12 bg-paper p-4 ${className}`.trim()} aria-hidden="true">
        <div className="mb-4 flex items-center gap-2.5">
          <SkeletonCircle size={26} />
          <SkeletonLine w="38%" h={13} />
          <span className="ml-auto"><SkeletonChip w={104} /></span>
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 border-t border-ink/[0.08] pt-3 first:border-0 first:pt-0">
              <SkeletonLine w={i === 1 ? "72%" : "58%"} h={12} />
              <SkeletonText lines={2} lastWidth="80%" />
              <div className="flex gap-2 pt-0.5"><SkeletonChip w={56} /><SkeletonChip w={44} /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const refresh = () => {
    if (regenerating) return; // guard re-entry
    setRegenerating(true);
    // Simulate the regenerateDigest mutation + refetch (stale-while-revalidate).
    setTimeout(() => {
      setCurrent((prev) => [...prev].reverse());
      setRegenerating(false);
    }, 1400);
  };

  return (
    <Card
      className={className}
      title="This week's digest"
      actions={
        <Button compact onClick={refresh} disabled={regenerating}>
          <Shuffle size={14} /> {regenerating ? "Refreshing…" : "Refresh digest"}
        </Button>
      }
    >
      {regenerating && (
        <div className="mb-3 flex items-center gap-2 font-display italic text-[13px] text-moss">
          <Spinner size="sm" /> Mari is re-reading the week…
        </div>
      )}
      {error ? (
        /* §8: failure copy comes from the catalog, never a bespoke string. */
        <ReadError onRetry={onRetry} />
      ) : current.length === 0 ? (
        <EmptyState>No digest yet. Refresh to have Mari read the week.</EmptyState>
      ) : (
        <>
          {/* Topic count above the topics it describes (§13). A busy week can
              produce dozens; the card shows a page and scrolls the rest. */}
          {current.length > TOPIC_PAGE && (
            <ResultCount
              from={1}
              to={topics_.length}
              total={current.length}
              noun="topics"
              className="mb-2 rounded-[4px] border border-ink/10"
              actions={<ShowRest expanded={showAll} total={current.length} onToggle={() => setShowAll((v) => !v)} />}
            />
          )}
          <Scrollable axis="y" style={{ maxHeight: topics_.length > TOPIC_PAGE ? 560 : undefined }} scrollerClassName="pr-1">
            <div className="flex flex-col divide-y divide-ink/10">
              {topics_.map((t, i) => <TopicBlock key={`${t.title}-${i}`} topic={t} dim={regenerating} />)}
            </div>
          </Scrollable>
        </>
      )}
    </Card>
  );
}
