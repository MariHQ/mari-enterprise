import { useMemo, useState } from "react";
import { Sparkles, Globe, ChevronDown } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { Button } from "../actions/Button";
import { ExportButton } from "../actions/RepeatedActions";
import { useWrite, why } from "../actions/useWrite";
import { CardActions, CardBody, CardMeta, CardSection, CardTitleBlock } from "../layout/CardShell";
import { Input } from "../forms/Input";
import { Chip } from "../data-display/Chip";
import { AvatarGroup } from "../data-display/AvatarGroup";
import { ResultCount } from "../data-display/Pagination";
import { Truncate } from "../data-display/Truncate";
import { WriteError } from "../feedback/WriteError";
import { SkeletonText, SkeletonList, Skeleton } from "../data-display/Skeleton";
import {
  LgDrawerShell, LG_DRAWER_W_WIDE, SEVERITY_META, SOURCE_LABELS, LgSourceChip, LgAuthor, LgOwners,
  downloadText, impactReport,
  type ImpactDoc, type ImpactResult, type Severity,
} from "./LineageDataModel";

/* ─────────────────────────────────────────────────────────────────────────
   Lineage assert / impact-analysis drawer (feature: lineage-assert-drawer)

   An AI-assisted "what does changing this touch?" panel. You type an assertion,
   Mari analyzes it against the whole document graph, and the drawer returns a
   summary + impacted documents bucketed by severity, with bulk task creation
   and report export. Same non-modal shell. Analysis state is local here so it
   survives close/reopen in the demo.

   Note: unlike the deprecated mock, pre-analysis counts are 0/empty (honoring
   the api-client "never canned data" contract) — real numbers only appear once
   an analysis has run. This demo ships a baked-in result so the populated state
   shows in the gallery.
   ──────────────────────────────────────────────────────────────────────── */

/** Impacted-document rows drawn per page. */
const DOC_PAGE = 10;

const BUCKETS: { key: Severity; label: string }[] = [
  { key: "update-required", label: "Direct contradiction" },
  { key: "review", label: "Needs update" },
  { key: "minor", label: "Mentions" },
];

export type LineageAssertDrawerProps = {
  /** What running the analysis yields. Required: the drawer never invents an
      impact set. `analyzed` decides whether it is already on screen. */
  result: ImpactResult;
  /** Start with the analysis already resolved (false = pre-analysis state). */
  analyzed: boolean;
  /** The claim the drawer starts with, before an analysis has run. */
  claim: string;
  /** Top owners of the impacted documents. */
  owners: { name: string; role: string }[];
  /** Initials for the owner avatar stack. */
  people: string[];
  /** Run the analysis for real and hand back what came out. Long-running: the
      Analyze button says so. May throw; the drawer shows the message. Omitted
      = the drawer resolves to `result`, which is what the canvas renders. */
  onAnalyze?: (claim: string) => ImpactResult | Promise<ImpactResult>;
  /** What came back, handed to whoever renders this drawer, so an analysis is
      not trapped inside the panel that ran it: the page lights the impacted
      documents on the canvas beside it. Fired only on a successful run. */
  onResult?: (result: ImpactResult) => void;
  /** Open one task per impacted document and answer with how many were
      created. The count is the reader's receipt, so it comes from whoever did
      the writing rather than from the length of the list. May throw; the
      message lands in the drawer. Omitted = the local echo the design canvas
      renders, which claims one task per listed document and nothing more. */
  onCreateTasks?: (docs: ImpactDoc[]) => number | Promise<number>;
  onClose?: () => void;
  /** Render a content-shaped skeleton silhouette instead of the drawer body. */
  loading?: boolean;
  className?: string;
};

