/* Insights canvas fixtures. Lifted verbatim out of InsightsPage and the two
   Insights features, which now take required data props and ship no demo
   content of their own. Nothing here is importable by a consuming app. */

import type { Freshness } from "../../features/InsightsFreshnessChart";
import type {
  GlossRow, InsightStat, InsightsActivity, ReadRow,
} from "../../features/InsightsWidgets";
import type { InsightsData, InsightsWidgetData } from "../../pages/InsightsPage";
import { fmtDateTime } from "../../tokens/format";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, UNBREAKABLE, LONG_WORD, MIXED_SCRIPT,
  HUGE_NUMBER, HUGE_NUMBER_STR, MANY_TAGS, MANY_INITIALS, LONG_BREADCRUMB, repeat,
} from "./stress";

const SINCE = "2026-01-01";

const STATS: InsightStat[] = [
  { key: "searches", value: 4820, label: "Searches", tone: "ok", icon: "search" },
  { key: "answers", value: 1394, label: "Answers served", tone: "info", icon: "answers" },
  { key: "drift", value: 37, label: "Drift caught", tone: "blocked", icon: "drift" },
  { key: "fixed", value: 212, label: "Docs fixed", tone: "attention", icon: "fixed" },
];

const READABILITY: ReadRow[] = [
  { id: 1, title: "API authentication", source: "github", grade: "A", note: "Clear, concise, well-structured." },
  { id: 2, title: "Billing & invoices", source: "gdocs", grade: "B", note: "Two long paragraphs could be split." },
  { id: 3, title: "Rate limits", source: "github", grade: "C", note: "Dense; heavy passive voice." },
  { id: 4, title: "Onboarding checklist", source: "notion", grade: "A", note: "" },
  { id: 5, title: "Incident runbook", source: "slack", grade: "B", note: "Jargon without definitions." },
];

const GLOSSARY: GlossRow[] = [
  { id: 1, term: "Flow", variants: ["workflow", "automation"], definition: "An automation that watches knowledge and does editorial work." },
  { id: 2, term: "Drift", variants: ["staleness", "doc rot"], definition: "When a document falls out of sync with accepted facts." },
  { id: -3, term: "Canonical", variants: ["source of truth"], definition: "The version Mari treats as authoritative." },
];

const ACTIVITY: InsightsActivity[] = [
  { id: "a1", actor: "Aki K.", action: "accepted glossary term “Drift”", time: "May 11, 4:12 PM", icon: "glossary" },
  { id: "a2", actor: "Priya S.", action: "fixed 3 readability findings", time: "May 11, 2:03 PM", icon: "readability" },
  { id: "a3", actor: "Mari", action: "scored 42 documents", time: "May 11, 9:20 AM", icon: "scored" },
  { id: "a4", actor: "Dana R.", action: "dismissed a coverage finding", time: "May 10, 5:41 PM" },
];

/* `label` is the source's real display name, which the chart no longer knows
   how to invent from the provider key. The last row deliberately carries none,
   so the canvas also shows what a row falls back to. */
const FRESHNESS: Freshness[] = [
  { source: "github", label: "GitHub · product-docs", fresh: 128, aging: 34, stale: 12 },
  { source: "gdocs", label: "Google Drive · Handbook", fresh: 62, aging: 41, stale: 27 },
  { source: "slack", label: "Slack · #support", fresh: 210, aging: 18, stale: 4 },
  { source: "notion", label: "Notion · Onboarding", fresh: 44, aging: 22, stale: 31 },
  { source: "docs", fresh: 0, aging: 0, stale: 0 },
];

/* ── content variants ─────────────────────────────────────────────────────── */

const SPREAD_READABILITY: ReadRow[] = [
  { id: 1, title: "API authentication", source: "github", grade: "A", note: "Clear, concise, well-structured." },
  { id: 2, title: "Billing & invoices", source: "gdocs", grade: "B", note: "Two long paragraphs could be split." },
  { id: 3, title: "Rate limits", source: "github", grade: "C", note: "Dense; heavy passive voice." },
  { id: 4, title: "Legacy migration notes", source: "notion", grade: "D", note: "Unstructured; no headings." },
  { id: 5, title: "Onboarding checklist", source: "notion", grade: "A", note: "" },
  { id: 6, title: "Incident runbook", source: "slack", grade: "B", note: "Jargon without definitions." },
  { id: 7, title: "Deprecated SDK guide", source: "docs", grade: "C", note: "Long sentences, buried steps." },
];

const REVIEW_GLOSSARY: GlossRow[] = [
  { id: 1, term: "Flow", variants: ["workflow", "automation"], definition: "An automation that watches knowledge and does editorial work." },
  { id: 2, term: "Drift", variants: ["staleness", "doc rot"], definition: "When a document falls out of sync with accepted facts." },
  { id: 3, term: "Closure", variants: ["impact set"], definition: "Every document reachable from a node along its lineage edges." },
  { id: 4, term: "Lens", variants: ["view mode"], definition: "A recoloring of the graph by source, staleness, owner, or health." },
  { id: -5, term: "Canonical", variants: ["source of truth"], definition: "The version Mari treats as authoritative." },
];

