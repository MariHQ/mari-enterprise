import { Fragment, useMemo, useState } from "react";
import { Search, ScrollText, ChevronDown } from "lucide-react";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ExportButton, RefreshButton } from "../actions/RepeatedActions";
import { Avatar } from "../data-display/Avatar";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonButton, SkeletonTable } from "../data-display/Skeleton";
import { SortHeader, useSort, tdPad } from "../data-display/sortable";
import { Scrollable } from "../data-display/Scrollable";
import { PagerBar, ResultCount, usePaged } from "../data-display/Pagination";
import { Truncate } from "../data-display/Truncate";
import { DateRangePicker, dateRangeStart, type DateRange } from "../data-display/DateRangePicker";
import { fmtDateTime } from "../tokens/format";
import { focusRing } from "../tokens/focusRing";

/* Settings — Access log ───────────────────────────────────────────────────
   A read-only chronological record of every workspace change — actor, action
   verb, target, and time — with a text filter, a date range, expandable rows
   carrying the before/after detail, an export, and a pager.
   Source: web/src/pages/settings/AuditLog.tsx. */

/** One extra fact about an event, shown when its row is expanded. Recorded at
    write time by whoever logged the event, so an event logged before the
    writer had anything more to say simply has none. */
export type AuditDetail = { label: string; value: string };

export type AuditEvent = {
  id: number; actor: string; verb: string; target: string; at: string;
  /** Before/after values, request id, source IP. Absent means the row has
      nothing to expand, and it does not draw an expand control. */
  detail?: AuditDetail[];
};

function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/** CSV of exactly the rows on screen. Quoting is the boring kind: double the
    quotes, wrap every field, so a target containing a comma survives. */
function toCsv(rows: AuditEvent[]): string {
  const cell = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Actor", "Action", "Target", "When"].map(cell).join(",")];
  for (const e of rows) lines.push([e.actor, e.verb, e.target, e.at].map(cell).join(","));
  return lines.join("\r\n");
}

export type SettingsAuditLogProps = {
  /** Hide the internal PageHeader when the host page already renders one. */
  embedded?: boolean;
  events: AuditEvent[];
  total: number;
  /** Seed the filter box. The host page passes whatever filter the URL or the
      server-side narrowing describes; typing still owns it from then on. */
  initialQuery?: string;
  /** Told whenever the filter or the date range changes, so an app can narrow
      the WINDOW server-side instead of only narrowing what was fetched. With
      no handler the filtering below is the whole story, over the window this
      component was given. */
  onFilterChange?: (f: { query: string; from: string | null; to: string | null }) => void;
  /** Which row starts expanded. Deep-linking a single event, and how the
      canvas captures the expanded state without a click. */
  expandedId?: number | null;
  loading?: boolean;
  className?: string;
};

