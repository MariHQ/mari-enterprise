import { useState, type ReactNode } from "react";
import { MessagesSquare, FileText, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { Drawer } from "../layout/Drawer";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Textarea } from "../forms/Textarea";
import { Stepper } from "../data-display/Stepper";
import { Chip } from "../data-display/Chip";
import { Spinner } from "../data-display/Spinner";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonButton } from "../data-display/Skeleton";
import { focusRing } from "../tokens/focusRing";

/* AnswersHarvestWizard — the LLM-driven "question harvest" wizard opened from
   the Answers header. Scans picked knowledge sources for Q/A candidates, lets
   the user edit and accept/skip each, then imports the accepted set as draft
   answers. Four-step drawer: Sources → Scan → Review → Import.

   The scan used to resolve to four baked question/answer pairs about sessions,
   settlement queues and webhook retries — invented findings, attributed to
   "Google Docs" and "Notion", presented as what a real scan had turned up. A
   scan now returns what the CALLER can find: `onScan`, or the `candidates` it
   was handed. With neither, the scan honestly finds nothing and the wizard
   says so, which is the empty state it already carried and never reached.

   NOTE: `features/ApprovedAnswers` (the Approved answers tab of Workflows)
   composes its own harvest wizard inline, wired to `AnswersActions.harvest` /
   `.importAnswers`. This standalone drawer is the catalog rendition of the
   same flow; the tab is the one that ships. */

export type SourceId = "slack" | "docs" | "chat";
const SOURCES: { id: SourceId; label: string; description: string; icon: ReactNode }[] = [
  { id: "slack", label: "Slack", description: "Threads and decision chunks across connected channels.", icon: <MessagesSquare size={18} /> },
  { id: "docs", label: "Docs & repos", description: "Google Docs, Notion pages, and GitHub READMEs.", icon: <FileText size={18} /> },
  { id: "chat", label: "Ask-Mari history", description: "Questions people already asked the assistant.", icon: <Sparkles size={18} /> },
];

type ImportStatus = "pending" | "saving" | "done";
type Candidate = {
  question: string;
  draft: string;
  sourceLabel: string;
  confidence: number;
  accepted: boolean;
  status?: ImportStatus;
};

/** One question/answer pair a scan proposed. Plain JSON, so an API can return
    it and no React element is carried. */
export type HarvestProposal = Omit<Candidate, "accepted" | "status">;

function confLevel(c: number) { return c >= 0.75 ? "high" : c >= 0.45 ? "med" : "low"; }
const CONF_TONE: Record<string, string> = { high: "ok", med: "attention", low: "neutral" };

function SourcePickerItem({ icon, label, description, checked, onChange }: { icon: ReactNode; label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={`flex items-start gap-3 rounded-[5px] border px-3.5 py-3 cursor-pointer transition-colors ${checked ? "border-biscay-2/60 bg-biscay-2/[0.04] ring-1 ring-biscay-2/40" : "border-ink/15 hover:border-ink/30"} ${focusRing}`}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span className={`grid place-items-center w-9 h-9 rounded-[5px] shrink-0 ${checked ? "bg-biscay text-white" : "bg-flysch text-ink/70 border border-ink/12"}`}>{icon}</span>
      <span className="min-w-0">
        <b className="block text-[13.5px] font-semibold text-ink">{label}</b>
        <span className="text-[12.5px] text-ink/65">{description}</span>
      </span>
    </label>
  );
}

export type AnswersHarvestWizardProps = {
  defaultOpen?: boolean;
  /** What a scan finds, when the caller already knows. Empty = nothing found. */
  candidates?: HarvestProposal[];
  /** Ask a server to scan the picked sources. Answers with what it found, so
      the wizard reviews the server's result rather than reading it back. */
  onScan?: (sources: SourceId[]) => Promise<HarvestProposal[]>;
  /** Save the accepted drafts. Omitted = the wizard reports nothing saved. */
  onImport?: (drafts: { question: string; answer: string }[]) => void | Promise<void>;
  loading?: boolean;
  className?: string;
};

