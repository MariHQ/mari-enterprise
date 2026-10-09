import { useRef, useState, type ReactNode } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, SPLIT } from "./PageFrame";
import { Layers, ShieldCheck, CheckCircle2, ArrowRight, ExternalLink, UploadCloud, FileText } from "lucide-react";
import { card } from "../tokens/card";
import { PageHeader } from "../layout/PageHeader";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonPage } from "../data-display/Skeletons";
import { Stepper } from "../data-display/Stepper";
import { IconRing } from "../data-display/IconRing";
import { Chip } from "../data-display/Chip";
import { PropertyList } from "../data-display/PropertyList";
import { Button } from "../actions/Button";
import { useWrite, why } from "../actions/useWrite";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { HelpText } from "../forms/HelpText";
import { Select } from "../forms/Select";
import { Textarea } from "../forms/Textarea";
import { SectionLabel } from "../forms/SectionLabel";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { Spinner } from "../data-display/Spinner";
import { focusRing } from "../tokens/focusRing";
import { SyncPanel, type SyncSource } from "../feedback/SyncPanel";
import { ConnectorCard as ConnectorCardUI } from "../data-display/ConnectorCard";
import { SourceMark } from "../icons/marks";
import { SourcesConnectorCard, type Source } from "../features/SourcesConnectorCard";
import { SourcesConnectorWizard, type WizardProviderSpec } from "../features/SourcesConnectorWizard";
import { PhaseTracker } from "../features/SourcesSyncStatus";
import { Truncate } from "../data-display/Truncate";
import type { PropertyItem } from "../data-display/PropertyList";

/* Sources & connectors (pages/sources.md). Settings → Sources: the ingestion
   hub for bringing every product conversation into one trusted library.

   Beyond the grid, this page enumerates a full inline connect *workflow* per
   provider — choose → configure credentials → syncing → done — composed
   directly in the page body (provider header, credential Fields, a live
   SyncPanel) rather than a portalled dialog, so a static screenshot reads the
   whole flow. States: connect-<provider>-configure / -sync / -done.

   Pure presenter: the connector catalog, the connected sources, the connect
   flow's credential fields and the first-sync row all arrive
   in `data`. Brand marks are derived from the provider key, never carried in
   the data. "No sources connected" is derived from the source list. */

/* ── §11 page grid ─────────────────────────────────────────────────────────
   Same container and main/rail split as the five Settings tabs, so the outer
   border does not move when you cross from Sources into Settings. */
const PAGE = "mx-auto max-w-[1400px] px-5 py-6 sm:px-8";
const FORM_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

function SplitBody({ mobile, rail, children }: { mobile: boolean; rail: ReactNode; children: ReactNode }) {
  return (
    <div className={mobile ? "flex flex-col gap-5" : SPLIT[320]}>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="flex min-w-0 flex-col gap-5">{rail}</aside>
    </div>
  );
}

/* ── Inline connect flow ───────────────────────────────────────────────────
   Credential fields come in already filled so the configure screenshot reads
   populated; the sync counts feed the SyncPanel step. */

/** One credential field on the configure step. `key` is what the server calls
    the field; it defaults to the label, which is all a screenshot needs. */
export type ConnField = { key?: string; label: string; value: string; secret?: boolean; help?: string; multiline?: boolean };

/** The provider being connected, and what its first sync will report. */
export type Connector = {
  /** Provider key: also selects the brand mark. */
  key: string;
  name: string;
  blurb: string;
  docsUrl?: string;
  detail: string;
  fields: ConnField[];
  /** File-upload connector: no credentials, a drop zone instead. */
  upload?: boolean;
  sync: { done: number; total: number; docCount: number; chunkCount: number; embeddedCount: number };
};

/** Which screen of Sources is on. An app drives it from its own route. */
export type SourcesView = "grid" | "wizard" | "connect" | "sync-status";
/** Step of the inline per-provider connect flow. */
export type ConnectPhase = "configure" | "sync" | "done";
/** State of the standalone first-sync row. */
export type SyncPhase = "queued" | "syncing" | "done" | "error";

/** The one source the first-sync panel is reporting on. */
export type FirstSync = {
  /** Provider key, which selects the brand mark. */
  provider: string;
  name: string;
  phase: string;
  done: number;
  total: number;
  docCount: number;
  chunkCount: number;
  embeddedCount: number;
  lastSyncAt: string;
  error: string;
};

