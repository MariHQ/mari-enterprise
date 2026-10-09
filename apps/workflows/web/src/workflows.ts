/** Pure presentation mapping shared by platform adapters. */
import type { ObservedData, TrajectoryRow, WorkflowsData, WorkflowsTab } from "@mari-design/components/pages/WorkflowsPage";
import type { AnswerStat, AnswersData, HarvestSource } from "@mari-design/components/features/ApprovedAnswers";
import type { Answer } from "@mari-design/components/features/AnswerCard";

const PAGE = 25;

type AnswerRes = {
  id: number; question: string; answer: string; status: string; owner: string;
  channels: string[]; sources: { source: string; title: string }[] | null;
  served: number; spark: number[]; updated: string;
  trajectoryId: number | null; supersedes: number | null; recheckAfter: string;
};

type Res = {
  trajectories: TrajectoryRow[];
  trajectory: TrajectoryRow | null;
  trajectoryTotal: number;
  trajectoryCategories: string[];
  trajectoryStatuses: string[];
  approvedAnswers: AnswerRes[];
  answerCoverageGaps: string[];
  answerHarvestSources: { key: string; label: string; count: number }[] | null;
};

function row(raw: TrajectoryRow): TrajectoryRow {
  return {
    ...raw,
    steps: (raw.steps ?? []).map((step) => ({
      ...step,
      disposition: step.disposition ?? "included",
      editedArgs: step.editedArgs ?? null,
    })),
    evidence: raw.evidence ?? [],
    phases: raw.phases ?? [],
    promotedWorkflowId: raw.promotedWorkflowId ?? null,
    // The server sends the codified workflow as one object; an older server
    // (or a row shaped by the flat fields alone) still names it, so the card
    // can draw the panel either way.
    promotedWorkflow: raw.promotedWorkflow ?? (raw.promotedWorkflowId && raw.promotedWorkflowName ? {
      id: raw.promotedWorkflowId, name: raw.promotedWorkflowName,
      status: raw.promotedWorkflowStatus || "active", nodeCount: raw.stepCount ?? 0,
    } : null),
    disposition: raw.disposition || "observed",
    promotedWorkflowName: raw.promotedWorkflowName ?? "",
    workflowRootTrajectoryId: raw.workflowRootTrajectoryId ?? null,
    workflowObservationCount: raw.workflowObservationCount ?? 1,
    promotedWorkflowStatus: raw.promotedWorkflowStatus ?? "",
    promotedWorkflowCachePolicy: raw.promotedWorkflowCachePolicy ?? "none",
    promotedWorkflowCacheState: raw.promotedWorkflowCacheState ?? "disabled",
    promotedWorkflowCacheRefreshedAt: raw.promotedWorkflowCacheRefreshedAt ?? "",
    promotedWorkflowDependencyCount: raw.promotedWorkflowDependencyCount ?? 0,
    promotedWorkflowEmbeddingMap: raw.promotedWorkflowEmbeddingMap ?? { profile: "", points: [] },
  };
}

export function clusterRows(rows: TrajectoryRow[]): TrajectoryRow[] {
  const grouped = new Map<string, TrajectoryRow>();
  for (const item of rows) {
    const key = item.promotedWorkflowId ? `workflow:${item.promotedWorkflowId}` : `observation:${item.id}`;
    const current = grouped.get(key);
    if (!current) { grouped.set(key, { ...item, clusterObservations: [item] }); continue; }
    const observations = [...(current.clusterObservations ?? [current]), item];
    if (item.id === item.workflowRootTrajectoryId) grouped.set(key, { ...item, clusterObservations: observations });
    else current.clusterObservations = observations;
  }
  return [...grouped.values()];
}

export type ObservedParams = {
  category: string | null;
  status: string | null;
  failures: string | null;
  search: string;
  offset: number;
  focus: number | null;
};

