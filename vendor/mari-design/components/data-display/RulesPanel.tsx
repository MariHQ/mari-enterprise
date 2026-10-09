import { type ReactNode, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "../layout/Card";
import { Chip, type ChipTone } from "./Chip";
import { EmptyState } from "./EmptyState";
import { ResultCount } from "./Pagination";
import { ShowRest } from "./ShowRest";
import { Scrollable } from "./Scrollable";
import { SortHeader, useSort, thPad, tdPad } from "./sortable";

/* RulesPanel — a searchable rule catalog with severity. Ported from the
   console's library RulesPanel (the deterministic rule registry), decoupled
   from settings: rules are passed in and per-rule status changes are emitted
   as a callback. Filters (family + text) are managed locally. The
   active/zero/ignore status control only appears when `onStatusChange` is
   given.

   Layout notes (client review):
   - It is a real <table> now, with visible SortHeader column headers and the
     shared thPad/tdPad spacing, so every column lines up (CONVENTIONS.md §3).
   - The status column stays LAST and its contents are LEFT-aligned. That is a
     deliberate exception to §3's "status first" default, asked for by the
     client: here status is the thing you change, not the thing you scan.
   - Status is a row of `Chip selected` rather than a segmented button group.
     The old group applied `font-medium` only to the "on" segment, so selecting
     a status widened that segment and shifted the whole control sideways. */

export type RuleSeverity = "error" | "warn" | "advisory";
export type RuleStatus = "active" | "zero" | "ignored";

export type RuleRow = {
  id: string;
  /** Grouping such as "Clarity" or "Inclusive"; used for the family filter. */
  family: string;
  severity: RuleSeverity;
  description: string;
  /** Optional pack / list label. */
  pack?: string;
  status?: RuleStatus;
};

const SEVERITY_TONE: Record<RuleSeverity, ChipTone> = {
  error: "blocked",
  warn: "attention",
  advisory: "neutral",
};

const SEVERITY_RANK: Record<RuleSeverity, number> = { error: 0, warn: 1, advisory: 2 };

const STATUS_STEPS: { id: RuleStatus; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "zero", label: "Zero" },
  { id: "ignored", label: "Ignore" },
];
const STATUS_RANK: Record<RuleStatus, number> = { active: 0, zero: 1, ignored: 2 };

/** Rows per page, family chips shown before "more families", and the row count
    past which the table scrolls inside a capped region. */
const PAGE = 25;
const FAMILY_CHIPS = 10;
const BOUND_AT = 8;

export type RulesPanelProps = {
  rules: RuleRow[];
  onStatusChange?: (id: string, status: RuleStatus) => void;
  searchable?: boolean;
  title?: ReactNode;
  hint?: ReactNode;
  className?: string;
};

