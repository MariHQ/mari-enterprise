import type { ReactNode } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, DASH3, SPAN } from "./PageFrame";
import { ArrowRight, PlugZap, Sprout } from "lucide-react";
import { OverviewStatTiles, type OverviewStats } from "../features/OverviewStatTiles";
import { OverviewDigestCard, type DigestTopic } from "../features/OverviewDigestCard";
import { OverviewRecentDocs, type RecentDoc } from "../features/OverviewRecentDocs";
import { OverviewSourcePulse, type PulseTileData } from "../features/OverviewSourcePulse";
import { OverviewLiveActivity, type FeedItem } from "../features/OverviewLiveActivity";
import { EmptyState } from "../data-display/EmptyState";
import { ReadError } from "../feedback/ReadError";
import { SkeletonPage } from "../data-display/Skeletons";
import { Card, CardCollapseScope } from "../layout/Card";
import { Truncate } from "../data-display/Truncate";
import { DateRangePicker, type DateRange } from "../data-display/DateRangePicker";
import { Button } from "../actions/Button";

/* Overview dashboard (pages/overview.md). Composes the overview features into
   the two-track grid, inside the console frame.

   This page is a pure presenter. It holds no demo content: every value it
   renders arrives in `data`, so a real workspace with nothing in it renders
   the empty state rather than someone's invented numbers. The design canvas
   supplies the same shape from `.preview/fixtures/overview.ts`. */

