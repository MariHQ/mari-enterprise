import { useState } from "react";
import { CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, PAGE_CONTAINER } from "./PageFrame";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Dialog } from "../layout/Dialog";
import { FormField } from "../forms/FormField";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { Truncate } from "../data-display/Truncate";
import { Select } from "../forms/Select";
import { SkeletonPage } from "../data-display/Skeletons";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite } from "../actions/useWrite";
import { fmtDateTime } from "../tokens/format";

export type ScheduledTask = {
  id: number | string;
  name: string;
  description: string;
  status: string;
  scheduleMinutes: number | null;
  lastRunNumber: number | string | null;
  lastRunStatus: string;
  lastRunStarted: string;
  /** A connector sync. Syncs are cheap per run (unchanged chunks are never
      re-embedded), so their cadence list adds the sub-hourly options the
      Sources page offers; model-backed jobs never get a 10-minute loop. */
  sync?: boolean;
  retired?: boolean;
  projected?: boolean;
  nextRunAt?: string | null;
};

export type ScheduledTasksData = { tasks: ScheduledTask[]; observedAt?: string; projectionNote?: string; runs?: {id:string; name:string; status:string; startedAt:string; duration:number|null}[] };

export type ScheduledTasksActions = {
  refresh?: () => void;
  setStatus?: (taskId: number | string, status: "active" | "paused") => void | Promise<void>;
  setSchedule?: (taskId: number | string, everyMinutes: number | null) => void | Promise<void>;
  runNow?: (taskId: number | string) => number | string | Promise<number | string>;
  remove?: (taskId: number | string) => void | Promise<void>;
  /** Schedule one of the console's recurring jobs. Removal deletes the
      workflow outright, so without this a removed job was gone until the
      next server restart re-seeded it. Idempotent server-side: an existing
      job of that kind is reused with the new cadence. */
  createTask?: (kind: "facts" | "digest", everyMinutes: number) => void | Promise<void>;
};

/** The jobs New task can schedule. Connector syncs are created by connecting
    a source, and decision scan is deliberately manual-only, so neither is
    offered here. */
const TASK_KINDS = [
  { value: "facts", label: "Fact extraction" },
  { value: "digest", label: "Weekly digest refresh" },
] as const;

const OPTIONS = [
  { value: "", label: "Manual only" },
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "1440", label: "Every day" },
  { value: "10080", label: "Every week" },
];

/* Sync rows offer the same sub-hourly cadences Sources does, so a value set
   there is a real option here rather than a synthesized orphan you could
   leave but never return to. */
const SYNC_OPTIONS = [
  OPTIONS[0],
  { value: "10", label: "Every 10 min" },
  { value: "15", label: "Every 15 min" },
  ...OPTIONS.slice(1),
];

function scheduleLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `Every ${minutes / 1440} days`;
  if (minutes % 60 === 0) return `Every ${minutes / 60} hours`;
  return `Every ${minutes} min`;
}

