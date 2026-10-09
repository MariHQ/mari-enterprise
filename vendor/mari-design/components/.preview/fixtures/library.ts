/* Library canvas fixtures. Lifted out of `pages/LibraryPage.tsx` and the five
   Library* feature panels, which are now pure presenters and ship no demo
   content of their own. */

import type { LibraryData, LibraryTab } from "../../pages/LibraryPage";
import type { TagDef } from "../../features/LibraryTagsPanel";
import type { Term } from "../../features/LibraryGlossaryPanel";
import type { Guide, VoiceLayer } from "../../features/LibraryGuidesPanel";
import type { Template } from "../../features/LibraryTemplatesPanel";
import type { CheckerDoc } from "../../features/LibraryRulesPanel";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_URL, UNBREAKABLE, LONG_WORD,
  HUGE_NUMBER, MIXED_SCRIPT, MANY_TAGS, repeat,
} from "./stress";

const TAGS: TagDef[] = [
  { id: "canonical", name: "Canonical", tone: "ok", evidence: "Preferred evidence", weight: 1.6, usage: 142, behaviors: ["Ranks first", "Trusted for facts"], standard: true, description: "The current source of truth." },
  { id: "verified", name: "Verified", tone: "info", evidence: "Trusted evidence", weight: 1.3, usage: 98, behaviors: ["Facts extracted are trusted"], standard: true, description: "Facts extracted from it are trusted." },
  { id: "customer-facing", name: "Customer-facing", tone: "info", evidence: "Surface in audits", weight: 1.0, usage: 61, behaviors: ["Published surfaces", "Audit coverage"], standard: true, description: "Approved for external and published surfaces." },
  { id: "needs-review", name: "Needs review", tone: "attention", evidence: "Flagged, not evidence", weight: 0.6, usage: 27, behaviors: ["Routed to a person"], standard: true, description: "Flagged for a person to make a judgment." },
  { id: "stale", name: "Stale", tone: "attention", evidence: "Flagged, not evidence", weight: 0.4, usage: 19, behaviors: ["Excluded from evidence"], standard: true, description: "Known to be out of date and ready for review." },
  { id: "deprecated", name: "Deprecated", tone: "blocked", evidence: "Not evidence", weight: 0.2, usage: 8, behaviors: ["Superseded"], standard: true, description: "Superseded by a newer document." },
  { id: "runbook", name: "Runbook", tone: "info", evidence: "Normal evidence", weight: 1.1, usage: 34, behaviors: ["Ops workflows"], standard: false, description: "Operational runbooks and on-call docs." },
];

const TERMS: Term[] = [
  { id: "t1", term: "Canonical", definition: "The current source of truth for a topic; evidence is preferred from it and conflicting docs defer to it.", owner: "Priya Nair", updated: "2026-07-14" },
  { id: "t2", term: "Decision chunk", definition: "A thread-sized slice of a Slack conversation that captures a single decision, participants, and outcome.", owner: "Marcus Vale", updated: "2026-07-09" },
  { id: "t3", term: "Evidence policy", definition: "The rule that governs whether facts extracted from a document are trusted, flagged, or ignored.", owner: "Priya Nair", updated: "2026-06-28" },
  { id: "t4", term: "Freshness", definition: "How recently a source was verified against reality; drives the fresh-% corpus stat and stale flags.", owner: "Dana Osei", updated: "2026-07-02" },
  { id: "t5", term: "Zero tolerance", definition: "A rule behavior that treats any match as a hard block rather than an advisory finding.", owner: "Marcus Vale", updated: "2026-05-31" },
];