export function SettingsAuditLog({
  events, total, initialQuery = "", onFilterChange, expandedId = null,
  loading = false, embedded = false, className = "",
}: SettingsAuditLogProps) {
  const [filter, setFilter] = useState(initialQuery);
  const [range, setRange] = useState<DateRange>({ preset: "all" });
  const [nonce, setNonce] = useState(0);
  /* Which row is open. Seeded from the prop, then owned here: the chevron used
     to be a bare icon on a row nothing listened to, so the log depicted an
     expandable table that could not expand (P-SA-1). */
  const [openId, setOpenId] = useState<number | null>(expandedId);
  /* Both buffers are seeded from props, which `useState` reads once: without
     these sentinels a new window (or a new deep link) left the old filter text
     and the old open row on screen (C1). */
  const [seen, setSeen] = useState({ expandedId, initialQuery });
  if (seen.expandedId !== expandedId || seen.initialQuery !== initialQuery) {
    setSeen({ expandedId, initialQuery });
    setOpenId(expandedId);
    setFilter(initialQuery);
  }

  const changeFilter = (q: string, r: DateRange) => {
    setFilter(q);
    setRange(r);
    const start = dateRangeStart(r);
    onFilterChange?.({
      query: q,
      from: start ? start.toISOString().slice(0, 10) : null,
      to: r.preset === "custom" ? r.to ?? null : null,
    });
  };

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const start = dateRangeStart(range);
    const end = range.preset === "custom" && range.to ? new Date(`${range.to}T23:59:59`) : null;
    return events.filter((e) => {
      if (q && !`${e.actor} ${e.verb} ${e.target} ${e.at}`.toLowerCase().includes(q)) return false;
      if (!start && !end) return true;
      const at = new Date(e.at);
      if (start && at < start) return false;
      if (end && at > end) return false;
      return true;
    });
  }, [events, filter, range]);

  const { sort, onSort, sorted } = useSort(shown, {
    actor: (e) => e.actor,
    action: (e) => e.verb,
    target: (e) => e.target,
    when: (e) => e.at,
  });

  /* An access log is thousands of rows deep. It pages, 15 at a time, instead
     of rendering a mile of card (CONVENTIONS §13). */
  const pager = usePaged(sorted, 15);

  /* Export is the rows on screen, made in the browser: nothing to fetch, and
     no claim about anything outside the window that was fetched. */
  const exportCsv = () => {
    const blob = new Blob([toCsv(sorted)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filter.trim().length > 0 || range.preset !== "all";

  /* Same fix as the keys table: the page's own words render, the events do
     not exist yet. "Every change in this workspace, newest first" is a
     promise about the log, not a fact from it, so it stands. */
  if (loading) {
    return (
      <div className={`flex flex-col gap-5 ${className}`.trim()} aria-busy="true">
        {!embedded && <PageHeader
          title="Access log"
          description="Every change in the workspace, who made it, and when"
          actions={<SkeletonButton w={110} />}
        />}
        <Card variant="flush" title="Events" hint="Every change in this workspace, newest first">
          <SkeletonTable rows={6} columns={["Actor", "Action", "Target", "When", "Detail"]} className="border-0 rounded-none" />
        </Card>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`.trim()}>
      {!embedded && <PageHeader
        title="Access log"
        description="Every change in the workspace, who made it, and when"
        /* XA-23: Refresh was written out at both levels of this one feature,
           here and again on SettingsAuditLogPage's header, with different
           glyph sizes and a different busy word. One component now spells it
           (§16); this header only renders when the log is NOT embedded in
           that page, so the two never appear at once. */
        actions={<RefreshButton count={nonce} onClick={() => setNonce((n) => n + 1)} />}
      />}

      {/* The count lives in the result strip, once (CONVENTIONS §13). */}
      <Card variant="flush" title="Events" hint="Every change in this workspace, newest first" actions={
        <>
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
            <Search size={13} className="text-ink/65" />
            <input
              value={filter}
              onChange={(e) => changeFilter(e.target.value, range)}
              placeholder="Filter events…"
              aria-label="Filter events"
              className="w-[150px] bg-transparent text-[12.5px] text-ink placeholder:text-ink/65 outline-none"
            />
          </div>
          {/* A log without a date range is a log you cannot answer "what
              happened last Tuesday" with (P-SA-2). */}
          <DateRangePicker compact value={range} onChange={(r) => changeFilter(filter, r)} />
          <ExportButton compact format="CSV" onClick={exportCsv} disabled={sorted.length === 0} />
        </>
      }>
        {shown.length === 0 ? (
          <EmptyState icon={<ScrollText size={24} />} title={events.length === 0 ? "No events yet" : "No matches"}>
            {events.length === 0 ? "Workspace activity will appear here." : "No events match that filter."}
          </EmptyState>
        ) : (
          <>
          <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="events"
            note={filtered ? `filtered from ${total.toLocaleString("en-US")}` : undefined} />
          <Scrollable>
            {/* The last column carried 6%, which at this card's width is 49px
                — less than the 32px of cell padding plus the word DETAIL, so
                the header was sliced by the card border and the chevrons sat
                flush against it. A column has to be at least as wide as its
                own name: 10% of the 800px floor is 80px, which fits both the
                header and the 28px expand control with room to spare (§12). */}
            <table className="w-full table-fixed text-left border-collapse" style={{ minWidth: 800 }}>
              <colgroup>
                <col style={{ width: "22%" }} /><col style={{ width: "18%" }} /><col style={{ width: "32%" }} />
                <col style={{ width: "18%" }} /><col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <SortHeader label="Actor" sortKey="actor" sort={sort} onSort={onSort} />
                  <SortHeader label="Action" sortKey="action" sort={sort} onSort={onSort} />
                  <SortHeader label="Target" sortKey="target" sort={sort} onSort={onSort} />
                  <SortHeader label="When" sortKey="when" sort={sort} onSort={onSort} align="center" />
                  <SortHeader label="Detail" sortable={false} align="center" />
                </tr>
              </thead>
              <tbody>
                {pager.pageRows.map((e) => {
                  const open = e.id === openId;
                  const detail = e.detail ?? [];
                  return (
                    <Fragment key={e.id}>
                      <tr className={`border-b border-ink/10 last:border-0 align-top ${open ? "bg-flysch/60" : ""}`}>
                        <td className={tdPad}>
                          <span className="flex items-start gap-2.5">
                            <Avatar initials={initialsOf(e.actor)} />
                            <Truncate className="min-w-0 flex-1 text-[13px] font-medium text-ink">{e.actor}</Truncate>
                          </span>
                        </td>
                        <td className={tdPad}><Truncate className="text-[13px] text-ink/70">{e.verb}</Truncate></td>
                        {/* A target is an arbitrary identifier: truncate with the
                            full value on hover, never wrap it a character at a
                            time down the column (CONVENTIONS §12). */}
                        <td className={tdPad}><Truncate className="text-[13px] text-ink/85">{e.target}</Truncate></td>
                        <td className={`${tdPad} text-center font-term text-[12px] text-ink/65`}>{fmtDateTime(e.at)}</td>
                        <td className={`${tdPad} text-center`}>
                          {detail.length > 0 && (
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={open ? `Hide detail for event ${e.id}` : `Show detail for event ${e.id}`}
                              onClick={() => setOpenId(open ? null : e.id)}
                              className={`grid h-7 w-7 place-items-center rounded-[4px] border border-ink/20 text-ink/70 hover:border-ink/45 hover:text-ink transition-colors ${focusRing}`}
                            >
                              <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {open && detail.length > 0 && (
                        <tr className="border-b border-ink/10 bg-flysch/30">
                          <td colSpan={5} className={tdPad}>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-term text-[12px] sm:grid-cols-4">
                              {detail.map((d) => (
                                <div key={d.label} className="min-w-0">
                                  <dt className="text-ink/65">{d.label}</dt>
                                  <dd className="text-ink/80"><Truncate>{d.value}</Truncate></dd>
                                </div>
                              ))}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Scrollable>
          {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
