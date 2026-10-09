import type { ReactNode } from "react";
import { Card } from "../layout/Card";
import { SourceMark } from "../icons/marks";
import { Chip } from "./Chip";
import { EmptyState } from "./EmptyState";
import { Spinner } from "./Spinner";
import { SkeletonLine, SkeletonText, SkeletonChip } from "./Skeleton";
import { ReadError } from "../feedback/ReadError";
import { RefreshButton } from "../actions/RepeatedActions";

/* DigestCard: Mari's weekly summary of what changed, surfaced on the Overview
   dashboard. Each topic lists where it surfaced (source chips), a one-line
   summary, and who/what it impacts. Ported from pages/overview/DigestCard.tsx;
   the self-owned query is lifted out: data and a refresh callback come in as
   props. Built on our base <Card>. */

/* The one mono row label used by both the Sources and the Impact strips.
   text-ink/65 is the meta-text contrast floor (CONVENTIONS.md §6). */
const LABEL = "font-term text-[11px] font-medium uppercase tracking-[0.08em] text-ink/65";

/* No `icon` field: the provider mark is derived from `source`. Data that
   carries React elements cannot come from an API. */
export type DigestWhere = { source: string; label: string };
export type DigestImpact = { name: string; tone?: string };
export type DigestTopic = {
  title: string;
  summary: string;
  where: DigestWhere[];
  impact: DigestImpact[];
};

export type DigestCardProps = {
  topics: DigestTopic[];
  title?: string;
  loading?: boolean;
  error?: boolean;
  regenerating?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export function DigestCard({
  topics, title = "This week's digest", loading = false, error = false,
  regenerating = false, onRefresh, className = "",
}: DigestCardProps) {
  return (
    <Card
      className={className}
      title={title}
      /* XA-23: a fourth spelling of Refresh, carrying a <Shuffle> glyph that
         says "reorder these" rather than "fetch this again". */
      actions={onRefresh && <RefreshButton compact busy={regenerating} onClick={onRefresh} />}
    >
      {regenerating && (
        <div className="mb-3 flex items-center gap-2 font-display italic text-[13px] text-moss">
          <Spinner size="sm" /> Mari is re-reading the week…
        </div>
      )}
      {loading ? (
        <div className="flex flex-col divide-y divide-ink/10" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 py-3.5 first:pt-0 last:pb-0">
              <SkeletonLine w="46%" h={13} />
              <div className="flex gap-1.5"><SkeletonChip w={64} /><SkeletonChip w={72} /></div>
              <SkeletonText lines={2} lastWidth="55%" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* XA-01: this was an EmptyState reading "API offline", which told the
           reader there was no digest when the truth is the request did not come
           back — and diagnosed the cause from a bare boolean. `error` carries no
           detail, so the catalog copy stands alone and Refresh becomes Retry. */
        <ReadError onRetry={onRefresh} />
      ) : topics.length === 0 ? (
        <EmptyState>No digest yet. Refresh to have Mari read the week.</EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-ink/10">
          {topics.map((t) => (
            <div key={t.title} className="py-3.5 first:pt-0 last:pb-0" style={{ opacity: regenerating ? 0.55 : 1 }}>
              <h4 className="text-[13.5px] font-semibold text-ink break-words">{t.title}</h4>
              {/* Source slot (CONVENTIONS.md §1 slot 6): the where-it-surfaced
                  chips carry the same mono label as Impact, so the two rows
                  read as a labelled pair instead of a bare chip strip. */}
              {t.where.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={LABEL}>{t.where.length === 1 ? "Source" : "Sources"}</span>
                  {t.where.map((w) => <Chip key={w.label} label={w.label} icon={<SourceMark provider={w.source} size={13} />} />)}
                </div>
              )}
              <p className="mt-2 text-[13px] leading-[1.5] text-ink/70 break-words">{t.summary}</p>
              {t.impact.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={LABEL}>Impact</span>
                  {t.impact.map((i) => <Chip key={i.name} label={i.name} tone={i.tone ?? "neutral"} dot />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