export function AnswersHarvestWizard({
  defaultOpen = false, candidates: found, onScan, onImport,
  loading = false, className = "",
}: AnswersHarvestWizardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Set<SourceId>>(new Set(["slack", "docs", "chat"]));
  const [scanning, setScanning] = useState(false);
  const [scanEmpty, setScanEmpty] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const acceptedCount = candidates.filter((c) => c.accepted).length;

  const reset = () => {
    setStep(0); setScanning(false); setScanEmpty(false); setCandidates([]); setImporting(false); setImportedCount(0);
    setPicked(new Set(["slack", "docs", "chat"]));
  };

  const close = () => { if (importing) return; setOpen(false); reset(); };

  const togglePick = (id: SourceId) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* Nothing is invented here: the scan reports what the handler answered, or
     what the caller handed over, or nothing at all. "Nothing found" is a real
     result and gets the empty state rather than four fabricated pairs. */
  const scan = async () => {
    setStep(1); setScanning(true); setScanEmpty(false);
    let result: HarvestProposal[] = [];
    try {
      result = onScan ? await onScan([...picked]) : (found ?? []);
    } catch {
      result = [];
    }
    setScanning(false);
    if (result.length === 0) { setScanEmpty(true); return; }
    setCandidates(result.map((c) => ({ ...c, accepted: true })));
    setStep(2);
  };

  const setAccepted = (i: number, v: boolean) => setCandidates((prev) => prev.map((c, idx) => (idx === i ? { ...c, accepted: v } : c)));
  const editDraft = (i: number, text: string) => setCandidates((prev) => prev.map((c, idx) => (idx === i ? { ...c, draft: text } : c)));
  const acceptHigh = () => setCandidates((prev) => prev.map((c) => ({ ...c, accepted: confLevel(c.confidence) === "high" })));

  const doImport = async () => {
    if (importing || acceptedCount === 0) return;
    setStep(3); setImporting(true);
    const accepted = candidates.filter((c) => c.accepted);
    setCandidates((prev) => prev.map((c) => (c.accepted ? { ...c, status: "saving" } : c)));
    try {
      if (onImport) await onImport(accepted.map((c) => ({ question: c.question, answer: c.draft })));
      setCandidates((prev) => prev.map((c) => (c.accepted ? { ...c, status: "done" } : c)));
      setImportedCount(accepted.length);
    } catch {
      // A failed import leaves the rows where they were: nothing is reported
      // as saved that was not saved.
      setCandidates((prev) => prev.map((c) => (c.accepted ? { ...c, status: "pending" } : c)));
      setImportedCount(0);
    } finally {
      setImporting(false);
    }
  };

  const footer = (() => {
    if (step === 0) return (
      <>
        <span className="flex-1" />
        <Button variant="primary" disabled={picked.size === 0} onClick={() => void scan()}>Scan {picked.size} source{picked.size === 1 ? "" : "s"}</Button>
      </>
    );
    if (step === 1) return <Button disabled={scanning} onClick={() => setStep(0)}>Back to sources</Button>;
    if (step === 2) return (
      <>
        <Button onClick={() => setStep(0)}>Back</Button>
        <span className="flex-1" />
        <Button variant="primary" disabled={acceptedCount === 0} onClick={doImport}>Import {acceptedCount} draft{acceptedCount === 1 ? "" : "s"}</Button>
      </>
    );
    return (
      <>
        <span className="flex-1" />
        <Button variant="primary" disabled={importing} onClick={close}>{importing ? "Saving…" : "Done"}</Button>
      </>
    );
  })();

  if (loading) {
    return (
      <div className={className} aria-hidden="true">
        <SkeletonButton w={150} />
      </div>
    );
  }

  return (
    <div className={className}>
      <Button variant="primary" onClick={() => setOpen(true)}>Harvest questions</Button>

      <Drawer open={open} onClose={close} title="Harvest questions" footer={footer} closable={!importing}>
        <div className="flex flex-col gap-5">
          <Stepper labels={["Sources", "Scan", "Review", "Import"]} current={step} />

          {step === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-ink/70">Pick the sources Mari should scan for question and answer candidates. Nothing is saved until you import.</p>
              {SOURCES.map((s) => (
                <SourcePickerItem key={s.id} icon={s.icon} label={s.label} description={s.description} checked={picked.has(s.id)} onChange={() => togglePick(s.id)} />
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="py-6">
              {scanning ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <Spinner size="md" label="Scanning" />
                  <div className="text-[13px] text-ink/70">Scanning {[...picked].join(", ")}…</div>
                  <div className="font-term text-[11.5px] text-ink/65">Clustering threads · extracting question/answer pairs</div>
                </div>
              ) : scanEmpty ? (
                <EmptyState title="Nothing new found" action={<Button compact onClick={() => void scan()}>Scan again</Button>}>No fresh question candidates in the selected sources.</EmptyState>
              ) : null}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-term text-[12px] text-ink/65">{acceptedCount} of {candidates.length} accepted</span>
                <Button compact onClick={acceptHigh}>Accept all high confidence</Button>
              </div>
              {candidates.map((c, i) => {
                const lvl = confLevel(c.confidence);
                return (
                  <Card key={i} className={c.accepted ? "" : "opacity-60"}>
                    <h3 className="text-[13.5px] font-semibold text-ink">{c.question}</h3>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Chip label={c.sourceLabel} tone="neutral" />
                      <Chip label={`${Math.round(c.confidence * 100)}% confident`} tone={CONF_TONE[lvl]} dot />
                    </div>
                    <Textarea short className="mt-2.5" value={c.draft} onChange={(e) => editDraft(i, e.target.value)} />
                    <div className="mt-2.5 flex items-center gap-2">
                      {c.accepted ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-moss"><CheckCircle2 size={15} /> Accepted</span>
                          <span className="flex-1" />
                          <Button compact onClick={() => setAccepted(i, false)}>Skip</Button>
                        </>
                      ) : (
                        <>
                          <span className="text-[12.5px] text-ink/65">Skipped</span>
                          <span className="flex-1" />
                          <Button variant="success" compact onClick={() => setAccepted(i, true)}>Accept</Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-ink/70">
                {/* "Imported N" is a claim about a write. It is only made when
                    there was a write to make. */}
                {importing
                  ? `Saving ${acceptedCount} draft answer${acceptedCount === 1 ? "" : "s"}…`
                  : !onImport
                    ? `${acceptedCount} draft answer${acceptedCount === 1 ? "" : "s"} accepted. Nothing was saved: this wizard has no import wired.`
                    : importedCount > 0
                      ? `Imported ${importedCount} draft answer${importedCount === 1 ? "" : "s"}. They're queued in the Drafts filter for approval.`
                      : "The import did not finish. Nothing was saved."}
              </p>
              <ul className="flex flex-col gap-2">
                {candidates.filter((c) => c.status).map((c, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[13px] text-ink/80">
                    {c.status === "done" ? <CheckCircle2 size={16} className="text-moss shrink-0" />
                      : c.status === "saving" ? <Spinner size="sm" />
                      : <Circle size={14} className="text-ink/30 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate">{c.question}</span>
                    <span className="font-term text-[11px] text-ink/65 shrink-0">{c.status === "done" ? "draft saved" : c.status === "saving" ? "saving…" : "queued"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}

export default AnswersHarvestWizard;
