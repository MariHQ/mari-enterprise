/* Doc Review canvas fixtures. Lifted verbatim out of DocReviewPage and the five
   review panels, which now take required data props and ship no demo content of
   their own. Nothing here is importable by a consuming app.

   The filename is camelCase for the `doc-review` page id: see the note in
   `index.ts`. */

import { fmtDate } from "../../tokens/format";
import type { DocReviewData, ReviewDoc } from "../../pages/DocReviewPage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER, HUGE_NUMBER_STR, MIXED_SCRIPT,
} from "./stress";

/* ── the document the workspace opens with ─────────────────────────────── */

/** The outline panel derives its section tree from headings, so its copy of the
    body only needs the heading skeleton. */
const OUTLINE_MD = `# Authentication Service Migration

## Overview
intro

## 2. Rollout phases
body

### Canary
body

### Ramp
body

## Risks
body`;

const EDITOR_MD = `# Authentication Service Migration

## 1. Overview
The new authentication service replaces the legacy session store with stateless JWT tokens. It is expected to reduce login latency by roughly 40% and remove the shared-session bottleneck.

Tokens are signed with RS256 and rotated every 24 hours. Downstream services validate signatures against the published JWKS endpoint.

## 2. Rollout phases
We will roll out the change in three phases across the fleet.

### 2.1 Canary
Route 5% of traffic through the new service and watch error rates for 48 hours.

### 2.2 Ramp
Increase to 50% once the canary is stable, tracking p99 latency closely.

### 2.3 Cutover
Full cutover after a clean week. The order is fixed:

1. Drain the legacy session store
2. Flip the router
3. Revoke the old signing key

## 3. Risks
- Token replay if clock skew exceeds the allowed window
  - Clock skew above 90 seconds fails validation outright
- JWKS downtime blocks all signature validation
- Rollback requires draining every active token

| Phase | Traffic | Watch for |
| --- | --- | --- |
| Canary | 5% | error rate, p99 |
| Ramp | 50% | p99 latency |
| Cutover | 100% | token replay |

> Rollback is not free: draining active tokens signs every user out.

#### Open question
Whether the 24-hour rotation cadence is a requirement or a habit.`;

const CHANGE_BODY =
  "The new authentication service replaces the legacy session store with stateless JWT tokens. " +
  "It is expected to reduce login latency by roughly 40% and remove the shared-session bottleneck. " +
  "Tokens are signed with RS256 and rotated every 24 hours. " +
  "We will roll out the change in three phases across the fleet.";

/* "Not verified" rather than a bare dash: CONVENTIONS.md §5 bans em/en dashes
   in user-visible copy. */
const NOT_VERIFIED = "Not verified";

const DOC: ReviewDoc = {
  outlineBody: OUTLINE_MD,
  revisions: [
    { id: 1, actor: "Aki Kim", verb: "edited Overview", at: "Jul 21, 2026, 2:40 PM" },
    { id: 2, actor: "Lena Shah", verb: "ran Tighten", at: "Jul 20, 2026, 4:12 PM" },
    { id: 3, actor: "Maya Chen", verb: "accepted 3 changes", at: "Jul 18, 2026, 11:03 AM" },
    { id: 4, actor: "Aki Kim", verb: "ran fact check", at: "Jul 17, 2026, 9:40 AM" },
    { id: 5, actor: "Sam Ortiz", verb: "created the document", at: "Jul 15, 2026, 2:15 PM" },
    { id: 6, actor: "Lena Shah", verb: "imported from docs", at: "Jul 15, 2026, 2:14 PM" },
  ],
  editorBody: EDITOR_MD,
  editorFindings: [
    { id: 1, kind: "fact", severity: "error", text: "reduce login latency by roughly 40%", note: "Contradicts verified fact: measured reduction was 22% in staging." },
    { id: -2, kind: "prose", severity: "warn", text: "expected to", note: "hedge" },
    { id: 3, kind: "freshness", severity: "warn", text: "rotated every 24 hours", note: "rotation cadence unverified" },
    { id: -4, kind: "prose", severity: "warn", text: "across the fleet", note: "vague scope" },
  ],
  refine: { errorN: 1, warnN: 3, advisoryN: 2 },
  changes: [
    { id: 1, original: "It is expected to reduce login latency by roughly 40%", proposed: "It reduces measured login latency by 22%", rule: "Fact check, align with staging measurement", state: "pending" },
    { id: 2, original: "roll out the change in three phases across the fleet", proposed: "roll out the change in three phases", rule: "Tighten, cut vague scope", state: "pending" },
    { id: 3, original: "replaces the legacy session store", proposed: "supersedes the legacy session store", rule: "Sharpen, stronger verb", state: "pending" },
    { id: 4, original: "remove the shared-session bottleneck", proposed: "eliminate the shared-session bottleneck", rule: "Sharpen, stronger verb", state: "accepted" },
    { id: 5, original: "signed with RS256 and rotated every 24 hours", proposed: "signed with RS256, rotated daily", rule: "Deslop, reduce wordiness", state: "rejected" },
  ],
  changeBody: CHANGE_BODY,
  findings: [
    { id: 1, kind: "fact", severity: "error", text: "reduces login latency by roughly 40%", note: "Contradicts verified fact: measured reduction was 22% in staging." },
    { id: 2, kind: "fact", severity: "warn", text: "tokens rotate every 24 hours", note: "No verified source for rotation cadence." },
    { id: 3, kind: "freshness", severity: "warn", text: "JWKS endpoint published Q1", note: "Endpoint doc last updated 8 months ago." },
  ],
  claims: [
    { claim: "Tokens are signed with RS256.", source: "Auth RFC v1.2", status: "Verified", verified: "May 1, 2024" },
    { claim: "Login latency drops by 40%.", source: "Migration brief", status: "Contradicted", verified: NOT_VERIFIED },
    { claim: "All downstream services validate against JWKS.", source: "Platform wiki", status: "Verified", verified: "Apr 12, 2024" },
    { claim: "Tokens rotate every 24 hours.", source: "No source", status: "Unsupported", verified: NOT_VERIFIED },
    { claim: "Rollback drains every active token.", source: "Runbook", status: "Verified", verified: "Mar 3, 2024" },
  ],
};

