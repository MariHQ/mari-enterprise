import { useState, type ReactNode } from "react";
import { ScrollText } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, SPLIT } from "./PageFrame";
import { SettingsTabs, SETTINGS_TAB_LABELS } from "./SettingsTabs";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { PropertyList } from "../data-display/PropertyList";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonPage } from "../data-display/Skeletons";
import { SettingsAuditLog, type AuditEvent, type AuditDetail } from "../features/SettingsAuditLog";
import { useWrite } from "../actions/useWrite";
import { RefreshButton } from "../actions/RepeatedActions";
import { WriteError } from "../feedback/WriteError";
import { ReadError } from "../feedback/ReadError";
import type { PropertyItem } from "../data-display/PropertyList";

/** Re-exported so an app types its rows off the page it renders. `detail` now
    rides the event itself: the log lets you expand ANY row, so the detail has
    to be available for any row, not only for one the adapter singled out. */
export type { AuditDetail };

/* Settings → Audit log (pages/settings-audit-log.md). Read-only record of the
   workspace's changes, with a filter, a date range, expandable rows, an export
   and a pager. Every variant is the SettingsAuditLog feature driven through
   its own props: the filtered / expanded / paginated states used to be a
   hand-drawn copy of the table in this file, whose filter input was
   `readOnly`, whose clear was a bare X glyph, whose expand chevron was not a
   button, and whose pager was `onChange={() => {}}` (P-SA-1). Under the shared
   settings tab strip.

   Pure presenter: the events, the applied filter, the expanded row and the
   rail summary all arrive in `data`. "No events yet" is derived from the log
   being empty. */