export function buildObserved(res: Res | null, params: ObservedParams): ObservedData {
  return {
    rows: clusterRows((res?.trajectories ?? []).slice(0, PAGE).map(row)),
    total: res?.trajectoryTotal ?? 0,
    categories: res?.trajectoryCategories ?? [],
    statuses: res?.trajectoryStatuses ?? [],
    category: params.category,
    status: params.status,
    failures: params.failures,
    search: params.search,
    offset: params.offset,
    limit: PAGE,
    // Read directly rather than looked up in `rows`: the deep-linked workflow
    // is very often not on the page the filters currently show, and the drawer
    // has to open on it anyway.
    focused: res?.trajectory ? row(res.trajectory) : null,
  };
}

const STATUS = new Set<Answer["status"]>(["approved", "draft", "retired"]);

const CHANNELS = new Set<Answer["channels"][number]>(["slack-bot", "support-widget", "docs-site"]);

export function mapAnswers(res: { approvedAnswers: AnswerRes[] }): Answer[] {
  return (res.approvedAnswers ?? [])
    // status is the card's whole frame — badge, actions and tone. A row whose
    // status this build does not know would render as an untitled card.
    .filter((a) => STATUS.has(a.status as Answer["status"]))
    .map<Answer>((a) => ({
      id: a.id,
      question: a.question,
      answer: a.answer,
      status: a.status as Answer["status"],
      owner: a.owner,
      channels: (a.channels ?? []).filter((c): c is Answer["channels"][number] =>
        CHANNELS.has(c as Answer["channels"][number])),
      sources: a.sources ?? [],
      served: a.served,
      // [] is a real answer: an answer nobody has been served has no curve, and
      // the card then draws no sparkline rather than a flat invented one.
      spark: a.spark ?? [],
      updated: a.updated,
      trajectoryId: a.trajectoryId ?? null,
      // "" means the row carries no recheck date. Passing it through as ""
      // would draw a chip reading "Recheck Invalid Date".
      recheckAfter: a.recheckAfter || undefined,
    }));
}

const TILES: { label: string; sub: string; tone: AnswerStat["tone"]; of: (a: Answer[]) => number }[] = [
  { label: "Approved", sub: "serving verbatim", tone: "ok", of: (a) => a.filter((x) => x.status === "approved").length },
  { label: "Drafts", sub: "awaiting review", tone: "attention", of: (a) => a.filter((x) => x.status === "draft").length },
  { label: "Served", sub: "all time", tone: "info", of: (a) => a.reduce((n, x) => n + (x.served ?? 0), 0) },
];

export function mapHarvestSources(res: Pick<Res, "answerHarvestSources">): HarvestSource[] {
  return (res.answerHarvestSources ?? [])
    .filter((source) => source.count > 0)
    .map((source) => ({
      key: source.key,
      label: source.label,
      desc: source.key === "chat"
        ? `${source.count.toLocaleString("en-US")} recent questions asked in chat.`
        : `${source.count.toLocaleString("en-US")} indexed documents available to mine.`,
      on: true,
    }));
}

export function buildAnswers(
  answers: Answer[], coverage: string[], filter: AnswersData["filter"],
  harvestSources: HarvestSource[] = [],
): AnswersData {
  return {
    // Empty means there is nothing to scan, and no "Harvest questions" button
    // is drawn — which is the truth about a workspace with no corpus yet.
    harvestSources,
    stats: TILES.map<AnswerStat>((t) => ({
      value: t.of(answers).toLocaleString("en-US"), label: t.label, tone: t.tone, sub: t.sub,
    })),
    filter,
    answers,
    coverage,
    pane: { kind: "answers" },
  };
}

export function buildWorkflows(
  res: Res | null, tab: WorkflowsTab, params: ObservedParams,
): WorkflowsData {
  return {
    tab,
    observed: buildObserved(res, params),
    answers: buildAnswers(
      res ? mapAnswers(res) : [],
      res?.answerCoverageGaps ?? [],
      "all",
      res ? mapHarvestSources(res) : [],
    ),
  };
}

export const EMPTY: WorkflowsData = buildWorkflows(null, "observed", {
  category: null, status: null, failures: null, search: "", offset: 0, focus: null,
});
