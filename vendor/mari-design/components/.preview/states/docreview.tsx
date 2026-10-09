import type { ComponentSpec } from "./types";
import {
  DOC_EDITOR_BODY, DOC_EDITOR_FINDINGS, DOC_OUTLINE_BODY, DOC_REVISIONS,
  DOC_CHANGES, DOC_CHANGE_BODY, DOC_FINDINGS, DOC_CLAIMS,

  MARKDOWN_SOURCE, MARKDOWN_FINDINGS,
} from "../fixtures/features";
import {
  DocReviewMarkdown, DocReviewEditor, DocReviewFindingsPanel,
  DocReviewChangeQueue, DocReviewRefinePanel, DocReviewOutlinePanel,
} from "../../features";

/* State matrix for the docreview group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks. */

const LONG =
  "Quarterly revenue recognition policy for multi-year enterprise authentication agreements with usage-based true-ups and a staged regional rollout";
const HUGE =
  "Supercalifragilisticexpialidocious_configuration_parameter_value_that_never_wraps_anywhere";

/* ————— markdown fixtures ————— */

const MD = `# Authentication Service Migration

##1. Overview
The new authentication service replaces the legacy session store with stateless **JWT** tokens. It is expected to reduce login latency by roughly 40% and remove the shared-session bottleneck.

Tokens are signed with \`RS256\` and rotated every 24 hours.

## 2. Rollout phases
- Canary at *5%* of traffic for 48 hours
- Ramp to 50% once the canary is stable
- Full cutover after a clean week

\`\`\`bash
POST /auth/token
Authorization: Basic <credentials>
\`\`\`
`;

const MD_LONG = `# ${LONG}

## ${LONG}
${LONG}. ${LONG}. The unbreakable identifier is ${HUGE} and it must not push the frame open.

- ${LONG}
- ${HUGE}

\`\`\`bash
GET /auth/${HUGE}?scope=${HUGE}
\`\`\`
`;

const MD_HEADINGS = `# Root

## One
a

## Two
b

### Two point one
c

### Two point two
d

## 3. Already numbered
e

## Four
f

### Four point one
g

## ${LONG}
h

### ${HUGE}
i
`;

/* ————— findings / claims / changes ————— */

const FINDINGS = [
  { id: 1, kind: "fact", severity: "error", text: "reduce login latency by roughly 40%", note: "Contradicts verified fact: measured reduction was 22%." },
  { id: -2, kind: "prose", severity: "warn", text: "expected to", note: "hedge" },
  { id: 3, kind: "freshness", severity: "warn", text: "every 24 hours", note: "rotation cadence unverified" },
];

const MANY_FINDINGS = [
  ...FINDINGS,
  { id: 4, kind: "fact", severity: "error", text: "stateless", note: "Contradicts verified fact: a refresh-token table is still read on every renewal." },
  { id: 5, kind: "prose", severity: "warn", text: "roughly", note: "hedge" },
  { id: 6, kind: "freshness", severity: "warn", text: "Full cutover", note: "cutover date last confirmed 9 months ago" },
  { id: 7, kind: "fact", severity: "warn", text: "Canary at", note: "No verified source for the canary percentage." },
  { id: 8, kind: "prose", severity: "warn", text: "remove the shared-session bottleneck", note: "hedge" },
  { id: 9, kind: "freshness", severity: "warn", text: "Ramp to 50%", note: "ramp plan is 11 months old" },
  { id: 10, kind: "fact", severity: "error", text: LONG, note: `Contradicts verified fact: ${LONG}` },
];

const CLAIMS = [
  { claim: "Tokens are signed with RS256.", source: "Auth RFC v1.2", status: "Verified", verified: "May 1, 2024" },
  { claim: "Login latency drops by 40%.", source: "Migration brief", status: "Contradicted", verified: "Not verified" },
  { claim: "All downstream services validate against JWKS.", source: "Platform wiki", status: "Verified", verified: "Apr 12, 2024" },
  { claim: "Tokens rotate every 24 hours.", source: "No source", status: "Unsupported", verified: "Not verified" },
  { claim: "Rollback drains every active token.", source: "Runbook", status: "Verified", verified: "Mar 3, 2024" },
];

const LONG_CLAIMS = [
  { claim: `${LONG}.`, source: LONG, status: "Contradicted", verified: "Not verified" },
  { claim: HUGE, source: HUGE, status: "Unsupported", verified: "Not verified" },
  ...CLAIMS,
  ...CLAIMS.map((c, i) => ({ ...c, claim: `${c.claim} (duplicate ${i + 1})` })),
];