function TaskRow({ task, actions }: { task: ScheduledTask; actions?: ScheduledTasksActions }) {
  const [status, setStatus] = useState(task.status);
  const [minutes, setMinutes] = useState<number | null>(task.scheduleMinutes);
  const [startedRun, setStartedRun] = useState<number | string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [seen, setSeen] = useState(`${task.status}:${task.scheduleMinutes}:${task.lastRunNumber}`);
  const write = useWrite();
  const signature = `${task.status}:${task.scheduleMinutes}:${task.lastRunNumber}`;
  if (seen !== signature) {
    setSeen(signature); setStatus(task.status); setMinutes(task.scheduleMinutes);
  }
  const active = status === "active" && minutes !== null;
  const base = task.sync ? SYNC_OPTIONS : OPTIONS;
  const options = minutes !== null && !base.some((option) => option.value === String(minutes))
    ? [...base, { value: String(minutes), label: scheduleLabel(minutes) }] : base;
  let next = "Manual only";
  if (minutes !== null && status === "paused") next = "Paused — cadence is preserved";
  else if (active && task.lastRunStatus === "running") next = "After the current run finishes";
  else if (active && task.lastRunStarted) {
    next = fmtDateTime(new Date(new Date(task.lastRunStarted).getTime() + minutes! * 60_000));
  } else if (active) next = "On the next scheduler check";

  if (task.projected) next = task.retired ? "Replaced by durable polling" : status === "paused" ? "Paused" : task.nextRunAt ? fmtDateTime(task.nextRunAt) : "Not projected";

  const changeSchedule = (value: string) => {
    const valueMinutes = value ? Number(value) : null;
    void write.run(actions?.setSchedule && (() => actions.setSchedule!(task.id, valueMinutes)),
      () => { if (!task.projected) setMinutes(valueMinutes); else setStartedRun("requested"); });
  };
  const toggle = () => {
    const value = status === "active" ? "paused" : "active";
    void write.run(actions?.setStatus && (() => actions.setStatus!(task.id, value)),
      () => { if (!task.projected) setStatus(value); else setStartedRun("requested"); });
  };
  const run = async () => {
    const number = await write.runFor(actions?.runNow && (() => actions.runNow!(task.id)));
    if (number !== undefined) setStartedRun(number);
  };
  const remove = () => {
    void write.run(actions?.remove && (() => actions.remove!(task.id)), () => setRemoved(true));
  };

  if (removed) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CalendarClock size={17} className="shrink-0 text-biscay-2" />
            <h3 className="min-w-0 font-semibold text-ink"><Truncate>{task.name}</Truncate></h3>
            <Chip
              label={task.retired ? "Retired" : minutes === null ? "Manual" : status === "paused" ? "Paused" : task.lastRunStatus === "running" ? "Running" : "Active"}
              tone={minutes === null ? "neutral" : status === "paused" ? "attention" : task.lastRunStatus === "failed" ? "blocked" : "ok"}
              dot={minutes !== null}
            />
          </div>
          {task.description && <p className="mt-1 text-[12.5px] text-ink/70">{task.description}</p>}
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-[610px] lg:grid-cols-[180px_1fr_auto] lg:items-end">
          {/* ink/70, not /60: 11px text on a white card needs 4.5:1, and
              ink at 60% over white lands at ~4.25 (axe color-contrast). */}
          <label className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/70">
            Cadence
            <Select aria-label={`${task.name} cadence`} className="mt-1 h-9 w-full text-[12px] normal-case tracking-normal"
              value={minutes === null ? "" : String(minutes)} disabled={write.busy || task.retired || !actions?.setSchedule}
              onChange={(event) => changeSchedule(event.target.value)}>
              {options.map((option) => <option key={option.value || "manual"} value={option.value}>{option.label}</option>)}
            </Select>
          </label>
          <div className="min-w-0 text-[11px] text-ink/65">
            <div className="font-semibold uppercase tracking-[0.08em]">Last / next</div>
            <div className="mt-1 truncate text-[12px] text-ink/80">
              {task.lastRunStarted ? `${task.lastRunNumber ? "#" + task.lastRunNumber + " " : ""}${task.lastRunStatus || "Status not projected"} · ${fmtDateTime(task.lastRunStarted)}` : "Not run yet"}
            </div>
            <div className="truncate text-[12px] text-ink/65">Next: {next}</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-3 lg:col-span-1">
            {actions?.remove && <ConfirmButton compact disabled={write.busy || task.lastRunStatus === "running"}
              confirmLabel="Confirm remove" onConfirm={remove}>
              <Trash2 size={12} /> Remove
            </ConfirmButton>}
            {minutes !== null && !task.retired && actions?.setStatus && <Button compact disabled={write.busy} onClick={toggle}>
              {status === "active" ? <Pause size={12} /> : <Play size={12} />}{status === "active" ? "Pause" : "Resume"}
            </Button>}
            {!task.retired && actions?.runNow && <Button compact variant="primary" disabled={write.busy || (!task.projected && task.lastRunStatus === "running")} onClick={() => void run()}>
              <Play size={12} /> {write.busy ? "Working…" : "Run now"}
            </Button>}
          </div>
        </div>
      </div>
      {(startedRun !== null || write.failed) && <div className="border-t border-ink/10 px-5 py-2 text-[12px] text-ink/70">
        {startedRun !== null && <>Command accepted by Temporal. Displayed status is the last knowledge snapshot.</>}
        <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      </div>}
    </Card>
  );
}

