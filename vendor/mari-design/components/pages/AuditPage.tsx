import { useEffect, useState, type ReactNode } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, SPLIT } from "./PageFrame";
import { Shield, RotateCw } from "lucide-react";
import { AuditFindingsChecklist, type AuditActions, type AuditFinding } from "../features/AuditFindingsChecklist";
import { ScanRunCard, type ScanRun } from "../features/ScanRunCard";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite } from "../actions/useWrite";
import { PageHeader } from "../layout/PageHeader";
import { Button } from "../actions/Button";
import { Card } from "../layout/Card";
import { Alert } from "../feedback/Alert";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonPage } from "../data-display/Skeletons";
import { Truncate } from "../data-display/Truncate";
import { fmtDate, type DateInput } from "../tokens/format";
import { focusRing } from "../tokens/focusRing";
import { Chip } from "../index";
import { AvatarGroup } from "../index";
import { Breadcrumb } from "../index";

/* Repository Audit (pages/audit.md). An onboarding / re-audit workflow: Mari
   scans a connected repo's docs, localization, authorship, tags and hygiene,
   then walks the user through fixing or dismissing each finding. The findings
   checklist is the page core; a right rail carries run history + "what we scan".

   This page is a pure presenter. It holds no demo content: the repo, the run
   history, the findings and the copy all arrive in `data`, and both empty
   shapes are derived from it — no repo connected is "connect a repo", a
   connected repo with no findings left is "run cleared". The canvas supplies
   the same shape from `.preview/fixtures/audit.ts`. */

