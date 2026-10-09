/* Repository-audit canvas fixtures. Lifted verbatim out of AuditPage and
   AuditFindingsChecklist, which now take required data props and ship no demo
   content of their own. Nothing here is importable by a consuming app. */

import type { AuditFinding } from "../../features/AuditFindingsChecklist";
import type { AuditData, AuditRun } from "../../pages/AuditPage";
import { fmtDateTime } from "../../tokens/format";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_DOC_TITLE, LONG_SOURCE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER_STR, HUGE_PERCENT, MIXED_SCRIPT,
  MANY_TAGS, MANY_INITIALS, LONG_BREADCRUMB,
} from "./stress";

const REPO = "acme/product-docs";
const PROVIDER = "github";
/* ISO, not display text: the checklist header formats it itself (P-AU-3).
   It used to be the string "Jul 21, 9:04 AM", which `fmtDate` could only
   echo back verbatim. */
const RAN_AT = "2026-07-21T09:04:00";
const SUMMARY = `github · ${REPO} · last audit ${fmtDateTime(RAN_AT)} · 8 findings, 1 fixed`;

const MEMBERS = [{ id: 1, name: "Aki K." }, { id: 2, name: "Dana R." }, { id: 3, name: "Priya S." }];

/* Each run carries its `id`, so the rail rows are buttons that open a run
   rather than hover affordances with nothing behind them (P-AU-2), and its
   `ranAt` as an ISO date the rail formats. */
const HISTORY: AuditRun[] = [
  { id: "run-48", label: "Latest run", detail: "8 findings · 1 fixed", ranAt: RAN_AT, current: true },
  { id: "run-47", label: "Weekly audit", detail: "12 findings · 12 fixed", ranAt: "2026-07-14T09:04:00" },
  { id: "run-41", label: "First audit", detail: "21 findings", ranAt: "2026-07-02T16:20:00" },
];

const SCANS = [
  "Localization coverage & stale translations",
  "Tag coverage and classifier suggestions",
  "Git authorship mapped to members",
  "Referenced-but-unindexed docs",
  "Markdown hygiene",
];

const FINDINGS: AuditFinding[] = [
  { id: 1, kind: "Localization", title: "onboarding.fr.md has no source translation link", detail: "French doc exists but isn't linked to its English source.", fixAction: "link_translation", status: "open" },
  { id: 2, kind: "Localization", title: "pricing.md changed: translations stale", detail: "3 locale copies are older than the source.", fixAction: "translation_task", status: "open" },
  { id: 3, kind: "Tags", title: "api-auth.md is untagged", detail: "No tags: won't surface in filtered search.", fixAction: "apply_tag", fixPayload: { tag: "reference" }, status: "open" },
  { id: 4, kind: "Tags", title: "billing.md missing 'customer-facing'", detail: "Suggested by content classifier.", fixAction: "apply_tag", fixPayload: { suggest: "customer-facing" }, status: "open" },
  { id: 5, kind: "Authorship", title: "Unknown author 'jsmith' on 6 docs", detail: "Git author not mapped to a team member.", fixAction: "invite_member", status: "open" },
  { id: 6, kind: "Coverage", title: "webhooks.md referenced but not indexed", detail: "Linked from 4 docs; never ingested.", fixAction: "ingest", status: "open" },
  { id: 7, kind: "Hygiene", title: "README.md has a broken anchor", detail: "#setup no longer exists.", fixAction: "hygiene_task", status: "open" },
  { id: 8, kind: "Hygiene", title: "changelog.md trailing whitespace", detail: "Cosmetic; safe to auto-fix.", fixAction: "hygiene_task", status: "open" },
];

const MANY: AuditFinding[] = [
  ...FINDINGS,
  { id: 9, kind: "Localization", title: "help.de.md drifted from source", detail: "German copy is 40 commits behind.", fixAction: "translation_task", status: "open" },
  { id: 10, kind: "Tags", title: "sdk-quickstart.md missing 'reference'", detail: "Classifier confidence 0.91.", fixAction: "apply_tag", fixPayload: { suggest: "reference" }, status: "open" },
  { id: 11, kind: "Authorship", title: "Unknown author 'dev-bot' on 3 docs", detail: "CI account committing docs directly.", fixAction: "invite_member", status: "open" },
  { id: 12, kind: "Coverage", title: "migration-guide.md referenced but not indexed", detail: "Linked from the changelog; never ingested.", fixAction: "ingest", status: "open" },
  { id: 13, kind: "Coverage", title: "faq.md is orphaned", detail: "No inbound links; may be dead.", fixAction: "ingest", status: "open" },
  { id: 14, kind: "Hygiene", title: "index.md has duplicate headings", detail: "Two '## Setup' sections.", fixAction: "hygiene_task", status: "open" },
];

const FIXED_MIX: AuditFinding[] = FINDINGS.map((f) =>
  f.id === 3 ? { ...f, status: "fixed" } : f.id === 8 ? { ...f, status: "dismissed" } : f,
);

const FIX_ALL: AuditFinding[] = [
  { id: 3, kind: "Tags", title: "api-auth.md is untagged", detail: "No tags: won't surface in filtered search.", fixAction: "apply_tag", fixPayload: { tag: "reference" }, status: "fixed" },
  { id: 4, kind: "Tags", title: "billing.md missing 'customer-facing'", detail: "Suggested by content classifier.", fixAction: "apply_tag", fixPayload: { suggest: "customer-facing" }, status: "fixed" },
  { id: 10, kind: "Tags", title: "sdk-quickstart.md missing 'reference'", detail: "Classifier confidence 0.91.", fixAction: "apply_tag", fixPayload: { suggest: "reference" }, status: "fixed" },
];

