import type { ComponentSpec } from "./types";
import {
  OverviewStatTiles, OverviewDigestCard, OverviewSourcePulse,
  OverviewLiveActivity, OverviewRecentDocs,
} from "../../features";
import type { PulseTileData } from "../../features/OverviewSourcePulse";
import type { FeedItem } from "../../features/OverviewLiveActivity";
import type { RecentDoc } from "../../features/OverviewRecentDocs";
import type { DigestTopic } from "../../data-display/DigestCard";
import {
  OVERVIEW_STATS, OVERVIEW_TOPICS, OVERVIEW_TILES, OVERVIEW_FEED, OVERVIEW_DOCS,
} from "../fixtures/features";

/* State matrix for the overview group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks. */

const LONG =
  "Quarterly revenue recognition policy for multi-year enterprise agreements with usage-based true-ups and mid-term expansion credits";
/* 90 chars, no spaces: the classic layout breaker. */
const HUGE = "Supercalifragilistic_configuration_parameter_value_that_never_wraps_because_it_has_no_sp";
const LONG_SUMMARY =
  "Mari re-read every page touched this week and found that the pricing FAQ, the billing runbook, and the partner agreement template all describe proration differently, which means support, sales, and finance have each been quoting a different number to customers since the Growth tier rename shipped.";

/* ── Digest fixtures ─────────────────────────────────────────────────── */
const LONG_TOPICS: DigestTopic[] = [
  {
    title: LONG,
    summary: LONG_SUMMARY,
    where: [
      { source: "notion", label: "Pricing FAQ, Growth tier proration and credits" },
      { source: "gdocs", label: HUGE },
      { source: "github", label: "auth/README" },
      { source: "slack", label: "#eng-identity" },
      { source: "linear", label: "Billing platform backlog" },
    ],
    impact: [
      { name: "Support", tone: "info" }, { name: "Sales", tone: "ok" },
      { name: "Finance operations and revenue recognition", tone: "attention" },
      { name: "SRE", tone: "blocked" }, { name: "On-call", tone: "attention" },
      { name: HUGE, tone: "neutral" },
    ],
  },
  {
    title: HUGE,
    summary: "One source, one line.",
    where: [{ source: "granola", label: "Postmortem sync" }],
    impact: [],
  },
];

/* ── Pulse fixtures ──────────────────────────────────────────────────── */
const MANY_TILES: PulseTileData[] = [
  { key: "github", name: "GitHub", stat: "128", unit: "commits", status: "active", bars: [4, 7, 5, 9, 6, 11, 8] },
  { key: "slack", name: "Slack", stat: "412", unit: "messages", status: "active", bars: [30, 22, 41, 18, 35, 27, 44] },
  { key: "notion", name: "Notion", stat: "19", unit: "edits", status: "moderate", bars: [3, 1, 4, 2, 0, 5, 4] },
  { key: "gdocs", name: "Google Drive", stat: "34", unit: "files", status: "active", bars: [6, 4, 8, 5, 7, 9, 6] },
  { key: "granola", name: "Granola", stat: "7", unit: "meetings", status: "moderate", bars: [1, 2, 0, 1, 3, 1, 2] },
  { key: "linear", name: "Linear", stat: "56", unit: "issues", status: "active", bars: [8, 5, 11, 7, 9, 6, 12] },
  { key: "jira", name: "Jira", stat: "203", unit: "issues", status: "active", bars: [12, 9, 15, 11, 14, 10, 18] },
  { key: "confluence", name: "Confluence", stat: "88", unit: "pages", status: "moderate", bars: [2, 6, 3, 7, 4, 5, 6] },
  { key: "zendesk", name: "Zendesk", stat: "1,204", unit: "tickets", status: "active", bars: [40, 55, 38, 61, 47, 52, 66] },
  { key: "airtable", name: "Airtable", stat: "77", unit: "records", status: "moderate", bars: [3, 4, 2, 6, 5, 3, 7] },
];

