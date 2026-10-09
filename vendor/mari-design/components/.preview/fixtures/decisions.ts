/* Decisions canvas fixtures. Lifted verbatim out of DecisionsPage and
   DecisionCardFeature, which now take required data props and ship no demo
   content of their own. Nothing here is importable by a consuming app. */

import { NO_IMPACT, type Decision, type ImpactState } from "../../features/DecisionCardFeature";
import type { ImpactDoc } from "../../data-display/ImpactPanel";
import type { DecisionExtras, DecisionsData, LedgerFilterTab } from "../../pages/DecisionsPage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_SOURCE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER, HUGE_NUMBER_STR, MIXED_SCRIPT,
  MANY_TAGS, MANY_INITIALS, LONG_BREADCRUMB,
} from "./stress";

/* The tab strip is the ledger's only filter, so its counts have to come off the
   timeline behind it: a hardcoded "6" promised rows the column never had. */
const TABS: { id: string; label: string; status?: Decision["status"] }[] = [
  { id: "all", label: "All" },
  { id: "proposed", label: "Proposed", status: "proposed" },
  { id: "ratified", label: "Ratified", status: "ratified" },
  { id: "ignored", label: "Ignored", status: "ignored" },
];

/** Records filed under the old "superseded" spelling count as ignored. */
const seen = (d: Decision) => (d.status === "superseded" ? "ignored" : d.status);

const filtersFor = (decisions: Decision[]): LedgerFilterTab[] =>
  TABS.map((t) => ({
    ...t,
    count: t.status ? decisions.filter((d) => seen(d) === t.status).length : decisions.length,
  }));

const AWAITING_RAIL = [
  "Adopt short-lived JWTs for service auth",
  "Freeze the public API surface for v2",
];

const HOW_IT_WORKS =
  "Decisions are captured from Slack or written by hand, sit “Proposed” until ratified, then can have impact run against the corpus. Superseding a decision keeps the old record, struck through.";

const DOCS: ImpactDoc[] = [
  { title: "Auth architecture", source: "gdocs · eng", severity: "update-required", reason: "Describes the old session-cookie flow; must move to short-lived JWTs." },
  { title: "Security review", source: "notion · sec", severity: "review", reason: "Threat model references cookie theft: revisit under the new scheme." },
  { title: "SDK quickstart", source: "github · docs", severity: "minor", reason: "Sample uses the legacy header; low-priority copy change." },
];

/** The timeline the ledger opens with: lifted out of DecisionCardFeature. */
const DEFAULT_DECISIONS: Decision[] = [
  {
    id: 1,
    statement: "Adopt short-lived JWTs for service-to-service auth",
    context: "Cookie sessions don't survive our move to multi-region. JWTs with a 10-minute TTL and rotating keys close the replay window.",
    status: "proposed",
    fresh: true,
    source: "Mari scan · #eng-security",
    provider: "slack",
    owners: ["Dana Ito", "Reza Okafor"],
    impact: { ...NO_IMPACT },
  },
  {
    id: 2,
    statement: "Standardize on Postgres 16 across all environments",
    context: "Two services still run 13. Aligning removes three migration branches and unlocks logical replication.",
    status: "ratified",
    source: "Architecture sync",
    provider: "gdocs",
    owners: ["Priya Nair"],
    decidedOn: "2026-07-09",
    impact: { ...NO_IMPACT, count: 5, summary: "5 documents reference database version constraints." },
  },
  {
    id: 3,
    statement: "Ship the console as a single-page app, not per-page routes",
    context: "The agent dock and command palette need to survive navigation; an SPA keeps them mounted once.",
    status: "ratified",
    source: "Design review",
    provider: "notion",
    owners: ["Alex Chen", "Wei Zhang"],
    decidedOn: "2026-06-28",
    impact: { ...NO_IMPACT },
  },
  {
    id: 4,
    statement: "Use REST for the public API surface",
    status: "ignored",
    source: "Founders memo",
    provider: "docs",
    owners: ["Sam Rowe"],
    decidedOn: "2025-11-14",
    ignoredFor: "Expose a typed GraphQL gateway in front of the internal services",
    impact: { ...NO_IMPACT },
  },
];

