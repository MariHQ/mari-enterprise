import { useState } from "react";
import { BookOpen, RefreshCw, Sparkles, FileText, Plus, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { card } from "../tokens/card";
import { Button } from "../actions/Button";
import { Chip } from "../data-display/Chip";
import { Spinner } from "../data-display/Spinner";
import { EmptyState } from "../data-display/EmptyState";
import { WriteError } from "../feedback/WriteError";
import { why } from "../actions/useWrite";
import { Skeleton, SkeletonLine, SkeletonChip, SkeletonButton } from "../data-display/Skeleton";

/* WelcomeGlossaryStep — the Welcome wizard's optional glossary-seeding step:
   scan the user's own docs for term candidates (grounded in real docs, nothing
   persisted by the scan), review a checklist, then upsert the accepted terms
   one at a time with a live progress count. The deterministic (non-LLM)
   fallback is flagged honestly. Local ReviewChecklist is built here; harvest /
   upsertGlossary are baked in. Standalone in the "Start" state. */

export type Candidate = {
  /** The stored candidate row, when the harvester persisted one. Promoting a
      candidate by id is a different operation from inserting a term someone
      typed, so the two must stay distinguishable. */
  id?: number;
  term: string;
  definition: string;
  /** Where the term was found, e.g. the document title. */
  evidence: string;
  /** The document the evidence came from, when it is a known document, so the
      citation can be followed. The harvester now verifies a candidate against
      the corpus before proposing it, so this is a real id or nothing. */
  evidenceDocId?: number;
};

type Mode = "start" | "scanning" | "review" | "adding";

export type WelcomeGlossaryStepProps = {
  candidates: Candidate[];
  /** Simulate the "LLM unavailable" deterministic fallback. */
  llm?: boolean;
  /** Open straight into a given step (used by the state gallery). */
  defaultMode?: Mode;
  /** Run the real harvest. Throws on failure; the caller shows the message.
      Returning the fresh candidate list is what makes the scan visible: the
      page's own read is already in flight-free cache, so a scan that only
      wrote to the server would look like it found nothing.
      Omitted: the local walk-through below, so the button is never inert. */
  onScan?: () => void | Promise<Candidate[] | void> | Candidate[];
  /** Save the candidates the user kept. Throws on failure. */
  onAdd?: (picked: Candidate[]) => void | Promise<void>;
  loading?: boolean;
  className?: string;
};

export function WelcomeGlossaryStep({ candidates: given, llm = true, defaultMode = "start", onScan, onAdd, loading = false, className = "" }: WelcomeGlossaryStepProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  /* A scan that returned rows replaces the list this step was handed. */
  const [scanned, setScanned] = useState<Candidate[] | null>(null);
  const candidates = scanned ?? given;
  const [checked, setChecked] = useState<Set<string>>(new Set(defaultMode === "review" ? given.map((c) => c.term) : []));
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [addResult, setAddResult] = useState<{ ok: number; failed: number; error?: string } | null>(null);
  const [addedThisSession, setAddedThisSession] = useState(0);

  /* The candidate list is the server's, and the harvest replaces it. Without
     this the review step kept showing the batch it mounted with, so a scan
     that really did find new terms looked like it found nothing. */
  const signature = given.map((candidate) => `${candidate.id ?? ""}:${candidate.term}`).join("\u0000");
  const [seenSignature, setSeenSignature] = useState(signature);
  if (seenSignature !== signature) {
    setSeenSignature(signature);
    setScanned(null);
    if (mode === "review") setChecked(new Set(given.map((c) => c.term)));
  }

  const scan = () => {
    setMode("scanning");
    setAddResult(null);
    if (!onScan) {
      window.setTimeout(() => {
        setChecked(new Set(candidates.map((c) => c.term)));
        setMode("review");
      }, 1400);
      return;
    }
    void (async () => {
      let next = candidates;
      try {
        const out = await onScan();
        if (Array.isArray(out)) { setScanned(out); next = out; }
      } catch {
        /* The caller renders the message; this step just stops pretending to
           work. */
      } finally {
        setChecked(new Set(next.map((c) => c.term)));
        setMode("review");
      }
    })();
  };

  const toggle = (term: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(term)) n.delete(term); else n.add(term);
      return n;
    });

  const addTerms = () => {
    const picked = candidates.filter((c) => checked.has(c.term));
    setProgress({ done: 0, total: picked.length });
    setMode("adding");
    if (onAdd) {
      void (async () => {
        try {
          await onAdd(picked);
          setAddedThisSession((n) => n + picked.length);
          setAddResult({ ok: picked.length, failed: 0 });
        } catch (e) {
          setAddResult({ ok: 0, failed: picked.length, error: why(e, "The terms could not be saved.") });
        } finally {
          setProgress({ done: picked.length, total: picked.length });
          setMode("start");
        }
      })();
      return;
    }
    let i = 0;
    const step = () => {
      i += 1;
      setProgress({ done: i, total: picked.length });
      if (i >= picked.length) {
        setAddedThisSession((n) => n + picked.length);
        setAddResult({ ok: picked.length, failed: 0 });
        setMode("start");
      } else {
        window.setTimeout(step, 350);
      }
    };
    window.setTimeout(step, 350);
  };

  if (loading) {
    return (
      <div className={`${card} p-4 ${className}`.trim()} aria-hidden="true">
        <div className="grid grid-cols-1 gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-md border border-ink/12 p-2.5">
              <Skeleton width={14} height={14} rounded="rounded-[3px]" className="mt-1" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2"><SkeletonLine w={90} h={11} /><SkeletonChip w={84} /></div>
                <SkeletonLine w="85%" h={9} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <SkeletonButton w={110} /><SkeletonButton w={96} />
        </div>
      </div>
    );
  }

  if (mode === "scanning") {
    return (
      <div className={`${card} ${className}`.trim()}>
        <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-ink/65">
          <Spinner size="md" /> Reading your docs. The LLM pass can take a minute.
        </div>
      </div>
    );
  }

  if (mode === "adding") {
    return (
      <div className={`${card} ${className}`.trim()}>
        <div className="flex items-center justify-center gap-2 py-14 text-[13px] text-ink/65">
          <Spinner size="md" /> Adding term {progress.done} of {progress.total}…
        </div>
      </div>
    );
  }

  if (mode === "review") {
    if (candidates.length === 0) {
      return (
        <div className={`${card} ${className}`.trim()}>
          <EmptyState icon={<Search size={26} />} title="Nothing new to suggest"
            action={<Button compact onClick={scan}><RefreshCw size={13} /> Scan again</Button>}>
            Everything found is already in your glossary.
          </EmptyState>
        </div>
      );
    }
    return (
      <div className={`${card} p-4 ${className}`.trim()}>
        <div className="mb-3">
          <h2 className="text-[15px] font-semibold text-ink">Fill glossary</h2>
          <p className="mt-0.5 text-[12.5px] text-ink/70">Keep the terms worth defining. Nothing is saved until you add them.</p>
        </div>
        {!llm && (
          <div className="mb-3 flex items-start gap-2 rounded-[4px] border border-clay/35 bg-clay/[0.07] px-3 py-2 text-[12.5px] text-clay">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span><b>LLM unavailable.</b> These came from a deterministic capitalized-phrase scan, so review them extra carefully.</span>
          </div>
        )}
        {/* Same shape as "Pick a style guide": control on the LEFT, a check
            mark on the RIGHT once the row is on. */}
        <div className="grid grid-cols-1 gap-2">
          {candidates.map((c) => {
            const on = checked.has(c.term);
            return (
              <label key={c.term}
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${focusRing} ${
                  on ? "border-biscay-2 ring-1 ring-biscay-2/40 bg-biscay/[0.04]" : "border-ink/15 hover:border-ink/35"
                }`}>
                <input type="checkbox" className="mt-1 accent-biscay shrink-0" checked={on} onChange={() => toggle(c.term)} />
                <span className="min-w-0 flex-1">
                  <span className="flex w-full min-w-0 flex-wrap items-center gap-2">
                    <b className="min-w-0 break-all text-[13.5px] font-semibold text-ink">{c.term}</b>
                    <Chip label={c.evidence} tone="neutral" icon={<FileText size={10} />} className="min-w-0 max-w-full [&>span]:truncate" />
                  </span>
                  <span className="block mt-0.5 break-words text-[12.5px] text-ink/70">{c.definition}</span>
                </span>
                {on && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-moss" />}
              </label>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="primary" compact disabled={checked.size === 0} onClick={addTerms}>
            <Plus size={13} /> Add {checked.size} term{checked.size === 1 ? "" : "s"}
          </Button>
          <Button compact onClick={scan}><RefreshCw size={13} /> Scan again</Button>
          <span className="text-[11.5px] text-ink/65">Unchecked rows are discarded.</span>
        </div>
      </div>
    );
  }

  // start
  return (
    <div className={`${card} p-6 text-center ${className}`.trim()}>
      <span className="grid place-items-center mx-auto w-10 h-10 rounded-full border border-ink/15 text-ink/60 mb-3"><BookOpen size={20} /></span>
      <h2 className="text-[15px] font-semibold text-ink">Fill glossary</h2>
      {addResult && addResult.failed > 0 ? (
        /* XA-02: a refused save is a failed WRITE, not a red sentence. It also
           used to point at "the detail is above" when nothing above carried
           one, because the throw was caught and dropped. */
        <div className="mt-2 text-left">
          <WriteError onDismiss={() => setAddResult(null)}>
            {`None of the ${addResult.failed} term${addResult.failed === 1 ? " was" : "s were"} saved. ${addResult.error ?? ""}`.trim()}
          </WriteError>
        </div>
      ) : addResult ? (
        <p className="mt-1 text-[13.5px] text-moss inline-flex items-center gap-1.5 justify-center">
          <CheckCircle2 size={15} /> Added {addResult.ok} term{addResult.ok === 1 ? "" : "s"} to your glossary.
        </p>
      ) : (
        <p className="mt-1 text-[13.5px] text-ink/70 max-w-[420px] mx-auto">
          Fill your glossary from your own documents. Mari proposes term candidates grounded in real docs, and you review every one before anything is saved.
        </p>
      )}
      <div className="mt-4 flex justify-center">
        <Button variant="primary" onClick={scan}>
          <Sparkles size={14} /> {addResult ? "Scan again" : "Scan my documents"}
        </Button>
      </div>
      {addedThisSession > 0 && (
        <p className="mt-3 font-term text-[11px] text-ink/65">{addedThisSession} terms added this session</p>
      )}
    </div>
  );
}