const MOSTLY_HANDLED: AuditFinding[] = FINDINGS.map((f, i) =>
  i < FINDINGS.length - 1 ? { ...f, status: i % 2 === 0 ? "fixed" : "dismissed" } : f,
);

const section = (kind: AuditFinding["kind"]) => MANY.filter((f) => f.kind === kind);

/* Overflow: one finding per kind, natural but very long titles + details. */
const OVERFLOW_FINDINGS: AuditFinding[] = [
  { id: 1, kind: "Localization", title: "The French onboarding document onboarding.fr.md has no source-translation link back to its consolidated English source of truth", detail: LONG_PARAGRAPH, fixAction: "link_translation", status: "open" },
  { id: 2, kind: "Tags", title: LONG_TITLE, detail: "Suggested by the content classifier after reconciling against the last four quarters of documentation drift across every service, region, and team.", fixAction: "apply_tag", fixPayload: { suggest: "customer-facing" }, status: "open" },
  { id: 3, kind: "Authorship", title: `Unknown git author "${LONG_NAME}" is credited on the platform reliability, incident-response, and on-call escalation runbook`, detail: LONG_PARAGRAPH, fixAction: "invite_member", status: "open" },
  { id: 4, kind: "Coverage", title: `${LONG_DOC_TITLE} is referenced from many documents but has never been ingested or indexed`, detail: LONG_PARAGRAPH, fixAction: "ingest", status: "open" },
  { id: 5, kind: "Hygiene", title: "The consolidated quarterly platform reliability runbook has a broken anchor that no longer resolves to any heading anywhere in the corpus", detail: LONG_PARAGRAPH, fixAction: "hygiene_task", status: "open" },
];

/* Stress: pathological — unbreakable tokens, long word, huge numbers, scripts. */
const STRESS_FINDINGS: AuditFinding[] = [
  { id: 1, kind: "Localization", title: UNBREAKABLE, detail: LONG_URL, fixAction: "link_translation", status: "open" },
  { id: 2, kind: "Tags", title: MIXED_SCRIPT, detail: LONG_WORD, fixAction: "apply_tag", fixPayload: { suggest: UNBREAKABLE }, status: "open" },
  { id: 3, kind: "Authorship", title: `${LONG_WORD} committed to ${HUGE_NUMBER_STR} docs`, detail: MIXED_SCRIPT, fixAction: "invite_member", status: "open" },
  { id: 4, kind: "Coverage", title: LONG_DOC_TITLE, detail: `Referenced ${HUGE_NUMBER_STR} times at ${HUGE_PERCENT} confidence`, fixAction: "ingest", status: "open" },
  { id: 5, kind: "Hygiene", title: LONG_WORD, detail: UNBREAKABLE, fixAction: "hygiene_task", status: "open" },
];

/* ── states ───────────────────────────────────────────────────────────────── */

const BASE: AuditData = {
  repo: REPO, provider: PROVIDER, ranAt: RAN_AT, summary: SUMMARY,
  findings: FINDINGS, members: MEMBERS,
  banner: null, history: HISTORY, scans: SCANS, extras: null,
};

const withFindings = (findings: AuditFinding[]): AuditData => ({ ...BASE, findings });

/** No repository connected: the page's own "connect a repo" check fires
    because there is genuinely nothing to audit, not because of a state flag. */
const EMPTY: AuditData = {
  ...BASE,
  repo: "",
  summary: "Connect a repo to begin.",
  findings: [],
  history: [],
  extras: null,
};

const extras = (extreme: boolean) => ({
  title: "Contributors & labels",
  crumbs: LONG_BREADCRUMB,
  tags: extreme ? [...MANY_TAGS, MIXED_SCRIPT, UNBREAKABLE] : MANY_TAGS.slice(0, 6),
  people: extreme ? MANY_INITIALS : MANY_INITIALS.slice(0, 8),
  avatarMax: extreme ? 5 : 6,
});

export const FIXTURES: PageFixtures<AuditData> = {
  default: { data: BASE },
  localization: { data: withFindings(section("Localization")) },
  tags: { data: withFindings(section("Tags")) },
  authorship: { data: withFindings(section("Authorship")) },
  coverage: { data: withFindings(section("Coverage")) },
  hygiene: { data: withFindings(section("Hygiene")) },
  fixed: { data: withFindings(FIXED_MIX) },
  "fix-all": { data: withFindings(FIX_ALL) },
  many: { data: withFindings(MANY) },
  "hide-resolved": {
    data: {
      ...withFindings(MOSTLY_HANDLED),
      banner: {
        title: "Hide resolved is on",
        body: "Fixed and dismissed findings are collapsed: only what still needs attention shows.",
      },
    },
  },
  /* A connected repo whose run has nothing left in it: every finding was
     fixed or dismissed, so the checklist has no rows to show. */
  clear: { data: withFindings([]) },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "The audit service is temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  overflow: {
    data: { ...BASE, repo: LONG_SOURCE, findings: OVERFLOW_FINDINGS, extras: extras(false) },
  },
  stress: {
    data: { ...BASE, repo: UNBREAKABLE, findings: STRESS_FINDINGS, extras: extras(true) },
  },
};