const AWAITING: Decision[] = [
  { id: 1, statement: "Adopt short-lived JWTs for service-to-service auth", context: "Cookie sessions don't survive our move to multi-region. JWTs with a 10-minute TTL and rotating keys close the replay window.", status: "proposed", fresh: true, source: "Mari scan · #eng-security", provider: "slack", owners: ["Dana Ito", "Reza Okafor"], impact: { ...NO_IMPACT } },
  { id: 2, statement: "Freeze the public API surface for v2", context: "Downstream teams need a stable contract before the SDK release.", status: "proposed", source: "Architecture sync", provider: "gdocs", owners: ["Priya Nair"], impact: { ...NO_IMPACT } },
  { id: 3, statement: "Move CI to the shared runner pool", context: "Dedicated runners sit idle 80% of the day.", status: "proposed", source: "Platform review", provider: "notion", owners: ["Alex Chen"], impact: { ...NO_IMPACT } },
];

const RATIFIED: Decision[] = [
  { id: 1, statement: "Adopt short-lived JWTs for service-to-service auth", context: "Cookie sessions don't survive our move to multi-region. JWTs with a 10-minute TTL and rotating keys close the replay window.", status: "ratified", fresh: true, source: "Mari scan · #eng-security", provider: "slack", owners: ["Dana Ito", "Reza Okafor"], decidedOn: "2026-07-21", impact: { ...NO_IMPACT } },
  { id: 2, statement: "Standardize on Postgres 16 across all environments", status: "ratified", source: "Architecture sync", provider: "gdocs", owners: ["Priya Nair"], decidedOn: "2026-07-09", impact: { ...NO_IMPACT, count: 5, summary: "5 documents reference database version constraints." } },
];

const impactDecision = (impact: ImpactState): Decision[] => [
  { id: 1, statement: "Adopt short-lived JWTs for service-to-service auth", context: "Cookie sessions don't survive our move to multi-region. JWTs with a 10-minute TTL and rotating keys close the replay window.", status: "ratified", source: "Architecture sync", provider: "gdocs", owners: ["Dana Ito", "Reza Okafor"], decidedOn: "2026-07-14", impact },
];

const RATIFIED_ONLY: Decision[] = [
  { id: 2, statement: "Standardize on Postgres 16 across all environments", context: "Two services still run 13. Aligning removes three migration branches.", status: "ratified", source: "Architecture sync", provider: "gdocs", owners: ["Priya Nair"], decidedOn: "2026-07-09", impact: { ...NO_IMPACT, count: 5, summary: "5 documents reference database version constraints." } },
  { id: 3, statement: "Ship the console as a single-page app, not per-page routes", context: "The agent dock and command palette need to survive navigation.", status: "ratified", source: "Design review", provider: "notion", owners: ["Alex Chen", "Wei Zhang"], decidedOn: "2026-06-28", impact: { ...NO_IMPACT } },
];

const SUPERSEDED: Decision[] = [
  { id: 4, statement: "Use REST for the public API surface", status: "superseded", source: "Founders memo", provider: "docs", owners: ["Sam Rowe"], decidedOn: "2025-11-14", supersededBy: "Expose a typed GraphQL gateway in front of the internal services", impact: { ...NO_IMPACT } },
  { id: 5, statement: "Expose a typed GraphQL gateway in front of the internal services", context: "Replaces the REST-only decision; unifies typing across clients.", status: "ratified", source: "Architecture sync", provider: "gdocs", owners: ["Sam Rowe", "Wei Zhang"], decidedOn: "2026-05-02", impact: { ...NO_IMPACT } },
];

/* Overflow — long statements, multi-sentence context, long owner names. */
const OVERFLOW_DECISIONS: Decision[] = [
  { id: 1, statement: LONG_TITLE, context: LONG_PARAGRAPH, status: "ratified", fresh: true, source: LONG_SOURCE, provider: "slack", owners: [LONG_NAME, "Priya Nair", "Alexandra Featherstonehaugh-Montgomery"], decidedOn: "2026-07-21", impact: { ...NO_IMPACT, count: 5, summary: LONG_PARAGRAPH } },
  { id: 2, statement: "Freeze the entire public API surface for v2 until every downstream team has migrated off the legacy header and onto the typed gateway contract", context: LONG_PARAGRAPH, status: "proposed", source: "Architecture sync spanning the platform, reliability, and security guilds across every region", provider: "gdocs", owners: [LONG_NAME], impact: { ...NO_IMPACT } },
];

