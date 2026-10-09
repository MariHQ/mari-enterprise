import { useEffect, useState } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor } from "./PageFrame";
import { Shield, ShieldCheck, Workflow } from "lucide-react";
import { FactsVerificationAudit, factStatusKey, isVerifiedFact, type Fact } from "../features/FactsVerificationAudit";
import { ImpactPanelFeature } from "../features/ImpactPanelFeature";
import type { ImpactDoc } from "../data-display/ImpactPanel";
import { PageHeader } from "../layout/PageHeader";
import { Button } from "../actions/Button";
import { Card } from "../layout/Card";
import { Table } from "../data-display/Table";
import { Chip, StatusChip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonPage } from "../data-display/Skeletons";
import { Truncate } from "../data-display/Truncate";
import { Alert } from "../feedback/Alert";
import { FieldError } from "../feedback/ErrorMessage";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite, why } from "../actions/useWrite";
import { CreateReviewTaskButton } from "../actions/RepeatedActions";
import { Drawer } from "../layout/Drawer";
import { ConfirmButton } from "../actions/ConfirmButton";
import { FormField } from "../forms/FormField";
import { Input } from "../forms/Input";
import { Textarea } from "../forms/Textarea";
import type { ChipStatus } from "../data-display/Chip";
import { ScanRunCard, type ScanRun } from "../features/ScanRunCard";
import { AvatarGroup } from "../index";
import { Breadcrumb } from "../index";
import { fmtDate, toDate, type DateInput } from "../tokens/format";
import { FilterField, FilterSearch, FilterSelect, localDayStart } from "../navigation/FilterTrigger";

/* Facts (pages/facts.md). Every claim the team relies on, verified and owned —
   a status-filtered table (claim / owner / status / verified) with per-row
   impact analysis and a toggled client-side verification audit.

   This page is a pure presenter. It holds no demo content: the filter tabs,
   the rows, the banner, the audit panel and the impact expansion all arrive in
   `data`, and every section renders only if the data carries it. The canvas
   supplies the same shape from `.preview/fixtures/facts.ts`. */

