/* Facts canvas fixtures. Lifted verbatim out of FactsPage, FactsVerification-
   Audit and ImpactPanelFeature, which now take required data props and ship no
   demo content of their own. Nothing here is importable by a consuming app. */

import type { ImpactDoc } from "../../data-display/ImpactPanel";
import type { Fact } from "../../features/FactsVerificationAudit";
import type {
  FactFilter, FactImpact, FactTaskAudit, FactsData, FactsExtras,
} from "../../pages/FactsPage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_SOURCE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER_STR, HUGE_PERCENT, MIXED_SCRIPT,
  MANY_TAGS, MANY_INITIALS, LONG_BREADCRUMB,
} from "./stress";

/* `status` is what the tab keeps, so the row filters the table it sits above.
   "Stale" carries none: staleness is derived from verification age rather than
   stored on a claim, and the states that show it arrive pre-filtered. */
const FILTERS: FactFilter[] = [
  { id: "all", label: "All", count: 9 },
  { id: "verified", label: "Verified", count: 6, status: "Verified" },
  { id: "review", label: "Needs review", count: 2, status: "Needs review" },
  { id: "contradicted", label: "Contradicted", count: 1, status: "Contradicted" },
  { id: "stale", label: "Stale", count: 2 },
];

const FACTS: Fact[] = [
  { id: 1, claim: "Free tier includes 3 connected sources.", source: "Pricing page", owner: "Aki K.", status: "Verified", verified: "2026-07-18" },
  { id: 2, claim: "SSO is available on the Team plan and above.", source: "Sales deck", owner: "Dana R.", status: "Verified", verified: "2026-07-02" },
  { id: 3, claim: "Data is encrypted at rest with AES-256.", source: "Security whitepaper", owner: "Priya S.", status: "Verified", verified: "2026-05-30" },
  { id: 4, claim: "The scheduler polls twice a minute.", source: "Flows docs", owner: "Aki K.", status: "Verified", verified: "2026-04-11" },
  { id: 5, claim: "Uploaded PDFs are OCR'd on ingest.", source: "Sources docs", owner: "Dana R.", status: "Verified", verified: "2026-02-20" },
  { id: 6, claim: "Data is retained for 90 days on the free tier.", source: "Legal FAQ", owner: "Priya S.", status: "Verified", verified: "2026-06-14" },
  { id: 7, claim: "Support SLA is 1 business day.", source: "Support page", owner: "Aki K.", status: "Needs review", verified: null },
  { id: 8, claim: "Beta regions include eu-west and us-east.", source: "Roadmap", owner: "Priya S.", status: "Needs review", verified: null },
  { id: 9, claim: "The API rate limit is 1000 requests/min.", source: "Old changelog", owner: "Dana R.", status: "Contradicted", verified: "2026-01-08" },
];

const MANY: Fact[] = [
  ...FACTS,
  { id: 10, claim: "Webhooks retry three times with backoff.", source: "Integrations docs", owner: "Aki K.", status: "Verified", verified: "2026-06-30" },
  { id: 11, claim: "Custom domains require a paid plan.", source: "Billing page", owner: "Dana R.", status: "Verified", verified: "2026-05-11" },
  { id: 12, claim: "Search covers up to 50k documents per workspace.", source: "Limits table", owner: "Priya S.", status: "Verified", verified: "2026-03-22" },
];

/* The verification audit derives its own stale candidates from whatever facts
   it is given, so it gets its own list: a mix of verified, draft and
   needs-evidence claims spanning five months of verification dates. */
const AUDIT_FACTS: Fact[] = [
  { id: 1, claim: "Free tier includes 3 connected sources.", source: "Pricing page", owner: "Aki K.", status: "Verified", verified: "2026-07-18" },
  { id: 2, claim: "SSO is available on the Team plan and above.", source: "Sales deck", owner: "Dana R.", status: "Verified", verified: "2026-07-02" },
  { id: 3, claim: "Data is encrypted at rest with AES-256.", source: "Security whitepaper", owner: "Priya S.", status: "Verified", verified: "2026-05-30" },
  { id: 4, claim: "The scheduler polls twice a minute.", source: "Flows docs", owner: "Aki K.", status: "Verified", verified: "2026-04-11" },
  { id: 5, claim: "Uploaded PDFs are OCR'd on ingest.", source: "Sources docs", owner: "Dana R.", status: "Verified", verified: "2026-02-20" },
  { id: 6, claim: "Beta regions include eu-west and us-east.", source: "Roadmap", owner: "Priya S.", status: "Draft", verified: null },
  { id: 7, claim: "Support SLA is 1 business day.", source: "Support page", owner: "Aki K.", status: "Needs evidence", verified: null },
];

/* Overflow: natural but very long text — multi-sentence claims, long owner
   names, long sources. Exercises wrapping / truncation / line-clamp. */
const OVERFLOW_FACTS: Fact[] = [
  { id: 1, claim: LONG_PARAGRAPH, source: LONG_SOURCE, owner: LONG_NAME, status: "Verified", verified: "2026-05-30" },
  { id: 2, claim: LONG_TITLE, source: "Consolidated reliability, incident-response, and on-call escalation runbook: superseding all prior drafts", owner: LONG_NAME, status: "Needs review", verified: null },
  { id: 3, claim: "The platform reliability guild reconciles every claim against the last four quarters of incident retrospectives before it is marked verified, and re-reviews after any Sev-1 incident anywhere in the fleet.", source: LONG_SOURCE, owner: LONG_NAME, status: "Verified", verified: "2026-06-14" },
];