/* Stress — unbreakable tokens, mixed scripts, huge numbers, long owner stack. */
const STRESS_DECISIONS: Decision[] = [
  { id: 1, statement: UNBREAKABLE, context: LONG_URL, status: "ratified", fresh: true, source: UNBREAKABLE, provider: "slack", owners: MANY_INITIALS, decidedOn: "2026-07-21", impact: { ...NO_IMPACT, count: HUGE_NUMBER, summary: `${HUGE_NUMBER_STR} documents reference ${MIXED_SCRIPT}` } },
  { id: 2, statement: MIXED_SCRIPT, context: LONG_WORD, status: "proposed", source: LONG_DOC_TITLE, provider: "gdocs", owners: MANY_INITIALS, impact: { ...NO_IMPACT } },
  { id: 3, statement: LONG_WORD, status: "superseded", source: UNBREAKABLE, provider: "docs", owners: [LONG_NAME], decidedOn: "2025-11-14", supersededBy: UNBREAKABLE, impact: { ...NO_IMPACT } },
];

const OVERFLOW_EXTRAS: DecisionExtras = {
  breadcrumb: LONG_BREADCRUMB,
  tags: MANY_TAGS.slice(0, 6),
  people: MANY_INITIALS.slice(0, 8),
  avatarMax: 6,
};

const STRESS_EXTRAS: DecisionExtras = {
  breadcrumb: LONG_BREADCRUMB,
  tags: [...MANY_TAGS, MIXED_SCRIPT, UNBREAKABLE],
  people: MANY_INITIALS,
  avatarMax: 5,
};

/* ── states ─────────────────────────────────────────────────────────────── */

/** One ledger view: a timeline plus the rail every state shares. */
const ledger = (decisions: Decision[], filter = "all"): DecisionsData => ({
  decisions,
  filter,
  filters: filtersFor(decisions),
  awaiting: AWAITING_RAIL,
  howItWorks: HOW_IT_WORKS,
  composer: null,
  ratify: null,
  extras: null,
});

const DEFAULT = ledger(DEFAULT_DECISIONS);

/** A workspace that has never recorded a decision. Every collection genuinely
    empty, so the page's own `isEmpty` check fires. */
const EMPTY: DecisionsData = {
  decisions: [], filter: "all",
  filters: filtersFor([]),
  awaiting: [], howItWorks: HOW_IT_WORKS,
  composer: null, ratify: null, extras: null,
};

export const FIXTURES: PageFixtures<DecisionsData> = {
  default: { data: DEFAULT },
  awaiting: { data: ledger(AWAITING, "proposed") },
  ratifying: {
    data: {
      ...ledger(DEFAULT_DECISIONS, "proposed"),
      ratify: {
        /* The ledger id being signed. Without it the pane can show the record
           but never sign it (P-DE-2). It is decision #1 above. */
        id: 1,
        statement: "Adopt short-lived JWTs for service-to-service auth",
        context: "Cookie sessions don't survive our move to multi-region. JWTs with a 10-minute TTL and rotating keys close the replay window.",
        status: "proposed",
        fresh: true,
        sourceLabel: "Mari scan · #eng-security",
        provider: "slack",
        owners: ["Dana Ito", "Reza Okafor"],
      },
    },
  },
  ratified: { data: ledger(RATIFIED) },
  "impact-loading": { data: ledger(impactDecision({ ...NO_IMPACT, open: true, loading: true }), "ratified") },
  "impact-docs": {
    data: ledger(impactDecision({ ...NO_IMPACT, open: true, docs: DOCS, count: DOCS.length, summary: "3 documents reference the old cookie-session flow." }), "ratified"),
  },
  "impact-collapsed": {
    data: ledger(impactDecision({ ...NO_IMPACT, open: false, docs: DOCS, count: DOCS.length, summary: "3 documents reference the old cookie-session flow." }), "ratified"),
  },
  composer: {
    data: { ...DEFAULT, composer: { statement: "", context: "", source: "", saving: false } },
  },
  "composer-saving": {
    data: {
      ...DEFAULT,
      composer: {
        statement: "Adopt trunk-based development for the web app",
        context: "Long-lived feature branches keep drifting; short-lived branches behind flags keep main releasable.",
        source: "slack · #eng-web",
        saving: true,
      },
    },
  },
  superseded: { data: ledger(SUPERSEDED, "ignored") },
  filtered: { data: ledger(RATIFIED_ONLY, "ratified") },
  empty: { data: EMPTY },
  loading: { data: DEFAULT, loading: true },
  error: { data: EMPTY, error: "The decisions ledger is temporarily unavailable. Retrying…" },
  overflow: { data: { ...ledger(OVERFLOW_DECISIONS), extras: OVERFLOW_EXTRAS } },
  stress: { data: { ...ledger(STRESS_DECISIONS), extras: STRESS_EXTRAS } },
};