const LONG_TILES: PulseTileData[] = [
  { key: "gdocs", name: "Google Drive shared company handbook archive", stat: "1,284,905", unit: "files touched this week", status: "active", bars: [6, 4, 8, 5, 7, 9, 6] },
  { key: "notion", name: HUGE, stat: "19", unit: "edits", status: "moderate", bars: [3, 1, 4, 2, 0, 5, 4] },
];

/* ── Activity fixtures ───────────────────────────────────────────────── */
const LONG_FEED: FeedItem[] = [
  { id: 1, kind: "run", actor: "Docs guardrail nightly sweep over every synced space", text: "completed a run over", target: LONG, secondsAgo: 42 },
  { id: 2, kind: "edit", actor: "Aleksandra Konstantinopoulou-Whitfield", text: "refined", target: HUGE, secondsAgo: 190 },
  { id: 3, kind: "fact", actor: "Mari", text: "verified a fact in", target: "Proration rule", secondsAgo: 380 },
];
const MANY_FEED: FeedItem[] = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  kind: ["run", "edit", "fact", "deploy", "sync", "link", "task"][i % 7],
  actor: ["Docs guardrail", "Dana R.", "Mari", "Stale sweeper", "Notion", "Priya K.", "Sam L."][i % 7],
  text: "touched",
  target: `Document ${i + 1}`,
  secondsAgo: 60 * (i + 1),
}));

/* ── Recent docs fixtures ────────────────────────────────────────────── */
const MANY_DOCS: RecentDoc[] = Array.from({ length: 12 }, (_, i) => ({
  id: 200 + i,
  source: ["notion", "github", "granola", "gdocs", "linear", "slack"][i % 6],
  title: `Runbook section ${i + 1}: proration, credits, and mid-term expansion`,
  date: `2026-07-${String(20 - i).padStart(2, "0")}`,
}));
const LONG_DOCS: RecentDoc[] = [
  { id: 301, source: "notion", title: LONG, date: "2026-07-20" },
  { id: 302, source: "gdocs", title: HUGE, date: "2026-07-19" },
  { id: 303, source: "unknown-provider", title: "A doc from a source Mari has no mark for", date: "2026-07-18" },
];

/* ── Volume fixtures ─────────────────────────────────────────────────────
   The "stress" state of every component: production-sized data, not a demo
   sample. A live workspace feed is hundreds of events, a task inbox hundreds
   of rows, a source list dozens of tiles, a flow dozens of steps. Nothing here
   may grow its card past the fold or push the page below it off screen. */

const STRESS_TOPICS: DigestTopic[] = Array.from({ length: 40 }, (_, i) => ({
  title: `Topic ${i + 1}: ${["Billing docs realigned to the new plan tiers", "Onboarding flow gained a self-serve SSO path", LONG][i % 3]}`,
  summary: i % 4 === 0 ? LONG_SUMMARY : "Mari re-read the week and reconciled the overlapping passages across three sources.",
  where: Array.from({ length: (i % 6) + 2 }, (_, j) => ({
    source: ["notion", "gdocs", "github", "slack", "granola", "linear"][j % 6],
    label: j === 3 ? HUGE : `Source document ${j + 1}`,
  })),
  impact: Array.from({ length: (i % 5) + 2 }, (_, j) => ({
    name: ["Support", "Sales", "Finance operations and revenue recognition", "SRE", "On-call"][j % 5],
    tone: (["info", "ok", "attention", "blocked", "neutral"] as const)[j % 5],
  })),
}));

const STRESS_TILES: PulseTileData[] = Array.from({ length: 40 }, (_, i) => ({
  key: ["github", "slack", "notion", "gdocs", "granola", "linear", "jira", "confluence", "zendesk", "airtable"][i % 10],
  name: i % 11 === 0 ? HUGE : `${["GitHub", "Slack", "Notion", "Google Drive", "Granola", "Linear", "Jira", "Confluence", "Zendesk", "Airtable"][i % 10]} workspace ${i + 1}`,
  stat: (1000 + i * 137).toLocaleString(),
  unit: i % 2 ? "documents touched" : "messages",
  status: (i % 3 === 0 ? "moderate" : "active") as PulseTileData["status"],
  bars: [4, 7, 5, 9, 6, 11, 8].map((v) => v + (i % 5)),
}));