const GUIDES: Guide[] = [
  { id: "plain", name: "Plain language", tone: "ok", rules: 42, description: "Direct, concise, and accessible. Prefer familiar words and active voice.", preview: ["Prefer one- or two-syllable words when they carry the meaning", "Keep sentences under 25 words", "Address the reader as “you”", "Use active voice unless the actor is unknown"] },
  { id: "microsoft", name: "Microsoft", tone: "info", rules: 38, description: "Warm, clear product writing with task-oriented language.", preview: ["Use contractions for a natural tone", "Drop “please” from direct instructions", "Use sentence case everywhere, including titles", "Bold UI labels exactly as they appear"] },
  { id: "google", name: "Google developer", tone: "attention", rules: 35, description: "Scannable technical guidance with precise, consistent terminology.", preview: ["Write in second person, present tense", "Put conditions before instructions", "Number sequences, bullet options", "Define an initialism at first mention"] },
  { id: "ap", name: "AP style", tone: "blocked", rules: 31, description: "Newsroom conventions for capitalization, numerals, names, and dates.", preview: ["Spell out one through nine, numerals for 10+", "Abbreviate months with specific dates", "Use last names on second reference", "No serial comma in a simple series"] },
  { id: "chicago", name: "Chicago", tone: "info", rules: 29, description: "Long-form editorial conventions for careful, polished prose.", preview: ["Use the serial comma", "Spell out numbers up to one hundred", "Italicize titles of standalone works", "Lowercase job titles unless they precede a name"] },
];

const VOICE: VoiceLayer = {
  voice: "Confident and plain. We explain the why before the how, and we never hype. Short sentences. Address the reader directly.",
  terms: "sign in → not login\nMari → not the assistant\nknowledge base → not KB",
  banned: "leverage, synergy, best-in-class, seamless, revolutionary",
  inclusive: true,
  jargon: true,
  sentenceCase: true,
};

const TEMPLATES: Template[] = [
  { id: "runbook", name: "Runbook", category: "Operations", icon: "clipboard", standard: true, description: "Service overview, alarms, diagnosis, rollback, escalation.", sections: ["Service overview", "Architecture and dependencies", "Alarms and thresholds", "Dashboards", "Diagnosis steps", "Mitigation", "Rollback procedure", "Escalation contacts"] },
  { id: "adr", name: "Architecture decision", category: "Engineering", icon: "git-fork", standard: true, description: "Context, decision, alternatives, and consequences.", sections: ["Context", "Decision", "Alternatives considered", "Consequences", "Rollout", "References"] },
  { id: "postmortem", name: "Postmortem", category: "Operations", icon: "shield-check", standard: true, description: "Impact, timeline, root cause, response, and follow-ups.", sections: ["Summary", "Customer impact", "Timeline", "Root cause", "Detection", "Response", "Recovery", "Lessons learned", "Follow-up actions"] },
  { id: "rfc", name: "RFC", category: "Engineering", icon: "file-text", standard: true, description: "Problem, goals, proposal, risks, and rollout plan.", sections: ["Problem statement", "Goals", "Non-goals", "Proposal", "Risks and mitigations", "Rollout plan", "Open questions"] },
  { id: "onboarding", name: "Onboarding guide", category: "Team", icon: "sprout", standard: true, description: "Context, first-week checklist, people, tools, and milestones.", sections: ["Welcome and context", "First-week checklist", "People to meet", "Tools and access", "Codebase tour", "First tasks", "30/60/90 milestones"] },
  { id: "api", name: "API reference page", category: "Product", icon: "book-open", standard: true, description: "Endpoint purpose, request, response, errors, and examples.", sections: ["Endpoint purpose", "Authentication", "Request", "Response", "Errors", "Examples"] },
  { id: "release", name: "Release notes", category: "Product", icon: "megaphone", standard: true, description: "What changed, who it helps, migration notes, and links.", sections: ["Highlights", "What changed", "Who it helps", "Migration notes", "Links"] },
  { id: "security", name: "Security policy", category: "Governance", icon: "shield-check", standard: true, description: "Supported versions, reporting, disclosure, and response.", sections: ["Supported versions", "Reporting a vulnerability", "Disclosure policy", "Response targets", "Scope", "Safe harbor"] },
];

