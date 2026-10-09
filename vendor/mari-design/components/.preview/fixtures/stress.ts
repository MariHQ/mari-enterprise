/* Shared stress-test content for the `overflow` and `stress` page states.
   - `overflow`: very long but natural text (real words + spaces) → catches
     wrapping, truncation, line-clamp, and vertical-overflow failures.
   - `stress`: pathological content (unbreakable tokens, huge numbers, mixed
     scripts, huge counts) → catches horizontal overflow, missing min-w-0 /
     break-words / truncate, and flex blowouts that normal long text won't. */

export const LONG_TITLE =
  "Quarterly platform reliability, incident-response, and on-call escalation runbook: consolidated across every service, region, and team, superseding all prior drafts";

export const LONG_PARAGRAPH =
  "This document consolidates the operating guidance for the entire platform organization across regions, teams, and service tiers. It describes the escalation ladder, the paging policy, the severity rubric, the communication templates, and the post-incident review process in exhaustive detail so that any responder: regardless of tenure or team: can act without ambiguity during an active incident. Every section has been reviewed by the reliability guild and reconciled against the last four quarters of incident retrospectives, and it will be re-reviewed every quarter or after any Sev-1.";

export const LONG_NAME = "Alexandra Wilhelmina Featherstonehaugh-Montgomery-Brixington III";

export const LONG_DOC_TITLE =
  "authentication-and-single-sign-on-migration-plan-including-saml-oidc-and-scim-provisioning-for-all-workspaces-final-v7";

export const LONG_SOURCE = "github.com/mari-hq/the-monorepo-that-contains-absolutely-everything-we-own";

export const LONG_URL =
  "https://console.mari.guru/knowledge/documents/9f2c7a1be44d0c83f6a1e7b2c9d40e5f/revisions/compare?from=abc123&to=def456&highlight=contradiction&scroll=1840";

/** No spaces — the classic horizontal-overflow catcher. */
export const UNBREAKABLE =
  "mari_sk_9f2c7a1be44d0c83f6a1e7b2c9d40e5f_0123456789abcdef0123456789abcdef_this_token_will_never_wrap_on_its_own";

/** A single very long word (no break opportunities). */
export const LONG_WORD = "Pneumonoultramicroscopicsilicovolcanoconiosisantidisestablishmentarianism";

export const HUGE_NUMBER = 12847392;
export const HUGE_NUMBER_STR = "12,847,392";
export const HUGE_PERCENT = "99.999982%";

/** Emoji + CJK + Arabic + accents to exercise glyph width + bidi. */
export const MIXED_SCRIPT = "部署が失敗しました ⚠️ الإصدار النهائي: café résumé naïve 🚀🔥✅";

/** Many tags (some long) — overflow a chip row / wrap test. */
export const MANY_TAGS = [
  "canonical", "customer-facing", "needs-review", "deprecated", "internal-only",
  "authentication", "sso", "billing", "onboarding", "security-sensitive",
  "quarterly-review", "reliability", "incident-response", "escalation-policy",
  "compliance", "gdpr", "soc2", "pii", "data-retention", "cross-region",
  "high-priority", "blocked", "stale-candidate", "auto-generated",
];

/** Many owners for avatar-stack overflow. */
export const MANY_INITIALS = ["AW", "DR", "MC", "JL", "KP", "TN", "SM", "AB", "RG", "PV", "LC", "EO"];

export const LONG_BREADCRUMB = [
  "Home", "Knowledge base", "Engineering", "Platform", "Reliability",
  "Runbooks", "Incident response", "Escalation", "On-call", "This document",
];

/** Repeat helper for building long lists of items. */
export function repeat<T>(item: (i: number) => T, n: number): T[] {
  return Array.from({ length: n }, (_, i) => item(i));
}
