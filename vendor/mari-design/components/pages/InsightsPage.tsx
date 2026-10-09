import type { ReactNode } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, DASH3, SPAN } from "./PageFrame";
import { Sparkles } from "lucide-react";
import {
  InsightsWidgets,
  type InsightStat, type ReadRow, type GlossRow, type InsightsActivity, type InsightsWidgetsActions,
} from "../features/InsightsWidgets";
import { InsightsFreshnessChart, type Freshness, type BandKey } from "../features/InsightsFreshnessChart";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonPage } from "../data-display/Skeletons";
import { Card, Chip, AvatarGroup, Breadcrumb } from "../index";
import { DateRangePicker, dateRangeLabel, type DateRange } from "../data-display/DateRangePicker";
import { PageHeader } from "../layout/PageHeader";
import { ReadError } from "../feedback/ReadError";
import { ExportButton } from "../actions/RepeatedActions";
import { fmtDate } from "../tokens/format";

/* Insights (pages/insights.md). Read-mostly dashboard proving the knowledge
   cloud is working: the headline stat row + evidence panels (readability,
   glossary health, recent audit) from InsightsWidgets, with the freshness-by-
   source stacked-bar card composed alongside as the dashboard grid.

   This page is a pure presenter. It holds no demo content: every value it
   renders arrives in `data`, and what it shows is derived from that data —
   widgets still resolving are `widgets: null`, a freshness query that could
   not answer is `freshness: null`, and a workspace with nothing measured yet
   falls out of `isEmpty`. The canvas supplies the same shape from
   `.preview/fixtures/insights.ts`. */