const STATES = [
  { id: "default", label: "Default: all facts + audit" },
  { id: "verified", label: "Filter · Verified" },
  { id: "review", label: "Filter · Needs review" },
  { id: "contradicted", label: "Filter · Contradicted" },
  { id: "stale", label: "Filter · Stale candidates" },
  { id: "impact", label: "Fact expanded: run impact" },
  { id: "impact-analyzed", label: "Fact expanded: impact resolved" },
  { id: "task-creating", label: "Create review task: creating" },
  { id: "task-done", label: "Create review task: done" },
  { id: "task-error", label: "Create review task: error" },
  { id: "single", label: "Single fact" },
  { id: "many", label: "Many facts" },
  { id: "empty", label: "No facts yet" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** A claim being captured, or rewritten. */
export type NewFact = { claim: string; source: string; owner: string };

/** A fact scan, as the page follows it: a real background run, in the same
    vocabulary the Flows page uses for every other run in the product. Mining
    the corpus takes minutes and touches the ledger, so it is a flow with steps
    and a progress reading, not something a link fires and forgets. */
export type FactCandidate = {
  id: number;
  documentTitle: string;
  claim: string;
  evidence: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  reviewReason: string;
  reviewer: string;
  impactScore: number;
  highImpact: boolean;
  semanticLinks: {
    targetType: "fact" | "document";
    targetId: number;
    relation: string;
    similarity: number;
    targetLabel: string;
    targetUpdatedAt: string;
    observedAt: string;
  }[];
  intelligence?: FactIntelligence;
};

export type FactLlmBudget = {
  stage: string;
  purpose: string;
  model: string;
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  callsUsed: number;
  inputTokens: number;
  outputTokens: number;
  status: string;
};

export type FactIntelligence = {
  structuredClaim: Record<string, unknown>;
  adjudication: Record<string, unknown>;
  validFrom: string;
  validTo: string;
  components: { role: string; text: string }[];
  relations: { targetClaim: string; relation: string; similarity: number | null; decisionKind: string; rationale: string }[];
  evidenceGroups: { verdict: string; sufficient: boolean; confidence: number; rationale: string; decisionKind: string;
    spans: { documentTitle: string; quote: string; role: string; similarity: number | null }[] }[];
  clusters: { label: string; stableKey: string; labelKind: string; membershipScore: number }[];
};

export type FactScan = ScanRun & { candidates: FactCandidate[]; llmBudgets?: FactLlmBudget[] };

/** What the Facts page can DO. Every handler may throw and the control that
    called it shows the message. All optional: without actions the page keeps
    the local behaviour the library ships (the canvas has no server). */
export type FactsActions = {
  /** Mark a claim verified as of today. */
  verifyFact?: (id: string | number) => void | Promise<void>;
  /** Capture a new claim into the ledger. */
  addFact?: (fact: NewFact) => void | Promise<void>;
  /** Rewrite a claim in place. Without it no row offers Edit: a ledger row you
      can verify but never correct forces a retire-and-recapture (P-FA-3). */
  editFact?: (fact: NewFact & { id: string | number }) => void | Promise<void>;
  /** Retire a claim the team no longer relies on. Destructive, so the row
      offers it through <ConfirmButton> and never on a first click (§2). */
  retireFact?: (id: string | number) => void | Promise<void>;
  /** Reopen an invalidated claim as needs-review — the way back for a
      changed mind. Verification is not restored; a person re-verifies. */
  restoreFact?: (id: string | number) => void | Promise<void>;
  /** Read the embedding-space neighborhood used for invalidation impact. */
  inspectFactImpact?: (id: string | number) => FactSemanticImpactLink[] | Promise<FactSemanticImpactLink[]>;
  /** Start the corpus scan as a background run, and answer with the run so the
      page can follow it. Long-running: the run outlives this call.

      Without it the header draws NO scan button: the page used to invent a
      progress reading for a scan nobody had started (P-FA-5), and a control
      that cannot start anything must not be drawn (§2). */
  scanFacts?: () => FactScan | Promise<FactScan>;
  /** Start the scan again with the configuration it already has. Retry after
      a failure must not reopen the configuration dialog: the settings did not
      cause the failure, and re-asking for them reads as blame. Absent, Retry
      falls back to `scanFacts`. */
  retryFactScan?: () => FactScan | Promise<FactScan>;
  /** Re-read a scan the page started. Polled until the run stops running;
      without it the page shows the run once and does not follow it. */
  scanProgress?: (id: string) => FactScan | Promise<FactScan>;
  /** Recover the newest run so scheduled output survives navigation/reloads. */
  latestFactScan?: () => FactScan | null | Promise<FactScan | null>;
  /** Persist one candidate verdict and return the refreshed run output. */
  reviewFactCandidate?: (runId: string, candidateId: number, accept: boolean, reason?: string) => FactScan | Promise<FactScan>;
  /** Resume a human-gated run after every candidate has a verdict. */
  completeFactReview?: (runId: string) => FactScan | Promise<FactScan>;
  /** Persistently hide a recovered run for the current user. */
  dismissFactScan?: (runId: string) => void | Promise<void>;
  /** Open a re-verification task on a stale fact. */
  createReviewTask?: (fact: Fact) => string | void | Promise<string | void>;
};

export type FactSemanticImpactLink = {
  targetType: string;
  targetId: number | string;
  relation: string;
  similarity: number;
  targetLabel: string;
  targetUpdatedAt: string;
  observedAt: string;
};

/** One status filter tab, with the count the workspace actually holds. */
export type FactFilter = {
  id: string;
  label: string;
  count: number;
  /** The `Fact.status` this tab keeps. Absent = every claim. It is here so the
      tab row can filter the rows it is sitting above without a round trip —
      the tabs used to be inert, and a status with no tab (the ledger's own
      "Needs review") could not be reached at all. */
  status?: string;
};

/** A verified fact expanded into its impact analysis. */
export type FactImpact = {
  /** Card title: the claim being traced. */
  title: string;
  claim: string;
  source: string;
  /** ISO timestamp of the last verification, rendered as an age. */
  verifiedAt: string;
  summary: string;
  docs: ImpactDoc[];
  /** The analysis has already run, so the strip is resolved on arrival. */
  analyzed: boolean;
};

/** A frozen create-review-task mutation, one phase at a time, so each phase of
    the lifecycle is a capturable state rather than a timing accident. */
export type FactTaskAudit = {
  title: string;
  hint: string;
  claim: string;
  meta: string;
  /** ISO date of the verification the row is about. */
  verified: string;
  age: string;
  statusLabel: string;
  phase: "creating" | "done" | "error";
  errorText: string;
};

/** A supporting card carrying long owner/tag content. Only the long-text
    states have one, which is why it is nullable. */
export type FactsExtras = {
  title: string;
  crumbs: string[];
  tags: string[];
  people: string[];
  avatarMax: number;
};

/** Everything the Facts page renders. */
export type FactsData = {
  filters: FactFilter[];
  /** Which filter tab is selected. */
  filter: string;
  /** The rows of the facts table. Empty = the table is not rendered at all. */
  facts: Fact[];
  pagination?: {previous:string|null;next:string|null};
  /** A banner above the table (e.g. a contradiction warning). */
  banner: { title: string; body: string } | null;
  /** The verification-audit card. `null` = not shown for this view. */
  audit: Fact[] | null;
  /** A frozen create-review-task mutation, shown instead of the audit. */
  taskAudit: FactTaskAudit | null;
  /** An expanded fact's impact analysis, shown instead of the table. */
  impact: FactImpact | null;
  extras: FactsExtras | null;
};

function Extras({ extras }: { extras: FactsExtras }) {
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

/* A ledger status, mapped onto the chip system's own vocabulary.
   `factChip` used to switch on the ENGLISH DISPLAY STRING ("Verified",
   "Stale", "Contradicted") and return "Needs review" for everything else, so a
   ledger that spelled a status "needs_evidence", "VERIFIED" or "Retired"
   silently relabelled every one of its rows (P-FA-1). The key is normalised
   and, when the word is one the console has no meaning for, the row shows the
   word the API actually used rather than a status it invented. */
const FACT_STATUS: Record<string, ChipStatus> = {
  verified: "verified",
  stale: "stale",
  draft: "draft",
  retired: "retired",
  invalidated: "retired",
  contradicted: "contradiction",
  contradiction: "contradiction",
  "needs-review": "needs-review",
  "needs-evidence": "unsupported",
  unsupported: "unsupported",
  unverified: "unverified",
  supported: "supported",
  canonical: "canonical",
  approved: "approved",
};

function factChip(status: string) {
  if (factStatusKey(status) === "invalidated") return <Chip label="Invalidated" tone="neutral" dot />;
  const known = FACT_STATUS[factStatusKey(status)];
  if (known) return <StatusChip status={known} />;
  return <Chip label={status || "Unrecorded"} tone="neutral" dot />;
}

function FactsTable({ facts, onVerify, onEdit, onRetire, onRestore, onImpact }: {
  facts: Fact[];
  pagination?: {previous:string|null;next:string|null};
  onVerify?: (id: string | number) => void | Promise<void>;
  onEdit?: (fact: Fact) => void;
  onRetire?: (id: string | number) => void | Promise<void>;
  /** Reopen an invalidated claim as needs-review. Without it an invalidated
      row is a one-way door with no answer to a changed mind. */
  onRestore?: (id: string | number) => void | Promise<void>;
  onImpact?: (id: string | number) => FactSemanticImpactLink[] | Promise<FactSemanticImpactLink[]>;
}) {
  /* Local overlay so the row visibly settles the moment it is verified, with
     or without a server behind the page (§2). With `onVerify` wired the write
     lands first and the overlay is what the reader sees until the next read.

     It is cleared whenever a new `facts` array arrives (the sentinel below):
     the overlay used to survive every refetch, so a claim un-verified on the
     server kept reading "Verified" here until someone reloaded the tab
     (P-FA-4, C1). */
  const [verified, setVerified] = useState<(string | number)[]>([]);
  const [retired, setRetired] = useState<(string | number)[]>([]);
  const [restored, setRestored] = useState<(string | number)[]>([]);
  const [busy, setBusy] = useState<string | number | null>(null);
  const [failed, setFailed] = useState<Record<string | number, string>>({});
  const [seenFacts, setSeenFacts] = useState(facts);
  const [impact, setImpact] = useState<{ fact: Fact; links: FactSemanticImpactLink[] } | null>(null);
  if (seenFacts !== facts) {
    setSeenFacts(facts);
    setVerified([]);
    setRetired([]);
    setRestored([]);
    setFailed({});
  }

  if (facts.length === 0) {
    return <EmptyState title="No facts in this view">Nothing matches the current filter.</EmptyState>;
  }

  const write = async (f: Fact, run: () => void | Promise<void>, settle: () => void, floor: string) => {
    setBusy(f.id);
    setFailed((e) => { const n = { ...e }; delete n[f.id]; return n; });
    try {
      await run();
      settle();
    } catch (err) {
      setFailed((e) => ({ ...e, [f.id]: why(err, floor) }));
    } finally {
      setBusy(null);
    }
  };

  const verify = (f: Fact) =>
    write(f, () => onVerify?.(f.id), () => setVerified((v) => [...v, f.id]), "Could not verify that claim.");
  const retire = (f: Fact) =>
    write(f, () => onRetire?.(f.id), () => {
      setRetired((r) => [...r, f.id]);
      setRestored((r) => r.filter((id) => id !== f.id));
    }, "Could not invalidate that claim.");
  const restore = (f: Fact) =>
    write(f, () => onRestore?.(f.id), () => {
      setRestored((r) => [...r, f.id]);
      setRetired((r) => r.filter((id) => id !== f.id));
    }, "Could not restore that claim.");

  return (
    /* <Table> draws its own card. It used to be wrapped in a second, flush
       <Card>, so the ledger opened on a blank ~22px band between two nested
       borders — read on the canvas as a count strip rendering with nothing in
       it. One box per table. */
    <>
      {/* Every column carries the standard sort affordance; the action column
          is the one exception and says so rather than passing a bare string
          the table would try to sort by (§3, C3). Every row carries a
          clickable action, so status is second-to-last. */}
      <Table
        noun="facts"
        head={[
          { label: "Claim", key: "claim" },
          { label: "Owner", key: "owner" },
          /* "Date", not "Verified": the cell shows the verification date OR
             the captured date (title says which), and a header claiming every
             date below it is a verification would lie about half of them. */
          { label: "Date", key: "verified", align: "center" },
          { label: "Status", key: "status" },
          { label: "", key: "actions", sortable: false },
        ]}
        minW={760}
      >
        {facts.map((f) => {
          const isRestored = restored.includes(f.id);
          const isRetired = !isRestored && retired.includes(f.id);
          const isClosed = !isRestored
            && (isRetired || ["invalidated", "retired"].includes(factStatusKey(f.status)));
          const isVerified = !isClosed && !isRestored && (verified.includes(f.id) || isVerifiedFact(f));
          const status = isRetired ? "Invalidated" : isVerified ? "Verified"
            : isRestored ? "Needs review" : f.status;
          return (
            <tr key={f.id} className="border-b border-ink/[0.06] last:border-0">
              {/* §12: claim, source and owner are arbitrarily long user values,
                  so they truncate with the full text on hover. They used to
                  `break-words`, which reflowed the row and pulled every
                  neighbouring column out of plumb (C4). */}
              <td className="px-4 py-3 align-top">
                <Truncate lines={2} className="text-[13px] font-medium text-ink">{f.claim}</Truncate>
                <Truncate className="mt-0.5 font-term text-[11px] text-ink/65">{f.source}</Truncate>
                {(f.highImpact || f.impactCount) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {f.highImpact && <Chip label="High impact" tone="attention" dot />}
                    <span className="text-[10.5px] text-ink/70">
                      {f.impactCount} related evidence link{f.impactCount === 1 ? "" : "s"}
                      {f.validFrom ? ` · valid since ${fmtDate(f.validFrom)}` : ""}
                    </span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 align-top text-[12.5px] text-ink/70"><Truncate>{f.owner}</Truncate></td>
              {/* The bare date; which date it is rides in the title. The cell
                  used to spell "Captured" out, which read as clutter against
                  a column of plain dates. */}
              <td className="px-4 py-3 align-top text-center text-[12.5px] text-ink/70 whitespace-nowrap">
                {f.verified ? <span title="Verified">{fmtDate(f.verified)}</span>
                  : f.capturedAt ? <span title="Captured, not yet verified">{fmtDate(f.capturedAt)}</span>
                  : "Not recorded"}
              </td>
              <td className="px-4 py-3 align-top">{factChip(status)}</td>
              {/* nowrap: a long owner name pushed this column narrow enough to
                  break "Verify" across two lines. */}
              <td className="whitespace-nowrap px-4 py-3 align-top text-right">
                {/* A verified claim has nothing left to verify here, and the
                    status column one cell to the left already says so — the
                    word used to be repeated in this cell, twice per row.
                    Edit and Retire are drawn only when a handler exists (§2). */}
                {/* The one place a page-action failure stays a <FieldError>:
                    this is a TABLE ROW cell, and a banner here would blow the
                    row height apart and pull every neighbouring column out of
                    plumb (§3, XA-02's stated exception). The message still
                    reaches the reader, in the cell the action fired from. */}
                {failed[f.id] ? (
                  <FieldError>{failed[f.id]}</FieldError>
                ) : isClosed ? (
                  /* An invalidated claim is closed, not gone: Restore reopens
                     it as needs-review, so a changed mind has a way back that
                     is not re-typing the claim (which the unique constraint
                     refuses anyway). Retired stays closed. */
                  onRestore && factStatusKey(status) === "invalidated" ? (
                    <Button compact disabled={busy === f.id} onClick={() => void restore(f)}>
                      {busy === f.id ? "Restoring…" : "Restore"}
                    </Button>
                  ) : null
                ) : (
                  <span className="inline-flex items-center justify-end gap-2">
                    {!isVerified && (
                      <Button compact variant="primary" disabled={busy === f.id} onClick={() => void verify(f)}>
                        {busy === f.id ? "Verifying…" : "Verify"}
                      </Button>
                    )}
                    {onImpact && (f.impactCount ?? 0) > 0 && (
                      <Button compact disabled={busy === f.id} onClick={() => void write(
                        f, async () => setImpact({ fact: f, links: await onImpact(f.id) }), () => {},
                        "Could not read this fact's impact neighborhood.",
                      )}>Impact</Button>
                    )}
                    {onEdit && <Button compact disabled={busy === f.id} onClick={() => onEdit(f)}>Edit</Button>}
                    {onRetire && (
                      <ConfirmButton compact confirmLabel="Invalidate and preserve impact" disabled={busy === f.id} onConfirm={() => void retire(f)}>
                        Invalidate
                      </ConfirmButton>
                    )}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      {impact && (
        <Drawer open onClose={() => setImpact(null)} title="Fact impact neighborhood"
          subtitle="Embedding-related facts and temporally versioned evidence">
          <div className="flex flex-col gap-3">
            <div className="rounded border border-ink/12 bg-ink/[0.02] p-3 text-[13px] font-medium text-ink">{impact.fact.claim}</div>
            {impact.links.map((link) => (
              <div key={`${link.targetType}-${link.targetId}`} className="rounded border border-ink/10 p-3">
                <div className="flex items-center gap-2">
                  <Chip label={link.relation} tone={link.relation === "contradicts" ? "blocked" : link.relation === "source" ? "ok" : "info"} dot />
                  <span className="font-term text-[10.5px] text-ink/70">{Math.round(link.similarity * 100)}% similar</span>
                </div>
                <div className="mt-1.5 text-[12.5px] font-medium text-ink/80">{link.targetLabel}</div>
                <div className="mt-1 text-[11px] text-ink/70">
                  {link.targetType}{link.targetUpdatedAt ? ` · source revised ${fmtDate(link.targetUpdatedAt)}` : ""}
                  {link.observedAt ? ` · mapped ${fmtDate(link.observedAt)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </>
  );
}

/* The claim form: "New fact" from the header, or a row's Edit. One drawer for
   both, so a correction is collected by the same fields that captured the
   claim in the first place.

   Labels come from <FormField>, which wraps its control in a real <label>;
   <Field> is the read-only detail row and left every control here named only
   by its placeholder (§7). */
function FactDrawer({ fact, onSave, onClose }: {
  /** The claim being rewritten, or null when capturing a new one. */
  fact: Fact | null;
  onSave?: (fact: NewFact) => void | Promise<void>;
  onClose: () => void;
}) {
  const [claim, setClaim] = useState(fact?.claim ?? "");
  const [source, setSource] = useState(fact?.source ?? "");
  const [owner, setOwner] = useState(fact?.owner ?? "");
  /* One hook for the busy/failed pair the drawer used to keep by hand: no
     handler closes the drawer immediately, a handler is awaited first (XA-04). */
  const write = useWrite();
  const editing = fact !== null;

  const submit = async () => {
    await write.run(
      onSave && (() => onSave({ claim: claim.trim(), source: source.trim(), owner: owner.trim() })),
      onClose,
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={editing ? "Edit fact" : "New fact"}
      subtitle="A claim the team relies on"
      icon={<ShieldCheck size={16} className="text-moss" />}
      footer={
        <>
          {/* Primary bottom left, secondary to its right (§2). */}
          <Button variant="primary" disabled={write.busy || !claim.trim() || !source.trim()} onClick={() => void submit()}>
            {write.busy ? "Saving…" : editing ? "Save changes" : "Add fact"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Claim">
          <Textarea short autoFocus value={claim} onChange={(e) => setClaim(e.target.value)}
            placeholder="Free-tier limits are enforced per workspace." className="w-full" />
        </FormField>
        <FormField label="Where it comes from">
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="pricing.md" className="w-full font-term" />
        </FormField>
        <FormField label="Owner">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Maya Chen" className="w-full" />
        </FormField>
        {/* A refused save accuses the whole claim, not one of the three fields
            above it, so it is a banner rather than a FieldError (XA-02). */}
        <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
        {!editing && (
          <div className="text-[11.5px] text-ink/65">
            A new claim starts as Needs review until someone verifies it.
          </div>
        )}
      </div>
    </Drawer>
  );
}

/* Frozen create-review-task lifecycle — mirrors FactsVerificationAudit's stale
   row so each mutation phase (creating / done / error) is capturable. */
function ReviewTaskAudit({ task }: { task: FactTaskAudit }) {
  return (
    <Card
      icon={<ShieldCheck size={17} className="text-moss" />}
      title={task.title}
      hint={task.hint}
      variant="flush"
    >
      {/* The row carries a clickable action, so status is second-to-last (§3).
          Column objects, not bare strings, so the action column declares that
          it does not sort (C3). */}
      <Table
        noun="rows"
        head={[
          { label: "Claim", key: "claim" },
          { label: "Verified", key: "verified", align: "center" },
          { label: "Status", key: "status" },
          { label: "", key: "actions", sortable: false },
        ]}
        minW={640}
      >
        <tr className="border-b border-ink/[0.06] last:border-0">
          <td className="px-4 py-3 align-top">
            <Truncate lines={2} className="text-[13px] font-medium text-ink">{task.claim}</Truncate>
            <Truncate className="mt-0.5 font-term text-[11px] text-ink/65">{task.meta}</Truncate>
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-center align-top text-[12.5px] text-ink/70">{fmtDate(task.verified)} <span className="text-ink/65">{`· ${task.age}`}</span></td>
          <td className="px-4 py-3 align-top"><Chip label={task.statusLabel} tone="attention" dot /></td>
          <td className="px-4 py-3 align-top text-right">
            {task.phase === "error" ? (
              /* Same table-row exception as FactsTable: a banner in this cell
                 would wreck the row height, so the failure stays a FieldError
                 here rather than a bespoke espelette span (§3, XA-02). */
              <FieldError>{task.errorText}</FieldError>
            ) : (
              /* One "Create review task" everywhere, with one icon, one busy
                 word and one done word: this cell spelled the done state
                 "Task created" while the drawers said "Review task created"
                 (§16, XA-23). */
              <CreateReviewTaskButton compact state={task.phase === "done" ? "done" : "busy"} />
            )}
          </td>
        </tr>
      </Table>
    </Card>
  );
}

/** A workspace with no facts at all. Derived from the data, so it is true in
    the real app for exactly the same reason it is true on the canvas. */
function isEmpty(d: FactsData): boolean {
  return !d.facts.length && !d.audit?.length && !d.taskAudit && !d.impact && !d.extras;
}

const AI_RECOMMENDATION_LABELS: Record<string, string> = {
  new_fact: "Accept as a new fact",
  supersede: "Supersede the related fact",
  qualify: "Accept with temporal qualification",
  duplicate: "Link to the existing fact",
  reject: "Reject",
  needs_review: "Needs human judgment",
};

function AiFactProposal({ intelligence }: { intelligence?: FactIntelligence }) {
  const proposal = intelligence?.adjudication ?? {};
  const recommendation = typeof proposal.recommendation === "string" ? proposal.recommendation : "";
  if (!recommendation) return null;
  const confidence = typeof proposal.confidence === "number" ? proposal.confidence : null;
  const relation = typeof proposal.relation === "string" ? proposal.relation : "";
  const reason = typeof proposal.reason === "string" ? proposal.reason : "";
  const needsHuman = proposal.needs_human_review !== false;
  return (
    <section className="mt-3 rounded border border-biscay-2/20 bg-biscay-2/[0.045] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-term text-[10px] uppercase tracking-[0.1em] text-biscay-2">AI recommendation</span>
        <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-ink/80">
          {AI_RECOMMENDATION_LABELS[recommendation] ?? recommendation.split("_").join(" ")}
        </span>
        {confidence !== null && <span className="font-term text-[10px] text-ink/60">{Math.round(confidence * 100)}% confidence</span>}
        <span className={`rounded px-2 py-0.5 font-term text-[9.5px] uppercase ${
          needsHuman ? "bg-espelette/10 text-espelette" : "bg-moss/10 text-moss"
        }`}>{needsHuman ? "Human decision required" : "Eligible for bounded auto-review"}</span>
      </div>
      {reason && <p className="mt-1.5 text-[11.5px] leading-5 text-ink/70">{reason}</p>}
      {relation && <div className="mt-1 font-term text-[10px] text-ink/50">Evidence relation · {relation}</div>}
    </section>
  );
}

function FactCandidateReview({ run, onReview, onContinue }: {
  run: FactScan;
  onReview?: (candidateId: number, accept: boolean, reason: string) => Promise<void>;
  onContinue?: () => Promise<void>;
}) {
  const [notes, setNotes] = useState<Record<string | number, string>>({});
  const [busy, setBusy] = useState<number | "continue" | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!run.candidates.length) return null;
  const pending = run.candidates.filter((candidate) => candidate.status === "pending").length;
  const accepted = run.candidates.filter((candidate) => candidate.status === "accepted").length;
  const rejected = run.candidates.filter((candidate) => candidate.status === "rejected").length;

  const decide = async (candidate: FactCandidate, accept: boolean) => {
    if (!onReview || busy !== null) return;
    setBusy(candidate.id); setFailed(null);
    try { await onReview(candidate.id, accept, notes[candidate.id] ?? ""); }
    catch (error) { setFailed(why(error, "The review decision could not be saved.")); }
    finally { setBusy(null); }
  };
  const complete = async () => {
    if (!onContinue || busy !== null || pending) return;
    setBusy("continue"); setFailed(null);
    try { await onContinue(); }
    catch (error) { setFailed(why(error, "The workflow could not continue.")); }
    finally { setBusy(null); }
  };

  return (
    <Card variant="plain" title="Review extracted facts" eyebrow={`${pending} pending · ${accepted} accepted · ${rejected} rejected`}>
      <div className="flex flex-col gap-3">
        {failed && <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>}
        {Boolean(run.llmBudgets?.length) && (
          <section className="rounded border border-ink/12 bg-ink/[0.018] p-3">
            <div className="font-term text-[10px] uppercase tracking-[0.1em] text-ink/70">Bounded LLM usage</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {run.llmBudgets!.map((budget) => (
                <div key={`${budget.stage}-${budget.purpose}`} className="rounded border border-ink/10 bg-white px-2.5 py-2">
                  <div className="text-[11.5px] font-medium text-ink/80">{budget.stage.split("_").join(" ")}</div>
                  <div className="mt-0.5 font-term text-[10px] text-ink/70">
                    {budget.callsUsed}/{budget.maxCalls} calls · {budget.inputTokens}/{budget.maxInputTokens} in · {budget.outputTokens}/{budget.maxOutputTokens} out
                  </div>
                  <div className="mt-1 text-[10.5px] text-ink/70">{budget.model || "Configured model"} · {budget.status}</div>
                </div>
              ))}
            </div>
          </section>
        )}
        {run.candidates.map((candidate) => (
          <section key={candidate.id} className="rounded border border-ink/12 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[13.5px] font-medium text-ink">{candidate.claim}</div>
                  {candidate.highImpact && <Chip label={`High impact · ${candidate.impactScore}`} tone="attention" dot />}
                </div>
                <div className="mt-1 font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/70">{candidate.documentTitle}</div>
              </div>
              <span className="shrink-0 rounded border border-ink/15 px-2 py-1 font-term text-[10px] uppercase tracking-[0.06em] text-ink/65">
                {candidate.status}
              </span>
            </div>
            {candidate.evidence && <blockquote className="mt-2 border-l-2 border-moss/35 pl-3 text-[12.5px] text-ink/70">{candidate.evidence}</blockquote>}
            <AiFactProposal intelligence={candidate.intelligence} />
            {candidate.semanticLinks.length > 0 && (
              <div className="mt-3 rounded border border-ink/10 bg-ink/[0.018] p-2.5">
                <div className="font-term text-[10px] uppercase tracking-[0.1em] text-ink/70">Impact neighborhood</div>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {candidate.semanticLinks.map((link) => (
                    <li key={`${link.targetType}-${link.targetId}`} className="flex items-start gap-2 text-[11.5px] text-ink/70">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-term text-[9.5px] uppercase ${
                        link.relation === "contradicts" ? "bg-espelette/10 text-espelette" :
                        link.relation === "source" ? "bg-moss/10 text-moss" : "bg-biscay-2/10 text-biscay-2"
                      }`}>{link.relation}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-ink/80">{link.targetLabel}</span>
                        <span className="ml-1.5 text-ink/50">
                          {Math.round(link.similarity * 100)}%{link.targetUpdatedAt ? ` · source revised ${fmtDate(link.targetUpdatedAt)}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {candidate.intelligence && (
              <details className="mt-3 rounded border border-ink/10 bg-ink/[0.018] p-2.5">
                <summary className="cursor-pointer font-term text-[10px] uppercase tracking-[0.1em] text-ink/60">
                  Assertion, evidence, and temporal context
                </summary>
                <div className="mt-2 grid gap-3 text-[11.5px] text-ink/70 sm:grid-cols-2">
                  <div>
                    <div className="font-medium text-ink/80">Embedding components</div>
                    <ul className="mt-1 space-y-1">
                      {candidate.intelligence.components.map((component, index) => (
                        <li key={`${component.role}-${index}`}><span className="font-term text-[9.5px] uppercase text-ink/45">{component.role}</span> · {component.text}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium text-ink/80">Temporal scope and AI proposal</div>
                    <div className="mt-1">Valid {candidate.intelligence.validFrom ? fmtDate(candidate.intelligence.validFrom) : "from an unspecified date"}
                      {candidate.intelligence.validTo ? ` until ${fmtDate(candidate.intelligence.validTo)}` : " · no end recorded"}</div>
                    {Object.keys(candidate.intelligence.adjudication).length > 0 &&
                      <div className="mt-1 text-[10.5px] text-ink/55">The recommendation and rationale are shown above.</div>}
                  </div>
                </div>
                {candidate.intelligence.evidenceGroups.map((group, index) => (
                  <div key={`${group.verdict}-${index}`} className="mt-2 rounded border border-ink/10 bg-white p-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-medium text-ink/80">{group.verdict}</span>
                      <span>{Math.round(group.confidence * 100)}% · {group.decisionKind}{group.sufficient ? " · sufficient" : " · needs review"}</span>
                    </div>
                    {group.rationale && <div className="mt-1 text-[11px] text-ink/60">{group.rationale}</div>}
                    {group.spans.map((span, spanIndex) => (
                      <blockquote key={`${span.documentTitle}-${spanIndex}`} className="mt-1.5 border-l-2 border-moss/30 pl-2 text-[11px] text-ink/65">
                        {span.quote}<span className="ml-1 text-ink/45">— {span.documentTitle} · {span.role}{span.similarity !== null ? ` · ${Math.round(span.similarity * 100)}%` : ""}</span>
                      </blockquote>
                    ))}
                  </div>
                ))}
                {candidate.intelligence.clusters.length > 0 && (
                  <div className="mt-2 text-[11px] text-ink/60">Clusters: {candidate.intelligence.clusters.map((cluster) =>
                    `${cluster.label || cluster.stableKey} (${cluster.labelKind})`).join(" · ")}</div>
                )}
              </details>
            )}
            {candidate.status === "pending" && onReview ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input aria-label={`Review note for ${candidate.claim}`} placeholder="Review note (optional)"
                  value={notes[candidate.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [candidate.id]: event.target.value }))}
                  className="min-w-[240px] flex-1" />
                <Button variant="default" disabled={busy !== null} onClick={() => void decide(candidate, false)}>Reject</Button>
                <Button variant="primary" disabled={busy !== null} onClick={() => void decide(candidate, true)}>Accept</Button>
              </div>
            ) : (candidate.reviewReason || candidate.reviewer) && (
              <div className="mt-2 text-[11.5px] text-ink/60">
                {[candidate.reviewer, candidate.reviewReason].filter(Boolean).join(" · ")}
              </div>
            )}
          </section>
        ))}
        {run.status === "waiting" && onContinue && (
          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
            <span className="text-[12px] text-ink/65">
              {pending ? `Decide ${pending} remaining candidate${pending === 1 ? "" : "s"} to continue.` : "All candidates have a verdict."}
            </span>
            <Button variant="primary" disabled={pending > 0 || busy !== null} onClick={() => void complete()}>
              {busy === "continue" ? "Publishing…" : "Continue & publish"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function Body({ data, error, actions, auditOpen, onCloseAudit, scan, onDismissScan, onRetryScan, onEditFact, onReviewCandidate, onContinueReview }: {
  data: FactsData; error: string | null; actions?: FactsActions;
  auditOpen: boolean; onCloseAudit: () => void;
  scan: FactScan | null; onDismissScan: () => void; onRetryScan?: () => void;
  onEditFact: (fact: Fact) => void;
  onReviewCandidate: (candidateId: number, accept: boolean, reason: string) => Promise<void>;
  onContinueReview: () => Promise<void>;
}) {
  /* Which status tab is showing. `data.filter` seeds it and an app can still
     serve pre-filtered rows, but the row itself is a view over the rows already
     on screen — it was wired to `onChange={() => {}}`, so every tab but the one
     the data named was unreachable.

     The sentinel resyncs the selection when a refetch changes which tab the
     ledger opens on; local state seeded from `data` used to keep rendering the
     first response forever (C1). */
  const [tab, setTab] = useState(data.filter);
  const [seenFilter, setSeenFilter] = useState(data.filter);
  if (seenFilter !== data.filter) { setSeenFilter(data.filter); setTab(data.filter); }

  /* Free-text filter over the rows on screen. The table paginates on its own
     past 25 rows, but a ledger of thousands still has to be searchable, and
     the "many" state used to just grow (P-FA-2). */
  const [query, setQuery] = useState("");
  /* The filter bar (owner, date range) beside the status tabs — the same
     view-over-rows-on-screen the tabs and search are; nothing round-trips. */
  const [owner, setOwner] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const selected = data.filters.find((f) => f.id === tab) ?? data.filters.find((f) => f.id === data.filter);
  const inTab = selected?.status
    ? data.facts.filter((f) => factStatusKey(f.status) === factStatusKey(selected.status!))
    : data.facts;
  const q = query.trim().toLowerCase();
  const searched = q
    ? inTab.filter((f) => `${f.claim} ${f.source} ${f.owner}`.toLowerCase().includes(q))
    : inTab;
  const owners = Array.from(new Set(data.facts.map((f) => f.owner).filter(Boolean))).sort();
  /* A refetch can remove the last fact by the selected owner. The native
     select then DISPLAYS "All owners" (a value with no matching option)
     while the stale state filters every row away — the bar looked clean over
     an empty table. A selection the list no longer holds is treated as the
     All it already reads as. */
  const activeOwner = owners.includes(owner) ? owner : "";
  const byOwner = activeOwner ? searched.filter((f) => f.owner === activeOwner) : searched;
  /* A fact's date for the range filter: EXACTLY the date the row displays —
     verification first, capture for unverified rows, and nothing else: the
     old validFrom fallback made a row filterable by a date its cell never
     shows. A dated range keeps only dated rows — waving undated rows
     through would answer a date question with rows that have no date. */
  const factTime = (f: Fact): number | null => {
    const raw: DateInput | null | undefined = f.verified || f.capturedAt;
    if (!raw) return null;
    // toDate, not new Date: a date-only value like "2026-08-18" must sit on
    // the same local day the cell renders it on, not on UTC midnight.
    const t = toDate(raw).getTime();
    return Number.isNaN(t) ? null : t;
  };
  const fromTime = dateFrom ? localDayStart(dateFrom) : null;
  const toTime = dateTo ? localDayStart(dateTo) + 86_400_000 : null;
  const rows = fromTime === null && toTime === null ? byOwner : byOwner.filter((f) => {
    const t = factTime(f);
    if (t === null) return false;
    return (fromTime === null || t >= fromTime) && (toTime === null || t < toTime);
  });

  if (error) {
    return (
      <div className="mt-6">
        {/* A ledger that did not load is not a ledger with nothing in it: an
            EmptyState here reported a failure as emptiness (§8, XA-01). */}
        <ReadError>{error}</ReadError>
      </div>
    );
  }
  if (isEmpty(data)) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        {/* The scan strip belongs here too: an empty ledger is exactly where
            someone presses the button, and the run has to be visible then. */}
        {scan && <ScanRunCard run={scan} noun="claim" label="Scanning the corpus" onDismiss={onDismissScan} onRetry={onRetryScan} />}
        {/* The review queue waits for a real run: the optimistic starting
            card carries no id yet, and an empty queue under it reads as a
            result nothing has produced. */}
        {scan && scan.id && <FactCandidateReview run={scan} onReview={actions?.reviewFactCandidate ? onReviewCandidate : undefined}
          onContinue={actions?.completeFactReview ? onContinueReview : undefined} />}
        <EmptyState title="No facts yet">
          {actions?.scanFacts
            ? "Capture a claim or run “Scan for facts” to start building your verified knowledge base."
            : "Capture a claim to start building your verified knowledge base."}
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* Filter row: tabs left, search right, on ONE line (§13). It filters the
          LEDGER, so it is drawn only when the ledger is what is on screen. On
          the expanded-fact view it stayed up over a table that was not
          rendered and counted rows that were not there: `All 0 · Verified 0 ·
          Needs review 0 · Contradicted 0 · Stale 0` above a verified fact. */}
      {!data.impact && (
        <div className="flex flex-wrap items-center gap-3">
          {/* The filter bar in the console's shared idiom (navigation/
              FilterTrigger, the Workflows bar), in its order: search
              stretching, then Status, Owner, Dates. Every one a view over
              the rows on screen; cleared by picking All / blanking a date. */}
          <FilterSearch
            aria-label="Search claims"
            value={query}
            onSearch={setQuery}
            placeholder="Search claims, sources, owners"
          />
          <FilterSelect label="Status" aria-label="Filter by status"
            value={selected?.id ?? data.filter} onChange={(e) => setTab(e.target.value)}>
            {/* Counts describe the rows this page holds, not a workspace-wide
                total the table cannot show (C2) — carried over from the tab
                strip this select replaced. */}
            {data.filters.map((f) => {
              const count = f.status
                ? data.facts.filter((x) => factStatusKey(x.status) === factStatusKey(f.status!)).length
                : data.facts.length;
              return <option key={f.id} value={f.id}>{`${f.label} (${count})`}</option>;
            })}
          </FilterSelect>
          <FilterSelect label="Owner" aria-label="Filter by owner" value={activeOwner}
            onChange={(e) => setOwner(e.target.value)}>
            <option value="">All owners</option>
            {owners.map((name) => <option key={name} value={name}>{name}</option>)}
          </FilterSelect>
          <FilterField label="Dates">
            <input type="date" aria-label="Date from" value={dateFrom} max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 w-[124px] border-0 bg-transparent text-[13px] text-ink outline-none" />
            {/* ink/70: the contrast floor for small text (axe color-contrast) */}
            <span className="text-[12px] text-ink/70">to</span>
            <input type="date" aria-label="Date to" value={dateTo} min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-7 w-[124px] border-0 bg-transparent text-[13px] text-ink outline-none" />
          </FilterField>
        </div>
      )}
      {scan && <ScanRunCard run={scan} noun="claim" label="Scanning the corpus" onDismiss={onDismissScan} onRetry={onRetryScan} />}
      {scan && scan.id && <FactCandidateReview run={scan} onReview={actions?.reviewFactCandidate ? onReviewCandidate : undefined}
        onContinue={actions?.completeFactReview ? onContinueReview : undefined} />}
      {data.banner && <Alert tone="blocked" title={data.banner.title}>{data.banner.body}</Alert>}
      {data.extras && <Extras extras={data.extras} />}
      {data.impact ? (
        <Card variant="plain" title={data.impact.title} eyebrow="Verified fact: expanded">
          <ImpactPanelFeature
            claim={data.impact.claim}
            source={data.impact.source}
            verifiedAt={data.impact.verifiedAt}
            summary={data.impact.summary}
            docs={data.impact.docs}
            analyzed={data.impact.analyzed}
          />
        </Card>
      ) : (
        // The table stands down for a ledger with no rows at all; filters
        // that narrow every row out get the named empty state below instead.
        data.facts.length > 0 && rows.length === 0 ? (
          /* Four filters compose here, and "nothing matches the current
             filter" named none of them — a stale owner or a date window was
             indistinguishable from an empty ledger. Say which filters are
             narrowing, and hand back the way out. */
          <EmptyState
            title="No facts match these filters"
            action={<Button compact onClick={() => {
              setQuery(""); setOwner(""); setDateFrom(""); setDateTo("");
              setTab(data.filters.find((f) => !f.status)?.id ?? data.filter);
            }}>Clear filters</Button>}
          >
            {`The ledger holds ${data.facts.length} fact${data.facts.length === 1 ? "" : "s"} outside this view, narrowed by ${[
              query.trim() && `search "${query.trim()}"`,
              selected?.status && `status ${selected.label}`,
              activeOwner && `owner ${activeOwner}`,
              (dateFrom || dateTo) && (dateFrom && dateTo
                ? `dates ${dateFrom} to ${dateTo}`
                : dateFrom ? `dates from ${dateFrom}` : `dates to ${dateTo}`),
            ].filter(Boolean).join(", ")}.`}
          </EmptyState>
        ) : data.facts.length > 0 && (
          <FactsTable
            facts={rows}
            onVerify={actions?.verifyFact}
            onEdit={actions?.editFact ? onEditFact : undefined}
            onRetire={actions?.retireFact}
            onRestore={actions?.restoreFact}
            onImpact={actions?.inspectFactImpact}
          />
        )
      )}
      {data.taskAudit && <ReviewTaskAudit task={data.taskAudit} />}
      {/* The audit is a view of the same rows: it arrives in `data` for the
          states that are about it, and "Audit documents" opens it over the
          rows already on screen otherwise. */}
      {(data.audit ?? (auditOpen ? data.facts : null)) && (
        <FactsVerificationAudit
          facts={data.audit ?? data.facts}
          onCreateReviewTask={actions?.createReviewTask}
          onClose={data.audit ? undefined : onCloseAudit}
        />
      )}
    </div>
  );
}

/** How often the page re-reads a running scan. Slow enough that a minutes-long
    corpus scan is not a hot loop, fast enough that the bar visibly moves. */
const SCAN_POLL_MS = 1500;

function FactsPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<FactsData, FactsActions>) {
  const [auditOpen, setAuditOpen] = useState(false);
  /* The claim form: `null` = closed, `{ fact: null }` = capturing a new claim,
     `{ fact }` = correcting an existing one. */
  const [editing, setEditing] = useState<{ fact: Fact | null } | null>(null);
  const [scan, setScan] = useState<FactScan | null>(null);
  const [scanRecovered, setScanRecovered] = useState(false);
  /* The scan's busy/failed pair, from the one hook (XA-04). The poll below
     reports through the same surface, so a run that starts and then stops
     answering has one banner, not two. */
  const scanWrite = useWrite();
  // Stable identity for the poll effect below: the hook's object is new every
  // render, its setter is not.
  const { setFailed: setScanFailed } = scanWrite;

  /* Follow a run that is still going. The poll is an effect (not a chain of
     timeouts inside the click) so it stops when the page unmounts and never
     outlives the run it is reading. */
  const progress = actions?.scanProgress;
  const runId = scan && (scan.status === "running" || scan.status === "pending") ? scan.id : null;
  const activeRunId = scan && (scan.status === "running" || scan.status === "pending" || scan.status === "waiting") ? scan.id : null;
  const latestScan = actions?.latestFactScan;
  useEffect(() => {
    if (scanRecovered || !latestScan) return;
    setScanRecovered(true);
    void Promise.resolve(latestScan()).then((latest) => { if (latest) setScan(latest); })
      .catch((err) => setScanFailed(why(err, "The latest fact workflow could not be read.")));
  }, [latestScan, scanRecovered, setScanFailed]);
  useEffect(() => {
    if (!runId || !progress) return;
    let alive = true;
    const tick = window.setInterval(() => {
      void (async () => {
        try {
          const next = await progress(runId);
          if (alive) setScan(next);
        } catch (err) {
          if (alive) setScanFailed(why(err, "The scan could not be read."));
        }
      })();
    }, SCAN_POLL_MS);
    return () => { alive = false; window.clearInterval(tick); };
  }, [runId, progress, setScanFailed]);

  if (loading) {
    return (
      <PageFrame chrome={chrome} active={navFor("facts")} title="Facts" mobile={mobile}>
        <SkeletonPage
          variant="table"
          eyebrow="Verification"
          title="Facts"
          description="Every claim the team relies on: verified, owned, and traced to its impact across the corpus."
          /* The same head the loaded table renders, so the grid does not
             reflow when the rows land. */
          icon={<span className="text-moss"><Shield size={26} /></span>}
          columns={["Claim", "Owner", "Date", "Status"]}
          search="Search claims, sources, owners"
          sections={["Verification audit"]}
          actions={["Audit documents", { label: "New fact", variant: "primary" }]}
          mobile={mobile}
        />
      </PageFrame>
    );
  }

  const scanFacts = actions?.scanFacts;

  const launchScan = async (start: () => FactScan | Promise<FactScan>) => {
    if (scanWrite.busy || activeRunId) return;
    // The card appears the moment the click lands. Starting a scan writes
    // the workflow configuration before a run exists, and the page used to
    // show nothing for that whole round trip. The placeholder has no id, so
    // the poll and the review queue both wait for the real run.
    setScan({ id: "", label: "Fact scan · starting", status: "pending",
              progress: 0, steps: [], added: null, candidates: [] });
    // `runFor`: the run itself is the result the page then follows.
    const started = await scanWrite.runFor(start);
    setScan(started || null);
  };
  const startScan = async () => { if (scanFacts) await launchScan(scanFacts); };
  const retryScan = actions?.retryFactScan ?? scanFacts;
  const reviewCandidate = async (candidateId: number, accept: boolean, reason: string) => {
    if (!scan || !actions?.reviewFactCandidate) return;
    const next = await actions.reviewFactCandidate(scan.id, candidateId, accept, reason);
    setScan(next);
  };
  const continueReview = async () => {
    if (!scan || !actions?.completeFactReview) return;
    const next = await actions.completeFactReview(scan.id);
    setScan(next);
  };
  const dismissScan = async () => {
    if (!scan || scanWrite.busy) return;
    if (actions?.dismissFactScan) {
      const dismissed = await scanWrite.runFor(async () => {
        await actions.dismissFactScan!(scan.id);
        return true;
      });
      if (!dismissed) return;
    }
    setScan(null);
  };

  const headerActions = (
    <>
      {/* A real background run, so a real button — the text link beside two
          buttons read as a footnote and hid what it starts. With no handler
          there is no run to follow, so the button is not drawn at all: it used
          to fabricate a progress bar that climbed to a "passed" nothing had
          run (P-FA-5, §2). */}
      {scanFacts && (
        <Button variant="default" disabled={scanWrite.busy || Boolean(activeRunId)} onClick={() => void startScan()}>
          <Workflow size={14} /> {scan?.status === "waiting" ? "Review pending" : scanWrite.busy || runId ? "Scanning…" : "Scan for facts"}
        </Button>
      )}
      <Button variant="default" aria-expanded={auditOpen} onClick={() => setAuditOpen((v) => !v)}>
        {auditOpen ? "Hide audit" : "Audit documents"}
      </Button>
      <Button variant="primary" onClick={() => setEditing({ fact: null })}>New fact</Button>
    </>
  );
  return (
    <PageFrame chrome={chrome} active={navFor("facts")} title="Facts" mobile={mobile}>
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <PageHeader
          icon={<span className="text-moss"><Shield size={26} /></span>}
          eyebrow="Verification"
          title="Facts"
          description="Every claim the team relies on: verified, owned, and traced to its impact across the corpus."
          actions={mobile ? undefined : headerActions}
        />
        {mobile && <div className="mt-4 flex flex-wrap items-center gap-2">{headerActions}</div>}
        {/* A scan that would not start, or would not answer, is a failed write
            beside a button, not a bad value in an input (XA-02). */}
        <div className="mt-3 empty:mt-0">
          <WriteError onDismiss={() => scanWrite.setFailed(null)}>{scanWrite.failed}</WriteError>
        </div>
        <Body
          data={data}
          error={error}
          actions={actions}
          auditOpen={auditOpen}
          onCloseAudit={() => setAuditOpen(false)}
          scan={scan}
          onDismissScan={() => void dismissScan()}
          onRetryScan={retryScan ? () => void launchScan(retryScan) : undefined}
          onEditFact={(fact) => setEditing({ fact })}
          onReviewCandidate={reviewCandidate}
          onContinueReview={continueReview}
        />
        {data.pagination && <nav aria-label="Fact pages" className="mt-4 flex gap-4 text-sm">
          {data.pagination.previous && <a href={data.pagination.previous}>Previous page</a>}
          {data.pagination.next && <a href={data.pagination.next}>Next page</a>}
        </nav>}
      </div>
      {editing && (
        <FactDrawer
          fact={editing.fact}
          onSave={editing.fact
            ? (next) => actions?.editFact?.({ ...next, id: editing.fact!.id })
            : actions?.addFact}
          onClose={() => setEditing(null)}
        />
      )}
    </PageFrame>
  );
}

export const page: PageModule<FactsData, FactsActions> = {
  id: "facts",
  title: "Facts",
  route: "/facts",
  component: FactsPage,
  states: STATES.map((s) => ({ ...s })),
};