export function RulesPanel({
  rules, onStatusChange, searchable = true, title = "Rule catalog", hint, className,
}: RulesPanelProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string | "All">("All");
  const [showAll, setShowAll] = useState(false);
  const [allFamilies, setAllFamilies] = useState(false);

  const families = useMemo(() => Array.from(new Set(rules.map((r) => r.family))), [rules]);

  const visible = useMemo(
    () =>
      rules.filter(
        (r) =>
          (family === "All" || r.family === family) &&
          `${r.id} ${r.description} ${r.family} ${r.pack ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [rules, family, query],
  );

  const { sort, onSort, sorted } = useSort(visible, {
    rule: (r) => r.id,
    family: (r) => r.family,
    severity: (r) => SEVERITY_RANK[r.severity],
    status: (r) => STATUS_RANK[r.status ?? "active"],
  });

  const cols = onStatusChange ? 4 : 3;

  /* Volume. A real rule catalog is hundreds of rules across dozens of
     families. The family filter shows a bounded number of chips, and the table
     renders one page of rows inside a height-capped scroll region, with an
     honest count above it (§13, §20). */
  const shownFamilies = allFamilies ? families : families.slice(0, FAMILY_CHIPS);
  const hiddenFamilies = families.length - shownFamilies.length;
  const capped = sorted.length > PAGE;
  const rows = capped && !showAll ? sorted.slice(0, PAGE) : sorted;

  return (
    <Card variant="flush" title={title} hint={hint ?? `${rules.length} rules`} className={className}>
      <div className="border-t border-ink/10 px-4 pb-4 pt-3">
        {searchable && (
          <label className="mb-3 flex h-9 items-center gap-2 rounded-[4px] border border-ink/25 bg-paper px-3 text-ink/70 focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
            <Search size={18} className="shrink-0" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink/65"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a rule or family"
              aria-label="Find a rule or family"
            />
          </label>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Chip label="All families" tone={family === "All" ? "info" : "neutral"} selected={family === "All"} onClick={() => setFamily("All")} />
          {shownFamilies.map((f) => (
            <Chip key={f} label={f} tone={family === f ? "info" : "neutral"} selected={family === f} onClick={() => setFamily(f)} />
          ))}
          {(hiddenFamilies > 0 || allFamilies) && (
            /* XA-08: "12 more families" / "Show fewer families" was a ninth
               phrasing of the one show-the-rest toggle. */
            <ShowRest expanded={allFamilies} total={families.length} onToggle={() => setAllFamilies((v) => !v)} />
          )}
        </div>

        {/* Result count above the list, below the search and filter bar (§13).
            XA-05: hand-rolled, and the uncapped branch read "Showing 3 of 3
            rules" — a count that says "showing" when nothing is hidden. The
            shared strip says "3 rules" there, and the filter is stated as a
            note instead of being smuggled into the count. */}
        <ResultCount
          className="-mx-4 mb-3"
          from={1}
          to={rows.length}
          total={sorted.length}
          noun="rules"
          note={sorted.length < rules.length ? `filtered from ${rules.length.toLocaleString("en-US")}` : undefined}
          actions={capped ? <ShowRest expanded={showAll} total={sorted.length} onToggle={() => setShowAll((v) => !v)} /> : undefined}
        />

        <Scrollable axis="both" style={{ maxHeight: rows.length > BOUND_AT ? 520 : undefined }}>
          {/* Explicit min width (not a utility class) so the fixed layout always has
              room for four columns and the wrapper scrolls, instead of the first
              column collapsing to one character per line. 620 was not enough:
              the three fixed columns ate 496px of it and the rule column was
              left with 124px, which wrapped the rule id one word per line. */}
          <table style={{ minWidth: 780 }} className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col />
              <col style={{ width: "9.5rem" }} />
              <col style={{ width: "7.5rem" }} />
              {onStatusChange && <col style={{ width: "14.5rem" }} />}
            </colgroup>
            <thead>
              <tr>
                <SortHeader label="Rule" sortKey="rule" sort={sort} onSort={onSort} />
                <SortHeader label="Family" sortKey="family" sort={sort} onSort={onSort} />
                <SortHeader label="Severity" sortKey="severity" sort={sort} onSort={onSort} />
                {/* Status stays last, left-aligned, per the client note. */}
                {onStatusChange && <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} align="left" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const current = r.status ?? "active";
                return (
                  <tr key={r.id} className="border-b border-ink/10 align-top last:border-0">
                    <td className={tdPad}>
                      <code className="break-words font-term text-[12px] font-medium text-ink">{r.id}</code>
                      <div className="mt-0.5 break-words text-[12.5px] text-ink/70">{r.description}</div>
                    </td>
                    <td className={tdPad}>
                      <div className="break-words text-[12.5px] font-medium text-ink/80">{r.family}</div>
                      {r.pack && <div className="break-words font-term text-[11px] text-ink/65">{r.pack}</div>}
                    </td>
                    <td className={tdPad}>
                      <Chip label={r.severity} tone={SEVERITY_TONE[r.severity]} />
                    </td>
                    {onStatusChange && (
                      <td className={tdPad}>
                        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${r.id} status`}>
                          {STATUS_STEPS.map((s) => (
                            <Chip
                              key={s.id}
                              label={s.label}
                              tone={current === s.id ? "info" : "neutral"}
                              selected={current === s.id}
                              onClick={() => onStatusChange(r.id, s.id)}
                            />
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={cols} className={thPad}>
                    <EmptyState icon={<Search size={22} />}>No rules match these filters.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Scrollable>
      </div>
    </Card>
  );
}
