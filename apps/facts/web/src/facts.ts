/** Pure presentation mapping shared by platform adapters. */
import type { FactsData, FactFilter } from "@mari-design/components/pages/FactsPage";
import type { Fact } from "@mari-design/components/features/FactsVerificationAudit";

export function tabsFor(facts: Fact[]): FactFilter[] {
  const counts = new Map<string, number>();
  for (const f of facts) counts.set(f.status, (counts.get(f.status) ?? 0) + 1);
  return [
    { id: "all", label: "All", count: facts.length },
    ...[...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([status, count]) => ({ id: status.toLowerCase().replace(/\s+/g, "-"), label: status, count, status })),
  ];
}

export function buildFacts(facts: Fact[], banner: FactsData["banner"], filter = "all"): FactsData {
  const filters = tabsFor(facts);
  return {
    filters,
    // Deep links land on a real tab or fall back to All: the home page's
    // "Facts to review" tile counts only needs-review claims, so it links
    // straight to that filter instead of a page-wide list the number never
    // described.
    filter: filters.some((f) => f.id === filter) ? filter : "all",
    facts,
    banner,
    // The verification-audit card re-lists facts by staleness. It is a view
    // of the same rows, so it only appears once the user asks for it.
    audit: null,
    taskAudit: null,
    impact: null,
    extras: null,
  };
}