const CHECKER_DOCS: CheckerDoc[] = [
  {
    id: "runbook",
    label: "Payments runbook",
    source: "github · docs/runbooks/payments.md",
    text: "# Handling Payment Incidents\n\nIt's worth noting that our payments flow is seamless in order to reduce friction. When an alarm fires, you guys should delve into the dashboards very carefully. The transaction is processed and the record is written before the customer is notified. Please login to the console to whitelist the affected merchant.",
  },
  {
    id: "release",
    label: "Release notes",
    source: "notion · Product / Release notes",
    text: "# What Changed This Week\n\nWe shipped a seamless new onboarding flow. The migration is handled automatically and no action is required. Run a sanity check on your integrations before you sign in.",
  },
  {
    id: "clean",
    label: "Clean sample",
    source: "docs · style/example.md",
    text: "# Sign in to the console\n\nOpen the console and sign in. The service writes the record, then notifies the customer. If an alarm fires, open the dashboards and check the failed transaction.",
  },
];

const COUNTS: Record<LibraryTab, number> = {
  tags: 12, rules: 170, glossary: 34, guides: 5, templates: 9,
};

const BASE: LibraryData = {
  tab: "tags",
  tags: TAGS,
  totalDocs: 420,
  checkerDocs: CHECKER_DOCS,
  workspace: "Northwind",
  terms: TERMS,
  guides: GUIDES,
  defaultPack: "plain",
  voice: VOICE,
  templates: TEMPLATES,
  counts: COUNTS,
};

/** A brand-new workspace: every collection genuinely empty, so the page's own
    `isEmpty` check fires. */
const EMPTY: LibraryData = {
  ...BASE,
  tags: [], terms: [], guides: [], templates: [], checkerDocs: [],
  counts: { tags: 0, rules: 0, glossary: 0, guides: 0, templates: 0 },
};

/* Per-tab empties: the workspace has other sections, this one is unpopulated,
   so the panel renders its own empty state. */
const at = (tab: LibraryTab, over: Partial<LibraryData> = {}): { data: LibraryData } =>
  ({ data: { ...BASE, tab, ...over } });