const ACTIVE_ACTIVITY: InsightsActivity[] = [
  { id: "a1", actor: "Aki K.", action: "accepted glossary term “Drift”", time: fmtDateTime("2026-05-11T16:12:00"), icon: "glossary" },
  { id: "a2", actor: "Priya S.", action: "fixed 3 readability findings", time: fmtDateTime("2026-05-11T14:03:00"), icon: "readability" },
  { id: "a3", actor: "Mari", action: "scored 42 documents", time: fmtDateTime("2026-05-11T09:20:00"), icon: "scored" },
  { id: "a4", actor: "Dana R.", action: "dismissed a coverage finding", time: fmtDateTime("2026-05-10T17:41:00") },
  { id: "a5", actor: "Mari", action: "harvested 6 candidate terms", time: fmtDateTime("2026-05-10T11:02:00"), icon: "glossary" },
  { id: "a6", actor: "Aki K.", action: "re-scored the API docs after edits", time: fmtDateTime("2026-05-09T15:30:00"), icon: "readability" },
];

const WIDGETS: InsightsWidgetData = {
  stats: STATS, readability: READABILITY, glossary: GLOSSARY, activity: ACTIVITY, since: SINCE,
};

const widgets = (over: Partial<InsightsWidgetData>): InsightsWidgetData => ({ ...WIDGETS, ...over });

/* ── states ───────────────────────────────────────────────────────────────── */

/* `range` is the window the counts were measured over, present only where the
   app can change it — it rewrites the dashboard's subtitle from "counting
   since …" to the window itself. */
const DEFAULT: InsightsData = {
  widgets: WIDGETS, freshness: FRESHNESS, range: { preset: "90d" }, extras: null,
};

/** A workspace with nothing measured. Every collection genuinely empty, so the
    page's own `isEmpty` fires: the canvas is not faking the empty state. */
const EMPTY: InsightsData = {
  widgets: { stats: [], readability: [], glossary: [], activity: [], since: SINCE },
  freshness: null,
  extras: null,
};

/** Long natural text (overflow) and pathological tokens (stress). */
function strained(extreme: boolean): InsightsData {
  const TONE = ["ok", "info", "blocked", "attention"] as const;
  const STAT_LABELS = extreme ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT, HUGE_NUMBER_STR] : [LONG_TITLE];
  const READ_TITLES = extreme ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT] : [LONG_TITLE];
  const GRADES = ["A", "B", "C", "D"];

  return {
    widgets: {
      since: SINCE,
      stats: repeat<InsightStat>((i) => ({
        key: `s${i}`,
        value: HUGE_NUMBER + i,
        label: STAT_LABELS[i % STAT_LABELS.length],
        tone: TONE[i % TONE.length],
        icon: "drift",
      }), 4),
      readability: repeat<ReadRow>((i) => ({
        id: i + 1,
        title: READ_TITLES[i % READ_TITLES.length],
        source: "github",
        grade: GRADES[i % GRADES.length],
        note: extreme ? LONG_WORD : LONG_PARAGRAPH,
      }), 4),
      glossary: repeat<GlossRow>((i) => ({
        id: i + 1,
        term: extreme ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT][i % 3] : LONG_TITLE,
        variants: extreme ? MANY_TAGS : MANY_TAGS.slice(0, 8),
        definition: extreme ? `${MIXED_SCRIPT} ${LONG_WORD}` : LONG_PARAGRAPH,
      }), 3),
      activity: repeat<InsightsActivity>((i) => ({
        id: `a${i}`,
        actor: extreme ? UNBREAKABLE : LONG_NAME,
        action: extreme ? `${MIXED_SCRIPT} ${HUGE_NUMBER_STR}` : LONG_PARAGRAPH,
        time: fmtDateTime("2026-05-11T16:12:00"),
        icon: "scored",
      }), 5),
    },
    /* The chart's row labels are caller-supplied display names, so they are
       user data and belong in the overflow sweep like every other label. */
    freshness: FRESHNESS.map((f, i) => ({
      ...f,
      label: extreme ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT][i % 3] : LONG_TITLE,
      ...(extreme ? { fresh: HUGE_NUMBER + i, aging: HUGE_NUMBER, stale: HUGE_NUMBER } : {}),
    })),
    extras: {
      title: extreme ? MIXED_SCRIPT : LONG_TITLE,
      crumbs: LONG_BREADCRUMB,
      tags: extreme ? MANY_TAGS : MANY_TAGS.slice(0, 10),
      people: MANY_INITIALS,
      avatarMax: extreme ? 4 : 6,
    },
  };
}

export const FIXTURES: PageFixtures<InsightsData> = {
  default: { data: DEFAULT },
  loading: { data: DEFAULT, loading: true },
  "widgets-loading": { data: { widgets: null, freshness: FRESHNESS, extras: null } },
  error: { data: EMPTY, error: "Mari is temporarily unreachable. We are retrying automatically." },
  empty: { data: EMPTY },
  "no-freshness": { data: { ...DEFAULT, freshness: null } },
  "freshness-empty": { data: { ...DEFAULT, freshness: [] } },
  "readability-spread": { data: { ...DEFAULT, widgets: widgets({ readability: SPREAD_READABILITY }) } },
  "glossary-review": { data: { ...DEFAULT, widgets: widgets({ glossary: REVIEW_GLOSSARY }) } },
  "glossary-clear": { data: { ...DEFAULT, widgets: widgets({ glossary: [] }) } },
  "audit-active": { data: { ...DEFAULT, widgets: widgets({ activity: ACTIVE_ACTIVITY }) } },
  "audit-empty": { data: { ...DEFAULT, widgets: widgets({ activity: [] }) } },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
