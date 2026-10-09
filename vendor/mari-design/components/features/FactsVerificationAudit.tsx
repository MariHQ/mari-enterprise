import { useMemo, useState } from "react";
import { ClipboardCheck, ShieldCheck, X } from "lucide-react";
import { Button } from "../actions/Button";
import { Table, type TableHead } from "../data-display/Table";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { Truncate } from "../data-display/Truncate";
import { FieldError } from "../feedback/ErrorMessage";
import { CreateReviewTaskButton } from "../actions/RepeatedActions";
import { why } from "../actions/useWrite";
import { fmtDate, type DateInput } from "../tokens/format";

/* Facts verification audit — a client-side audit derived entirely from the
   already-loaded facts: it lists every Verified fact oldest-first and flags any
   verified more than 60 days ago as a stale candidate, offering a one-click
   Create review task. Ages are anchored to the newest verification on record so
   mixed seed/live data never yields negative ages. Composes the shared <Table>
   primitive — the same one FactsPage's claims ledger renders through — so the
   two tables on the Facts page share fonts, cell padding, sort chrome and
   header band. This panel must stay visually identical to that ledger. */

const STALE_AFTER_DAYS = 60;

const HEAD: TableHead[] = [
  { label: "Claim", key: "claim" },
  { label: "Owner", key: "owner" },
  { label: "Verified", key: "verified", align: "center" },
  { label: "Status", key: "status" },
  { label: "Review task", key: "reviewTask", sortable: false, align: "right" },
];

export type Fact = {
  id: string | number;
  claim: string;
  source: string;
  owner: string;
  /* XA-25: this union used to advertise "Needs evidence", a spelling that
     appears in no chip table and that FactsPage's FACT_STATUS has to alias
     onto `unsupported`. The suggestions are now the console's own status
     vocabulary (data-display/Chip.tsx), which is what the chips actually
     render; the trailing `string` stays because a ledger may spell a status
     however it likes and `factStatusKey` below is what normalises it. */
  status: "verified" | "unsupported" | "draft" | "retired" | "contradiction" | string;
  verified?: DateInput | null;
  validFrom?: DateInput | null;
  /** When the fact entered the ledger. The date an unverified row shows:
      before this, a claim captured today rendered with no date at all,
      because verification is the only other date the ledger keeps. */
  capturedAt?: DateInput | null;
  impactCount?: number;
  highImpact?: boolean;
};

/** A ledger status reduced to one comparable token: case, spacing and
    underscores are the API's business, not the console's. Every status test in
    the fact views goes through this, because the audit used to compare against
    the literal English string "Verified" and quietly dropped every row a
    workspace spelled "verified" or "VERIFIED" (P-FA-1). */
export const factStatusKey = (status: string) => status.trim().toLowerCase().replace(/[\s_]+/g, "-");

/** Is this claim verified, however its ledger spells the word? */
export const isVerifiedFact = (f: Pick<Fact, "status">) => factStatusKey(f.status) === "verified";

type TaskState = "idle" | "creating" | "done" | "error";

function toDate(input: DateInput): Date { return input instanceof Date ? input : new Date(input); }

function verifiedAgeDays(verified: DateInput | null | undefined, anchor: number): number | null {
  if (verified == null) return null;
  const d = toDate(verified);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((anchor - d.getTime()) / 86_400_000);
}

export type FactsVerificationAuditProps = {
  /** The facts to audit. Required: the panel never invents claims. */
  facts: Fact[];
  /** Open a re-verification task on a stale fact. May throw; the row shows the
      message in place of the button. Omitted = the local echo below. */
  onCreateReviewTask?: (fact: Fact) => string | void | Promise<string | void>;
  /** Render the surrounding close affordance (the panel is toggled open). */
  onClose?: () => void;
  /** Render a content-shaped skeleton while the audit is computing. */
  loading?: boolean;
  className?: string;
};