function strained(extreme: boolean): LibraryData {
  const tags: TagDef[] = extreme
    ? [
        { id: "s1", name: UNBREAKABLE, tone: "blocked", evidence: UNBREAKABLE, weight: HUGE_NUMBER, usage: HUGE_NUMBER, behaviors: MANY_TAGS, standard: false, description: LONG_URL },
        { id: "s2", name: LONG_WORD, tone: "info", evidence: LONG_URL, weight: 1, usage: 12847392, behaviors: [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT], standard: false, description: MIXED_SCRIPT },
      ]
    : [
        { id: "canonical", name: "Canonical: consolidated across every service, region, and on-call team", tone: "ok", evidence: "Preferred evidence, superseding all prior evidence policies across the org", weight: 1.6, usage: 142, behaviors: ["Ranks first in every search surface and published documentation site", "Trusted for facts extracted during the quarterly reliability review"], standard: true, description: LONG_PARAGRAPH },
        { id: "incident-response", name: "Incident-response and on-call escalation runbook", tone: "attention", evidence: "Flagged for a human reviewer, never used as silent evidence", weight: 0.6, usage: 27, behaviors: ["Routed to the reliability guild for a judgment call", "Re-reviewed every quarter or immediately after any Sev-1 incident"], standard: true, description: LONG_TITLE },
        { id: "runbook", name: LONG_TITLE, tone: "info", evidence: "Operational runbooks and on-call documentation for every service tier", weight: 1.1, usage: 34, behaviors: ["Operational workflows", "On-call escalation ladder"], standard: false, description: LONG_PARAGRAPH },
      ];

  const terms: Term[] = extreme
    ? [
        { id: "s1", term: UNBREAKABLE, definition: LONG_URL, owner: LONG_WORD, updated: "2026-07-14" },
        { id: "s2", term: LONG_WORD, definition: `${MIXED_SCRIPT} ${UNBREAKABLE}`, owner: MIXED_SCRIPT, updated: "2026-07-01" },
      ]
    : [
        { id: "t1", term: "Escalation ladder and paging policy: the consolidated runbook definition", definition: LONG_PARAGRAPH, owner: LONG_NAME, updated: "2026-07-14" },
        { id: "t2", term: LONG_TITLE, definition: LONG_PARAGRAPH, owner: LONG_NAME, updated: "2026-07-09" },
      ];

  const templates: Template[] = extreme
    ? [
        { id: "s1", name: UNBREAKABLE, category: "Governance", description: LONG_URL, sections: [UNBREAKABLE, LONG_URL, LONG_WORD, MIXED_SCRIPT], standard: false, icon: "file-text" },
        { id: "s2", name: LONG_WORD, category: "Engineering", description: MIXED_SCRIPT, sections: MANY_TAGS, standard: false, icon: "file-text" },
      ]
    : [
        { id: "o1", name: LONG_TITLE, category: "Operations", description: LONG_PARAGRAPH, sections: repeat((i) => `${i + 1}. Escalation ladder, paging policy, severity rubric, and communication templates for responders`, 10), standard: true, icon: "file-text" },
        { id: "o2", name: "Consolidated platform reliability and incident-response scaffold", category: "Governance", description: LONG_TITLE, sections: repeat((i) => `Reviewed section ${i + 1}: reconciled against the last four quarters of incident retrospectives`, 8), standard: false, icon: "file-text" },
      ];

  const guides: Guide[] = repeat((i) => ({
    id: `g${i}`,
    name: extreme ? UNBREAKABLE : LONG_TITLE,
    tone: (["ok", "info", "attention"] as const)[i % 3],
    rules: extreme ? HUGE_NUMBER : 42,
    description: extreme ? `${LONG_WORD} ${MIXED_SCRIPT}` : LONG_PARAGRAPH,
    preview: extreme ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT] : repeat(() => LONG_TITLE, 4),
  }), 2);

  return {
    ...BASE,
    tab: "tags",
    tags,
    totalDocs: extreme ? HUGE_NUMBER : 420,
    terms,
    templates,
    guides,
    defaultPack: "g0",
    workspace: extreme ? UNBREAKABLE : LONG_NAME,
    checkerDocs: [
      { id: "d1", label: extreme ? UNBREAKABLE : LONG_TITLE, source: extreme ? UNBREAKABLE : LONG_URL, text: extreme ? `${UNBREAKABLE} ${MIXED_SCRIPT}` : LONG_PARAGRAPH },
    ],
    voice: extreme
      ? { ...VOICE, voice: `${UNBREAKABLE} ${MIXED_SCRIPT}`, terms: UNBREAKABLE, banned: LONG_WORD }
      : { ...VOICE, voice: LONG_PARAGRAPH, terms: LONG_TITLE, banned: LONG_TITLE },
    counts: {
      tags: tags.length, rules: extreme ? HUGE_NUMBER : 170,
      glossary: terms.length, guides: guides.length, templates: templates.length,
    },
  };
}

export const FIXTURES: PageFixtures<LibraryData> = {
  default: at("tags"),
  rules: at("rules"),
  glossary: at("glossary"),
  guides: at("guides"),
  templates: at("templates"),
  "tags-empty": at("tags", { tags: [], counts: { ...COUNTS, tags: 0 } }),
  "glossary-empty": at("glossary", { terms: [], counts: { ...COUNTS, glossary: 0 } }),
  "templates-empty": at("templates", { templates: [], counts: { ...COUNTS, templates: 0 } }),
  "guides-empty": at("guides", { guides: [], counts: { ...COUNTS, guides: 0 } }),
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "The library is temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