/** What Sources can DO.
 *
 *  Every handler may throw, and the control that called it shows the message
 *  the server actually sent. That matters more here than anywhere else in the
 *  console: connecting a source fails for reasons the user can fix ("Bad
 *  credentials", "Repository acme/docs not found", "Slack is already
 *  connected"), and flattening those into one house apology would leave a
 *  workspace stuck at zero documents with no idea why.
 *
 *  All optional. With none of them the page keeps the local behaviour the
 *  library ships, which is what the design canvas renders (CONVENTIONS.md §2). */
export type SourcesActions = {
  /** Pre-flight credential check. Answers rather than throws: "not ok" is a
      normal result of a test, not a broken request. */
  testConnection?: (v: { provider: string; config: Record<string, string> }) => Promise<{ ok: boolean; error?: string }>;
  /** Create the source and start its first sync. `name` is the optional
      display name from the wizard's configure step, absent when left blank.
      May answer with the new source's id, which is what lets the dialog follow
      that sync to its end through `syncProgress` instead of spinning on its
      first phase forever. A duplicate-active refusal thrown as
      `DuplicateSourceError` (features/SourcesConnectorWizard) additionally
      offers "Edit the existing source" on the failure. */
  connectSource?: (v: { provider: string; config: Record<string, string>; name?: string }) => void | string | Promise<void | string>;
  /** Ingest files directly, no credentials involved. */
  uploadFiles?: (files: File[]) => void | Promise<void>;
  /** Start an incremental sync on an existing source. Long-running: it
      returns once the server has accepted the run, not once it finishes. */
  syncNow?: (s: Source) => void | Promise<void>;
  /** Full rebuild of one source. */
  fullResync?: (s: Source) => void | Promise<void>;
  /** Merge corrected settings into a source's stored config, then start the
      full resync that makes them take effect. Receives ONLY the fields the
      user changed or filled: the server merges keys, so an untouched secret
      stays stored. The edit-connection dialog is drawn only with this
      handler and a catalog entry that names fields for the provider. */
  updateConfig?: (s: Source, config: Record<string, string>) => void | Promise<void>;
  /** Destructive: stops syncing this source. Goes through <ConfirmButton>. */
  disconnect?: (s: Source) => void | Promise<void>;
  /** Destructive for real: deletes the source and its indexed documents.
      Disconnect only pauses, and a misconfigured source needs a way out. The
      card puts it behind a confirm dialog, and on success the row leaves the
      grid. Without this handler the Remove action is not drawn. */
  removeSource?: (s: Source, deleteDocuments: boolean) => void | Promise<void>;
  /** Start the first sync again after it failed. Takes the provider key the
      failed row carries, because that run has no source row behind it yet.
      Without it the failure has no retry button rather than an inert one. */
  retryFirstSync?: (provider: string) => void | Promise<void>;
  /** How often this source syncs itself. `null` is manual only. Drawn only
      for sources whose schedule the server actually reports. */
  setSyncSchedule?: (s: Source, everyMinutes: number | null) => void | Promise<void>;
  /** One reading of a source's sync. The card and the connect dialog poll it
      after starting a run — without it they hold their first optimistic phase
      ("Listing…") until someone reloads the page, however long ago the sync
      actually finished. */
  syncProgress?: (sourceId: string) => Promise<SyncReading>;
};

/** What one syncProgress poll answers. `done`/`total` are items this run. */
export type SyncReading = {
  state: "running" | "done" | "failed";
  phase?: string;
  done?: number;
  total?: number;
  error?: string;
};

/** Everything Sources renders. */
export type SourcesData = {
  projection?: {observedAt:string;truncated:boolean;connectors:{id:string;name:string;provider:string;webhooks:string[];targets:{target:string;workflowId?:string;status?:string;phase?:string;error?:string;intervalSeconds?:number}[]}[]};
  view: SourcesView;
  /** Connectors already wired up. */
  sources: Source[];
  /** Catalog the Add-source wizard offers. */
  catalog: WizardProviderSpec[];
  /** `connect` view: the provider being set up and how far it has got. */
  connector: Connector | null;
  connectPhase: ConnectPhase;
  /** Files chosen for the upload connector. */
  uploadFiles: string[];
  /** `sync-status` view. */
  syncPhase: SyncPhase;
  firstSync: FirstSync;
  /** Read-only facts in the rail. */
  summary: PropertyItem[];
};