function NewTaskDialog({ onCreate, onClose }: {
  onCreate: (kind: "facts" | "digest", everyMinutes: number) => void | Promise<void>;
  onClose: () => void;
}) {
  const write = useWrite();
  const [kind, setKind] = useState<"facts" | "digest">("facts");
  const [minutes, setMinutes] = useState("60");
  const create = () => void write.run(
    () => onCreate(kind, Number(minutes) || 0),
    onClose,
  );
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="New scheduled task"
      description="Put one of the recurring jobs on a cadence."
      footer={
        <>
          <Button variant="primary" disabled={write.busy} onClick={create}>
            {write.busy ? "Creating…" : "Create task"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </>
      }>
      <div className="flex flex-col gap-4">
        <FormField label="Job">
          <Select aria-label="Task kind" value={kind}
            onChange={(e) => setKind(e.target.value as "facts" | "digest")}>
            {TASK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Cadence" hint="Model-backed jobs run hourly at the tightest.">
          <Select aria-label="Task cadence" value={minutes}
            onChange={(e) => setMinutes(e.target.value)}>
            {OPTIONS.map((option) => (
              <option key={option.value || "manual"} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </FormField>
        <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      </div>
    </Dialog>
  );
}

function ScheduledTasksPage({ data, loading = false, error = null, actions, chrome, mobile = false }:
  PageProps<ScheduledTasksData, ScheduledTasksActions>) {
  const [creating, setCreating] = useState(false);
  if (loading) return <PageFrame chrome={chrome} active={navFor("scheduled-tasks")} title="Scheduled tasks" mobile={mobile}>
    <SkeletonPage variant="list" eyebrow="Automation" title="Scheduled tasks"
      description="Control recurring background jobs and one-off runs." mobile={mobile} />
  </PageFrame>;
  const active = data.tasks.filter((task) => task.status === "active" && task.scheduleMinutes !== null).length;
  return <PageFrame chrome={chrome} active={navFor("scheduled-tasks")} title="Scheduled tasks" mobile={mobile}>
    <div className={PAGE_CONTAINER}>
      <PageHeader eyebrow="Automation" title="Scheduled tasks"
        description="Control recurring background jobs and one-off runs."
        actions={<>{actions?.refresh && <Button onClick={actions.refresh}>Refresh snapshot</Button>}{actions?.createTask && <Button variant="primary" onClick={() => setCreating(true)}>New task</Button>}</>} />
      {data.observedAt && <p className="mt-4 text-[12.5px] text-ink/70">Knowledge snapshot: {fmtDateTime(data.observedAt)}. {data.projectionNote}</p>}
      {creating && actions?.createTask && (
        <NewTaskDialog onCreate={actions.createTask} onClose={() => setCreating(false)} />
      )}
      <div className="mt-6 space-y-4">
        {error ? <Card><ReadError>{error}</ReadError></Card> : !data.tasks.length ? <Card>
          <EmptyState icon={<CalendarClock size={22} />} title="No scheduled tasks">
            Connector syncs and recurring knowledge jobs appear here when configured.
          </EmptyState>
        </Card> : <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink/70">
            <p>Schedules stay configured when paused. Manual runs do not turn a schedule back on.</p>
            <span className="font-term">{active} active · {data.tasks.filter(task=>!task.retired).length - active} paused or manual</span>
          </div>
          {data.tasks.filter(task=>!task.retired).map((task) => <TaskRow key={task.id} task={task} actions={actions} />)}
          {data.tasks.some(task=>task.retired) && <details className="text-sm text-ink/70"><summary>Retired connector schedules ({data.tasks.filter(task=>task.retired).length})</summary><div className="mt-3 space-y-3">{data.tasks.filter(task=>task.retired).map(task=><TaskRow key={task.id} task={task} />)}</div></details>}
          {data.runs && <Card className="overflow-x-auto p-5">
            <h2 className="font-semibold text-ink">Recent Temporal runs</h2>
            <p className="mt-1 text-sm text-ink/70">{data.runs.filter(r=>r.status.startsWith('RUNNING')).length} running · {data.runs.filter(r=>r.status==='FAILED').length} failed · {data.runs.length} projected runs</p>
            <table className="mt-4 w-full text-left text-sm">
              <thead><tr><th className="p-2">Workflow</th><th className="p-2">Status</th><th className="p-2">Started</th><th className="p-2">Duration</th></tr></thead>
              <tbody>{data.runs.slice(0,30).map(run=><tr key={run.id} className="border-t border-ink/10">
                <td className="p-2" title={run.id}>{run.name}</td><td className="p-2">{run.status}</td>
                <td className="p-2">{fmtDateTime(run.startedAt)}</td><td className="p-2">{run.duration===null?'In progress':`${Math.round(run.duration)}s`}</td>
              </tr>)}</tbody>
            </table>
          </Card>}

        </>}
      </div>
    </div>
  </PageFrame>;
}

export const page: PageModule<ScheduledTasksData, ScheduledTasksActions> = {
  id: "scheduled-tasks", title: "Scheduled tasks", route: "/scheduled-tasks",
  component: ScheduledTasksPage,
  states: [{ id: "default", label: "Default" }, { id: "loading", label: "Loading" },
    { id: "error", label: "Error" }, { id: "empty", label: "Empty" }],
};