const STRESS_FEED: FeedItem[] = Array.from({ length: 400 }, (_, i) => ({
  id: i + 1,
  kind: ["run", "edit", "fact", "deploy", "sync", "link", "task"][i % 7],
  actor: i % 19 === 0 ? "Aleksandra Konstantinopoulou-Whitfield" : ["Docs guardrail", "Dana R.", "Mari", "Stale sweeper", "Notion", "Priya K.", "Sam L."][i % 7],
  text: "touched",
  target: i % 13 === 0 ? HUGE : `Runbook section ${i + 1}: proration, credits, expansion`,
  secondsAgo: 45 * (i + 1),
}));

const STRESS_DOCS: RecentDoc[] = Array.from({ length: 400 }, (_, i) => ({
  id: 1000 + i,
  source: ["notion", "github", "granola", "gdocs", "linear", "slack"][i % 6],
  title: i % 29 === 0 ? HUGE : `Runbook section ${i + 1}: proration, credits, and mid-term expansion`,
  date: `2026-0${(i % 7) + 1}-${String((i % 28) + 1).padStart(2, "0")}`,
}));

export const OVERVIEW: ComponentSpec[] = [
  {
    id: "OverviewStatTiles", title: "Overview / Headline stat tiles", width: 900,
    states: [
      { id: "default", label: "Default", node: <OverviewStatTiles stats={OVERVIEW_STATS} /> },
      { id: "zeroes", label: "All zero (idle workspace)", node: (
        <OverviewStatTiles stats={{ changes: 0, factsReview: 0, workflowsActive: 0 }} />) },
      { id: "loading", label: "Loading", node: <OverviewStatTiles stats={OVERVIEW_STATS} loading /> },
      { id: "offline", label: "Offline (no API)", node: <OverviewStatTiles stats={null} offline /> },
      { id: "noswatch", label: "Accent line off", node: <OverviewStatTiles stats={OVERVIEW_STATS} swatch={false} /> },
      { id: "bignumbers", label: "Overflow: huge numbers", node: (
        <OverviewStatTiles stats={{ changes: 1284905, factsReview: 998877, workflowsActive: 1234567 }} />) },
      { id: "narrow", label: "Overflow: narrow 320 frame", width: 320, node: <OverviewStatTiles stats={OVERVIEW_STATS} /> },
      { id: "stress", label: "Volume: nine-figure counts", node: (
        <OverviewStatTiles stats={{ changes: 128490512, factsReview: 99887766, workflowsActive: 412345678 }} />) },
    ],
  },
  {
    id: "OverviewDigestCard", title: "Overview / This week's digest", width: 680,
    states: [
      { id: "default", label: "Default", node: <OverviewDigestCard topics={OVERVIEW_TOPICS} /> },
      { id: "loading", label: "Loading", node: <OverviewDigestCard topics={[]} loading /> },
      { id: "empty", label: "Empty (no topics)", node: <OverviewDigestCard topics={[]} /> },
      { id: "error", label: "Error / API offline", node: <OverviewDigestCard topics={[]} error /> },
      { id: "single", label: "One topic, one source (singular label)", node: (
        <OverviewDigestCard topics={[{
          title: "Incident retro synthesized into a runbook update",
          summary: "The Jul 14, 2026 latency incident's action items landed as a new escalation ladder.",
          where: [{ source: "granola", label: "Postmortem sync" }],
          impact: [{ name: "SRE", tone: "blocked" }],
        }]} />) },
      { id: "overflow", label: "Overflow: long title, summary, unbreakable chip, many chips", node: (
        <OverviewDigestCard topics={LONG_TOPICS} />) },
      { id: "narrow", label: "Overflow: narrow 320 frame", width: 320, node: (
        <OverviewDigestCard topics={LONG_TOPICS} />) },
      { id: "stress", label: "Volume: 40 topics, up to 7 sources each", node: (
        <OverviewDigestCard topics={STRESS_TOPICS} />) },
    ],
  },
  {
    id: "OverviewSourcePulse", title: "Overview / Source pulse", width: 680,
    states: [
      { id: "default", label: "Default (collapsed)", node: <OverviewSourcePulse tiles={OVERVIEW_TILES} /> },
      { id: "expanded", label: "Expanded (all sources)", node: <OverviewSourcePulse tiles={OVERVIEW_TILES} defaultExpanded /> },
      { id: "loading", label: "Loading", node: <OverviewSourcePulse tiles={[]} loading /> },
      { id: "empty", label: "Empty (no sources connected)", node: <OverviewSourcePulse tiles={[]} /> },
      { id: "offline", label: "Offline (no API)", node: <OverviewSourcePulse tiles={[]} offline /> },
      { id: "manytiles", label: "Overflow: 10 sources, expanded", node: (
        <OverviewSourcePulse tiles={MANY_TILES} defaultExpanded />) },
      { id: "longnames", label: "Overflow: long + unbreakable source names", node: (
        <OverviewSourcePulse tiles={LONG_TILES} />) },
      { id: "narrow", label: "Overflow: narrow 320 frame", width: 320, node: (
        <OverviewSourcePulse tiles={LONG_TILES} />) },
      { id: "stress", label: "Volume: 40 connected sources, expanded", node: (
        <OverviewSourcePulse tiles={STRESS_TILES} defaultExpanded />) },
    ],
  },
  {
    id: "OverviewLiveActivity", title: "Overview / Live activity", width: 680,
    states: [
      { id: "default", label: "Default", node: <OverviewLiveActivity items={OVERVIEW_FEED} pollMs={0} /> },
      { id: "loading", label: "Loading", node: <OverviewLiveActivity items={[]} loading pollMs={0} /> },
      { id: "empty", label: "Empty (quiet feed, paused chip)", node: (
        <OverviewLiveActivity items={[]} pollMs={0} />) },
      { id: "offline", label: "Offline (no API)", node: <OverviewLiveActivity items={[]} offline pollMs={0} /> },
      { id: "manyrows", label: "Overflow: 16 items (caps at 8)", node: (
        <OverviewLiveActivity items={MANY_FEED} pollMs={0} />) },
      { id: "longtext", label: "Overflow: long actor + unbreakable target", node: (
        <OverviewLiveActivity items={LONG_FEED} pollMs={0} />) },
      { id: "narrow", label: "Overflow: narrow 320 frame", width: 320, node: (
        <OverviewLiveActivity items={LONG_FEED} pollMs={0} />) },
      { id: "stress", label: "Volume: 400 events", node: (
        <OverviewLiveActivity items={STRESS_FEED} pollMs={0} />) },
    ],
  },
  {
    id: "OverviewRecentDocs", title: "Overview / Recent docs", width: 680,
    states: [
      { id: "default", label: "Default (collapsed)", node: <OverviewRecentDocs docs={OVERVIEW_DOCS} /> },
      { id: "expanded", label: "Expanded (browse all)", node: <OverviewRecentDocs docs={OVERVIEW_DOCS} defaultExpanded /> },
      { id: "loading", label: "Loading", node: <OverviewRecentDocs docs={[]} loading /> },
      { id: "empty", label: "Empty (no docs)", node: <OverviewRecentDocs docs={[]} /> },
      { id: "offline", label: "Offline (no API)", node: <OverviewRecentDocs docs={[]} offline /> },
      { id: "manyrows", label: "Overflow: 12 rows, expanded", node: (
        <OverviewRecentDocs docs={MANY_DOCS} defaultExpanded />) },
      { id: "longtitles", label: "Overflow: long + unbreakable titles, unknown source", node: (
        <OverviewRecentDocs docs={LONG_DOCS} />) },
      { id: "narrow", label: "Overflow: narrow 320 frame", width: 320, node: (
        <OverviewRecentDocs docs={LONG_DOCS} />) },
      { id: "stress", label: "Volume: 400 documents, expanded", node: (
        <OverviewRecentDocs docs={STRESS_DOCS} defaultExpanded />) },
    ],
  },
];
