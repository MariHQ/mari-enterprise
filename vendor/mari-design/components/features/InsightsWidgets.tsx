import { useState, type ReactNode } from "react";
import { Search, Sparkles, BookOpen, Clock, MessageSquare, FileCheck, Wrench } from "lucide-react";
import { Button } from "../actions/Button";
import { Card } from "../layout/Card";
import { Stat } from "../data-display/Stat";
import { IconRing } from "../data-display/IconRing";
import { GradeChip } from "../data-display/GradeChip";
import { SortHeader, useSort, tdPad } from "../data-display/sortable";
import { EmptyState } from "../data-display/EmptyState";
import { Truncate } from "../data-display/Truncate";
import { ActivityFeed, type ActivityItem } from "../data-display/ActivityFeed";
import { WriteError } from "../feedback/WriteError";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { useWrite, why } from "../actions/useWrite";
import { Skeleton, SkeletonLine, SkeletonStat, SkeletonCard } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";
import { PageHeader } from "../layout/PageHeader";
import { SourceMark } from "../icons/marks";
import { focusRing } from "../tokens/focusRing";
import { fmtDate } from "../tokens/format";

/* Insights widgets — the four non-chart widgets on Insights: a headline stat
   strip, an LLM-readability grade table, a glossary-health review list with
   optimistic accept/dismiss, and a recent audit-activity feed. Composes Stat +
   IconRing, a sortable readability table (SortHeader/useSort, no minimum width
   so it can use the wider grid column), Card + Button, and ActivityFeed.
   Standalone. */

export type StatTone = "ok" | "attention" | "blocked" | "info";

/* Icons are named, not carried. A data prop has to survive a round trip
   through an API, and no API returns a React element (MIGRATION.md), so the
   row names its glyph and the widget draws it. */
export type StatIcon = "search" | "answers" | "drift" | "fixed";
const STAT_GLYPH: Record<StatIcon, ReactNode> = {
  search: <Search size={16} />,
  answers: <MessageSquare size={16} />,
  drift: <Sparkles size={16} />,
  fixed: <Wrench size={16} />,
};

/** One headline stat tile. */
export type InsightStat = { key: string; value: number; label: string; tone: StatTone; icon: StatIcon };

const RING_OF: Record<StatTone, "ok" | "attention" | "blocked" | "info"> = {
  ok: "ok", attention: "attention", blocked: "blocked", info: "info",
};

export type ReadRow = { id: number; title: string; source: string; grade: string; note: string };

export type GlossRow = { id: number; term: string; variants: string[]; definition: string };
/** One audit-activity line. Same rule as the stat tiles: the glyph is named,
    not carried, so the row is plain JSON. */
export type ActivityIcon = "glossary" | "readability" | "scored";
const ACTIVITY_GLYPH: Record<ActivityIcon, ReactNode> = {
  glossary: <BookOpen size={12} />,
  readability: <FileCheck size={12} />,
  scored: <Sparkles size={12} />,
};
export type InsightsActivity = {
  id: string; actor: string; action: string; time: string; icon?: ActivityIcon;
};

const td = `${tdPad} text-[13px] text-ink/75 border-b border-ink/[0.06] align-middle`;

/** Rows revealed per page in the readability table and the glossary list. */
const PAGE = 25;
/** Events the activity feed shows before the reader asks for the rest. */
const ACTIVITY_CAP = 8;

/** What the Insights widgets can DO. Every handler may throw; the widget that
    owns the control shows the message beside it. Optional throughout: with no
    actions the controls keep the local echo the library ships, which is what
    the design canvas renders. */
export type InsightsWidgetsActions = {
  /** Re-score every document for LLM readability. Long-running. */
  scoreReadability?: () => void | Promise<void>;
  /** Mine the corpus for candidate glossary terms. Long-running. */
  harvestGlossary?: () => void | Promise<void>;
  /** Accept a candidate term into the glossary, or dismiss it. */
  resolveGlossaryTerm?: (args: { id: number; accept: boolean }) => void | Promise<void>;
  /** Open the document behind a row. Insights had no drill-through at all: it
      reported a grade on a document and gave you no way to reach it. Without
      this handler the title stays plain text — a link that goes nowhere is
      worse than no link (§2). */
  openDoc?: (id: number) => void;
};