const STATES = [
  { id: "default", label: "Default: full findings" },
  { id: "localization", label: "Section · Localization" },
  { id: "tags", label: "Section · Tags" },
  { id: "authorship", label: "Section · Authorship" },
  { id: "coverage", label: "Section · Coverage" },
  { id: "hygiene", label: "Section · Hygiene" },
  { id: "fixed", label: "A finding fixed" },
  { id: "fix-all", label: "Fix all: section handled" },
  { id: "many", label: "Over threshold: many findings" },
  { id: "hide-resolved", label: "Hide-resolved · mostly handled" },
  { id: "clear", label: "Run cleared: all clear" },
  { id: "loading", label: "Scanning" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "No repo connected" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

export type { AuditActions };

/** One entry in the audit-history rail. */
export type AuditRun = {
  /** The run's own handle. Carry it and the rail row becomes a button that
      opens the run (with `actions.openRun`); without it the row is text, not a
      hover affordance with nothing behind it (§2, P-AU-2). */
  id?: string;
  label: string;
  detail: string;
  /** When the run happened: an ISO value, rendered here through `fmtDate`. */
  ranAt?: DateInput;
  current?: boolean;
};

/** A supporting card carrying long contributor/label content. Only the
    long-text states have one, which is why it is nullable. */
export type AuditExtras = {
  title: string;
  crumbs: string[];
  tags: string[];
  people: string[];
  avatarMax: number;
};

/** Everything the Repository audit page renders. */
export type AuditData = {
  /** The audited repository, e.g. "acme/product-docs". Empty = none connected,
      which is what makes the "connect a repo" state true. */
  repo: string;
  provider: string;
  /** When the last run happened: an ISO timestamp. The page renders it with
      `fmtDate` (§5) — it used to arrive pre-formatted, so it could be neither
      sorted nor re-localised (P-AU-3). */
  ranAt: DateInput;
  /** The page header's supporting line. */
  summary: string;
  findings: AuditFinding[];
  /** People an unmapped git author can be mapped to. */
  members: { id: number; name: string }[];
  /** A banner above the checklist (e.g. "hide resolved is on"). */
  banner: { title: string; body: string } | null;
  history: AuditRun[];
  /** The "what we scan" list in the rail. */
  scans: string[];
  extras: AuditExtras | null;
};

function Extras({ extras }: { extras: AuditExtras }) {
  return (
    <Card variant="plain" title={extras.title}>
      <div className="space-y-3">
        <Breadcrumb items={extras.crumbs.map((label) => ({ label }))} />
        <div className="flex flex-wrap gap-1.5">
          {extras.tags.map((t, i) => <Chip key={i} label={t} tone="info" />)}
        </div>
        <AvatarGroup people={extras.people.map((initials) => ({ initials }))} max={extras.avatarMax} />
      </div>
    </Card>
  );
}

function HistoryRail({ history, scans, onOpenRun }: {
  history: AuditRun[]; scans: string[]; onOpenRun?: (id: string) => void;
}) {
  return (
    <aside className="flex min-w-0 flex-col gap-5">
      <Card variant="plain" title="Audit history">
        {history.length === 0 ? (
          <EmptyState title="No runs yet">Run an audit and its history builds up here.</EmptyState>
        ) : (
        <ul className="space-y-1.5 text-[12.5px]">
          {history.map((r, i) => {
            /* A row is only a button when there is a run to open. It used to
               carry `hover:bg-flysch` and no onClick on every row: a hover
               affordance promising a click that did not exist (§2, P-AU-2). */
            const open = r.id !== undefined && onOpenRun ? () => onOpenRun(r.id!) : undefined;
            const body = (
              <>
                <Truncate className="font-medium text-ink">{r.label}</Truncate>
                <div className="text-ink/65">
                  {r.detail}
                  {r.ranAt ? ` · ${fmtDate(r.ranAt)}` : ""}
                </div>
              </>
            );
            const frame = r.current
              ? "rounded-[5px] border border-biscay/30 bg-flysch px-3 py-2"
              : "rounded-[5px] px-3 py-2";
            return (
              <li key={r.id ?? `${r.label}-${i}`} className="min-w-0">
                {open ? (
                  <button type="button" onClick={open} className={`block w-full text-left ${frame} hover:bg-flysch ${focusRing}`}>
                    {body}
                  </button>
                ) : (
                  <div className={frame}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        )}
      </Card>
      <Card variant="plain" title="What we scan">
        <ul className="space-y-1.5 text-[12.5px] text-ink/70">
          {scans.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </Card>
    </aside>
  );
}

function withRail(main: ReactNode, rail: ReactNode, mobile: boolean) {
  return (
    /* §11 two-column split: main column minmax(0,1fr) + standard 320px rail.
       Mobile, and any window too narrow to hold both, collapses to one column
       with the rail below the main content. */
    <div className={mobile ? "mt-6 flex flex-col gap-5" : `mt-6 items-start ${SPLIT[320]}`}>
      <div className="min-w-0">{main}</div>
      {rail}
    </div>
  );
}

/** No repository connected at all: there is nothing to audit yet. Derived from
    the data, so it is true in the real app for the same reason it is true on
    the canvas. */
const noRepo = (d: AuditData) => !d.repo;

function Body({ data, error, actions, mobile, scan, scanning, onReaudit, onDismissScan }: {
  data: AuditData; error: string | null; actions?: AuditActions; mobile: boolean;
  scan: ScanRun | null; scanning: boolean;
  onReaudit?: () => void; onDismissScan: () => void;
}) {
  if (error) {
    return (
      <div className="mt-6">
        {/* An audit that did not load is not an audit with nothing in it: an
            EmptyState here reported a failure as emptiness (§8, XA-01). */}
        <ReadError>{error}</ReadError>
      </div>
    );
  }
  /* The run strip belongs in every state that has a repo, including the two
     empty ones: a scan is exactly what someone starts from an empty checklist,
     and the run has to be visible when they do (P-AU-1). */
  const runCard = scan && (
    <ScanRunCard run={scan} noun="finding" label="Walking the repository" destination="on the checklist" onDismiss={onDismissScan} />
  );

  if (noRepo(data)) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        {runCard}
        <EmptyState title="Connect a repo to begin">
          Link a documentation repository and run your first audit to see findings here.
        </EmptyState>
      </div>
    );
  }

  const rail = <HistoryRail history={data.history} scans={data.scans} onOpenRun={actions?.openRun} />;

  /* A connected repo whose run has nothing left in it. Same derivation rule:
     the checklist has no rows, so there is nothing to check off. */
  if (!data.findings.length) {
    return withRail(
      <div className="flex flex-col gap-5">
        {runCard}
        <EmptyState title="Run cleared 🎉">
          Every finding in this run is fixed or dismissed. Re-audit any time to catch new drift.
        </EmptyState>
      </div>,
      rail,
      mobile,
    );
  }

  const checklist = (
    <AuditFindingsChecklist
      members={data.members}
      findings={data.findings}
      actions={actions}
      onReaudit={onReaudit}
      scanning={scanning}
      /* The page already shows the failure under its own header; one banner
         per page, not one per control that could have caused it. */
      scanError={null}
    />
  );

  if (!runCard && !data.banner && !data.extras) return withRail(checklist, rail, mobile);

  return withRail(
    <div className="flex flex-col gap-5">
      {runCard}
      {data.banner && (
        <Alert tone="info" title={data.banner.title}>{data.banner.body}</Alert>
      )}
      {data.extras && <Extras extras={data.extras} />}
      {checklist}
    </div>,
    rail,
    mobile,
  );
}

/** How often the page re-reads a running audit. Slow enough that a repo walk
    is not a hot loop, fast enough that the bar visibly moves. Same cadence as
    the fact and decision scans. */
const SCAN_POLL_MS = 1500;

function AuditPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<AuditData, AuditActions>) {
  const [scan, setScan] = useState<ScanRun | null>(null);
  // The re-audit's busy/failed pair, from the one hook (XA-04).
  const audit = useWrite();

  /* Follow a run that is still going, exactly as Facts and Decisions do: the
     poll is an effect, so it stops when the page unmounts and never outlives
     the run it is reading. A failed poll leaves the last good reading on
     screen — losing the card mid-run would look like the run vanished. */
  const poll = actions?.scanProgress;
  const runId = scan && (scan.status === "running" || scan.status === "pending") ? scan.id : null;
  useEffect(() => {
    if (!runId || !poll) return;
    let alive = true;
    const tick = window.setInterval(() => {
      void Promise.resolve(poll(runId)).then((next) => { if (alive) setScan(next); }).catch(() => {});
    }, SCAN_POLL_MS);
    return () => { alive = false; window.clearInterval(tick); };
  }, [runId, poll]);

  /* runRepoAudit walks the whole repository. It used to be awaited and
     forgotten (or, with no handler, faked with a 700ms sleep): no run, no
     progress, no history (P-AU-1). A handler that answers with a run gets
     followed through <ScanRunCard>; one that only succeeds keeps the older
     fire-and-forget behaviour. */
  const runAudit = actions?.runAudit;
  const scanning = audit.busy || Boolean(runId);
  const reaudit = runAudit
    ? async () => {
        if (scanning) return;
        // `runFor`: the run itself is the result the page then follows.
        const started = await audit.runFor(() => runAudit(data.provider));
        if (started && typeof started === "object" && "id" in started) setScan(started);
      }
    : undefined;

  /* No handler, no button: the header used to draw a Re-audit that slept and
     reported nothing (§2). */
  const headerActions = reaudit && (
    <Button variant="primary" disabled={scanning} onClick={() => void reaudit()}>
      <RotateCw size={14} className={scanning ? "animate-spin" : ""} />
      {scanning ? "Scanning…" : noRepo(data) ? "Run first audit" : "Re-audit"}
    </Button>
  );
  if (loading) {
    return (
      <PageFrame chrome={chrome} active={navFor("audit")} title="Repository audit" mobile={mobile}>
        <SkeletonPage
          variant="list"
          eyebrow="Repository audit"
          /* The loaded title appends the repo name and the description IS the
             run summary; both are the response's to give. The stem of the
             title is the page's own and stands. */
          title="Repository audit"
          /* The icon is what puts the loaded title at x=288; without it the
             loading title started at x=250 and slid right on load. */
          icon={<span className="text-moss"><Shield size={26} /></span>}
          /* The rail carries the run history and the explainer; the main column
             is the findings checklist, whose five groups are KIND_ORDER in
             AuditFindingsChecklist — page chrome, not response values. This
             passed both rail cards as `sections` and so drew them down the main
             column with nothing beside them. */
          rail={["Audit history", "What we scan"]}
          sections={["Localization", "Tags", "Authorship", "Coverage", "Hygiene"]}
          /* Gated exactly as the loaded header gates it: no handler, no button,
             in the skeleton as well as in the page (§2). */
          actions={reaudit ? [{ label: "Re-audit", variant: "primary" }] : 0}
          mobile={mobile}
        />
      </PageFrame>
    );
  }
  return (
    <PageFrame chrome={chrome} active={navFor("audit")} title="Repository audit" mobile={mobile}>
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <PageHeader
          icon={<span className="text-moss"><Shield size={26} /></span>}
          /* The eyebrow names the page, not the journey that happens to
             reach it: this said ONBOARDING on a re-audit of a repo connected
             months ago. */
          eyebrow="Repository audit"
          title={data.repo ? `Repository audit, ${data.repo}` : "Repository audit"}
          description={data.summary}
          actions={mobile ? undefined : headerActions || undefined}
        />
        {mobile && headerActions && <div className="mt-4 flex flex-wrap items-center gap-2">{headerActions}</div>}
        {/* An audit that would not start is a failed write beside a button,
            not a bad value in an input (XA-02). */}
        <div className="mt-3 empty:mt-0">
          <WriteError onDismiss={() => audit.setFailed(null)}>{audit.failed}</WriteError>
        </div>
        <Body
          data={data}
          error={error}
          actions={actions}
          mobile={mobile}
          scan={scan}
          scanning={scanning}
          onReaudit={reaudit ? () => void reaudit() : undefined}
          onDismissScan={() => setScan(null)}
        />
      </div>
    </PageFrame>
  );
}

export const page: PageModule<AuditData, AuditActions> = {
  id: "audit",
  title: "Repository Audit",
  route: "/audit",
  component: AuditPage,
  states: STATES.map((s) => ({ ...s })),
};