export function FactsVerificationAudit({
  facts, onCreateReviewTask, onClose, loading = false, className = "",
}: FactsVerificationAuditProps) {
  const [taskState, setTaskState] = useState<Record<string | number, TaskState>>({});
  const [tasks, setTasks] = useState<Record<string | number, string>>({});
  const [failed, setFailed] = useState<Record<string | number, string>>({});

  const auditRows = useMemo(() => {
    const verified = facts.filter(isVerifiedFact);
    const anchor = verified.reduce((max, f) => {
      const t = f.verified != null ? toDate(f.verified).getTime() : NaN;
      return Number.isNaN(t) ? max : Math.max(max, t);
    }, Number.NEGATIVE_INFINITY);
    const anchorMs = Number.isFinite(anchor) ? anchor : Date.now();
    return verified
      .map((f) => ({ fact: f, age: verifiedAgeDays(f.verified, anchorMs) }))
      .sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
  }, [facts]);

  const staleCount = auditRows.filter((r) => r.age != null && r.age > STALE_AFTER_DAYS).length;

  const createReviewTask = async (f: Fact) => {
    setTaskState((s) => ({ ...s, [f.id]: "creating" as const }));
    setFailed((e) => { const n = { ...e }; delete n[f.id]; return n; });
    try {
      if (!onCreateReviewTask) throw new Error('Review requests are not connected.');
      const reviewId = await onCreateReviewTask(f);
      setTaskState((s) => ({ ...s, [f.id]: "done" as const }));
      setTasks((t) => ({ ...t, [f.id]: typeof reviewId === "string" ? reviewId : "Submitted" }));
    } catch (err) {
      setTaskState((s) => ({ ...s, [f.id]: "error" as const }));
      setFailed((e) => ({ ...e, [f.id]: why(err, "Couldn’t reach Mari.") }));
    }
  };

  const closeButton = onClose && (
    <Button icon variant="link" aria-label="Close audit" onClick={onClose}><X size={16} /></Button>
  );

  if (loading) {
    return (
      <div className={className}>
        <Table title="Verification audit" head={HEAD} minW={760} pageSize={10} loading actions={closeButton}>
          <tr />
        </Table>
      </div>
    );
  }

  return (
    <div className={className}>
      <Table
        title="Verification audit"
        head={HEAD}
        minW={760}
        pageSize={10}
        noun="verified facts"
        /* The stale count used to be a note on the card's hint line
           ("Anything verified more than 60 days ago is a stale candidate.");
           <Table> has no hint slot, so it rides in the actions slot next to
           the close button instead — the chip's own word ("stale") carries
           the meaning the hint used to spell out. */
        actions={(staleCount > 0 || closeButton) && (
          <>
            {staleCount > 0 && <Chip label={`${staleCount.toLocaleString("en-US")} stale`} tone="attention" dot />}
            {closeButton}
          </>
        )}
      >
        {auditRows.length === 0 ? (
          <tr>
            <td className="px-4 py-10" colSpan={HEAD.length}>
              <EmptyState icon={<ShieldCheck size={24} />} title="Nothing to audit">No verified facts to audit yet.</EmptyState>
            </td>
          </tr>
        ) : (
          auditRows.flatMap(({ fact, age }) => {
            const stale = age != null && age > STALE_AFTER_DAYS;
            const state = taskState[fact.id] ?? "idle";
            const mainRow = (
              <tr key={fact.id} className="border-b border-ink/[0.06] last:border-0">
                <td className="align-top">
                  <Truncate lines={2} className="text-[13px] font-medium text-ink">{fact.claim}</Truncate>
                  <Truncate className="mt-0.5 font-term text-[11px] text-ink/65">{fact.source}</Truncate>
                </td>
                <td className="align-top text-[12.5px] text-ink/70"><Truncate>{fact.owner}</Truncate></td>
                <td className="align-top text-center text-[12.5px] text-ink/70 whitespace-nowrap">
                  {fact.verified ? fmtDate(fact.verified) : "Not recorded"}
                  {age != null && <span className="block text-ink/65">{age}d ago</span>}
                </td>
                <td className="align-top whitespace-nowrap">
                  {/* "Stale", not "Stale candidate": the longer label did not
                      fit the column and rendered as an ellipsised chip. The
                      actions-slot chip above carries the full meaning. */}
                  <Chip label={stale ? "Stale" : "Fresh"} tone={stale ? "attention" : "ok"} dot />
                </td>
                <td className="align-top whitespace-nowrap text-right">
                  {stale && (
                    <div className="flex flex-col items-end gap-1">
                      {/* XA-23: this was the table copy of "Create review
                          task", drawn with no icon and a done word
                          ("Task created") the drawers spelled differently.
                          One component owns label, glyph and both states. */}
                      <CreateReviewTaskButton
                        compact
                        state={state === "done" ? "done" : state === "creating" ? "busy" : "idle"}
                        onClick={() => void createReviewTask(fact)}
                      />
                      {/* XA-02 keeps <FieldError> for exactly this case: a
                          <WriteError> banner inside an action cell would
                          blow the row height apart and shove every other
                          column out of line (§3). The message still sits
                          beside the control that failed, and the button
                          stays clickable so the reader can retry. */}
                      {state === "error" && <FieldError>{failed[fact.id] ?? "Couldn’t reach Mari."}</FieldError>}
                    </div>
                  )}
                </td>
              </tr>
            );
            const taskRow = tasks[fact.id] ? (
              <tr key={`${fact.id}-task`} className="border-b border-ink/[0.06] last:border-0 bg-moss/[0.05]">
                <td className="font-term text-[11.5px] text-moss" colSpan={HEAD.length}>
                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardCheck size={13} />
                    {tasks[fact.id]} opened for {fact.owner}: re-verify “{fact.claim.slice(0, 48)}{fact.claim.length > 48 ? "…" : ""}”
                  </span>
                </td>
              </tr>
            ) : null;
            return [mainRow, taskRow];
          })
        )}
      </Table>
    </div>
  );
}
