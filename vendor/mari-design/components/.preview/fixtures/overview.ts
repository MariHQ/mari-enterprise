/* Overview canvas fixtures. Lifted verbatim out of the Overview feature
   components, which now take required data props and ship no demo content
   of their own. Nothing here is importable by a consuming app. */

import type { DigestTopic } from "../../features/OverviewDigestCard";
import type { FeedItem } from "../../features/OverviewLiveActivity";
import type { RecentDoc } from "../../features/OverviewRecentDocs";
import type { PulseTileData } from "../../features/OverviewSourcePulse";
import type { OverviewStats } from "../../features/OverviewStatTiles";
import type { OverviewData } from "../../pages/OverviewPage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_SOURCE, UNBREAKABLE,
  LONG_WORD, HUGE_NUMBER, HUGE_NUMBER_STR, MIXED_SCRIPT, MANY_TAGS, repeat,
} from "./stress";

const STATS: OverviewStats = { changes: 47, factsReview: 6, workflowsActive: 3 };

const DIGEST: DigestTopic[] = [
  {
    title: "Billing docs realigned to the new plan tiers",
    where: [
      { source: "notion", label: "Pricing FAQ" },
      { source: "gdocs", label: "Billing runbook" },
    ],
    summary:
      "Three pages drifted after the Growth-tier rename. Mari rewrote the overlap and flagged one contradiction between the FAQ and the runbook's proration rule.",
    impact: [
      { name: "Support", tone: "info" },
      { name: "Sales", tone: "ok" },
    ],
  },
  {
    title: "Onboarding flow gained a self-serve SSO path",
    where: [
      { source: "github", label: "auth/README" },
      { source: "slack", label: "#eng-identity" },
    ],
    summary:
      "The SAML setup guide was expanded with an Okta walkthrough. Two stale screenshots were retired and the admin-only caveat now leads the section.",
    impact: [
      { name: "Onboarding", tone: "ok" },
      { name: "Security", tone: "attention" },
    ],
  },
  {
    title: "Incident retro synthesized into a runbook update",
    where: [{ source: "granola", label: "Postmortem sync" }],
    summary:
      "The Jul 14, 2026 latency incident's action items landed as a new escalation ladder. Mari cross-linked it from the on-call guide.",
    impact: [
      { name: "SRE", tone: "blocked" },
      { name: "On-call", tone: "attention" },
    ],
  },
];

const ACTIVITY: FeedItem[] = [
  { id: 1, kind: "run", actor: "Docs guardrail", text: "completed a run over", target: "billing/*.md", secondsAgo: 42 },
  { id: 2, kind: "edit", actor: "Dana R.", text: "refined", target: "Pricing FAQ", secondsAgo: 190 },
  { id: 3, kind: "fact", actor: "Mari", text: "verified a fact in", target: "Proration rule", secondsAgo: 380 },
  { id: 4, kind: "deploy", actor: "Stale sweeper", text: "deployed", target: "help.mari.guru", secondsAgo: 900 },
  { id: 5, kind: "sync", actor: "Notion", text: "synced", target: "Onboarding space", secondsAgo: 1500 },
  { id: 6, kind: "link", actor: "Mari", text: "derived links between", target: "on-call guide", secondsAgo: 2400 },
  { id: 7, kind: "task", actor: "Priya K.", text: "closed a task on", target: "auth/README", secondsAgo: 3600 },
  { id: 8, kind: "edit", actor: "Sam L.", text: "edited", target: "Escalation ladder", secondsAgo: 5400 },
];

const DOCS: RecentDoc[] = [
  { id: 101, source: "notion", title: "Pricing FAQ: Growth tier proration", date: "2026-07-20" },
  { id: 102, source: "github", title: "auth/README: Okta SAML walkthrough", date: "2026-07-19" },
  { id: 103, source: "granola", title: "Incident retro: Jul 14, 2026 latency", date: "2026-07-15" },
  { id: 104, source: "gdocs", title: "Billing runbook: proration and credits", date: "2026-07-14" },
  { id: 105, source: "notion", title: "Onboarding space: self-serve SSO", date: "2026-07-11" },
  { id: 106, source: "linear", title: "On-call guide: escalation ladder", date: "2026-07-08" },
];

