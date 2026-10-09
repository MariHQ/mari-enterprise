/** Pure presentation mapping shared by platform adapters. */
/* Decisions ledger adapter. */
import type { DecisionsData, LedgerFilterTab } from "@mari-design/components/pages/DecisionsPage";
import type { Decision } from "@mari-design/components/features/DecisionCardFeature";

const TABS: LedgerFilterTab[] = [
  { id: "all", label: "All", count: 0 },
  { id: "awaiting", label: "Awaiting sign-off", count: 0, status: "proposed" },
  { id: "ratified", label: "Ratified", count: 0, status: "ratified" },
  { id: "superseded", label: "Superseded", count: 0, status: "superseded" },
];

const seen = (s: Decision["status"]) => (s === "superseded" ? "ignored" : s);

const HOW_IT_WORKS =
  "Mari captures decisions where they are made, then tracks what they affect. " +
  "A proposal stays in the ledger until someone signs off; once ratified it is " +
  "linked from every document its impact touches.";

export function buildDecisions(decisions: Decision[], filter: string): DecisionsData {
  const filters: LedgerFilterTab[] = TABS.map((t) => ({
    ...t,
    count: t.status ? decisions.filter((d) => seen(d.status) === seen(t.status!)).length : decisions.length,
  }));

  return {
    decisions,
    filter,
    filters,
    // Required by the shared presenter contract; derive it from the same rows.
    awaiting: decisions.filter((d) => d.status === "proposed").map((d) => d.statement),
    howItWorks: HOW_IT_WORKS,
    // Capture composer and the ratify card are opened by the user.
    composer: null,
    ratify: null,
    extras: null,
  };
}