const STATES = [
  { id: "default", label: "Default" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Empty / new workspace" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** Everything the Overview dashboard renders. One object, so an app can build
    it from a single query and hand it over whole. */
export type OverviewData = {
  /** Shown in the greeting. Empty string drops the name, never a placeholder. */
  personName: string;
  /** Independently resolved slots supplied by the runtime adapter. */
  cards?: {stats:ReactNode;docs:ReactNode;sources:ReactNode;digest:ReactNode;activity:ReactNode};
  lake?: {recent:{id:string;title:string;source:string;date:string}[]};
  /** IANA zone the greeting reads the clock in (the one Preferences collects).
      Omitted = the browser's own zone, which is still the reader's real local
      time. Never a fixed hour. */
  timeZone?: string;
  /** The window the dashboard counts over, when the app can change it. */
  range?: DateRange;
  stats: OverviewStats;
  digest: DigestTopic[];
  activity: FeedItem[];
  docs: RecentDoc[];
  sources: PulseTileData[];
  /** Poll interval for the live feed, ms. 0 disables it (canvas + tests). */
  activityPollMs?: number;
};

/* §11 dashboard grid. The widgets sit on one shared DASH3 so tile edges line up
   and the body fills the whole 1400px container. The grid drops to two-up below
   1280 and one-up below 1024 (see PageFrame), because a three-up row of console
   widgets does not fit beside the 218px sidebar on a small laptop. Mobile falls
   out of the same classes, never out of component breakpoints (§10).

   The widgets are grouped into TWO TRACKS rather than dropped into the grid one
   by one. A grid row is as tall as its tallest cell, and these widgets are
   sized by their content: "Today's review" (4 task rows) beside "This week's
   digest" (3 prose topics) left a quarter of a screen of empty grid cell under
   the shorter one, and "Recent docs" beside the live feed left more. Stacking
   each track in its own cell means the only place heights have to agree is the
   bottom of the dashboard, and the two tracks are loaded to land there
   together: the wide track carries the tables and the strips, the narrow one
   the two prose feeds. */
function DashGrid({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  return <div className={mobile ? "grid grid-cols-1 gap-5" : DASH3}>{children}</div>;
}

/** A dashboard cell. `span` is ignored on mobile (single column). */
function Cell({ mobile, span = 1, children }: { mobile: boolean; span?: 1 | 2 | 3; children: React.ReactNode }) {
  return <div className={mobile ? "min-w-0" : SPAN[span]}>{children}</div>;
}

/** One track of the dashboard: a column of widgets that share a grid cell. */
function Track({ mobile, span, children }: { mobile: boolean; span: 1 | 2; children: React.ReactNode }) {
  return (
    <Cell mobile={mobile} span={span}>
      <div className="flex flex-col gap-5">{children}</div>
    </Cell>
  );
}

/* The greeting used to read "Good morning" at every hour of the day, in every
   zone. It is a claim about the reader's clock, so it is read off the reader's
   clock: the zone Preferences collects when the app supplies one, the
   browser's own otherwise. A zone the runtime does not know falls back to
   local time rather than to a guess. */
function hourIn(timeZone: string | undefined, now: Date): number {
  if (!timeZone) return now.getHours();
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(now),
    );
  } catch {
    return now.getHours();
  }
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Greeting({ personName, timeZone }: { personName: string; timeZone?: string }) {
  const hello = greetingFor(hourIn(timeZone, new Date()));
  return (
    /* min-w-0 + Truncate: a display name is user data and can be arbitrarily
       long (§12). Without the floor override the greeting pushed 159px out
       through the page container. */
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-1 shrink-0 text-moss"><Sprout size={28} /></span>
      <div className="min-w-0">
        <Truncate as="h2" className="font-display text-[24px] font-bold tracking-[-0.01em] text-ink">
          {personName ? `${hello}, ${personName}` : hello}
        </Truncate>
        <div className="mt-1 h-[3px] w-24 rounded bg-espelette/60" />
      </div>
    </div>
  );
}

/** Nothing has happened in this workspace yet. Deliberately NOT "every
    collection is empty": that test required `sources` to be empty too, so a
    workspace whose only content was one connected source that had never synced
    fell through to the full dashboard and rendered six widgets of zeros
    instead of saying what to do next. What makes the dashboard worth drawing
    is content, not connections. */
function hasContent(d: OverviewData): boolean {
  return Boolean(d.digest.length || d.activity.length || d.docs.length);
}

/** What the Overview can DO. */
export type OverviewActions = {
  /** Change the window the dashboard counts over. Without it the page draws no
      range control at all — a picker that cannot re-query is decoration (§2). */
  setRange?: (range: DateRange) => void;
  /** Open first-run source onboarding. Omitted: the empty-source card keeps
      its explanation but draws no dead button. */
  connectSources?: () => void;
  /** Open the area a headline stat tile summarizes ("knowledge", "facts",
      "workflows"). Omitted: the tiles stay informational. A number that names
      work to do should take the reader to where the work is done. */
  openArea?: (area: string) => void;
};

function OverviewPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<OverviewData, OverviewActions>) {
  const range = data.range ?? { preset: "30d" as const };
  const rangeControl = actions?.setRange ? (
    <DateRangePicker value={range} onChange={actions.setRange} align="end" compact />
  ) : null;

  return (
    <PageFrame chrome={chrome} active={navFor("overview")} title="Overview" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="dashboard"
          /* No title: the Overview's h1 is a greeting carrying the signed-in
             person's name, which is exactly the kind of value a skeleton may
             not invent. The widget headings below it are the page's own, so
             they arrive with the frame. */
          label="Overview"
          /* The stat strip is THREE tiles, not the fallback four: a skeleton
             drawing a fourth relaid the whole dashboard when the row rewrapped
             on load. Captions are this page's own literals (OverviewStatTiles),
             so they render. */
          stats={["Changes", "Facts to review", "Workflows active"]}
          sections={["Recent docs", "Source pulse", "This week's digest", "Live activity"]}
          /* The one header control is a date-range picker whose label IS the
             range — a value, so it stays a bar. */
          actions={1}
          mobile={mobile}
        />
      ) : (
        <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
          <div className={mobile ? "flex flex-col gap-3" : "flex items-start justify-between gap-4"}>
            <Greeting personName={data.personName} timeZone={data.timeZone} />
            {/* The stats and digest carried no period label at all, so a number
                on this page was a count over an unstated window. The label only
                appears where the window is a real, changeable thing. */}
            {rangeControl && (
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-term text-[11.5px] text-ink/65">Counting</span>
                {rangeControl}
              </div>
            )}
          </div>
          {!error && !data.lake && !data.cards && data.sources.length === 0 && (
            <Card
              className="mt-6 border-biscay/25 bg-biscay/[0.035]"
              icon={<span className="grid h-9 w-9 place-items-center rounded-md bg-biscay/10 text-biscay"><PlugZap size={19} /></span>}
              title="Connect your first source"
              hint="No sources connected"
              actions={actions?.connectSources ? (
                <Button variant="primary" onClick={actions.connectSources}>
                  Browse connectors <ArrowRight size={14} />
                </Button>
              ) : undefined}
            >
              <p className="text-[13px] leading-relaxed text-ink/70">
                Bring in GitHub, Slack, Notion, Google Drive, uploaded files, or another
                connector to start building this workspace.
              </p>
            </Card>
          )}
          <div className="mt-6">
            {/* Mobile collapses every titled widget behind its header, so the
                dashboard scans as a list instead of a forever scroll (§17). */}
            <CardCollapseScope.Provider value={mobile}>
              {error ? (
                /* XA-01: an EmptyState here read as "your workspace is empty"
                   when the dashboard simply failed to load. */
                <ReadError>{error}</ReadError>
              ) : !hasContent(data) && !data.lake && !data.cards ? (
                /* Two different nothings, and they need two different next
                   steps. No sources: connect one. Sources but nothing indexed:
                   the pulse tiles below say which source is quiet, so they
                   still render — that is the whole answer to "why is this
                   dashboard blank?". */
                data.sources.length ? (
                  <div className="flex flex-col gap-5">
                    <EmptyState title="Nothing indexed yet">
                      Your sources are connected but have not produced any documents,
                      tasks, or activity yet. Check the sync status below.
                    </EmptyState>
                    <OverviewSourcePulse tiles={data.sources} />
                  </div>
                ) : null
              ) : (
                mobile ? (
                  /* One column, timeliest first (§17). The tracks below are a
                     desktop composition; on a phone the order is the reading
                     order. */
                  <div className="flex flex-col gap-5">
                    {data.cards?.stats ?? <OverviewStatTiles stats={data.lake ? null : data.stats} onNavigate={actions?.openArea} />}
                    <>{data.cards?.digest ?? (data.lake ? <Card title="This week’s digest"><ReadError>{"GRAPH_REQUIREMENTS:Expected Digest → supporting Record."}</ReadError></Card> : <OverviewDigestCard topics={data.digest} />)}</>
                    <>{data.cards?.activity ?? (data.lake ? <Card title="Live activity"><ReadError>{"GRAPH_REQUIREMENTS:Expected Actor → Change → Record (timestamp, operation)."}</ReadError></Card> : <OverviewLiveActivity items={data.activity} pollMs={data.activityPollMs ?? 0} />)}</>
                    {data.cards?.docs ?? <OverviewRecentDocs docs={data.lake?.recent ?? data.docs} />}
                    <>{data.cards?.sources ?? (data.lake ? <Card title="Source pulse"><ReadError>{"GRAPH_REQUIREMENTS:Expected Connector → ingested Record and Workflow → Run."}</ReadError></Card> : <OverviewSourcePulse tiles={data.sources} />)}</>
                  </div>
                ) : (
                <DashGrid mobile={mobile}>
                  {/* The stat strip is the one full-width row: three tiles, one
                      per column. */}
                  <Cell mobile={mobile} span={3}>{data.cards?.stats ?? <OverviewStatTiles stats={data.lake ? null : data.stats} onNavigate={actions?.openArea} />}</Cell>
                  {/* Wide track. The table needs two columns (its title
                      column alone is min-w-[200px] plus four no-wrap columns),
                      and Source pulse packs a 2 x 250px tile grid. */}
                  <Track mobile={mobile} span={2}>
                    {data.cards?.docs ?? <OverviewRecentDocs docs={data.lake?.recent ?? data.docs} />}
                    <>{data.cards?.sources ?? (data.lake ? <Card title="Source pulse"><ReadError>{"GRAPH_REQUIREMENTS:Expected Connector → ingested Record and Workflow → Run."}</ReadError></Card> : <OverviewSourcePulse tiles={data.sources} />)}</>
                  </Track>
                  {/* Narrow track: the two prose feeds, which reflow. */}
                  <Track mobile={mobile} span={1}>
                    <>{data.cards?.digest ?? (data.lake ? <Card title="This week’s digest"><ReadError>{"GRAPH_REQUIREMENTS:Expected Digest → supporting Record."}</ReadError></Card> : <OverviewDigestCard topics={data.digest} />)}</>
                    <>{data.cards?.activity ?? (data.lake ? <Card title="Live activity"><ReadError>{"GRAPH_REQUIREMENTS:Expected Actor → Change → Record (timestamp, operation)."}</ReadError></Card> : <OverviewLiveActivity items={data.activity} pollMs={data.activityPollMs ?? 0} />)}</>
                  </Track>
                </DashGrid>
                )
              )}
            </CardCollapseScope.Provider>
          </div>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<OverviewData, OverviewActions> = {
  id: "overview",
  title: "Overview",
  route: "/",
  component: OverviewPage,
  states: STATES.map((s) => ({ ...s })),
};