/* Stress: pathological content — unbreakable tokens, a single long word, huge
   numbers, mixed scripts + emoji. Exercises horizontal overflow. */
const STRESS_FACTS: Fact[] = [
  { id: 1, claim: UNBREAKABLE, source: LONG_URL, owner: LONG_WORD, status: "Verified", verified: "2026-05-30" },
  { id: 2, claim: MIXED_SCRIPT, source: LONG_DOC_TITLE, owner: MIXED_SCRIPT, status: "Needs review", verified: null },
  { id: 3, claim: `${LONG_WORD}, ${HUGE_NUMBER_STR} requests/min at ${HUGE_PERCENT} availability`, source: UNBREAKABLE, owner: LONG_NAME, status: "Verified", verified: "2026-06-14" },
];

const IMPACT_DOCS: ImpactDoc[] = [
  { title: "Pricing & Plans", source: "gdocs · handbook", severity: "update-required", reason: "States the free tier caps at 3 seats; this claim raises it to 5." },
  { title: "Onboarding checklist", source: "notion · CS", severity: "review", reason: "Mentions seat limits in step 4; may need a wording pass." },
  { title: "Sales one-pager", source: "slack · #gtm", severity: "minor", reason: "References 'small teams' loosely; likely unaffected." },
];

const impact = (analyzed: boolean): FactImpact => ({
  title: "Free tier includes 3 connected sources.",
  claim: "The free tier includes up to 5 seats per workspace.",
  source: "github · billing/limits.ts",
  verifiedAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
  summary: "3 documents reference the free-tier seat limit. Raising it to 5 makes one of them stale and puts another up for review.",
  docs: IMPACT_DOCS,
  analyzed,
});

const taskAudit = (phase: FactTaskAudit["phase"]): FactTaskAudit => ({
  title: "Verification audit",
  hint: "1 verified more than 60 days ago: stale candidate.",
  claim: "Uploaded PDFs are OCR'd on ingest.",
  meta: "Sources docs · Dana R.",
  verified: "2026-02-20",
  age: "148d ago",
  statusLabel: "Stale candidate",
  phase,
  errorText: "Couldn’t reach Mari.",
});

const extras = (extreme: boolean): FactsExtras => ({
  title: "Owners & tags",
  crumbs: LONG_BREADCRUMB,
  tags: extreme ? [...MANY_TAGS, MIXED_SCRIPT, UNBREAKABLE] : MANY_TAGS.slice(0, 6),
  people: extreme ? MANY_INITIALS : MANY_INITIALS.slice(0, 8),
  avatarMax: extreme ? 5 : 6,
});

/* ── states ───────────────────────────────────────────────────────────────── */

const BASE: FactsData = {
  filters: FILTERS,
  filter: "all",
  facts: FACTS,
  banner: null,
  audit: null,
  taskAudit: null,
  impact: null,
  extras: null,
};

const view = (over: Partial<FactsData>): FactsData => ({ ...BASE, ...over });

/** A workspace with no facts at all: every collection genuinely empty, so the
    page's own `isEmpty` check fires rather than a state flag. */
const EMPTY: FactsData = view({ facts: [] });

export const FIXTURES: PageFixtures<FactsData> = {
  default: { data: view({ audit: AUDIT_FACTS }) },
  verified: { data: view({ filter: "verified", facts: FACTS.filter((f) => f.status === "Verified") }) },
  review: { data: view({ filter: "review", facts: FACTS.filter((f) => f.status === "Needs review") }) },
  contradicted: {
    data: view({
      filter: "contradicted",
      facts: FACTS.filter((f) => f.status === "Contradicted"),
      banner: {
        title: "1 fact is contradicted by a newer source",
        body: "A more recent document conflicts with this claim. Re-verify or supersede it.",
      },
    }),
  },
  stale: { data: view({ filter: "stale", facts: [], audit: AUDIT_FACTS }) },
  impact: { data: view({ filter: "verified", facts: [], impact: impact(false) }) },
  "impact-analyzed": { data: view({ filter: "verified", facts: [], impact: impact(true) }) },
  "task-creating": { data: view({ filter: "stale", facts: [], taskAudit: taskAudit("creating") }) },
  "task-done": { data: view({ filter: "stale", facts: [], taskAudit: taskAudit("done") }) },
  "task-error": { data: view({ filter: "stale", facts: [], taskAudit: taskAudit("error") }) },
  single: { data: view({ facts: [FACTS[0]] }) },
  many: { data: view({ facts: MANY }) },
  empty: { data: EMPTY },
  loading: { data: BASE, loading: true },
  error: { data: EMPTY, error: "The facts service is temporarily unavailable. Retrying…" },
  overflow: { data: view({ facts: OVERFLOW_FACTS, audit: OVERFLOW_FACTS, extras: extras(false) }) },
  stress: { data: view({ facts: STRESS_FACTS, audit: STRESS_FACTS, extras: extras(true) }) },
};
