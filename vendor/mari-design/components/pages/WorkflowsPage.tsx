import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  CheckCircle2, CircleAlert, Database, GitBranch, MessageCircleQuestion,
  RefreshCw, Save, Search, SlidersHorizontal, Trash2, Undo2, Workflow, X,
} from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, PAGE_CONTAINER } from "./PageFrame";
import { FilterSearch, FilterSelect } from "../navigation/FilterTrigger";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Drawer } from "../layout/Drawer";
import { CardBody, CardTitleBlock, CardMeta, CardSection, CardActions } from "../layout/CardShell";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Chip, StatusChip, type ChipStatus } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { Pagination, ResultCount } from "../data-display/Pagination";
import { Scrollable } from "../data-display/Scrollable";
import { Truncate } from "../data-display/Truncate";
import { Tabs } from "../navigation/Tabs";
import { Input } from "../forms/Input";
import { Select } from "../forms/Select";
import { SkeletonPage } from "../data-display/Skeletons";
import { Spinner } from "../data-display/Spinner";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite } from "../actions/useWrite";
import { fmtDate } from "../tokens/format";
import { ApprovedAnswers, type AnswersActions, type AnswersData } from "../features/ApprovedAnswers";

/* Workflows — what Mari did while it worked, and what came out of it.
 *
 * Two tabs, one page, because they are two halves of one loop. "Observed" is
 * every run the agent harvested: the tools it called, the documents it leaned
 * on, and the grades a human puts on both. "Approved answers" is what those
 * runs are promoted into — the wording bots serve verbatim.
 *
 * This was two pages (Trajectories and Answers), and the seam between them was
 * exactly where the work was: you reviewed a run on one page and curated the
 * answer it produced on another, with nothing linking the two. An answer now
 * carries the workflow it came from, and a workflow shows the answer and the
 * paused workflow it produced, in place.
 *
 * Tab lives in the URL (?tab=), as does the focused workflow (?trajectory=), so
 * both are shareable and the agent can navigate to either.
 */