/* ── overflow / stress documents ───────────────────────────────────────── */

const OVERFLOW_DOC: ReviewDoc = {
  outlineBody: `# ${LONG_TITLE}

## Overview and scope of this consolidated operating guidance
${LONG_PARAGRAPH}

## ${LONG_TITLE}
${LONG_PARAGRAPH}

### ${LONG_DOC_TITLE}
${LONG_PARAGRAPH}`,
  revisions: [
    /* `at` is a timestamp the panel formats, not a phrase it prints. "2h ago"
       and "Yesterday" are the formatter's OUTPUT vocabulary, and "Jul 18,
       11:03 AM" parses to the year 2001. Overflow is about long strings; these
       are dates, spelled the way every other fixture spells them. */
    { id: 1, actor: LONG_NAME, verb: "reconciled the runbook against four quarters of incident retrospectives", at: "Jul 21, 2026, 2:40 PM" },
    { id: 2, actor: LONG_NAME, verb: "ran Tighten across every section of the consolidated document", at: "Jul 20, 2026, 4:12 PM" },
    { id: 3, actor: "Maya Chen", verb: "accepted 3 changes", at: "Jul 18, 2026, 11:03 AM" },
  ],
  editorBody: `# ${LONG_TITLE}

## Overview
${LONG_PARAGRAPH}

## Rollout
${LONG_PARAGRAPH}`,
  editorFindings: [
    { id: 1, kind: "fact", severity: "error", text: "re-reviewed every quarter or after any Sev-1", note: LONG_PARAGRAPH },
    { id: 2, kind: "prose", severity: "warn", text: "in exhaustive detail", note: "hedge: consider trimming this qualifier for concision across the section" },
  ],
  refine: { errorN: 12, warnN: 34, advisoryN: 21 },
  changes: [
    { id: 1, original: LONG_PARAGRAPH, proposed: "This document consolidates the operating guidance for the entire platform organization and describes the escalation ladder, the paging policy, and the post-incident review process.", rule: "Tighten: cut redundant scope-setting across the opening paragraph so responders reach the escalation ladder faster", state: "pending" },
    { id: 2, original: "It will be re-reviewed every quarter or after any Sev-1.", proposed: "It is re-reviewed each quarter and after every Sev-1 incident.", rule: "Sharpen: commit to the cadence instead of hedging with a future tense", state: "pending" },
  ],
  changeBody: LONG_PARAGRAPH,
  findings: [
    { id: 1, kind: "fact", severity: "error", text: "reconciled against the last four quarters of incident retrospectives", note: LONG_PARAGRAPH },
    { id: 2, kind: "freshness", severity: "warn", text: "reviewed by the reliability guild", note: "The reliability-guild sign-off referenced here is more than eight months old and predates the current escalation ladder." },
  ],
  claims: [
    { claim: LONG_PARAGRAPH, source: LONG_DOC_TITLE, status: "Contradicted", verified: "" },
    { claim: "Every section has been reviewed by the reliability guild and reconciled against retrospectives.", source: LONG_TITLE, status: "Verified", verified: "May 1, 2024" },
  ],
};