const STATES = [
  { id: "default", label: "Default" },
  { id: "loading", label: "Loading (full page)" },
  { id: "widgets-loading", label: "Per-widget loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Empty / no data" },
  { id: "no-freshness", label: "Freshness unavailable" },
  { id: "freshness-empty", label: "Freshness: no sources" },
  { id: "readability-spread", label: "Readability grade spread" },
  { id: "glossary-review", label: "Glossary suggestions" },
  { id: "glossary-clear", label: "Glossary all clear" },
  { id: "audit-active", label: "Audit activity" },
  { id: "audit-empty", label: "Audit: nothing logged" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** The four widgets that resolve together from the insights query. */
export type InsightsWidgetData = {
  readabilityAvailable?: boolean;
  glossaryAvailable?: boolean;
  periodLabel?: string;
  stats: InsightStat[];
  readability: ReadRow[];
  glossary: GlossRow[];
  activity: InsightsActivity[];
  /** ISO date the counts are measured from. */
  since: string;
};

/** A supporting card beside the dashboard. Only the long-text states carry
    one, which is why it is nullable rather than always present. */
export type InsightsExtras = {
  title: string;
  crumbs: string[];
  tags: string[];
  people: string[];
  avatarMax: number;
};

/** What Insights can DO. Every handler may throw; the widget that owns the
    control shows the message beside it. Optional: without actions the controls
    keep the local echo the library ships (the canvas has no server). */
export type InsightsActions = InsightsWidgetsActions & {
  /** Re-query the dashboard over a different window. Insights had no window
      control at all: `since` was data the reader could see and never change.
      Without this handler no picker is drawn — a range control that cannot
      re-query would be decoration (§2). */
  setRange?: (range: DateRange) => void;
  /** Open the documents behind one freshness band. */
  openFreshness?: (args: { source: string; band: BandKey }) => void;
};

/** Everything the Insights dashboard renders. */
export type InsightsData = {
  statistics?: ReactNode;
  /** `null` while the widget queries are still in flight: the widgets render
      their own skeleton, holding their exact places, while freshness shows. */
  widgets: InsightsWidgetData | null;
  /** `null` when the freshness query is unavailable, so the card is not
      rendered at all. `[]` is a real answer: no sources yet. */
  freshness: Freshness[] | null;
  /** The window `widgets.since` came from, when the app can change it. */
  range?: DateRange;
  extras: InsightsExtras | null;
};

/* ── Export ────────────────────────────────────────────────────────────────
   Export writes out exactly the rows on screen, from the data already loaded.
   It never asks the server for a wider set than the page was given, so the
   file and the dashboard can never disagree. */

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csvRows = (rows: (string | number)[][]): string =>
  rows.map((r) => r.map(csvCell).join(",")).join("\n");

function insightsCsv(w: InsightsWidgetData, freshness: Freshness[] | null): string {
  const out: (string | number)[][] = [["section", "key", "label", "value", "detail"]];
  for (const s of w.stats) out.push(["stat", s.key, s.label, s.value, ""]);
  for (const r of w.readability) out.push(["readability", r.id, r.title, r.grade, `${r.source}: ${r.note}`]);
  for (const g of w.glossary) out.push(["glossary", g.id, g.term, g.variants.join(" / "), g.definition]);
  for (const a of w.activity) out.push(["activity", a.id, a.actor, a.action, a.time]);
  for (const f of freshness ?? []) {
    out.push(["freshness", f.source, f.label ?? f.source, f.fresh + f.aging + f.stale, `fresh ${f.fresh}, aging ${f.aging}, stale ${f.stale}`]);
  }
  return csvRows(out);
}

function downloadCsv(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* <InsightsWidgets/> carries the page header (eyebrow, title, "counting
   since…"), so it must be the FIRST thing on the page and the freshness chart
   goes under it. The bare states below have no widgets, so the page supplies
   the same header itself and keeps every Insights state on one rhythm. The
   page's own controls (range, export) pass THROUGH the widgets into that one
   header rather than becoming a second toolbar row (§13). */
function BareHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <PageHeader
      eyebrow="Insights"
      title="Insights"
      description="Usage, quality, and coverage across your knowledge base."
      actions={actions}
    />
  );
}

function Extras({ extras }: { extras: InsightsExtras }) {
  return (
    <Card title={extras.title}>
      <Breadcrumb items={extras.crumbs.map((label) => ({ label }))} />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {extras.tags.map((t) => <Chip key={t} label={t} />)}
      </div>
      <div className="mt-3">
        <AvatarGroup people={extras.people.map((initials) => ({ initials }))} max={extras.avatarMax} />
      </div>
    </Card>
  );
}

/* §11 dashboard grid: one grid for the whole body so every tile shares the
   same left/right edges and the same vertical rhythm. Widgets span the columns
   they need, and the shared DASH3/SPAN pair drops the row from three-up to
   two-up to one-up as the window narrows (see PageFrame) so a widget is never
   squeezed to a gutter. */
const GRID = `${DASH3} items-start [&>*]:min-w-0`;
const GRID_M = "flex flex-col gap-5 [&>*]:min-w-0";

/** Nothing measured yet.

    `widgets === null` is deliberately NOT empty: it means the widget query has
    not answered, and the widgets' own skeletons are the honest render. Judging
    it empty is what made a workspace with freshness data but no readability
    rows claim there was nothing to measure, instead of letting each widget say
    what it is missing. */
function isEmpty(d: InsightsData): boolean {
  const w = d.widgets;
  if (!w) return false;
  return !d.extras && !d.freshness?.length
    && !w.stats.length && !w.readability.length && !w.glossary.length && !w.activity.length;
}

function Body({ data, error, actions, mobile, headerActions }: {
  data: InsightsData; error: string | null; actions?: InsightsActions; mobile: boolean;
  headerActions?: React.ReactNode;
}) {
  const grid = mobile ? GRID_M : GRID;
  const full = mobile ? "" : SPAN[3];

  if (error) {
    return (
      <>
        <BareHeader />
        {/* Error copy is catalogued, not composed per page (§8). <ReadError>
            is that catalog entry plus the message the server actually sent, so
            every failed read on every page reads the same (XA-01). No controls
            beside a header whose page could not load. */}
        <div className="mt-6"><ReadError>{error}</ReadError></div>
      </>
    );
  }
  if (isEmpty(data)) {
    return (
      <>
        <BareHeader actions={headerActions} />
        <div className="mt-6">
          <EmptyState icon={<Sparkles size={22} />} title="Nothing to measure yet">
            Sync a source and run a few searches to start collecting insights.
          </EmptyState>
        </div>
      </>
    );
  }

  const w = data.widgets;
  /* The window the numbers count over, said on the page rather than implied.
     `data.range` only exists where the app can change it, so the sentence
     never claims a window the reader cannot check. */
  const periodLabel = data.range && w
    ? `Usage, quality, and coverage over ${dateRangeLabel(data.range).toLowerCase()}, from ${fmtDate(w.since)}.`
    : undefined;

  return (
    <div className={grid}>
      {w
        ? <InsightsWidgets className={full} actions={actions} headerActions={headerActions} periodLabel={periodLabel} {...w} />
        : <InsightsWidgets className={full} loading stats={[]} readability={[]} glossary={[]} activity={[]} since="" />}
      {data.freshness && (
        <div className={mobile ? "" : data.extras ? SPAN[2] : SPAN[3]}>
          <InsightsFreshnessChart freshness={data.freshness} onOpenBand={actions?.openFreshness} />
        </div>
      )}
      {data.extras && <div className={mobile ? "" : SPAN[1]}><Extras extras={data.extras} /></div>}
    </div>
  );
}

function InsightsPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<InsightsData, InsightsActions>) {
  const w = data.widgets;
  const exportable = Boolean(
    w && (w.stats.length || w.readability.length || w.glossary.length || w.activity.length),
  );

  /* Both controls are drawn only where they can act: the picker needs a
     handler to re-query with, and Export needs rows to write. */
  const headerActions = (data.range && actions?.setRange) || exportable ? (
    <>
      {data.range && actions?.setRange && (
        <DateRangePicker value={data.range} onChange={actions.setRange} align="end" compact />
      )}
      {exportable && (
        /* One export control, one glyph, one label (§16, XA-23): four
           spellings of this button were in use across the console. */
        <ExportButton
          compact
          format="CSV"
          onClick={() => downloadCsv(
            `insights-${new Date().toISOString().slice(0, 10)}.csv`,
            insightsCsv(w!, data.freshness),
          )}
        />
      )}
    </>
  ) : undefined;

  return (
    <PageFrame chrome={chrome} active={navFor("insights")} title="Insights" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="dashboard"
          eyebrow="Insights"
          title="Insights"
          /* The loaded description names the date it counts since, so it is a
             value, not a label: the bar stands until the range comes back. */
          sections={["LLM readability", "Glossary health", "Recent audit activity"]}
          /* The header's export control, spelled as the loaded page spells it
             (ExportButton, format CSV). The date-range picker beside it is not
             here: its label IS the range, a value. */
          actions={["Export CSV"]}
          mobile={mobile}
        />
      ) : (
        <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
          <Body data={data} error={error} actions={actions} mobile={mobile} headerActions={headerActions} />
          {data.statistics && <div className="mt-5">{data.statistics}</div>}
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<InsightsData, InsightsActions> = {
  id: "insights",
  title: "Insights",
  route: "/insights",
  component: InsightsPage,
  states: STATES.map((s) => ({ ...s })),
};