export function LineageAssertDrawer({
  result: outcome, analyzed, claim: initialClaim, owners, people,
  onAnalyze, onResult, onCreateTasks, onClose, loading = false, className = "",
}: LineageAssertDrawerProps) {
  const initial = analyzed ? outcome : null;
  const [claim, setClaim] = useState(initial?.claim ?? initialClaim);
  const [result, setResult] = useState<ImpactResult | null>(initial);
  const [running, setRunning] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(initial ? "just now" : null);
  const [filter, setFilter] = useState<Severity | null>(null);
  const [taskState, setTaskState] = useState<"idle" | "creating" | "done">("idle");
  /** How many tasks were actually opened, straight from the handler. */
  const [created, setCreated] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  /* A failed bulk-create is its own banner. Sharing one with the analysis
     meant the message from a refused write vanished the moment the reader
     re-ran the analysis it had nothing to do with. */
  const taskWrite = useWrite();
  const [exported, setExported] = useState(false);
  const [docPage, setDocPage] = useState(1);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { "update-required": 0, review: 0, minor: 0 };
    for (const d of result?.docs ?? []) c[d.severity]++;
    return c;
  }, [result]);
  const needUpdates = counts["update-required"] + counts.review;
  const taskCount = result?.docs.length ?? 0;

  const analyze = async () => {
    if (!claim.trim() || running) return;
    setRunning(true);
    setFailed(null);
    setTaskState("idle");
    setCreated(0);
    taskWrite.setFailed(null);
    setExported(false);
    setFilter(null);
    try {
      // Mari reads the whole graph, so this is genuinely slow and the button
      // says "Analyzing…" the entire time.
      const next = onAnalyze
        ? await onAnalyze(claim.trim())
        : await new Promise<ImpactResult>((r) => setTimeout(() => r(outcome), 1400));
      setResult(next);
      setAnalyzedAt("just now");
      // The analysis is about the graph, not about this panel: whoever renders
      // the drawer gets the result and can light the documents it names.
      onResult?.(next);
    } catch (err) {
      setFailed(why(err, "The analysis could not run."));
    } finally {
      setRunning(false);
    }
  };

  const createTasks = async () => {
    if (!result || taskState !== "idle" || !result.docs.length) return;
    setTaskState("creating");
    const count = onCreateTasks
      ? await taskWrite.runFor(() => onCreateTasks(result.docs))
      : result.docs.length;
    // A refused write leaves the button offering the same action again, with
    // the server's message above it, rather than claiming tasks nobody has.
    if (count === undefined) { setTaskState("idle"); return; }
    setCreated(count);
    setTaskState("done");
  };

  const exportReport = () => {
    if (!result) return;
    const stem = result.claim.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadText(`impact-${stem.slice(0, 60) || "analysis"}.md`, impactReport(result), "text/markdown");
    setExported(true);
  };

  const state: "running" | "completed" | "ready" = running ? "running" : result ? "completed" : "ready";
  const stateWord = state === "running" ? "Running" : state === "completed" ? "Completed" : "Ready";
  const stateSub = state === "running" ? "Mari is reading the graph…" : state === "completed" ? `Analyzed ${analyzedAt}` : "Type an assertion to analyze";

  const matching = result?.docs.filter((d) => !filter || d.severity === filter) ?? [];
  /* An analysis over a real graph returns dozens of documents. Page them: the
     drawer stays one readable panel instead of an endless scroll. */
  const shown = matching.slice(0, DOC_PAGE * docPage);
  const hiddenDocs = matching.length - shown.length;

  const taskLabel =
    taskState === "creating" ? "Creating tasks…"
      : taskState === "done" ? `Created ${created} task${created === 1 ? "" : "s"} ✓`
      : `Create ${taskCount} task${taskCount === 1 ? "" : "s"}`;

  if (loading) {
    return (
      /* The drawer knows what it is for before the analysis returns: its
         title and its question are literals below. Greying them left the
         reader with an anonymous panel sliding in from the right. */
      <LgDrawerShell
        className={className}
        onClose={onClose}
        width={LG_DRAWER_W_WIDE}
        icon={<Sparkles size={19} className="text-biscay-2" />}
        title="Impact analysis"
        summary="What does changing this touch?"
      >
        <Skeleton height={34} className="rounded-[4px]" />
        <div className="mt-3"><Skeleton height={44} className="rounded-[4px]" /></div>
        <div className="mt-3"><SkeletonText lines={2} /></div>
        <div className="mt-4 space-y-1.5">
          <Skeleton height={40} className="rounded-[4px]" />
          <Skeleton height={40} className="rounded-[4px]" />
          <Skeleton height={40} className="rounded-[4px]" />
        </div>
        <div className="mt-4"><SkeletonList rows={3} /></div>
      </LgDrawerShell>
    );
  }

  return (
    <LgDrawerShell
      className={className}
      onClose={onClose}
      width={LG_DRAWER_W_WIDE}
      icon={<Sparkles size={19} className="text-biscay-2" />}
      title="Impact analysis"
      summary="What does changing this touch?"
      footer={
        /* CONVENTIONS §2: primary bottom LEFT, secondary on the same line to
           its right. */
        <div className="flex w-full flex-col gap-2">
          {/* A refused bulk-create is a failed WRITE with no field to accuse,
              so it is the banner (§8), and it sits above the button that will
              be pressed again rather than at the top of a scrolled panel. */}
          <WriteError onDismiss={() => taskWrite.setFailed(null)}>{taskWrite.failed}</WriteError>
          <CardActions
            className="pt-0"
            primary={
              <Button
                variant="primary"
                onClick={() => void createTasks()}
                disabled={!result || !taskCount || taskState !== "idle"}
              >
                {taskLabel}
              </Button>
            }
            secondary={
              // <Send> said "this goes somewhere else"; the report lands on the
              // reader's own machine, so it carries the Download glyph (§16).
              // It writes a real Markdown file now: summary, then every
              // document under the severity the analysis gave it.
              <ExportButton format="report" state={exported ? "done" : "idle"} onClick={exportReport} disabled={!result} />
            }
          />
          <span className="inline-flex items-center gap-1.5 font-term text-[11px] text-ink/65">
            <Globe size={12} /> All reachable documents
          </span>
        </div>
      }
    >
      <CardBody>
        {/* Slot 3: the card's own search/assertion bar. */}
        <div className="flex items-center gap-2">
          <Input
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void analyze(); }}
            placeholder="Free tier ends September 1"
            className="flex-1"
            aria-label="Assertion to analyze"
          />
          <Button onClick={() => void analyze()} disabled={running || !claim.trim()} className={running ? "text-clay" : ""}>
            <Sparkles size={14} /> {running ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
        {/* A refused analysis is a failed ACTION, not bad input: nothing the
            reader retypes in the assertion field fixes it, so it gets the
            banner every other failed write gets, not a field caption (§8). */}
        <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>

        {/* Slots 4 + 5: the claim under analysis and what came back. */}
        <CardTitleBlock
          className="[overflow-wrap:anywhere]"
          title={result?.claim ?? claim ?? "No assertion yet"}
          summary={result?.summary ?? "Type an assertion and run the analysis to see what it touches."}
        />
        <CardMeta
          source={<Chip label="All reachable documents" tone="neutral" icon={<Globe size={11} />} />}
          status={
            /* XA-25: "running" was clay/attention here and moss/ok-pulsing in
               StatusChip, the console's declared source of truth for status
               pills. Clay means "a person has to look at this"; a running
               analysis needs nobody. Same tone as every other running thing. */
            <Chip
              label={stateWord}
              tone={state === "ready" ? "neutral" : "ok"}
              dot
              pulse={state === "running"}
            />
          }
          date={stateSub}
          author={<LgAuthor name="Mari" />}
        />

        <CardSection label="Documents that need updates" count={needUpdates}>
          <div className="space-y-1.5">
            {BUCKETS.map((b) => {
              const active = filter === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  disabled={!result}
                  onClick={() => { setFilter((f) => (f === b.key ? null : b.key)); setDocPage(1); }}
                  title={result ? undefined : "Run the analysis first"}
                  aria-pressed={active}
                  /* Disabled reads as a legible grey, never a 45% ghost (§6). */
                  className={`flex w-full items-center gap-2.5 rounded-[4px] border px-3 py-2 text-left transition-colors disabled:opacity-100 disabled:border-ink/10 disabled:bg-flysch/60 disabled:text-ink/60 ${
                    active ? "border-biscay-2 bg-biscay-2/[0.08] ring-1 ring-biscay-2" : "border-ink/12 hover:border-ink/25"
                  } ${focusRing}`}
                >
                  {/* Square marker, not a radio-looking circle (§6). */}
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-[2px] font-term text-[10px] font-bold text-white"
                    style={{ backgroundColor: SEVERITY_META[b.key].color }}
                    aria-hidden
                  >
                    !
                  </span>
                  <span className="text-[16px] font-bold text-ink">{counts[b.key]}</span>
                  <span className="text-[13px] text-ink/75">{b.label}</span>
                  <ChevronDown size={14} className={`ml-auto text-ink/65 transition-transform ${active ? "rotate-180" : ""}`} />
                </button>
              );
            })}
          </div>
        </CardSection>

        <CardSection
          label={filter ? `${SEVERITY_META[filter].label} documents` : "Impacted documents"}
          count={matching.length}
          action={filter
            ? <button type="button" onClick={() => { setFilter(null); setDocPage(1); }} className={`font-term text-[11px] text-biscay-2 hover:underline ${focusRing}`}>Clear filter</button>
            : undefined}
        >
          {shown.length === 0 ? (
            <p className="text-[12.5px] text-ink/70">
              {result ? "No documents in this bucket. Clear the filter to show all." : "Nothing analyzed yet."}
            </p>
          ) : (
            <>
              {/* One count strip, and it sits ABOVE the rows it counts (§13).
                  It used to be a bespoke span under the list. */}
              <ResultCount
                from={1}
                to={shown.length}
                total={matching.length}
                noun="documents"
                className="mb-2 rounded-[4px] border border-ink/10"
              />
              {shown.map((d, i) => (
                <div key={i} className="border-b border-ink/10 py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Truncate className="min-w-0 flex-1 text-[13px] font-medium text-ink">{d.title}</Truncate>
                    <span className="shrink-0"><Chip label={SEVERITY_META[d.severity].label} tone={SEVERITY_META[d.severity].tone} dot /></span>
                  </div>
                  <div className="mt-1 flex items-start gap-2">
                    <LgSourceChip source={d.source} />
                    <Truncate lines={2} className="min-w-0 flex-1 font-term text-[11px] leading-[1.6] text-ink/70">{d.reason}</Truncate>
                  </div>
                </div>
              ))}
              {hiddenDocs > 0 && (
                <div className="mt-2.5">
                  <Button compact onClick={() => setDocPage((p) => p + 1)}>
                    Show {Math.min(hiddenDocs, DOC_PAGE)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardSection>

        {result && (
          <CardSection label="Owners" count={people.length} action={<AvatarGroup people={people.map((initials) => ({ initials }))} max={4} />}>
            <LgOwners owners={owners} />
          </CardSection>
        )}
      </CardBody>
    </LgDrawerShell>
  );
}