const STATES = [
  { id: "default", label: "Event log" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "No events yet" },
  { id: "filtered-actor", label: "Filtered by actor" },
  { id: "filtered-action", label: "Filtered by action" },
  { id: "filtered-date", label: "Filtered by date" },
  { id: "no-match", label: "Filter: no matches" },
  { id: "expanded", label: "Expanded entry" },
  { id: "many", label: "Many events (paginated)" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** What Settings → Access log can do.

    The log is immutable, so there is nothing here that writes: `refresh`
    re-reads, and `filter` re-reads a NARROWER window. Filtering used to be a
    canvas concept only — the page could show a filtered log and had no way to
    ask for one (P-SA-3). With no handler the feature filters the window it was
    given, which is honest about being a window. */
export type SettingsAuditLogActions = {
  refresh?: () => void | Promise<void>;
  /** `from` / `to` are ISO dates (yyyy-mm-dd), null for an open end. */
  filter?: (f: { query: string; from: string | null; to: string | null }) => void | Promise<void>;
};

/** A filter already applied to the log, as the URL or the server describes it.
    `query` is what the filter box shows; `matches` is legacy and unread, since
    the log now filters the window it was handed rather than being told the
    answer. */
export type AuditFilter = { label: string; query?: string; matches?: AuditEvent[] };

/** Everything Settings → Audit log renders. */
export type SettingsAuditLogData = {
  events: AuditEvent[];
  /** Events in the window, which may exceed the page of `events` shown. */
  total: number;
  /** The applied filter, or `null` for the unfiltered log. */
  filter: AuditFilter | null;
  /** The row whose detail panel starts open. Every row is expandable, so this
      is a deep link, not the only row that can open. */
  expandedId: number | null;
  /** Detail for the expanded event, for an app that only resolves the one row
      it was asked about. Detail now rides `events[].detail` as well, because a
      table you can expand ANYWHERE needs it everywhere; this is merged onto
      the expanded row so an adapter written against the old shape still
      works. */
  detail: AuditDetail[];
  /** Legacy: the page-level pager. The log pages itself over the window it was
      given, so this is no longer read. */
  pager?: { page: number; pageCount: number; label: string } | null;
  /** Read-only facts in the rail. */
  summary: PropertyItem[];
};


/* ── §11 page grid ─────────────────────────────────────────────────────────
   Shared verbatim with the other four Settings pages: one container width, one
   main/rail split, one form-field grid. */
const PAGE = "mx-auto max-w-[1400px] px-5 py-6 sm:px-8";

function SettingsBody({ mobile, rail, children }: { mobile: boolean; rail: ReactNode; children: ReactNode }) {
  return (
    <div className={mobile ? "mt-6 flex flex-col gap-5" : `mt-6 ${SPLIT[320]}`}>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="flex min-w-0 flex-col gap-5">{rail}</aside>
    </div>
  );
}

/* Supporting rail (§11, 320px) — matches the other four Settings rails. */
function AuditRail({ summary }: { summary: PropertyItem[] }) {
  return (
    <>
      <Card title="At a glance" hint="Read only">
        <PropertyList items={summary} />
      </Card>
      <Card title="Reading the log">
        <p className="text-[12.5px] leading-relaxed text-ink/70">
          Entries are immutable. Filter by actor, action, or date, then expand a
          row for the before and after values, the request ID, and the source IP.
        </p>
      </Card>
    </>
  );
}

/** No workspace activity recorded at all. Derived from the data. */
function isEmpty(d: SettingsAuditLogData): boolean {
  return d.events.length === 0 && d.filter === null;
}

function Body({ data, error, actions }: { data: SettingsAuditLogData; error: string | null; actions?: SettingsAuditLogActions }) {
  /* XA-01: this was an EmptyState titled "API offline" — the "nothing here
     yet" surface reporting a failure, under a string §8 forbids and that is a
     second spelling of ERRORS["server.unavailable"].title. */
  if (error) return <ReadError>{error}</ReadError>;
  if (isEmpty(data)) {
    return (
      <EmptyState icon={<ScrollText size={22} />} title="No events yet">
        Workspace changes will show up here as they happen.
      </EmptyState>
    );
  }
  /* One table for every state. The filter it starts with is whatever the app
     already applied; the box, the date range, the expand controls and the
     pager are the real ones the feature ships. */
  return (
    <SettingsAuditLog
      embedded
      events={withExpandedDetail(data)}
      total={data.total}
      initialQuery={queryOf(data.filter)}
      expandedId={data.expandedId}
      onFilterChange={actions?.filter}
    />
  );
}

/** The rows, with `data.detail` folded onto the row it describes. An app that
    resolves detail for every event puts it on the event and this changes
    nothing; one that resolves only the row it was asked about still gets that
    row's detail rendered. */
function withExpandedDetail(d: SettingsAuditLogData): AuditEvent[] {
  if (d.expandedId === null || d.detail.length === 0) return d.events;
  return d.events.map((e) => (e.id === d.expandedId && !e.detail ? { ...e, detail: d.detail } : e));
}

/** What the filter box starts with. A filter the app describes as
    "actor: Maya Chen" filters on the value, not on the field name it used to
    label it with. */
function queryOf(filter: AuditFilter | null): string {
  if (!filter) return "";
  if (filter.query !== undefined) return filter.query;
  const i = filter.label.indexOf(": ");
  return i === -1 ? filter.label : filter.label.slice(i + 2);
}

function SettingsAuditLogPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<SettingsAuditLogData, SettingsAuditLogActions>) {
  /* The header button used to be a picture of a refresh. It now re-reads, and
     says so while it is doing it (§2). */
  const write = useWrite();
  const [reloads, setReloads] = useState(0);
  const refresh = () => write.run(
    actions?.refresh && (() => actions.refresh!()),
    () => setReloads((n) => n + 1),
  );
  return (
    <PageFrame chrome={chrome} active={navFor("settings")} title="Settings" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="settings"
          eyebrow="Settings"
          title="Access log"
          description="Every workspace change: actor, action, target, and time."
          tabs={SETTINGS_TAB_LABELS}
          activeTab="Audit log"
          rail={["At a glance", "Reading the log"]}
          sections={["Events"]}
          columns={["Actor", "Action", "Target", "When", "Detail"]}
          actions={["Refresh"]}
          mobile={mobile}
        />
      ) : (
        <div className={PAGE}>
          <PageHeader
            eyebrow="Settings"
            title="Access log"
            description="Every workspace change: actor, action, target, and time."
            actions={
              /* XA-23: the same Refresh is spelled once, here and in the
                 embedded log below (§16). */
              <RefreshButton busy={write.busy} count={reloads} onClick={() => void refresh()} />
            }
          />
          <div className="mt-5"><SettingsTabs active="audit" onNavigate={chrome?.onNavigate} /></div>
          {write.failed && (
            <div className="mt-5"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>
          )}
          <SettingsBody mobile={mobile} rail={<AuditRail summary={data.summary} />}>
            <Body data={data} error={error} actions={actions} />
          </SettingsBody>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<SettingsAuditLogData, SettingsAuditLogActions> = {
  id: "settings-audit-log",
  title: "Settings · Access log",
  route: "/settings/audit",
  component: SettingsAuditLogPage,
  states: STATES.map((s) => ({ ...s })),
};