const STATES = [
  { id: "default", label: "Observed · default" },
  { id: "drawer", label: "Observed · detail drawer" },
  { id: "promoted", label: "Observed · promoted inline" },
  { id: "rejected", label: "Observed · rejected" },
  { id: "filtered", label: "Observed · filtered to nothing" },
  { id: "answers", label: "Approved answers tab" },
  { id: "answers-drafts", label: "Approved answers · drafts" },
  { id: "answers-harvest", label: "Approved answers · harvest" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Empty / nothing observed" },
  { id: "stress", label: "Stress / large archive" },
] as const;

/* ── Shapes ───────────────────────────────────────────────────────────────── */

export type WorkflowsTab = "observed" | "answers";

export type TrajectoryStep = {
  ordinal: number;
  tool: string;
  actionFamily: string;
  args: Record<string, unknown>;
  summary: string;
  ok: boolean;
  disposition: "included" | "excluded" | "preferred";
  editedArgs: Record<string, unknown> | null;
};

export type TrajectoryEvidence = {
  documentId: string | number; title: string; reason: string; rank: number;
  relevance: "observed" | "relevant" | "irrelevant" | "pinned"; note: string;
};

export type TrajectoryPhase = {
  id: number;
  name: string;
  family: string;
  start: number;
  end: number;
  steps: number;
  substate: string;
  failures: number;
};

/** The paused workflow a run was codified into. Carried WITH the run so the
    card can show what promotion produced instead of navigating somewhere to
    find out whether the button did anything. */
export type PromotedWorkflow = {
  id: number; name: string; status: string; nodeCount: number;
};

export type TrajectoryRow = {
  id: string | number;
  sessionId: number | null;
  prompt: string;
  status: string;
  model: string;
  layer1: string;
  layer2: string;
  category: string;
  macroIntent: string;
  phases: TrajectoryPhase[];
  stepCount: number;
  failureCount: number;
  reworkCount: number;
  startedAt: string;
  completedAt: string;
  steps: TrajectoryStep[];
  evidence: TrajectoryEvidence[];
  promotedWorkflowId: number | null;
  promotedWorkflow: PromotedWorkflow | null;
  /** "observed" or "rejected". Rejecting keeps the evidence; only Delete
      removes it. */
  disposition: string;
  /* How the assistant answered this turn: which codified workflow it selected
     (and how close the match was), whether the reply came from a reviewed
     cache, an approved answer, or generation, and the cluster it belongs to. */
  selectedWorkflowId?: number | null;
  selectedWorkflowScore?: number | null;
  selectedWorkflowExact?: boolean;
  executionMode?: string;
  observedClusterId?: number | null;
  /* The codified workflow this run seeds or belongs to, as a cluster: its
     name, every observation grouped under it, its enabled state, its
     reviewed-answer cache, and the embedding projection that places it. */
  promotedWorkflowName?: string;
  workflowRootTrajectoryId?: number | null;
  workflowObservationCount?: number;
  clusterObservations?: TrajectoryRow[];
  promotedWorkflowStatus?: string;
  promotedWorkflowCachePolicy?: "none" | "reviewed_answer";
  promotedWorkflowCacheState?: "disabled" | "empty" | "fresh" | "stale";
  promotedWorkflowCacheRefreshedAt?: string;
  promotedWorkflowDependencyCount?: number;
  promotedWorkflowEmbeddingMap?: {
    profile: string;
    points: Array<{ kind: "intent" | "phase" | "tool"; label: string; x: number; y: number }>;
  };
};

export type WorkflowHarvestCandidate = {
  seedTrajectoryId: number;
  name: string;
  reason: string;
  observationIds: number[];
  prompts: string[];
  existingWorkflowId: number | null;
  suggested?: boolean;
  accepted?: boolean;
};

/** The Observed tab's filters. Every one of them is applied by the server, so
    the rows and `total` always describe the same set. */
export type ObservedFilters = {
  category: string | null;
  status: string | null;
  /** "with", "none", or null for any. */
  failures: string | null;
  search: string;
};

export type ObservedData = ObservedFilters & {
  rows: TrajectoryRow[];
  pagination?: {previous:string|null;next:string|null};
  total: number;
  categories: string[];
  statuses: string[];
  offset: number;
  limit: number;
  /** The workflow ?trajectory= names, read directly so a deep link lands even
      when the row is not on the page the filters currently show. */
  focused: TrajectoryRow | null;
};

export type WorkflowsData = {
  statistics?: ReactNode;
  observedLoading?: boolean;
  tab: WorkflowsTab;
  observed: ObservedData;
  answers: AnswersData;
};

export type WorkflowsActions = AnswersActions & {
  setTab?: (tab: WorkflowsTab) => void;
  setCategory?: (category: string | null) => void;
  setStatusFilter?: (status: string | null) => void;
  setFailures?: (failures: string | null) => void;
  setSearch?: (search: string) => void;
  setOffset?: (offset: number) => void;
  /** Put the focused workflow in the URL. `null` closes the drawer. */
  openTrajectory?: (trajectoryId: string | number | null) => void;
  tuneStep?: (trajectoryId: string | number, ordinal: number, disposition: string,
              editedArgs: Record<string, unknown> | null) => void | Promise<void>;
  tuneEvidence?: (trajectoryId: string | number, documentId: string | number, relevance: string,
                  note: string) => void | Promise<void>;
  /** Codify the tuned trace as a paused workflow. Answers with the workflow it
      made, so the card can show it without a second read. */
  promote?: (trajectoryId: string | number, name: string) => PromotedWorkflow | Promise<PromotedWorkflow>;
  /** Draft an approved answer from what the agent answered in this run. */
  promoteToAnswer?: (trajectoryId: string | number) => void | Promise<void>;
  /** Turn a run down without losing it. `false` restores it. */
  reject?: (trajectoryId: string | number, rejected: boolean) => void | Promise<void>;
  /** Remove a run and everything harvested with it. */
  remove?: (trajectoryId: string | number) => void | Promise<void>;
  /* Codified workflow lifecycle. */
  setWorkflowEnabled?: (workflowId: number, enabled: boolean) => void | Promise<void>;
  setWorkflowCache?: (workflowId: number, enabled: boolean) => void | Promise<void>;
  reconcileStale?: () => number | Promise<number>;
  deleteWorkflow?: (workflowId: number) => void | Promise<void>;
  /* Clusters: carve one observation out into its own workflow. */
  suggestSplitName?: (trajectoryId: string | number) => string | Promise<string>;
  splitWorkflow?: (trajectoryId: string | number, name: string) => number | Promise<number>;
  /* Guided harvesting of new workflows from recent assistant turns. */
  harvestCandidates?: () => WorkflowHarvestCandidate[] | Promise<WorkflowHarvestCandidate[]>;
  codifyCandidate?: (candidate: WorkflowHarvestCandidate) => number | Promise<number>;
};

/* Re-exported under their old names for one release: `web/src/data` and the
   canvas fixtures both typed against `TrajectoriesData` / `TrajectoriesActions`
   when this page was Trajectories. */
export type TrajectoriesData = ObservedData;
export type TrajectoriesActions = WorkflowsActions;

/* ── Vocabulary ───────────────────────────────────────────────────────────── */

/** A harvest status onto the console's one status vocabulary. Anything this
    build has no chip for renders as the word itself rather than as a chip that
    claims a lifecycle it does not have. */
const RUN_STATUS: Record<string, ChipStatus> = {
  ready: "succeeded",
  fallback: "advisory",
  processing: "running",
  reconciling: "running",
  failed: "failed",
};

const FAILURE_OPTIONS = [
  { value: "", label: "Any outcome" },
  { value: "none", label: "Clean runs" },
  { value: "with", label: "Runs with failures" },
];

/* ── Detail: tool steps and evidence ──────────────────────────────────────── */

function PhaseRail({ phases }: { phases: TrajectoryPhase[] }) {
  if (!phases.length) return <p className="text-[12px] text-ink/70">No tool phases were observed.</p>;
  return (
    <ol aria-label="Workflow phases" className="flex min-w-0 flex-wrap gap-2">
      {phases.map((phase, index) => (
        <li key={`${phase.id}-${index}`} className="min-w-[120px] flex-1 rounded-[6px] border border-ink/12 bg-paper px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold">
            <span className="shrink-0 text-ink/40">{index + 1}</span>
            <Truncate>{phase.name}</Truncate>
          </div>
          <p className="mt-1 text-[11px] text-ink/70">
            {phase.steps} step{phase.steps === 1 ? "" : "s"}, {phase.substate.toLowerCase()}
          </p>
        </li>
      ))}
    </ol>
  );
}

function ToolStepEditor({ trajectoryId, step, actions }: {
  trajectoryId: string | number; step: TrajectoryStep; actions?: WorkflowsActions;
}) {
  const original = JSON.stringify(step.editedArgs ?? step.args, null, 2);
  const [disposition, setDisposition] = useState(step.disposition ?? "included");
  const [args, setArgs] = useState(original);
  const [tuning, setTuning] = useState(false);
  const write = useWrite();
  /* Nothing to save until something is changed. A Save button that is always
     live on all twelve rows of a trace is twelve invitations to write the
     value that is already there, and it makes the list read as a form rather
     than as the record of a run. */
  const dirty = disposition !== (step.disposition ?? "included") || args !== original;
  const save = async () => {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(args); } catch { write.setFailed("Arguments must be a JSON object."); return; }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      write.setFailed("Arguments must be a JSON object."); return;
    }
    await write.run(actions?.tuneStep && (() => actions.tuneStep!(trajectoryId, step.ordinal, disposition, parsed)));
  };
  return (
    <li className={`rounded-[5px] border px-2.5 py-2 text-[12px] ${disposition === "excluded" ? "border-rust/25 bg-rust/[0.04]" : "border-ink/12"}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {step.ok
          ? <CheckCircle2 size={13} className="shrink-0 text-olive" aria-label="Succeeded" />
          : <CircleAlert size={13} className="shrink-0 text-rust" aria-label="Failed" />}
        <span className="min-w-24 shrink-0 font-mono text-[11px] font-semibold">{step.tool}</span>
        <span className="min-w-0 flex-1"><Truncate>{step.summary}</Truncate></span>
        <Select
          aria-label={`${step.tool} disposition`}
          value={disposition}
          onChange={(event) => setDisposition(event.target.value as typeof disposition)}
          className="h-7 shrink-0 px-1.5 text-[11px]"
        >
          <option value="included">Include</option>
          <option value="preferred">Prefer</option>
          <option value="excluded">Exclude</option>
        </Select>
      </div>
      {/* Was a <details>. The whole page dropped disclosure triangles for real
          controls, and a tuning form is a mode of the row, not a footnote. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <Button variant="link" compact onClick={() => setTuning((open) => !open)}>
          <SlidersHorizontal size={12} /> {tuning ? "Hide arguments" : "Tune arguments"}
        </Button>
        {dirty && (
          <Button compact variant="primary" disabled={write.busy} onClick={() => void save()}>
            <Save size={12} /> {write.busy ? "Saving…" : "Save tool"}
          </Button>
        )}
      </div>
      {tuning && (
        <textarea
          aria-label={`${step.tool} arguments`}
          value={args}
          onChange={(event) => setArgs(event.target.value)}
          rows={5}
          className="mt-2 w-full rounded-[4px] border border-ink/20 bg-paper p-2 font-mono text-[11px] text-ink outline-none focus:border-biscay-2 focus:ring-1 focus:ring-biscay-2/40"
        />
      )}
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
    </li>
  );
}

function EvidenceEditor({ trajectoryId, evidence, actions }: {
  trajectoryId: string | number; evidence: TrajectoryEvidence; actions?: WorkflowsActions;
}) {
  const [relevance, setRelevance] = useState(evidence.relevance ?? "observed");
  const [note, setNote] = useState(evidence.note ?? "");
  const write = useWrite();
  const title = evidence.title || `Document ${evidence.documentId}`;
  // Same rule as the tool rows: no save affordance until there is something
  // to save.
  const dirty = relevance !== (evidence.relevance ?? "observed") || note !== (evidence.note ?? "");
  return (
    <li className="rounded-[5px] border border-ink/12 p-2.5 text-[12px]">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <strong className="min-w-0 flex-1 font-semibold"><Truncate>{title}</Truncate></strong>
        <Select
          aria-label={`${title} relevance`}
          value={relevance}
          onChange={(event) => setRelevance(event.target.value as typeof relevance)}
          className="h-7 shrink-0 px-1.5 text-[11px]"
        >
          <option value="observed">Observed</option>
          <option value="relevant">Relevant</option>
          <option value="pinned">Pin</option>
          <option value="irrelevant">Not relevant</option>
        </Select>
      </div>
      {/* The section header above already explains what pinning does; saying
          it again on every row is the same sentence twice. */}
      <p className="mt-1 text-[11px] text-ink/70">{evidence.reason}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input
          aria-label={`${title} note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why this document matters"
          className="h-8 min-w-[200px] flex-1 text-[11px]"
        />
        {dirty && (
          <Button
            compact
            variant="primary"
            disabled={write.busy}
            onClick={() => void write.run(actions?.tuneEvidence
              && (() => actions.tuneEvidence!(trajectoryId, evidence.documentId, relevance, note)))}
          >
            <Save size={12} /> {write.busy ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
    </li>
  );
}

/* ── Promotion ────────────────────────────────────────────────────────────── */

/** The codified workflow a run produced or belongs to, drawn IN PLACE.
 *
 * Promotion used to answer with a button that navigated to /flows, a page
 * that no longer exists. The workflow's name, state, size and controls live
 * here: enable or pause it for assistants, cache its reviewed answer, delete
 * it (the observed run is kept), and see the chat observations clustered
 * under it with the embedding projection that places them. */
function PromotedWorkflowPanel({ row, workflow, actions }: {
  row: TrajectoryRow; workflow: PromotedWorkflow; actions?: WorkflowsActions;
}) {
  const status = row.promotedWorkflowStatus ?? workflow.status;
  const [enabled, setEnabled] = useState(status === "active");
  const [cachePolicy, setCachePolicy] = useState(row.promotedWorkflowCachePolicy ?? "none");
  const [cacheState, setCacheState] = useState(row.promotedWorkflowCacheState ?? "disabled");
  const [gone, setGone] = useState(false);
  const statusWrite = useWrite();
  const cacheWrite = useWrite();
  const deleteWrite = useWrite();
  if (gone) return <p className="text-[12px] text-ink/70">Workflow deleted. The observed run is kept.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[6px] border border-ink/12 bg-flysch/50 px-3 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Workflow size={14} className="shrink-0 text-biscay-2" aria-hidden />
          <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">
            <Truncate>{row.promotedWorkflowName || workflow.name}</Truncate>
          </span>
          <Chip label={enabled ? "Enabled for assistants" : "Paused"} tone={enabled ? "ok" : "neutral"} />
        </div>
        <p className="mt-1 text-[11.5px] text-ink/70">
          {workflow.nodeCount} node{workflow.nodeCount === 1 ? "" : "s"}.
          {enabled ? " Assistants may select it for matching intents." : " Nothing runs until someone enables it."}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button compact disabled={statusWrite.busy}
            onClick={() => void statusWrite.run(actions?.setWorkflowEnabled && (() => actions.setWorkflowEnabled!(workflow.id, !enabled)))
              .then((ok) => { if (ok) setEnabled(!enabled); })}>
            <Workflow size={13} /> {enabled ? "Pause workflow" : "Enable workflow"}
          </Button>
          <ConfirmButton compact confirmLabel="Confirm delete"
            onConfirm={() => void deleteWrite.run(actions?.deleteWorkflow && (() => actions.deleteWorkflow!(workflow.id)))
              .then((ok) => { if (ok) setGone(true); })}>
            <Trash2 size={13} /> Delete workflow
          </ConfirmButton>
        </div>
        <WriteError onDismiss={() => statusWrite.setFailed(null)}>{statusWrite.failed}</WriteError>
        <WriteError onDismiss={() => deleteWrite.setFailed(null)}>{deleteWrite.failed}</WriteError>
      </div>

      <div className="rounded-[6px] border border-ink/12 bg-ink/[0.02] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Database size={14} className="shrink-0" aria-hidden />
          <strong className="text-[12px]">Reviewed-answer cache</strong>
          <Chip label={cachePolicy === "none" ? "Not cached" : cacheState === "fresh" ? "Current" : cacheState === "stale" ? "Stale" : "Needs reconciliation"} />
          <Button compact disabled={cacheWrite.busy}
            onClick={() => void cacheWrite.run(actions?.setWorkflowCache && (() => actions.setWorkflowCache!(workflow.id, cachePolicy === "none")))
              .then((ok) => {
                if (ok) { const enabling = cachePolicy === "none"; setCachePolicy(enabling ? "reviewed_answer" : "none"); setCacheState(enabling ? "fresh" : "disabled"); }
              })}>
            {cachePolicy === "none" ? "Cache reviewed answer" : "Disable cache"}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-ink/65">Optional. A current cache returns the reviewed answer without generation. It becomes stale when any tracked document revision changes.</p>
        {cachePolicy !== "none" && (
          <p className="mt-1 text-[11px] text-ink/55">
            Tracking {row.promotedWorkflowDependencyCount ?? 0} document{row.promotedWorkflowDependencyCount === 1 ? "" : "s"}
            {row.promotedWorkflowCacheRefreshedAt ? `, refreshed ${fmtDate(row.promotedWorkflowCacheRefreshedAt)}` : ""}
          </p>
        )}
        <WriteError onDismiss={() => cacheWrite.setFailed(null)}>{cacheWrite.failed}</WriteError>
      </div>

      <ClusterObservations row={row} actions={actions} />
    </div>
  );
}

/** The chat observations grouped under a codified workflow, with the
    projection that places them and a way to carve one out on its own. */
function ClusterObservations({ row, actions }: { row: TrajectoryRow; actions?: WorkflowsActions }) {
  const observations = row.clusterObservations ?? [row];
  const count = row.workflowObservationCount ?? observations.length;
  const splitWrite = useWrite();
  const [splitTarget, setSplitTarget] = useState<string | number | null>(null);
  const [splitName, setSplitName] = useState("");
  return (
    <details className="rounded-[6px] border border-ink/12 bg-ink/[0.015] px-3 py-2">
      <summary className="cursor-pointer text-[12px] font-semibold text-biscay">
        {count} chat observation{count === 1 ? "" : "s"} in this workflow
      </summary>
      <div className="mt-3"><EmbeddingMap map={row.promotedWorkflowEmbeddingMap} /></div>
      <ol className="mt-2 grid gap-2" aria-label="Workflow observations">
        {observations.map((observation) => (
          <li key={observation.id} className="rounded border border-ink/12 bg-paper p-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1"><strong><Truncate>{observation.prompt}</Truncate></strong> {observation.stepCount} tool step{observation.stepCount === 1 ? "" : "s"}</span>
              <Chip label={observation.executionMode === "cache" ? "Cached response"
                : observation.executionMode === "approved_answer" ? "Approved answer"
                : observation.selectedWorkflowId ? "Workflow selected, generated" : "Generated without workflow"} />
              {observation.id === row.workflowRootTrajectoryId ? <Chip label="Cluster seed" /> : (
                <Button compact disabled={splitWrite.busy}
                  onClick={() => void splitWrite.runFor(actions?.suggestSplitName && (() => actions.suggestSplitName!(observation.id)))
                    .then((name) => { if (name) { setSplitTarget(observation.id); setSplitName(name); } })}>
                  Split from cluster
                </Button>
              )}
            </div>
            {splitTarget === observation.id && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input aria-label="New workflow name" value={splitName} onChange={(event) => setSplitName(event.target.value)} className="min-w-[220px] flex-1" />
                <Button compact onClick={() => { setSplitTarget(null); setSplitName(""); }}>Cancel</Button>
                <Button compact variant="primary" disabled={!splitName.trim() || splitWrite.busy}
                  onClick={() => void splitWrite.runFor(actions?.splitWorkflow && (() => actions.splitWorkflow!(observation.id, splitName)))
                    .then((id) => { if (id) { setSplitTarget(null); setSplitName(""); } })}>
                  Create split workflow
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <WriteError onDismiss={() => splitWrite.setFailed(null)}>{splitWrite.failed}</WriteError>
    </details>
  );
}

function EmbeddingMap({ map }: { map?: TrajectoryRow["promotedWorkflowEmbeddingMap"] }) {
  const points = map?.points ?? [];
  if (!points.length) return (
    <div className="rounded-[6px] border border-dashed border-ink/15 bg-paper px-4 py-8 text-center text-[11px] text-ink/55">
      The embedding map will appear after this workflow has been indexed.
    </div>
  );
  const colors = { intent: "#294f78", phase: "#707746", tool: "#b05d3b" } as const;
  return (
    <figure className="overflow-hidden rounded-[7px] border border-ink/10 bg-paper p-3" aria-label="Workflow embedding">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/70">Workflow embedding</h3>
          <p className="mt-1 text-[11px] text-ink/55">A two-dimensional projection of the stored intent, phases, and tool steps.</p>
        </div>
        {map?.profile && <span className="max-w-[280px] truncate font-mono text-[10px] text-ink/45" title={map.profile}>{map.profile}</span>}
      </div>
      <svg viewBox="0 0 600 240" role="img" aria-label={`Embedding projection with ${points.length} points`} className="mt-2 h-auto w-full min-w-0">
        <rect x="0" y="0" width="600" height="240" rx="8" fill="#f8f6f1" />
        {[100, 200, 300, 400, 500].map((x) => <line key={`x-${x}`} x1={x} y1="18" x2={x} y2="222" stroke="#17202a" strokeOpacity="0.055" />)}
        {[60, 120, 180].map((y) => <line key={`y-${y}`} x1="18" y1={y} x2="582" y2={y} stroke="#17202a" strokeOpacity="0.055" />)}
        {points.map((point, index) => {
          const x = 300 + point.x * 245;
          const y = 120 - point.y * 82;
          const labelRight = x < 420;
          return <g key={`${point.kind}-${point.label}-${index}`}>
            {point.kind === "intent" && <circle cx={x} cy={y} r="14" fill={colors.intent} fillOpacity="0.12" />}
            <circle cx={x} cy={y} r={point.kind === "intent" ? 7 : 5} fill={colors[point.kind]} stroke="#fff" strokeWidth="2" />
            <text x={labelRight ? x + 10 : x - 10} y={y + 4} textAnchor={labelRight ? "start" : "end"} fontSize="11" fill="#17202a">{point.label.slice(0, 34)}</text>
          </g>;
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-[10px] text-ink/55">
        {(["intent", "phase", "tool"] as const).map((kind) => <span key={kind} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[kind] }} />{kind === "intent" ? "Canonical intent" : kind === "phase" ? "Phase" : "Tool step"}</span>)}
        <span className="ml-auto">Distance is relative within this workflow.</span>
      </figcaption>
    </figure>
  );
}

/** Guided discovery of new workflows from recent assistant turns. Every
    candidate is reviewed and named before anything is created. */
function WorkflowHarvestWizard({ actions }: { actions?: WorkflowsActions }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "scanning" | "review" | "done">("intro");
  const [candidates, setCandidates] = useState<WorkflowHarvestCandidate[]>([]);
  const scan = useWrite();
  const create = useWrite();
  const start = async () => {
    setStep("scanning");
    const rows = await scan.runFor(actions?.harvestCandidates && (() => actions.harvestCandidates!()));
    if (rows) {
      setCandidates(rows.map((row) => ({ ...row, accepted: row.suggested !== false })));
      setStep("review");
    } else setStep("intro");
  };
  const finish = async () => {
    const selected = candidates.filter((candidate) => candidate.accepted && candidate.name.trim());
    const result = await create.runFor(async () => {
      let count = 0;
      for (const candidate of selected) {
        await actions?.codifyCandidate?.({ ...candidate, name: candidate.name.trim() });
        count += 1;
      }
      return count;
    });
    if (result !== undefined) setStep("done");
  };
  const busy = scan.busy || create.busy;
  const close = () => { if (!busy) { setOpen(false); setStep("intro"); setCandidates([]); } };
  const update = (index: number, patch: Partial<WorkflowHarvestCandidate>) =>
    setCandidates((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return <>
    <Button compact onClick={() => setOpen(true)}><GitBranch size={13} /> Harvest new workflows</Button>
    <Drawer open={open} onClose={close} title="Harvest new workflows" subtitle="Guided workflow discovery" closable={!busy}
      footer={step === "review" ? <>
        <Button compact onClick={close}>Cancel</Button>
        <Button compact variant="primary" disabled={create.busy || !candidates.some((candidate) => candidate.accepted && candidate.name.trim())} onClick={() => void finish()}>
          Codify selected
        </Button>
      </> : step === "done" ? <Button compact variant="primary" onClick={close}>Done</Button> : undefined}>
      {step === "intro" && <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-5 text-ink/70">Mari inspects recent assistant turns and proposes distinct reusable workflows. You review every candidate before anything is created.</p>
        <div className="rounded-[7px] border border-ink/10 bg-ink/[0.02] p-3 text-[12px] text-ink/65">The scan considers unclustered turns and narrower intents inside existing clusters. Greetings and one-off chatter are excluded.</div>
        <div><Button variant="primary" compact disabled={scan.busy} onClick={() => void start()}>Analyze recent turns</Button></div>
        <WriteError onDismiss={() => scan.setFailed(null)}>{scan.failed}</WriteError>
      </div>}
      {step === "scanning" && <div className="flex flex-col items-center gap-3 py-14 text-center"><Spinner label="Finding workflow candidates" /><strong className="text-[13px]">Clustering observed intent</strong><span className="text-[12px] text-ink/60">Comparing recent turns with current workflow clusters</span></div>}
      {step === "review" && <div className="flex flex-col gap-3">
        <p className="text-[12px] text-ink/65">{candidates.length ? "Suggested workflows are selected. Generated recent turns remain visible for manual promotion or splitting." : "No recent assistant turns were found. Ask the Mari agent something first — every dock conversation becomes an observed turn this scan can mine."}</p>
        {candidates.map((candidate, index) => <Card key={`${candidate.seedTrajectoryId}-${index}`} className={candidate.accepted ? "" : "opacity-60"}>
          <CardBody>
            <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${candidate.suggested === false ? "text-ink/50" : "text-olive"}`}>{candidate.suggested === false ? "Recent generated turn" : "Suggested workflow"}</p>
            <label className="flex items-start gap-2">
              <input type="checkbox" aria-label={`Select candidate ${index + 1}`} checked={Boolean(candidate.accepted)} onChange={(event) => update(index, { accepted: event.target.checked })} className="mt-1" />
              <span className="min-w-0 flex-1">
                <Input aria-label={`Candidate ${index + 1} name`} value={candidate.name} onChange={(event) => update(index, { name: event.target.value })} className="w-full font-semibold" />
                <span className="mt-2 block text-[12px] leading-5 text-ink/65">{candidate.reason}</span>
              </span>
            </label>
            <details className="mt-3"><summary className="cursor-pointer text-[11px] font-semibold text-biscay">{candidate.observationIds.length} supporting turn{candidate.observationIds.length === 1 ? "" : "s"}</summary>
              <ul className="mt-2 space-y-1 text-[11px] text-ink/65">{candidate.prompts.map((prompt, promptIndex) => <li key={promptIndex} className="rounded bg-ink/[0.025] px-2 py-1.5">{prompt}</li>)}</ul>
            </details>
            {candidate.existingWorkflowId && <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-rust">Will split from workflow {candidate.existingWorkflowId}</p>}
          </CardBody>
        </Card>)}
        <WriteError onDismiss={() => create.setFailed(null)}>{create.failed}</WriteError>
      </div>}
      {step === "done" && <div className="py-12 text-center"><CheckCircle2 className="mx-auto text-olive" size={28} /><h3 className="mt-3 text-[15px] font-semibold">Workflows codified</h3><p className="mt-1 text-[12px] text-ink/65">The selected candidates are now available to chat, Slack, and other agent destinations.</p></div>}
    </Drawer>
  </>;
}

function PromoteToWorkflow({ row, actions }: { row: TrajectoryRow; actions?: WorkflowsActions }) {
  const [name, setName] = useState(row.macroIntent || row.prompt.slice(0, 80));
  const [made, setMade] = useState<PromotedWorkflow | null>(row.promotedWorkflow);
  const write = useWrite();

  /* Adopt a promotion that landed elsewhere (a refetch, the card beside this
     drawer) without clobbering a name being typed here (C1). */
  const [seen, setSeen] = useState(row.promotedWorkflow);
  if (seen !== row.promotedWorkflow) { setSeen(row.promotedWorkflow); setMade(row.promotedWorkflow); }

  if (made) return <PromotedWorkflowPanel row={row} workflow={made} actions={actions} />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Workflow name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-[220px] flex-1"
          placeholder="Name this workflow"
        />
      </div>
      <div>
        <Button
          variant="primary"
          compact
          disabled={write.busy || !name.trim()}
          onClick={() => void write.runFor(actions?.promote && (() => actions.promote!(row.id, name)))
            .then((made) => { if (made) setMade(made); })}
        >
          <Workflow size={13} /> {write.busy ? "Codifying…" : "Codify workflow"}
        </Button>
      </div>
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
    </div>
  );
}

/** The answer this run was promoted into, if one exists. Matched off the
    answers tab's own rows, so the two tabs can never disagree about it. */
function answerFor(data: WorkflowsData, trajectoryId: string | number) {
  return data.answers.answers.find((answer) => answer.trajectoryId === trajectoryId) ?? null;
}

/* ── One observed workflow ────────────────────────────────────────────────── */

function StatTrio({ row }: { row: TrajectoryRow }) {
  const cells = [
    { value: row.stepCount, label: "steps" },
    { value: row.failureCount, label: "failures" },
    { value: row.reworkCount, label: "rework" },
  ];
  return (
    <dl className="flex items-center gap-5">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0">
          <dd className={`text-[17px] font-semibold leading-none ${cell.label === "failures" && cell.value > 0 ? "text-rust" : "text-ink"}`}>
            {cell.value.toLocaleString("en-US")}
          </dd>
          <dt className="mt-1 font-term text-[10.5px] uppercase tracking-[0.1em] text-ink/65">{cell.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function ObservedCard({ data, row, actions, onInspect }: {
  data: WorkflowsData; row: TrajectoryRow; actions?: WorkflowsActions; onInspect: () => void;
}) {
  const rejected = row.disposition === "rejected";
  const answer = answerFor(data, row.id);
  const write = useWrite();
  const chip = RUN_STATUS[row.status];
  return (
    <Card className={rejected ? "border-dashed" : undefined}>
      <article aria-labelledby={`workflow-${row.id}`} className="min-w-0">
        <CardBody>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <CardTitleBlock
              className="flex-1 basis-[260px]"
              eyebrow={row.category || "Unclassified"}
              title={<span id={`workflow-${row.id}`}><Truncate>{row.promotedWorkflowName || row.macroIntent || row.prompt || `Workflow ${row.id}`}</Truncate></span>}
              summary={<Truncate lines={2}>{row.layer2 || "The abstraction for this run is still being written."}</Truncate>}
            />
            <div className="shrink-0"><StatTrio row={row} /></div>
          </div>

          <CardMeta
            source={chip
              ? <StatusChip status={chip} />
              : <Chip label={row.status} tone="neutral" />}
            status={rejected ? <Chip label="Rejected" tone="blocked" dot /> : undefined}
            date={row.startedAt ? fmtDate(row.startedAt) : undefined}
            author={row.model || "Model unavailable"}
          />

          <CardSection label="Phases" count={row.phases.length}>
            <PhaseRail phases={row.phases} />
          </CardSection>

          {row.promotedWorkflow && (
            <CardSection label="Workflow cluster">
              <PromotedWorkflowPanel row={row} workflow={row.promotedWorkflow} actions={actions} />
            </CardSection>
          )}

          {answer && (
            <CardSection label="Promoted answer">
              <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[6px] border border-ink/12 bg-flysch/50 px-3 py-2.5">
                <MessageCircleQuestion size={14} className="shrink-0 text-biscay-2" aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] text-ink"><Truncate>{answer.question}</Truncate></span>
                <StatusChip status={answer.status === "approved" ? "approved" : answer.status === "retired" ? "retired" : "draft"} />
                <Button variant="link" compact onClick={() => actions?.setTab?.("answers")}>Open in Approved answers</Button>
              </div>
            </CardSection>
          )}

          <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>

          <CardActions
            primary={<Button variant="primary" compact onClick={onInspect}>Inspect run</Button>}
            secondary={(
              <>
                {!answer && (
                  <Button
                    compact
                    disabled={write.busy}
                    onClick={() => void write.run(actions?.promoteToAnswer && (() => actions.promoteToAnswer!(row.id)))}
                  >
                    <MessageCircleQuestion size={13} /> Promote to answer
                  </Button>
                )}
                <Button
                  compact
                  disabled={write.busy}
                  onClick={() => void write.run(actions?.reject && (() => actions.reject!(row.id, !rejected)))}
                >
                  {rejected ? <><Undo2 size={13} /> Restore</> : <><X size={13} /> Reject</>}
                </Button>
                <ConfirmButton
                  compact
                  confirmLabel="Delete for good?"
                  onConfirm={() => void write.run(actions?.remove && (() => actions.remove!(row.id)))}
                >
                  <Trash2 size={13} /> Delete
                </ConfirmButton>
              </>
            )}
          />
        </CardBody>
      </article>
    </Card>
  );
}

/* ── The detail drawer ────────────────────────────────────────────────────── */

function WorkflowDrawer({ data, row, actions, onClose }: {
  data: WorkflowsData; row: TrajectoryRow | null; actions?: WorkflowsActions; onClose: () => void;
}) {
  const write = useWrite();
  if (!row) return null;
  const rejected = row.disposition === "rejected";
  return (
    <Drawer
      open
      onClose={onClose}
      title={row.macroIntent || row.prompt || `Workflow ${row.id}`}
      subtitle={row.category || "Unclassified"}
      icon={<GitBranch size={16} className="shrink-0 text-biscay-2" aria-hidden />}
      footer={(
        <>
          <Button
            variant="primary"
            compact
            disabled={write.busy || Boolean(answerFor(data, row.id))}
            onClick={() => void write.run(actions?.promoteToAnswer && (() => actions.promoteToAnswer!(row.id)))}
          >
            <MessageCircleQuestion size={13} /> Promote to answer
          </Button>
          <Button
            compact
            disabled={write.busy}
            onClick={() => void write.run(actions?.reject && (() => actions.reject!(row.id, !rejected)))}
          >
            {rejected ? "Restore" : "Reject"}
          </Button>
          <ConfirmButton
            compact
            confirmLabel="Delete for good?"
            onConfirm={() => void write.run(actions?.remove && (() => actions.remove!(row.id)), onClose)}
          >
            <Trash2 size={13} /> Delete
          </ConfirmButton>
        </>
      )}
    >
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">Question asked</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80">{row.prompt || "No prompt was recorded."}</p>
        </section>

        <section>
          <h3 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">Grounded workflow</h3>
          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/80">
            {row.layer1 || "The grounded description of this run has not been written yet."}
          </p>
        </section>

        <section>
          <h3 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">Phases</h3>
          <div className="mt-2"><PhaseRail phases={row.phases} /></div>
        </section>

        <section>
          <h3 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">
            Chronological evidence
          </h3>
          <p className="mt-1 text-[11.5px] text-ink/70">
            Prefer a tool and the planner reaches for it first. Exclude one and it is not offered at all.
          </p>
          {row.steps.length ? (
            <Scrollable axis="y" className="mt-2 max-h-[420px]">
              <ol className="flex flex-col gap-1.5 pr-1" aria-label="Trajectory steps">
                {row.steps.map((step) => (
                  <ToolStepEditor key={step.ordinal} trajectoryId={row.id} step={step} actions={actions} />
                ))}
              </ol>
            </Scrollable>
          ) : <p className="mt-2 text-[12px] text-ink/70">No tool calls were harvested from this run.</p>}
        </section>

        <section>
          <h3 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">Answer evidence</h3>
          <p className="mt-1 text-[11.5px] text-ink/70">
            A pinned document goes in front of the model whenever retrieval finds it again.
          </p>
          {row.evidence.length ? (
            <ol className="mt-2 flex flex-col gap-2">
              {row.evidence.map((reference) => (
                <EvidenceEditor key={reference.documentId} trajectoryId={row.id} evidence={reference} actions={actions} />
              ))}
            </ol>
          ) : <p className="mt-2 text-[12px] text-ink/70">No documents were attached to this answer.</p>}
        </section>

        <section>
          <h3 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">Codify as workflow</h3>
          <div className="mt-2"><PromoteToWorkflow row={row} actions={actions} /></div>
        </section>

        <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      </div>
    </Drawer>
  );
}

/* ── The Observed tab ─────────────────────────────────────────────────────── */

/** The search box. Local while typing, committed on a pause, so the URL is
    shareable without every keystroke becoming a place to go back to. */
function ObservedToolbar({ observed, actions }: { observed: ObservedData; actions?: WorkflowsActions }) {
  const staleCaches = observed.rows.filter((row) =>
    (row.promotedWorkflowCachePolicy ?? "none") !== "none" && row.promotedWorkflowCacheState !== "fresh").length;
  const reconciliation = useWrite();
  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2.5">
      {/* The console's shared filter idiom (navigation/FilterTrigger) — this
          bar is the reference the other pages match, so it renders through
          the shared components rather than a private copy of them. */}
      <FilterSearch
        aria-label="Search observed workflows"
        value={observed.search}
        onSearch={actions?.setSearch}
        placeholder="Search intents, prompts and categories"
      />
      <FilterSelect
        label="Category"
        aria-label="Filter by category"
        value={observed.category ?? ""}
        onChange={(event) => actions?.setCategory?.(event.target.value || null)}
      >
        <option value="">All categories</option>
        {observed.categories.map((category) => <option key={category} value={category}>{category}</option>)}
      </FilterSelect>
      <FilterSelect
        label="Status"
        aria-label="Filter by status"
        value={observed.status ?? ""}
        onChange={(event) => actions?.setStatusFilter?.(event.target.value || null)}
      >
        <option value="">All statuses</option>
        {observed.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </FilterSelect>
      <FilterSelect
        label="Outcome"
        aria-label="Filter by outcome"
        value={observed.failures ?? ""}
        onChange={(event) => actions?.setFailures?.(event.target.value || null)}
      >
        {FAILURE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </FilterSelect>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <WorkflowHarvestWizard actions={actions} />
        <Button compact disabled={reconciliation.busy}
          onClick={() => void reconciliation.runFor(actions?.reconcileStale && (() => actions.reconcileStale!()))}>
          <RefreshCw size={13} /> Reconcile stale caches{staleCaches ? ` (${staleCaches})` : ""}
        </Button>
      </span>
    </div>
    <WriteError onDismiss={() => reconciliation.setFailed(null)}>{reconciliation.failed}</WriteError>
    </div>
  );
}

/** True when the reader has narrowed the list themselves. It decides which
    empty state is honest: "nothing matches" is a different fact from "nothing
    has been observed", and only one of them is the reader's to fix. */
const isFiltered = (observed: ObservedData) =>
  Boolean(observed.category || observed.status || observed.failures || observed.search.trim());

function Observed({ data, error, actions, onInspect }: {
  data: WorkflowsData; error: string | null; actions?: WorkflowsActions; onInspect: (id: string | number) => void;
}) {
  const observed = data.observed;
  const filtered = isFiltered(observed);
  const from = observed.total ? observed.offset + 1 : 0;
  const to = Math.min(observed.offset + observed.rows.length, observed.total);
  const page = Math.floor(observed.offset / observed.limit);
  const pageCount = Math.max(1, Math.ceil(observed.total / observed.limit));

  return (
    <div className="flex flex-col gap-5">
      <ObservedToolbar observed={observed} actions={actions} />
      {error ? <Card><ReadError>{error}</ReadError></Card> : (
        <>
          {/* Above the list it describes, below the filter bar (§13). */}
          {observed.pagination ? <p className="text-sm text-muted">{observed.rows.length} workflows on this page</p> :
            <ResultCount from={from} to={to} total={observed.total} noun="workflows" nounOne="workflow" />}
          {!observed.rows.length ? (
            <Card>
              <EmptyState
                title={filtered ? "Nothing matches those filters" : "No workflows observed yet"}
                action={filtered ? (
                  <Button variant="primary" compact onClick={() => {
                    actions?.setSearch?.("");
                    actions?.setCategory?.(null);
                    actions?.setStatusFilter?.(null);
                    actions?.setFailures?.(null);
                  }}>Clear filters</Button>
                ) : undefined}
              >
                {filtered
                  ? "Widen the search, or clear the filters to see every run."
                  : "Ask Mari something. Every run it works through is harvested here, with the tools it called and the documents it used."}
              </EmptyState>
            </Card>
          ) : (
            /* A card gallery, not one stacked column: at the container width a
               single column of run cards leaves the right half of the page
               empty, and a short last row stretches rather than leaving a dead
               corner (§11, §15). */
            <div className="flex flex-wrap gap-5 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[560px]">
              {observed.rows.map((row) => (
                <ObservedCard key={row.id} data={data} row={row} actions={actions} onInspect={() => onInspect(row.id)} />
              ))}
            </div>
          )}
          {observed.pagination && <nav aria-label="Workflow pages" className="flex gap-4 text-sm">
            {observed.pagination.previous && <a href={observed.pagination.previous}>Previous page</a>}
            {observed.pagination.next && <a href={observed.pagination.next}>Next page</a>}
          </nav>}
          {!observed.pagination && observed.total > observed.limit && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onChange={(next) => actions?.setOffset?.(next * observed.limit)}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── The page ─────────────────────────────────────────────────────────────── */

function WorkflowsPage({ data, loading = false, error = null, actions, chrome, mobile = false }:
  PageProps<WorkflowsData, WorkflowsActions>) {
  const [tab, setTab] = useState<WorkflowsTab>(data.tab);
  const [seenTab, setSeenTab] = useState(data.tab);
  if (seenTab !== data.tab) { setSeenTab(data.tab); setTab(data.tab); }

  /* The drawer opens instantly off a row the page already holds, and the URL
     catches up. Seeded from ?trajectory= so a deep link, a bookmark, or an
     answer's "from workflow" link lands on the open drawer rather than on the
     list with the reader hunting for the row. */
  const focusedId = data.observed.focused?.id ?? null;
  const [openId, setOpenId] = useState<string | number | null>(focusedId);
  const [seenFocus, setSeenFocus] = useState(focusedId);
  if (seenFocus !== focusedId) { setSeenFocus(focusedId); setOpenId(focusedId); }

  const open = (id: string | number | null) => {
    setOpenId(id);
    if (id !== null) setTab("observed");
    actions?.openTrajectory?.(id);
  };

  const changeTab = (next: WorkflowsTab) => {
    setTab(next);
    actions?.setTab?.(next);
  };

  const drawerRow = openId === null ? null
    : data.observed.rows.find((row) => row.id === openId)
      ?? (data.observed.focused?.id === openId ? data.observed.focused : null);

  if (loading) {
    return (
      <PageFrame chrome={chrome} active={navFor("workflows")} title="Workflows" mobile={mobile}>
        <SkeletonPage
          variant="list"
          eyebrow="Agent operations"
          title="Workflows"
          description="Review agent trajectories and approve reusable answers."
          tabs={["Observed", "Approved answers"]}
          mobile={mobile}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame chrome={chrome} active={navFor("workflows")} title="Workflows" mobile={mobile}>
      <div className={PAGE_CONTAINER}>
        <PageHeader
          eyebrow="Agent operations"
          title="Workflows"
          description="Review agent trajectories and approve reusable answers."
        />
        <div className="mt-6 flex flex-col gap-5">
          {data.statistics}
          <Tabs
            ariaLabel="Workflows view"
            variant="underline"
            value={tab}
            onChange={changeTab}
            options={[
              { id: "observed", label: "Observed", count: data.observed.pagination ? undefined : data.observed.total },
              { id: "answers", label: "Approved answers", count: data.answers.answers.length },
            ]}
          />
          {tab === "observed" ? (
            data.observedLoading ? <Card title="Observed runs"><Spinner label="Loading observed runs" /></Card> : <Observed data={data} error={error} actions={actions} onInspect={(id) => open(id)} />
          ) : (
              <ApprovedAnswers
                data={data.answers}
                error={error}
                actions={actions}
                mobile={mobile}
              />
          )}
        </div>
      </div>
      {tab === "observed" && (
        <WorkflowDrawer data={data} row={drawerRow} actions={actions} onClose={() => open(null)} />
      )}
    </PageFrame>
  );
}

/* The component under its old name, for one release: an app that still imports
   `TrajectoriesPage` keeps compiling while it moves to `WorkflowsPage`. */
export { WorkflowsPage, WorkflowsPage as TrajectoriesPage };

export const page: PageModule<WorkflowsData, WorkflowsActions> = {
  id: "workflows",
  title: "Workflows",
  route: "/workflows",
  component: WorkflowsPage,
  states: STATES.map((state) => ({ ...state })),
};