const STRESS_DOC: ReviewDoc = {
  outlineBody: `# ${UNBREAKABLE}

## ${MIXED_SCRIPT}
${LONG_URL}

## ${LONG_WORD}
${UNBREAKABLE}

### ${LONG_URL}
${MIXED_SCRIPT}`,
  revisions: [
    { id: 1, actor: LONG_WORD, verb: MIXED_SCRIPT, at: HUGE_NUMBER_STR },
    { id: 2, actor: MIXED_SCRIPT, verb: `edited ${UNBREAKABLE}`, at: HUGE_NUMBER_STR },
  ],
  editorBody: `# ${UNBREAKABLE}

## ${MIXED_SCRIPT}
${LONG_URL}

${UNBREAKABLE}`,
  editorFindings: [
    { id: 1, kind: "fact", severity: "error", text: UNBREAKABLE, note: `${MIXED_SCRIPT} ${LONG_URL}` },
  ],
  refine: { errorN: HUGE_NUMBER, warnN: HUGE_NUMBER, advisoryN: HUGE_NUMBER },
  changes: [
    { id: 1, original: UNBREAKABLE, proposed: LONG_WORD, rule: MIXED_SCRIPT, state: "pending" },
    { id: 2, original: LONG_URL, proposed: UNBREAKABLE, rule: HUGE_NUMBER_STR, state: "pending" },
  ],
  changeBody: `${UNBREAKABLE} ${LONG_URL} ${MIXED_SCRIPT}`,
  findings: [
    { id: 1, kind: "fact", severity: "error", text: UNBREAKABLE, note: `${MIXED_SCRIPT}, ${LONG_URL}` },
    { id: 2, kind: "freshness", severity: "warn", text: LONG_WORD, note: MIXED_SCRIPT },
  ],
  claims: [
    { claim: UNBREAKABLE, source: LONG_URL, status: "Contradicted", verified: HUGE_NUMBER_STR },
    { claim: MIXED_SCRIPT, source: LONG_WORD, status: "Unsupported", verified: "" },
  ],
};

/** A document that exists but has nothing in it yet, so the page's own
    `isEmpty` check fires rather than the canvas faking the empty state. */
const BLANK_DOC: ReviewDoc = {
  outlineBody: "", revisions: [], editorBody: "", editorFindings: [],
  refine: { errorN: 0, warnN: 0, advisoryN: 0 },
  changes: [], changeBody: "", findings: [], claims: [],
};

/* ── states ─────────────────────────────────────────────────────────────── */

const TITLE = "Billing proration runbook";
const SUBTITLE = `Owner: Maya M. · Last verified ${fmtDate("2024-05-13")}`;

/** This document's own tags. The header used to draw "canonical" and
    "verified" on every document regardless of what it was tagged; it renders
    `data.tags` or nothing now, so a fixture that omits them shows a bare
    header. */
const TAGS = ["canonical", "customer-facing"];

const workspace = (data: Partial<DocReviewData> = {}): DocReviewData => ({
  title: TITLE, subtitle: SUBTITLE, save: "saved", pane: "workspace", doc: DOC,
  tags: TAGS,
  /* Seeds the Watch button. `undefined` and the button is not drawn at all,
     so leaving it out costs the canvas that control entirely. */
  watched: false,
  /* Which of Change queue / Fact check the bottom strip opens on. It was a
     hardcoded constant; it is a deep link now. */
  bottomTab: "changes",
  ...data,
});

const DEFAULT = workspace();

export const FIXTURES: PageFixtures<DocReviewData> = {
  default: { data: DEFAULT },
  outline: { data: workspace({ pane: "outline" }) },
  editor: { data: workspace({ pane: "editor" }) },
  "change-queue": { data: workspace({ pane: "changes" }) },
  /* The one state that is about the fact check, so it is also the one that
     opens the bottom strip on it. */
  findings: { data: workspace({ pane: "findings", bottomTab: "findings", watched: true }) },
  refine: { data: workspace({ pane: "refine" }) },
  dirty: { data: workspace({ save: "dirty" }) },
  saving: { data: workspace({ save: "saving" }) },
  applied: { data: workspace({ save: "applied" }) },
  "offline-dirty": { data: workspace({ save: "offline-dirty" }) },
  loading: { data: DEFAULT, loading: true },
  error: { data: workspace({ doc: BLANK_DOC }), error: "This document can't be loaded right now." },
  /* A blank document with nothing said about it: no tags yet either, and a
     deployment that does not know whether it is watched, so neither the tag
     chips nor the Watch control are drawn. */
  empty: { data: workspace({ doc: BLANK_DOC, tags: [], watched: undefined }) },
  overflow: {
    data: workspace({
      title: LONG_TITLE,
      subtitle: `Owner: ${LONG_NAME} · Last verified across every service, region, and team`,
      tags: ["canonical", "customer-facing", "needs-review", "platform-reliability-quarterly-review", "deprecated"],
      doc: OVERFLOW_DOC,
    }),
  },
  stress: {
    data: workspace({
      title: `${UNBREAKABLE} ${MIXED_SCRIPT}`,
      subtitle: `${MIXED_SCRIPT} · ${LONG_URL}`,
      tags: [UNBREAKABLE, MIXED_SCRIPT, LONG_WORD],
      doc: STRESS_DOC,
    }),
  },
};