type ChangeState = "pending" | "accepted" | "rejected";
const CHANGES: { id: number; original: string; proposed: string; rule: string; state: ChangeState }[] = [
  { id: 1, original: "It is expected to reduce login latency by roughly 40%", proposed: "It reduces measured login latency by 22%", rule: "Fact check, align with staging measurement", state: "pending" },
  { id: 2, original: "roll out the change in three phases across the fleet", proposed: "roll out the change in three phases", rule: "Tighten, cut vague scope", state: "pending" },
  { id: 3, original: "replaces the legacy session store", proposed: "supersedes the legacy session store", rule: "Sharpen, stronger verb", state: "pending" },
  { id: 4, original: "remove the shared-session bottleneck", proposed: "eliminate the shared-session bottleneck", rule: "Sharpen, stronger verb", state: "accepted" },
  { id: 5, original: "signed with RS256 and rotated every 24 hours", proposed: "signed with RS256, rotated daily", rule: "Deslop, reduce wordiness", state: "rejected" },
];

const LONG_CHANGES: typeof CHANGES = [
  { id: 1, original: `${LONG} ${HUGE}`, proposed: `${LONG} rewritten in place with ${HUGE}`, rule: `Fact check, ${LONG}`, state: "pending" },
  ...CHANGES.map((c) => ({ ...c, id: c.id + 10 })),
];

const REVISIONS = [
  { id: 1, actor: "Aki Kim", verb: "edited Overview", at: "Jul 21, 2026, 2:40 PM" },
  { id: 2, actor: "Lena Shah", verb: "ran Tighten", at: "Jul 20, 2026, 4:12 PM" },
  { id: 3, actor: "Maya Chen", verb: "accepted 3 changes", at: "Jul 18, 2026, 11:03 AM" },
  { id: 4, actor: "Aki Kim", verb: "ran fact check", at: "Jul 17, 2026, 9:40 AM" },
  { id: 5, actor: "Sam Ortiz", verb: "created the document", at: "Jul 15, 2026, 2:15 PM" },
  { id: 6, actor: "Lena Shah", verb: "imported from docs", at: "Jul 15, 2026, 2:14 PM" },
];

const LONG_REVISIONS = [
  { id: 1, actor: "Aleksandra Konstantinopoulou-Whitfield", verb: `ran ${LONG}`, at: "Jul 21, 2026, 4:12 PM" },
  { id: 2, actor: "Sam Ortiz", verb: HUGE, at: "Jul 20, 2026, 9:00 AM" },
  ...REVISIONS.map((r) => ({ ...r, id: r.id + 10 })),
];

/* ── Volume fixtures ──────────────────────────────────────────────────────
   The `stress` state of each spec is the realistic worst case: a 600-line
   document, 400 findings, 300 proposed changes, 500 extracted claims. */

const HUGE_MD = `# ${LONG}\n\n` + Array.from({ length: 60 }, (_, i) => (
  `## ${i + 1}. Section ${i + 1}\n${LONG}. The identifier ${HUGE} must not push the frame open.\n\n- ${LONG}\n- Bullet ${i + 1}\n\n\`\`\`bash\nGET /auth/${HUGE}?scope=${HUGE}\n\`\`\`\n`
)).join("\n");

const HUGE_FINDINGS = Array.from({ length: 400 }, (_, i) => ({
  id: i + 1,
  kind: ["fact", "prose", "freshness"][i % 3],
  severity: (["error", "warn", "advisory"] as const)[i % 3],
  text: i % 7 === 0 ? LONG : ["reduce login latency", "expected to", "every 24 hours", "seamless", "stateless"][i % 5],
  note: i % 5 === 0 ? `Contradicts verified fact: ${LONG}` : "No verified source for this claim.",
}));

const HUGE_CLAIMS = Array.from({ length: 500 }, (_, i) => ({
  claim: i % 9 === 0 ? `${LONG}.` : `Claim ${i + 1}: tokens are signed with RS256.`,
  source: i % 11 === 0 ? HUGE : `Auth RFC v1.${i % 9}`,
  status: ["Verified", "Contradicted", "Unsupported"][i % 3],
  verified: i % 3 === 0 ? "May 1, 2024" : "Not verified",
}));

const HUGE_CHANGES: typeof CHANGES = Array.from({ length: 300 }, (_, i) => ({
  id: i + 1,
  original: i % 8 === 0 ? `${LONG} ${HUGE}` : `It is expected to reduce login latency by roughly ${40 + i}%`,
  proposed: i % 8 === 0 ? `${LONG} rewritten in place` : `It reduces measured login latency by ${20 + i}%`,
  rule: i % 4 === 0 ? `Fact check, ${LONG}` : "Tighten, cut vague scope",
  state: (["pending", "pending", "pending", "accepted", "rejected"] as ChangeState[])[i % 5],
}));