function DocsLink({ c }: { c: Connector }) {
  if (!c.docsUrl) return null;
  return (
    <a className="inline-flex items-center gap-1 text-[12px] text-biscay-2 hover:underline" href={c.docsUrl} target="_blank" rel="noreferrer">
      {c.name} setup docs <ExternalLink size={11} />
    </a>
  );
}

const fieldKey = (f: ConnField) => f.key ?? f.label;

/** The drop zone plus a real file picker. Files are handed to the parent, so
    the same control is a live upload in the app and an inert-but-responsive
    picker on the canvas. */
function UploadBody({ chosen, seeded, onChoose }: {
  chosen: File[]; seeded: string[]; onChoose: (files: File[]) => void;
}) {
  const names = chosen.length ? chosen.map((f) => f.name) : seeded;
  return (
    <div>
      <label className={`grid cursor-pointer place-items-center gap-2 rounded-md border border-dashed border-ink/25 bg-ink/[0.015] px-4 py-8 text-center ${focusRing}`}>
        <input
          type="file" multiple className="sr-only"
          accept=".md,.mdx,.markdown,.txt"
          onChange={(e) => onChoose(Array.from(e.target.files ?? []))}
        />
        <span className="text-ink/65"><UploadCloud size={30} /></span>
        <p className="text-[13px] text-ink/70">Drag files here, or <span className="text-biscay-2">browse</span></p>
        <p className="font-term text-[11px] text-ink/65">Markdown or text, up to 20 files, 1 MB each</p>
      </label>
      <div className="mt-3">
        {/* §5: no em dashes in user-visible copy. */}
        <SectionLabel>Selected files, {names.length}</SectionLabel>
        <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {names.map((f) => (
            <li key={f} className="flex items-center gap-2 rounded-[4px] border border-ink/12 px-2.5 py-1.5 text-[12.5px] text-ink/80">
              <FileText size={13} className="text-ink/65" /> <Truncate>{f}</Truncate>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ConfigureBody({ c, values, onChange, tested }: {
  c: Connector;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  tested: { ok: boolean; error: string } | null;
}) {
  return (
    <div>
      <p className="mb-1 text-[13px] text-ink/70">{c.blurb} Credentials stay on the server and are never shown again.</p>
      <DocsLink c={c} />
      <div className={`mt-3 ${FORM_GRID}`}>
        {c.fields.map((f) => {
          const k = fieldKey(f);
          return (
            <Field key={k} label={f.label}>
              {f.multiline ? (
                <Textarea rows={4} className="w-full font-term text-[12px]" value={values[k] ?? ""} onChange={(e) => onChange(k, e.target.value)} />
              ) : (
                <Input className="w-full font-term" type={f.secret ? "password" : "text"} value={values[k] ?? ""} onChange={(e) => onChange(k, e.target.value)} />
              )}
              {f.help && <p className="mt-1 text-[11.5px] text-ink/65"><HelpText>{f.help}</HelpText></p>}
            </Field>
          );
        })}
      </div>
      {tested?.ok && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-moss">
          <CheckCircle2 size={14} /> Connection OK. Credentials verified.
        </div>
      )}
      {/* XA-02: a failed connection TEST accuses no one field, it reports that
          the whole credential set was refused, so it is a WriteError. */}
      {tested && !tested.ok && <WriteError>{tested.error}</WriteError>}
    </div>
  );
}

function connectorSyncSource(c: Connector, phase: "sync" | "done"): SyncSource {
  const base = { id: c.key, name: `${c.name} · ${c.detail}`, mark: <SourceMark provider={c.key} size={24} /> } as const;
  if (phase === "done") {
    /* No `lastSyncAt`: this function used to hand the panel the literal
       "2026-07-21T14:12:00", so every finished connect reported the same
       invented sync time as fact. The connector carries no timestamp, so the
       row simply does not claim one (SyncPanel omits the line). */
    return {
      ...base, state: "done",
      docCount: c.sync.docCount, chunkCount: c.sync.chunkCount, embeddedCount: c.sync.chunkCount,
    };
  }
  return {
    ...base, state: "syncing", phase: "Embedding",
    done: c.sync.done, total: c.sync.total,
    chunkCount: c.sync.chunkCount, embeddedCount: c.sync.embeddedCount,
  };
}

function ConnectFlow({ c, phase, uploadFiles, actions }: {
  c: Connector; phase: ConnectPhase; uploadFiles: string[]; actions?: SourcesActions;
}) {
  /* Credential values are local: they are typed here, and the data only ever
     seeds them. Fields used to be `readOnly` against `data`, so the configure
     step could be screenshotted but never completed. */
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(c.fields.map((f) => [fieldKey(f), f.value])));
  const [chosen, setChosen] = useState<File[]>([]);
  const [tested, setTested] = useState<{ ok: boolean; error: string } | null>(null);
  const [busy, setBusy] = useState<null | "test" | "connect">(null);
  const [failed, setFailed] = useState<string | null>(null);
  /* The user has fired Connect and the server accepted: the flow moves to its
     sync step on its own, rather than waiting for a route change it may never
     get. `null` means "whatever the data says". */
  const [live, setLive] = useState<ConnectPhase | null>(null);

  const effective = live ?? phase;
  const stepIdx = effective === "configure" ? 1 : 2;
  const configuring = effective === "configure";

  const test = async () => {
    if (!actions?.testConnection || busy) return;
    setBusy("test");
    setFailed(null);
    try {
      const r = await actions.testConnection({ provider: c.key, config: values });
      setTested({ ok: r.ok, error: r.error ?? "Validation failed without details." });
    } catch (err) {
      setTested({ ok: false, error: why(err, "The connection test failed.") });
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    if (busy) return;
    const run = c.upload
      ? (actions?.uploadFiles ? () => actions.uploadFiles!(chosen) : null)
      : (actions?.connectSource ? () => actions.connectSource!({ provider: c.key, config: values }) : null);
    if (!run) return; // canvas: no server behind the page
    setBusy("connect");
    setFailed(null);
    try {
      await run();
      setLive("sync");
    } catch (err) {
      // Verbatim: "Bad credentials" and "Repository not found" are the whole
      // point of this message.
      setFailed(why(err, "The source could not be connected."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-w-0">
      <div className={`${card} p-5`}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <IconRing size={42}><SourceMark provider={c.key} size={22} /></IconRing>
          <div className="min-w-0 flex-1 basis-[14rem]">
            <Truncate as="h3" className="text-[16px] font-semibold text-ink" title={`Connect ${c.name}`}>Connect {c.name}</Truncate>
            <Truncate className="text-[12.5px] text-ink/60">{c.blurb}</Truncate>
          </div>
          <Chip className="ml-auto" label={configuring ? "Step 2 of 3" : effective === "done" ? "Synced" : "Syncing"} tone={effective === "done" ? "ok" : configuring ? "neutral" : "info"} dot />
        </div>

        <div className="mt-5"><Stepper labels={["Choose source", "Configure", "Sync"]} current={stepIdx} ariaLabel="Connector setup progress" /></div>

        <div className="mt-5 min-h-[200px]">
          {/* Phase tracker lives in the 320px rail (§11) so the panel below can
              run the full width of the main column. */}
          {configuring
            ? (c.upload
                ? <UploadBody chosen={chosen} seeded={uploadFiles} onChoose={setChosen} />
                : <ConfigureBody c={c} values={values} onChange={(k, v) => { setValues((s) => ({ ...s, [k]: v })); setTested(null); }} tested={tested} />)
            : <SyncPanel sources={[connectorSyncSource(c, effective === "done" ? "done" : "sync")]} />}
        </div>

        {/* XA-02: a refused connect is a failed WRITE, so it renders through
            the one banner every other refused write on the console uses. */}
        {failed && <div className="mt-4"><WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError></div>}

        {/* Primary bottom LEFT, secondaries to its right (§2). */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
          {configuring ? (
            <>
              <Button variant="primary" disabled={busy !== null} onClick={() => void connect()}>
                {busy === "connect"
                  ? <><Spinner size="sm" /> Connecting…</>
                  : <>{c.upload ? "Upload & sync" : "Connect & sync"} <ArrowRight size={14} /></>}
              </Button>
              {!c.upload && (
                <Button disabled={busy !== null} onClick={() => void test()}>
                  {busy === "test" ? <><Spinner size="sm" /> Testing…</> : <><ShieldCheck size={13} /> Test connection</>}
                </Button>
              )}
            </>
          ) : effective === "done" ? (
            /* Finishing the wizard puts the panel back to the connector list,
               which is what "Done" has always looked like it would do. */
            <Button variant="primary" onClick={() => setLive(null)}>Done <CheckCircle2 size={14} /></Button>
          ) : null}
          <Button disabled={configuring} onClick={() => setLive("configure")}>Back</Button>
          {!configuring && effective !== "done" && (
            <span className="text-[12px] text-ink/65">Sync continues in the background.</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Standalone sync-status phases ─────────────────────────────────────────*/
function syncPhaseSource(f: FirstSync, phase: SyncPhase): SyncSource {
  /* The brand mark is built here from the provider key: the data stays plain
     JSON, exactly as an API would return it. */
  const base = { id: f.provider, name: f.name, mark: <SourceMark provider={f.provider} size={24} /> } as const;
  switch (phase) {
    case "queued": return { ...base, state: "queued" };
    case "syncing": return { ...base, state: "syncing", phase: f.phase, done: f.done, total: f.total, chunkCount: f.chunkCount, embeddedCount: f.embeddedCount };
    case "done": return { ...base, state: "done", docCount: f.docCount, chunkCount: f.chunkCount, embeddedCount: f.chunkCount, lastSyncAt: f.lastSyncAt };
    case "error": return { ...base, state: "error", error: f.error };
  }
}

const STATES = [
  { id: "default", label: "Default · Connectors grid" },
  { id: "adding", label: "Add-source wizard" },
  // First-sync status phases
  { id: "sync-queued", label: "Sync · Queued" },
  { id: "sync-syncing", label: "Sync · Syncing" },
  { id: "sync-done", label: "Sync · Done" },
  { id: "sync-error", label: "Sync · Error" },
  // Per-connector inline workflows
  { id: "connect-github-configure", label: "GitHub · Configure" },
  { id: "connect-github-sync", label: "GitHub · Syncing" },
  { id: "connect-github-done", label: "GitHub · Done" },
  { id: "connect-slack-configure", label: "Slack · Configure" },
  { id: "connect-slack-sync", label: "Slack · Syncing" },
  { id: "connect-notion-configure", label: "Notion · Configure" },
  { id: "connect-notion-sync", label: "Notion · Syncing" },
  { id: "connect-gdrive-configure", label: "Google Drive · Configure" },
  { id: "connect-gdrive-sync", label: "Google Drive · Syncing" },
  { id: "connect-confluence-configure", label: "Confluence · Configure" },
  { id: "connect-confluence-sync", label: "Confluence · Syncing" },
  { id: "connect-jira-configure", label: "Jira · Configure" },
  { id: "connect-jira-sync", label: "Jira · Syncing" },
  { id: "connect-linear-configure", label: "Linear · Configure" },
  { id: "connect-linear-sync", label: "Linear · Syncing" },
  { id: "connect-upload-configure", label: "Upload · Choose files" },
  { id: "connect-upload-sync", label: "Upload · Processing" },
  // Shared
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "No sources connected" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/* Supporting rail (§11, 320px). Same shape as the Settings rails: one
   read-only summary card plus one explanatory card. The connect and first-sync
   states swap the summary for the live phase tracker, which is what used to
   sit above the panel and force a half-width body. */
/** How often a source may sync itself. `""` is the manual-only option, because
    a <select> value is a string. */
const SCHEDULES: { value: string; label: string; minutes: number | null }[] = [
  { value: "", label: "Manual only", minutes: null },
  { value: "10", label: "Every 10 minutes", minutes: 10 },
  { value: "15", label: "Every 15 minutes", minutes: 15 },
  { value: "60", label: "Every hour", minutes: 60 },
  { value: "360", label: "Every 6 hours", minutes: 360 },
  { value: "1440", label: "Every day", minutes: 1440 },
  { value: "10080", label: "Every week", minutes: 10080 },
];

/* Sources had no schedule control anywhere: every sync was something a person
   had to press. This is that control, one row per source.

   It is drawn only for sources whose schedule the server reports
   (`syncIntervalMinutes !== undefined`) and only with a handler to write it
   to. A select over an unknown current value would be showing the user a
   setting this page guessed. */
function ScheduleCard({ sources, onSet }: {
  sources: Source[];
  onSet: (s: Source, everyMinutes: number | null) => void | Promise<void>;
}) {
  const scheduled = sources.filter((s) => s.syncIntervalMinutes !== undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (scheduled.length === 0) return null;

  const set = async (s: Source, value: string) => {
    const minutes = SCHEDULES.find((o) => o.value === value)?.minutes ?? null;
    setBusy(s.id);
    setFailed(null);
    try {
      await onSet(s, minutes);
    } catch (err) {
      setFailed(why(err, "That schedule could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`${card} p-4`}>
      <SectionLabel>Sync schedule</SectionLabel>
      <ul className="mt-2 flex flex-col gap-2.5">
        {scheduled.map((s) => (
          <li key={s.id} className="flex min-w-0 flex-col gap-1">
            <Truncate className="text-[12.5px] text-ink/80">{s.name}</Truncate>
            <Select
              className="w-full"
              aria-label={`Sync schedule for ${s.name}`}
              disabled={busy === s.id}
              value={s.syncIntervalMinutes == null ? "" : String(s.syncIntervalMinutes)}
              onChange={(e) => void set(s, e.target.value)}
            >
              {SCHEDULES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </li>
        ))}
      </ul>
      {/* XA-02: the message accuses no single input (any row's select can have
          been the one that failed), so it is a WriteError, not a FieldError. */}
      <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
    </div>
  );
}

function SourcesRail({ data, actions }: { data: SourcesData; actions?: SourcesActions }) {
  const connect = data.view === "connect" && data.connector !== null;
  const syncing = data.view === "sync-status";

  if (connect || syncing) {
    const current = connect
      ? (data.connectPhase === "configure" ? 0 : data.connectPhase === "done" ? 5 : 3)
      : data.syncPhase === "queued" ? 0 : data.syncPhase === "done" ? 5 : 2;
    return (
      <>
        <div className={`${card} p-4`}>
          <SectionLabel>{connect ? "Sync phases" : "First-sync status"}</SectionLabel>
          <div className="mt-3"><PhaseTracker current={current} failed={data.syncPhase === "error" && syncing} /></div>
        </div>
        <div className={`${card} p-4`}>
          <SectionLabel>What happens next</SectionLabel>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink/70">
            Sync runs on the server. Documents are fetched, chunked, embedded,
            and indexed; unchanged chunks are skipped by content hash.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={`${card} p-4`}>
        <SectionLabel>At a glance</SectionLabel>
        {data.projection ? <><p className="mt-3 text-[12.5px] text-ink/70">{data.projection.observedAt ? `Observed ${new Date(data.projection.observedAt).toLocaleString()}` : "Snapshot unavailable"}</p>{data.projection.truncated && <p>Projection limit reached.</p>}<a className="mt-3 inline-block text-biscay-2 hover:underline" href="/scheduled-tasks">View job schedules</a></> : <PropertyList className="mt-3" items={data.summary} />}
      </div>
      {actions?.setSyncSchedule && <ScheduleCard sources={data.sources} onSet={actions.setSyncSchedule} />}
      <div className={`${card} p-4`}>
        <SectionLabel>Credentials</SectionLabel>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink/70">
          Tokens are stored server-side and never shown again. Read-only scopes
          are enough for every connector here.
        </p>
      </div>
    </>
  );
}

/* ── Add-source toolbar ────────────────────────────────────────────────────
   The server's catalog returns two entries with no credential fields, because
   neither is configured with credentials: GitHub is picked by repository, and
   Upload takes files. A wizard step that asks for nothing and then connects
   nothing is the worst kind of dead control, so the two are shaped here. */

/** GitHub's one required setting. Not credentials: the token is server-side
    already, and this names which repository to read. */
const GITHUB_FIELDS = [{
  key: "repo", label: "Repository", placeholder: "owner/name",
  help: "Any repository this workspace's GitHub token can read.",
}];

function wizardCatalog(catalog: WizardProviderSpec[], hasUpload: boolean): WizardProviderSpec[] {
  return catalog
    // Upload takes files, not a credential form, so it moves out of the
    // wizard and onto its own control — but only once that control exists.
    .filter((p) => !(hasUpload && p.key === "upload"))
    .map((p) => (p.key === "github" && p.fields.length === 0 ? { ...p, fields: GITHUB_FIELDS } : p));
}

/** Files straight into the ingest pipeline. Sits beside "Add source" because
    it is the same intent with no credentials attached. */
function UploadSourceButton({ onUpload }: { onUpload: (files: File[]) => void | Promise<void> }) {
  // XA-04: was a hand-rolled busy/failed/try-catch pair around one awaited call.
  const write = useWrite();
  const [added, setAdded] = useState(0);

  const choose = async (files: File[]) => {
    if (files.length === 0) return;
    await write.run(() => onUpload(files), () => setAdded(files.length));
  };

  return (
    <div className="min-w-0">
      <label className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[4px] border border-ink/20 bg-paper px-3 text-[13px] font-medium text-ink/80 hover:border-ink/45 ${focusRing}`}>
        <input type="file" multiple className="sr-only" accept=".md,.mdx,.markdown,.txt"
          onChange={(e) => void choose(Array.from(e.target.files ?? []))} />
        {write.busy ? <><Spinner size="sm" /> Uploading…</> : <><UploadCloud size={14} /> Upload files</>}
      </label>
      {/* XA-02: a refused upload has no input to sit under. */}
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      {!write.failed && added > 0 && (
        <p className="mt-1 text-right text-[12px] text-moss">{added} file{added === 1 ? "" : "s"} ingested into Uploads.</p>
      )}
    </div>
  );
}

/** A workspace with nothing connected at all. Derived from the data. */
function isEmpty(d: SourcesData): boolean {
  return !d.projection && d.sources.length === 0 && d.connector === null && d.view === "grid";
}

function Body({ data, error, actions, onAddAnother, editRequest }: {
  data: SourcesData; error: string | null; actions?: SourcesActions;
  /** "Add another <Provider>" on a connected card: the page opens the wizard
      preselected to the catalog key it receives. */
  onAddAnother?: (providerKey: string) => void;
  /** The page asks the grid to open one source's Edit connection dialog (the
      wizard's duplicate-refusal follow-up). */
  editRequest?: { sourceId: string; token: number } | null;
}): ReactNode {
  // XA-01: a failed read is a blocked banner, never the "nothing here yet" surface.
  if (error) return <ReadError>{error}</ReadError>;
  if (data.projection) return <>
    <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[260px]">
      {data.projection.connectors.map(c=><ConnectorCardUI key={c.id} name={c.name}
        mark={<SourceMark provider={c.provider} size={26} />} health={c.targets.some(t=>t.error || t.status==='FAILED')?'Error':'Unknown'}
        counts={`${c.targets.length} polling targets · ${c.webhooks.length} signed webhook endpoints`}
        sync={<div className="space-y-3">{c.targets.map(t=><div key={t.target}>
          <p className="break-all">{t.target}</p><p>{t.phase || t.status || 'Status not projected'}</p>
          {t.error && <p role="alert">{t.error}</p>}
          {t.intervalSeconds != null && <p>Every {t.intervalSeconds/60} minutes</p>}
        </div>)}{c.webhooks.map(endpoint=><p key={endpoint} className="break-all">Signed webhook: {endpoint}</p>)}</div>}
        barsNote="Activity needs Connector → ingested Record mappings" />)}
    </div>
    {!data.projection.connectors.length && <ReadError>{'GRAPH_REQUIREMENTS:Expected Connector → polling Workflow or signed Webhook.'}</ReadError>}
  </>;
  if (isEmpty(data)) {
    /* A workspace with nothing connected is the one state where the empty box
       must not be a dead end: the wizard is the whole path out of it. */
    return (
      <EmptyState
        title="No sources connected yet"
        action={
          <span className="flex flex-wrap items-start justify-center gap-2">
            {actions?.uploadFiles && <UploadSourceButton onUpload={actions.uploadFiles} />}
            <SourcesConnectorWizard defaultOpen={false} providers={wizardCatalog(data.catalog, Boolean(actions?.uploadFiles))} actions={actions} />
          </span>
        }
      >
        Connect GitHub or another source, or upload files directly, to start building your knowledge base.
      </EmptyState>
    );
  }

  if (data.view === "connect" && data.connector) {
    return <ConnectFlow c={data.connector} phase={data.connectPhase} uploadFiles={data.uploadFiles} actions={actions} />;
  }
  if (data.view === "sync-status") {
    /* Retry used to be `() => {}`: a button on a failed first sync that did
       nothing at all (§2). It is drawn only where there is a handler behind
       it, and SyncPanel hides it otherwise. */
    return (
      <SyncPanel
        sources={[syncPhaseSource(data.firstSync, data.syncPhase)]}
        onRetry={actions?.retryFirstSync && (() => void actions.retryFirstSync!(data.firstSync.provider))}
      />
    );
  }
  /* grid / wizard → connectors grid.
     `<SourcesSyncStatus animate={false} />` used to close this list. It takes
     no props: it is the catalog's own self-advancing demo of the sync state
     model, and it drew "GitHub · acme/handbook, 500 docs, 8,912 chunks" under
     every real workspace's connectors. The live sync state for this workspace
     is the `sync-status` view and each card's own sync line, both of which are
     the workspace's own data. */
  return (
    <SourcesConnectorCard
      sources={data.sources}
      catalog={data.catalog}
      actions={actions}
      onAddAnother={onAddAnother}
      editRequest={editRequest}
    />
  );
}

function SourcesPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<SourcesData, SourcesActions>) {
  const pinned = data.view === "connect" || data.view === "sync-status";
  const bare = error !== null || isEmpty(data);
  /* Add source / Upload belong to the connectors grid, and only there. */
  const showConnectorTools = !pinned && (data.view === "grid" || data.view === "wizard");

  /* Multi-instance wiring, all local: a card's "Add another <Provider>" opens
     the header wizard preselected to that provider, and the wizard's
     duplicate-refusal follow-up opens the colliding card's Edit connection
     dialog. Tokens make the same request fire twice in a row; the counter
     never repeats within a session, which Date.now() cannot promise. */
  const tokens = useRef(0);
  const [preselect, setPreselect] = useState<{ provider: string; token: number } | null>(null);
  const [editRequest, setEditRequest] = useState<{ sourceId: string; token: number } | null>(null);

  if (loading) {
    return (
      <PageFrame chrome={chrome} active={navFor("sources")} title="Sources & connectors" mobile={mobile}>
        <SkeletonPage
          variant="gallery"
          eyebrow="Knowledge ingestion"
          title="Sources & connectors"
          description="Bring every product conversation into one trusted library."
          actions={0}
          mobile={mobile}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame chrome={chrome} active={navFor("sources")} title="Sources & connectors" mobile={mobile}>
      <div className={PAGE}>
        <PageHeader
          eyebrow="Knowledge ingestion"
          title="Sources & connectors"
          description="Bring every product conversation into one trusted library."
          icon={<span className="text-moss"><Layers size={24} /></span>}
        />
        {!bare && showConnectorTools && (
          <div className="mt-4 flex flex-wrap items-start justify-end gap-2">
            {/* The upload source's card owns the Upload action once it
                exists (ConnectorCard footer, beside Pause). This toolbar
                copy exists only for the workspace that has connectors but no
                upload source yet — without it there would be no way to
                create one. */}
            {actions?.uploadFiles && !data.sources.some((s) => s.provider === "upload")
              && <UploadSourceButton onUpload={actions.uploadFiles} />}
            <SourcesConnectorWizard
              defaultOpen={data.view === "wizard"}
              providers={wizardCatalog(data.catalog, Boolean(actions?.uploadFiles))}
              actions={actions}
              preselect={preselect}
              onEditExisting={(sourceId) => setEditRequest({ sourceId, token: ++tokens.current })}
            />
          </div>
        )}
        <div className="mt-6">
          <SplitBody mobile={mobile} rail={<SourcesRail data={data} actions={actions} />}>
            <Body
              data={data}
              error={error}
              actions={actions}
              onAddAnother={(providerKey) => setPreselect({ provider: providerKey, token: ++tokens.current })}
              editRequest={editRequest}
            />
          </SplitBody>
        </div>
      </div>
    </PageFrame>
  );
}

export const page: PageModule<SourcesData, SourcesActions> = {
  id: "sources",
  title: "Sources & connectors",
  route: "/sources",
  component: SourcesPage,
  states: STATES.map((s) => ({ ...s })),
};