const SOURCES: PulseTileData[] = [
  { key: "github", name: "GitHub", stat: "128", unit: "commits", status: "active", bars: [4, 7, 5, 9, 6, 11, 8] },
  { key: "slack", name: "Slack", stat: "412", unit: "messages", status: "active", bars: [30, 22, 41, 18, 35, 27, 44] },
  { key: "notion", name: "Notion", stat: "19", unit: "edits", status: "moderate", bars: [3, 1, 4, 2, 0, 5, 4] },
  { key: "gdocs", name: "Google Drive", stat: "34", unit: "files", status: "active", bars: [6, 4, 8, 5, 7, 9, 6] },
  { key: "granola", name: "Granola", stat: "7", unit: "meetings", status: "moderate", bars: [1, 2, 0, 1, 3, 1, 2] },
  { key: "linear", name: "Linear", stat: "56", unit: "issues", status: "active", bars: [8, 5, 11, 7, 9, 6, 12] },
];

/* ── states ─────────────────────────────────────────────────────────────── */

const DEFAULT: OverviewData = {
  personName: "Dana",
  /* The greeting reads the reader's own clock, in the zone Preferences
     collects. Naming one here means the canvas exercises that path rather
     than the browser fallback — and it is the zone the Preferences fixture
     stores. */
  timeZone: "America/Los_Angeles",
  range: { preset: "30d" },
  stats: STATS, digest: DIGEST, activity: ACTIVITY, docs: DOCS, sources: SOURCES,
  activityPollMs: 0,
};

/** A brand-new workspace. Every collection genuinely empty, so the page's own
    `isEmpty` check fires — the canvas is not faking the empty state. */
const EMPTY: OverviewData = {
  personName: "Dana",
  stats: { changes: 0, factsReview: 0, workflowsActive: 0 },
  digest: [], activity: [], docs: [], sources: [],
  activityPollMs: 0,
};

/** Long natural text (overflow) and pathological tokens (stress). */
function strained(extreme: boolean): OverviewData {
  const digest = repeat(() => ({
    title: extreme ? `${UNBREAKABLE} ${MIXED_SCRIPT}` : LONG_TITLE,
    summary: extreme ? `${LONG_WORD} ${UNBREAKABLE} ${MIXED_SCRIPT}` : LONG_PARAGRAPH,
    where: [
      { source: "github", label: extreme ? UNBREAKABLE : LONG_SOURCE },
      { source: extreme ? "notion" : "gdocs", label: extreme ? LONG_WORD : LONG_DOC_TITLE },
    ],
    impact: (extreme ? MANY_TAGS : MANY_TAGS.slice(0, 8)).map((t) => ({ name: t })),
  }), 2);

  const docs = (extreme
    ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT]
    : [LONG_DOC_TITLE, LONG_TITLE, `${LONG_NAME}, ${LONG_SOURCE}`]
  ).map((title, i) => ({ id: 100 + i, source: ["github", "notion", "granola"][i], title, date: "2026-07-20" }));

  const activity = (extreme
    ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT]
    : [LONG_NAME, LONG_SOURCE, LONG_DOC_TITLE]
  ).map((s, i) => ({
    id: i + 1, kind: ["run", "edit", "deploy"][i], actor: s,
    text: extreme ? UNBREAKABLE : "completed a very long-running run over",
    target: extreme ? LONG_WORD : LONG_SOURCE, secondsAgo: (i + 1) * 120,
  }));

  const sources = (extreme
    ? [{ key: "github", name: UNBREAKABLE, stat: HUGE_NUMBER_STR, unit: LONG_WORD },
       { key: "notion", name: MIXED_SCRIPT, stat: HUGE_NUMBER_STR, unit: UNBREAKABLE }]
    : [{ key: "github", name: LONG_SOURCE, stat: HUGE_NUMBER_STR, unit: "documents indexed this week" },
       { key: "notion", name: LONG_DOC_TITLE, stat: HUGE_NUMBER_STR, unit: "revisions" }]
  ).map((t) => ({ ...t, status: "active" as const, bars: [3, 8, 2, 9, 4, 7, 5] }));

  return {
    personName: extreme ? LONG_WORD : LONG_NAME,
    stats: { changes: HUGE_NUMBER, factsReview: HUGE_NUMBER, workflowsActive: HUGE_NUMBER },
    digest, activity, docs, sources,
    activityPollMs: 0,
  };
}

export const FIXTURES: PageFixtures<OverviewData> = {
  default: { data: DEFAULT },
  loading: { data: DEFAULT, loading: true },
  error: { data: EMPTY, error: "The dashboard is temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