const HUGE_REVISIONS = Array.from({ length: 400 }, (_, i) => ({
  id: i + 1,
  actor: i % 3 === 0 ? "Aleksandra Konstantinopoulou-Whitfield" : "Aki Kim",
  verb: i % 7 === 0 ? `ran ${LONG}` : `accepted ${i + 1} changes`,
  at: "Jul 21, 2026, 2:40 PM",
}));

export const DOCREVIEW: ComponentSpec[] = [
  {
    id: "DocReviewMarkdown", title: "DocReviewMarkdown", width: 880,
    states: [
      { id: "default", label: "Default (Parse tab)", node: <DocReviewMarkdown markdown={MARKDOWN_SOURCE} findings={MARKDOWN_FINDINGS} /> },
      { id: "serialize", label: "Variant: Serialize tab", node: <DocReviewMarkdown markdown={MARKDOWN_SOURCE} findings={MARKDOWN_FINDINGS} defaultTab="roundtrip" /> },
      { id: "decorate", label: "Variant: Decorate tab", node: <DocReviewMarkdown markdown={MARKDOWN_SOURCE} findings={MARKDOWN_FINDINGS} defaultTab="decorate" /> },
      { id: "decorate-many", label: "Variant: Decorate tab, too many findings", node: <DocReviewMarkdown markdown={MARKDOWN_SOURCE} defaultTab="decorate" findings={MANY_FINDINGS} /> },
      { id: "diff", label: "Variant: Word diff tab", node: <DocReviewMarkdown markdown={MARKDOWN_SOURCE} findings={MARKDOWN_FINDINGS} defaultTab="diff" /> },
      { id: "loading", label: "Loading", node: <DocReviewMarkdown markdown={MARKDOWN_SOURCE} findings={MARKDOWN_FINDINGS} loading /> },
      { id: "empty", label: "Empty document, no findings", node: <DocReviewMarkdown markdown="" findings={[]} /> },
      { id: "headings", label: "Heading-heavy doc", node: <DocReviewMarkdown markdown={MD_HEADINGS} findings={[]} /> },
      { id: "many", label: "Overflow: far too many findings", node: <DocReviewMarkdown markdown={MD} findings={MANY_FINDINGS} /> },
      { id: "long", label: "Overflow: long text + 90-char unbreakable string", node: <DocReviewMarkdown markdown={MD_LONG} findings={MANY_FINDINGS} /> },
      { id: "stress", label: "Volume: 600-line document, 400 findings", node: <DocReviewMarkdown markdown={HUGE_MD} findings={HUGE_FINDINGS} /> },
      { id: "narrow", label: "Overflow: narrow 320px frame", width: 320, node: <DocReviewMarkdown markdown={MD_LONG} findings={MANY_FINDINGS} /> },
    ],
  },
  {
    id: "DocReviewFindingsPanel", title: "DocReviewFindingsPanel", width: 480,
    states: [
      { id: "default", label: "Default (Fact check tab)", node: <DocReviewFindingsPanel findings={DOC_FINDINGS} claims={DOC_CLAIMS} /> },
      { id: "claims", label: "Variant: All claims tab", node: <DocReviewFindingsPanel findings={DOC_FINDINGS} claims={DOC_CLAIMS} defaultTab="claims" /> },
      { id: "claims-long", label: "Variant: All claims, long text", node: <DocReviewFindingsPanel findings={DOC_FINDINGS} defaultTab="claims" claims={LONG_CLAIMS} /> },
      { id: "loading", label: "Loading", node: <DocReviewFindingsPanel findings={[]} claims={[]} loading /> },
      { id: "empty", label: "Empty: no findings, no claims", node: <DocReviewFindingsPanel findings={[]} claims={[]} /> },
      { id: "clean", label: "No contradiction, claims all verified", node: <DocReviewFindingsPanel findings={FINDINGS.filter((f) => f.severity !== "error")} claims={CLAIMS.filter((c) => c.status === "Verified")} /> },
      { id: "many", label: "Overflow: too many findings and claims", node: <DocReviewFindingsPanel findings={MANY_FINDINGS} claims={LONG_CLAIMS} /> },
      { id: "long", label: "Overflow: long claim text + unbreakable string", node: <DocReviewFindingsPanel findings={[{ id: 1, kind: "fact", severity: "error", text: LONG, note: `Contradicts verified fact: ${LONG} ${HUGE}` }]} claims={LONG_CLAIMS} /> },
      { id: "stress", label: "Volume: 400 findings, 500 claims", node: <DocReviewFindingsPanel defaultTab="claims" findings={HUGE_FINDINGS} claims={HUGE_CLAIMS} /> },
      { id: "narrow", label: "Overflow: narrow 320px frame", width: 320, node: <DocReviewFindingsPanel findings={MANY_FINDINGS} claims={LONG_CLAIMS} /> },
    ],
  },
  {
    id: "DocReviewRefinePanel", title: "DocReviewRefinePanel", width: 380,
    states: [
      { id: "default", label: "Default", node: <DocReviewRefinePanel /> },
      { id: "loading", label: "Loading", node: <DocReviewRefinePanel loading /> },
      { id: "empty", label: "Empty: no findings", node: <DocReviewRefinePanel errorN={0} warnN={0} advisoryN={0} /> },
      { id: "many", label: "Overflow: four-digit tallies", node: <DocReviewRefinePanel errorN={1284} warnN={9612} advisoryN={4470} /> },
      { id: "stress", label: "Volume: six-digit tallies", node: <DocReviewRefinePanel errorN={128402} warnN={961244} advisoryN={447019} /> },
      { id: "narrow", label: "Overflow: narrow 320px frame", width: 320, node: <DocReviewRefinePanel errorN={128} warnN={961} advisoryN={447} /> },
    ],
  },
  {
    id: "DocReviewOutlinePanel", title: "DocReviewOutlinePanel", width: 340,
    states: [
      { id: "default", label: "Default", node: <DocReviewOutlinePanel body={DOC_OUTLINE_BODY} revisions={DOC_REVISIONS} /> },
      { id: "loading", label: "Loading", node: <DocReviewOutlinePanel body={DOC_OUTLINE_BODY} revisions={[]} loading /> },
      { id: "empty", label: "Empty: no headings, no revisions", node: <DocReviewOutlinePanel body="Just a paragraph, no headings at all." revisions={[]} /> },
      { id: "deep", label: "Deep outline with own-numbered headings", node: <DocReviewOutlinePanel body={MD_HEADINGS} revisions={REVISIONS} /> },
      { id: "many", label: "Overflow: long headings, long revisions", node: <DocReviewOutlinePanel body={MD_LONG} revisions={LONG_REVISIONS} /> },
      { id: "stress", label: "Volume: 60 headings, 400 revisions", node: <DocReviewOutlinePanel body={HUGE_MD} revisions={HUGE_REVISIONS} /> },
      { id: "narrow", label: "Overflow: narrow 320px frame", width: 320, node: <DocReviewOutlinePanel body={MD_LONG} revisions={LONG_REVISIONS} /> },
    ],
  },
  {
    id: "DocReviewChangeQueue", title: "DocReviewChangeQueue", width: 760,
    states: [
      { id: "default", label: "Default (Review before apply)", node: <DocReviewChangeQueue changes={DOC_CHANGES} body={DOC_CHANGE_BODY} /> },
      { id: "all", label: "Variant: All changes tab", node: <DocReviewChangeQueue changes={DOC_CHANGES} body={DOC_CHANGE_BODY} defaultTab="all" /> },
      { id: "loading", label: "Loading", node: <DocReviewChangeQueue changes={[]} body={DOC_CHANGE_BODY} loading /> },
      { id: "empty", label: "Empty: nothing proposed", node: <DocReviewChangeQueue changes={[]} body={DOC_CHANGE_BODY} /> },
      { id: "resolved", label: "All changes already resolved", node: <DocReviewChangeQueue changes={CHANGES.filter((c) => c.state !== "pending")} body={DOC_CHANGE_BODY} /> },
      { id: "long", label: "Overflow: long diff + unbreakable string", node: <DocReviewChangeQueue changes={LONG_CHANGES} body={MD_LONG} /> },
      { id: "stress", label: "Volume: 300 proposed changes", node: <DocReviewChangeQueue defaultTab="all" changes={HUGE_CHANGES} body={HUGE_MD} /> },
      { id: "narrow", label: "Overflow: narrow 320px frame", width: 320, node: <DocReviewChangeQueue changes={LONG_CHANGES} body={MD_LONG} /> },
    ],
  },
  {
    id: "DocReviewEditor", title: "DocReviewEditor", width: 900,
    states: [
      { id: "default", label: "Default", node: <DocReviewEditor body={DOC_EDITOR_BODY} findings={DOC_EDITOR_FINDINGS} /> },
      { id: "loading", label: "Loading", node: <DocReviewEditor body={DOC_EDITOR_BODY} findings={[]} loading /> },
      { id: "empty", label: "Empty document, no findings", node: <DocReviewEditor body="" findings={[]} /> },
      { id: "many", label: "Overflow: far too many annotations", node: <DocReviewEditor body={MD} findings={MANY_FINDINGS} /> },
      { id: "long", label: "Overflow: long text + unbreakable string", node: <DocReviewEditor body={MD_LONG} findings={MANY_FINDINGS} /> },
      { id: "stress", label: "Volume: 600-line body, 400 annotations", node: <DocReviewEditor body={HUGE_MD} findings={HUGE_FINDINGS} /> },
      { id: "narrow", label: "Overflow: narrow 320px frame", width: 320, node: <DocReviewEditor body={MD_LONG} findings={MANY_FINDINGS} /> },
    ],
  },
];