export type InsightsWidgetsProps = {
  readabilityAvailable?: boolean;
  glossaryAvailable?: boolean;
  stats: InsightStat[];
  readability: ReadRow[];
  glossary: GlossRow[];
  activity: InsightsActivity[];
  /** ISO date the counts are measured from. Shown in the page header. */
  since: string;
  /** Controls the page owns (date range, export) rendered in the shared page
      header, so Insights has ONE header rather than a second toolbar row. */
  headerActions?: ReactNode;
  /** Overrides the "counting since …" line when the page owns the window. */
  periodLabel?: string;
  /** Side effects the widgets offer. Omitted = local echo only. */
  actions?: InsightsWidgetsActions;
  /** Render a content-shaped skeleton silhouette instead of the widgets. */
  loading?: boolean;
  className?: string;
};

export function InsightsWidgets({
  stats, readability, glossary, activity, since, headerActions, periodLabel,
  actions, loading = false, className = "", readabilityAvailable = true, glossaryAvailable = true,
}: InsightsWidgetsProps) {
  const [hidden, setHidden] = useState<number[]>([]);
  /* XA-04: both long-running runs were the same hand-rolled busy + failed pair
     around an optional handler. One hook each now, so `busy` disables the
     control and `failed` carries whatever the server said. The canvas keeps its
     visible echo: with no handler wired the hook awaits the same 900ms pause
     the widget always used, rather than settling before the eye can see it. */
  const scoreW = useWrite();
  const harvestW = useWrite();
  /* Still local: the glossary row leaves optimistically and comes BACK on a
     rejection, which is the inverse of useWrite's echo-after-success. */
  const [glossErr, setGlossErr] = useState<string | null>(null);

  const pause = () => new Promise((r) => setTimeout(r, 900));
  const score = () => void scoreW.run(actions?.scoreReadability ?? pause);
  const harvest = () => void harvestW.run(actions?.harvestGlossary ?? pause);

  const readSort = useSort(readability, {
    title: (r) => r.title,
    source: (r) => r.source,
    grade: (r) => r.grade,
    note: (r) => r.note,
  });

  const candidates = glossary.filter((c) => !hidden.includes(c.id));

  /* Optimistic: the row leaves immediately, because that is what the reader
     asked for. A rejected write puts it back and says why. */
  const resolve = async (c: GlossRow, accept: boolean) => {
    setHidden((h) => [...h, c.id]);
    setGlossErr(null);
    if (!actions?.resolveGlossaryTerm) return;
    try {
      await actions.resolveGlossaryTerm({ id: c.id, accept });
    } catch (err) {
      setHidden((h) => h.filter((id) => id !== c.id));
      setGlossErr(why(err, "Could not save that term."));
    }
  };

  /* Neither list may render its whole input. A 300-document scoring run turned
     the readability card into a ~20,000px column, and the page below it was
     unreachable. Both page a screenful at a time and say what they are
     holding back (§13: the count strip sits above the list). */
  const [readShown, setReadShown] = useState(PAGE);
  const [allActivity, setAllActivity] = useState(false);
  const [glossShown, setGlossShown] = useState(PAGE);
  const readRows = readSort.sorted.slice(0, readShown);
  const glossRows = candidates.slice(0, glossShown);
  const shownActivity: ActivityItem[] = activity
    .filter((a) => !String(a.action).startsWith("__"))
    .map((a) => ({ ...a, icon: a.icon ? ACTIVITY_GLYPH[a.icon] : undefined }));

  /* The page's own header and the three panel headings below it are literals
     in this file — the reader can be told what is arriving while it arrives.

     The DESCRIPTION was the one place this went the other way. It was drawn as
     a bar 88% of the page wide, on the argument that the loaded sentence names
     the date the figures count since. But the sentence is not a date: it is
     "Usage, quality, and coverage" with a date on the end, and a grey rule
     running the width of the header claimed a paragraph where a short line
     goes. So the static sentence renders — the same one this page already
     shows in its error and empty states — and the counting-since clause
     arrives with the figures it qualifies. A static label greyed out is the
     bug this whole treatment exists to remove.

     Stat captions do come from `stats`, which is the response, so those tiles
     stay anonymous; the rest of the layout is the loaded layout. */
  if (loading) {
    return (
      <div className={`flex flex-col gap-5 ${className}`} aria-busy="true">
        <PageHeader
          eyebrow="Insights"
          title="Insights"
          description="Usage, quality, and coverage across your knowledge base."
        />
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
        </div>
        {/* Readability is a five-column table, so it gets the wider column. */}
        <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr] [&>*]:min-w-0">
          <SkeletonCard title="LLM readability" lines={6} />
          <SkeletonCard title="Glossary health" lines={5} />
        </div>
        <SkeletonCard title="Recent audit activity" lines={4} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      <PageHeader
        eyebrow="Insights"
        title="Insights"
        description={periodLabel ?? `Usage, quality, and coverage, counting since ${fmtDate(since)}.`}
        actions={headerActions}
      />

      {/* 1. Stat row. Auto-fill, not `lg:grid-cols-4` (§11): four fixed columns
          held even when the column could not afford them, and the tiles pushed
          27px out through the page container at a 1024px window.
          The 200px floor is not arbitrary: it MATCHES `Stat`'s own
          `min-w-[200px]`. At 190 the grid sized three tracks it thought would
          fit, each tile refused to go under 200, and the row escaped by 5px. */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
        {stats.map((s) => (
          <Stat
            key={s.key}
            value={s.value.toLocaleString("en-US")}
            label={s.label}
            tone={s.tone}
            icon={<IconRing tone={RING_OF[s.tone]}>{STAT_GLYPH[s.icon]}</IconRing>}
          />
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr] [&>*]:min-w-0">
        {/* 2. LLM readability */}
        <Card
          icon={<IconRing tone="info"><Search size={15} /></IconRing>}
          title="LLM readability"
          actions={<Button compact disabled={scoreW.busy || !readabilityAvailable} onClick={score}>{scoreW.busy ? "Scoring…" : "Score docs"}</Button>}
          variant="flush"
        >
          {/* XA-02: a refused re-score names no input, so it is a banner beside
              the control that fired. */}
          <div className="px-4 pb-1 empty:hidden">
            <WriteError onDismiss={() => scoreW.setFailed(null)}>{scoreW.failed}</WriteError>
          </div>
          {!readabilityAvailable ? (
            <EmptyState icon={<Search size={24} />} title="Not configured">Readability scoring is not available in this deployment.</EmptyState>
          ) : readability.length === 0 ? (
            <EmptyState icon={<Search size={24} />} title="Nothing scored yet">Score your documents to see readability grades.</EmptyState>
          ) : (
            <>
            {/* XA-09: the count sentence and its "Show N more" were written out
                here; both come from the shared strip now, still above the rows
                they describe (§13). */}
            <ResultCount
              from={readSort.sorted.length === 0 ? 0 : 1}
              to={readRows.length}
              total={readSort.sorted.length}
              noun="scored documents"
              actions={readSort.sorted.length > PAGE && (
                <ShowRest
                  expanded={readShown >= readSort.sorted.length}
                  total={readSort.sorted.length}
                  onToggle={() => setReadShown((n) => (n >= readSort.sorted.length ? PAGE : readSort.sorted.length))}
                />
              )}
            />
            <Scrollable>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <SortHeader label="Document" sortKey="title" sort={readSort.sort} onSort={readSort.onSort} />
                    <SortHeader label="Source" sortKey="source" sort={readSort.sort} onSort={readSort.onSort} />
                    <SortHeader label="Grade" sortKey="grade" sort={readSort.sort} onSort={readSort.onSort} align="center" />
                    <SortHeader label="Note" sortKey="note" sort={readSort.sort} onSort={readSort.onSort} />
                  </tr>
                </thead>
                <tbody>
                  {readRows.map((r) => (
                    <tr key={r.id} className="hover:bg-flysch/50">
                      <td className={`${td} max-w-[260px] font-medium text-ink`}>
                        {/* Drill-through, only where there is somewhere to go. */}
                        {actions?.openDoc ? (
                          <button
                            type="button"
                            onClick={() => actions.openDoc!(r.id)}
                            className={`block max-w-full truncate text-left hover:underline ${focusRing} rounded-[3px]`}
                            title={r.title}
                          >
                            {r.title}
                          </button>
                        ) : (
                          <Truncate>{r.title}</Truncate>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap`}><span className="inline-flex items-center gap-1.5"><SourceMark provider={r.source} size={15} /> <span className="capitalize">{r.source}</span></span></td>
                      <td className={`${td} text-center`}><GradeChip grade={r.grade} /></td>
                      <td className={`${td} max-w-[300px] truncate text-ink/70`}>{r.note || "No notes"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scrollable>
            </>
          )}
          {readabilityAvailable && <p className="px-4 py-3 text-[12px] text-ink/70">Deterministic A to C grades from the configured model. Re-run scoring after big edits.</p>}
        </Card>

        {/* 3. Glossary health */}
        <Card
          icon={<IconRing tone="ok"><BookOpen size={15} /></IconRing>}
          title="Glossary health"
          actions={<Button compact disabled={harvestW.busy || !glossaryAvailable} onClick={harvest}>{harvestW.busy ? "Harvesting…" : "Harvest terms"}</Button>}
        >
          {/* Both writes on this card report through one banner: neither a
              refused harvest nor a refused accept/dismiss accuses an input. */}
          <WriteError onDismiss={() => { harvestW.setFailed(null); setGlossErr(null); }}>
            {harvestW.failed ?? glossErr}
          </WriteError>
          {harvestW.busy && (
            <div className="mb-3 flex items-center gap-2 font-term text-[12px] text-ink/70">
              <Sparkles size={13} className="text-biscay-2" /> Scanning documents for candidate terms…
            </div>
          )}
          {!glossaryAvailable ? (
            <EmptyState icon={<BookOpen size={24} />} title="Not configured">Glossary health has not been measured in this deployment.</EmptyState>
          ) : candidates.length === 0 && !harvestW.busy ? (
            <EmptyState icon={<BookOpen size={24} />} title="All clear">No inconsistencies pending. Harvest to re-check.</EmptyState>
          ) : (
            <>
            <ResultCount
              className="-mx-4 mb-2"
              from={candidates.length === 0 ? 0 : 1}
              to={glossRows.length}
              total={candidates.length}
              noun="candidate terms"
              actions={candidates.length > PAGE && (
                <ShowRest
                  expanded={glossShown >= candidates.length}
                  total={candidates.length}
                  onToggle={() => setGlossShown((n) => (n >= candidates.length ? PAGE : candidates.length))}
                />
              )}
            />
            <ul className="flex flex-col divide-y divide-ink/10">
              {glossRows.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-3 first:pt-0">
                  {/* Glossary terms are user data and can be a single opaque
                      token; wrapping them drove the card 615px past its
                      column, so they ellipsise with the value on hover (§12). */}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-x-2">
                      <Truncate className="text-[13.5px] font-semibold text-ink">{c.term}</Truncate>
                    </div>
                    <Truncate as="p" lines={2} className="mt-0.5 text-[12.5px] leading-snug text-ink/70">{c.definition}</Truncate>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="success" compact onClick={() => void resolve(c, true)}>Accept</Button>
                    <Button compact onClick={() => void resolve(c, false)}>Dismiss</Button>
                  </div>
                </li>
              ))}
            </ul>
            </>
          )}
        </Card>
      </div>

      {/* 4. Recent audit activity */}
      <Card
        icon={<IconRing tone="ink"><Clock size={15} /></IconRing>}
        title="Recent audit activity"
        /* No `hint` count: "Last 4 events" sat directly over a "4 events"
           strip. The strip owns the number (§13 count rule). */
      >
        {activity.length === 0 ? (
          <EmptyState icon={<Clock size={24} />} title="Nothing logged yet">Actions on Insights will show up here.</EmptyState>
        ) : (
          /* The slice used to be silent: 400 events in, 8 rendered, nothing
             said so. Cutting data is fine; hiding that you cut it is not. */
          <>
            {/* The feed capped at eight with no way to see the rest; the strip
                now carries the standard expand control (XA-08/XA-09). */}
            <ResultCount
              className="-mx-4 mb-2"
              from={shownActivity.length === 0 ? 0 : 1}
              to={allActivity ? shownActivity.length : Math.min(ACTIVITY_CAP, shownActivity.length)}
              total={shownActivity.length}
              noun="events"
              actions={shownActivity.length > ACTIVITY_CAP && (
                <ShowRest expanded={allActivity} total={shownActivity.length} onToggle={() => setAllActivity((v) => !v)} />
              )}
            />
            <ActivityFeed items={allActivity ? shownActivity : shownActivity.slice(0, ACTIVITY_CAP)} />
          </>
        )}
      </Card>
    </div>
  );
}
