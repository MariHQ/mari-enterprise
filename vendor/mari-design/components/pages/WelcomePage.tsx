import { useState, type ReactNode } from "react";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite, why } from "../actions/useWrite";
import { ResultCount } from "../data-display/Pagination";
import { Spinner } from "../data-display/Spinner";
import {
  CheckCircle2, ArrowRight, GitFork, Lock, ExternalLink,
  Send, FileText, BookOpen, GitBranch, Bot, Sparkles,
} from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { Stepper } from "../data-display/Stepper";
import { Button } from "../actions/Button";
import { Logo, Brandmark } from "../shell/Logo";
import { Card } from "../layout/Card";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { Textarea } from "../forms/Textarea";
import { Chip } from "../data-display/Chip";
import { SyncPanel, type SyncSource } from "../feedback/SyncPanel";
import { SourceMark, GithubMark } from "../icons/marks";
import { WelcomeGlossaryStep, type Candidate } from "../features/WelcomeGlossaryStep";
import { WelcomeSyncPanel, type SyncRow } from "../features/WelcomeSyncPanel";
import { SkeletonPage } from "../data-display/Skeletons";
import { focusRing } from "../tokens/focusRing";

/* Welcome — onboarding wizard (pages/welcome.md). Post-auth, renders OUTSIDE
   the console shell: a single-column wizard with a four-step Stepper
   (Welcome → Connect → Glossary → Finish). Each state selects the
   active step; the Connect step expands into per-connector onboarding flows
   rendered INLINE (provider header + credential fields + live sync progress),
   not portalled drawers, so the static canvas captures every connector's setup
   surface. Glossary and finish compose the Welcome* features.

   Pure presenter: the connector tiles, the repositories, every credential
   field, the glossary candidates and the sync rows arrive in
   `data`. Brand marks are derived from a provider key, never carried. */

const LABELS = ["Welcome", "Connect", "Glossary", "Finish"] as const;

const STATES = [
  { id: "default", label: "Welcome" },
  { id: "connect", label: "Connect · pick a source" },
  { id: "connect-github", label: "Connect · GitHub" },
  { id: "connect-slack", label: "Connect · Slack" },
  { id: "connect-notion", label: "Connect · Notion" },
  { id: "connect-gdrive", label: "Connect · Google Drive" },
  { id: "connect-generic", label: "Connect · connector" },
  { id: "connect-upload", label: "Connect · Upload" },
  { id: "connect-syncing", label: "Connect · Syncing" },
  { id: "glossary", label: "Glossary" },
  { id: "syncing", label: "Finish · initial sync" },
  { id: "done", label: "Finish · complete" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** Which onboarding step is on screen. An app drives it from its own route. */
export type WelcomeStep =
  | "hero" | "connect" | "connect-github" | "connect-slack" | "connect-notion"
  | "connect-gdrive" | "connect-generic" | "connect-upload" | "connect-syncing"
  | "glossary" | "finish" | "done";

/** Which of the four Stepper positions a step sits at. */
const STEP_INDEX: Record<WelcomeStep, number> = {
  hero: 0,
  connect: 1, "connect-github": 1, "connect-slack": 1, "connect-notion": 1,
  "connect-gdrive": 1, "connect-generic": 1, "connect-upload": 1, "connect-syncing": 1,
  glossary: 2, finish: 3, done: 3,
};

/** One connector tile on the Connect step. `key` selects the brand mark. */
export type Tile = {
  key: string;
  name: string;
  blurb: string;
  connected?: boolean;
  active?: boolean;
  docsUrl?: string;
  fields?: CField[];
};

/** One credential field on a connector's setup form. */
export type CField = {
  key: string;
  label: string;
  secret?: boolean;
  multiline?: boolean;
  placeholder?: string;
  help?: string;
  value?: string;
  /** Defaults to true. Optional fields never gate Test or Connect. */
  required?: boolean;
};

/** A repository the GitHub token can reach. */
export type Repo = { name: string; desc: string; priv: boolean; branch: string };

/** One file already ingested by the Upload connector. */
export type UploadedFile = { name: string; detail: string };

/** What the onboarding run actually achieved, for the Done step. */
export type WelcomeSummary = { sourcesSynced: number; glossaryTerms: number };

/** What onboarding can DO. This is the path out of an empty workspace, so
 *  every failure here has to arrive intact: a GitHub token that cannot see a
 *  repository, a Slack app that was never installed, a workspace that already
 *  has that source. Handlers throw and the step shows the server's words.
 *
 *  All optional (CONVENTIONS.md §2): stepping through the wizard is local
 *  state and works with no server at all, which is what the canvas renders. */
export type WelcomeActions = {
  /** Leave onboarding for somewhere else in the console ("/", "/sources",
      "/library"). The page emits the intent; the APP owns routing. This used
      to be `window.location.href = "/"` inside the component, which is a hard
      reload, loses the SPA's session state, and bakes one app's URL scheme
      into a library component. */
  navigate?: (href: string) => void;
  /** Open the provider's own credential documentation. "Where do I get these?"
      with a ↗ was a <span>: it promised a destination and had none, on the one
      question every connector step actually gets asked (P-WE-4). The APP owns
      the URL, the same way it owns routing. */
  openDocs?: (provider: string) => void;
  /** Validate credentials without creating a source. */
  testConnection?: (v: { provider: string; config: Record<string, string> }) => Promise<{ ok: boolean; error?: string }>;
  /** Create a GitHub source from a repo the token can see, and start syncing. */
  connectGithubRepo?: (v: { repo: string; paths: string }) => void | Promise<void>;
  /** Create any catalog connector from its credential fields. */
  connectSource?: (v: { provider: string; config: Record<string, string> }) => void | Promise<void>;
  /** Ingest files straight from the device: no credentials involved. */
  uploadFiles?: (files: File[]) => void | Promise<void>;
  /** Mine the connected documents for glossary candidates, and return the
      fresh list so the review step shows what the scan actually found. */
  harvestGlossary?: () => Promise<Candidate[]>;
  /** Save the candidates the user kept. */
  addGlossaryTerms?: (terms: Candidate[]) => void | Promise<void>;
  /** Leave onboarding for the console. */
  finish?: () => void | Promise<void>;
};

/** Everything the onboarding wizard renders. */
export type WelcomeData = {
  step: WelcomeStep;
  /** Connect step: the tiles offered, and how many connectors exist in total. */
  tiles: Tile[];
  connectorCount: number;
  /** GitHub step. */
  repos: Repo[];
  selectedRepo: string;
  pathsGlob: string;
  /** Credential forms for the other providers. */
  slackFields: CField[];
  notionFields: CField[];
  gdriveFields: CField[];
  /** Upload step. */
  uploadSummary: string;
  uploadFiles: UploadedFile[];
  /** connect-syncing step: the one source being watched. */
  connectSync: SyncRow;
  /** Glossary step. */
  glossaryCandidates: Candidate[];
  /** Finish step: every source's sync state. */
  syncRows: SyncRow[];
  /** Done step: what the run actually achieved. */
  doneSummary: WelcomeSummary;
};

/* ── Shared unauthenticated framing ────────────────────────────────────────
   Kept identical to LoginPage / SetupPage: one backdrop, one 672px column, one
   centered logo/title/sub header, one card, primary-bottom-left actions.
   Deliberately OFF the 1400px console grid (§11): no sidebar here. */
const AUTH_SHELL = "relative h-full w-full overflow-x-hidden overflow-y-auto bg-paper";
const AUTH_COL = "relative mx-auto flex min-h-full max-w-2xl flex-col justify-center";
const AUTH_ACTIONS = "flex flex-wrap items-center gap-2";

function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="pointer-events-none absolute -left-6 -top-8 rotate-[-12deg] text-biscay/[0.08]"><Brandmark size={140} /></span>
      <span className="pointer-events-none absolute -bottom-10 -right-6 rotate-[8deg] text-moss/[0.08]"><Brandmark size={160} /></span>
    </div>
  );
}

function AuthHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <span className="text-biscay"><Logo size={34} /></span>
      <h1 className="mt-4 font-display text-[26px] font-bold tracking-[-0.01em] text-ink [overflow-wrap:anywhere]">{title}</h1>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink/70 [overflow-wrap:anywhere]">{sub}</p>
    </div>
  );
}

/* ── Step 0: hero ─────────────────────────────────────────────────────── */

function Hero() {
  const steps = [
    "Connect the systems that contain your product knowledge.",
    "Define the product terms your team uses every day.",
  ];

  return (
    <div>
      <h2 className="font-display text-[20px] font-semibold text-ink">Build your knowledge workspace</h2>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink/70">
        Bring your product knowledge together, establish shared standards, and
        give your team a reliable place to find answers.
      </p>
      <ul className="mt-5 space-y-2.5">
        {steps.map((step) => (
          <li key={step} className="flex items-start gap-2.5 text-[13.5px] text-ink/80">
            <span className="mt-0.5 text-moss"><CheckCircle2 size={17} /></span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
      {/* The two ledgers, told apart before the reader meets either page.
          People conflate them, and the distinction is the product's spine. */}
      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-md border border-ink/12 p-3.5">
          <div className="font-term text-[10.5px] font-medium uppercase tracking-[0.08em] text-biscay-2">Facts</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75">
            What is true right now. Each claim carries an owner, a verification
            state, and a freshness date. When a source changes, the facts that
            leaned on it get flagged.
          </p>
        </div>
        <div className="rounded-md border border-ink/12 p-3.5">
          <div className="font-term text-[10.5px] font-medium uppercase tracking-[0.08em] text-biscay-2">Decisions</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75">
            What was chosen, and why. Ratified by the people accountable, and
            kept as the record of intent until someone decides differently.
          </p>
        </div>
      </div>
      {/* ink/70, not /60: 12.5px body text needs 4.5:1 on this ground and
          ink at 60% over white lands at ~4.25 (axe color-contrast). */}
      <p className="mt-2.5 text-[12.5px] text-ink/70">
        Rule of thumb: if a document could invalidate it, it is a fact. If only
        a new decision could, it is a decision.
      </p>
    </div>
  );
}

/* ── Step 1: connector grid ───────────────────────────────────────────── */

function ConnectGrid({ tiles, connectorCount, nav, onSelect }: {
  tiles: Tile[];
  connectorCount: number;
  nav: StepNav;
  onSelect: (provider: string) => void;
}) {
  const cls = (active?: boolean) =>
    `flex w-full items-center gap-3 rounded-md border p-3 text-left ${focusRing} ${
      active ? "border-biscay-2 ring-1 ring-biscay-2/40 bg-biscay/[0.04]" : "border-ink/15 hover:border-ink/35"
    }`;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[20px] font-semibold text-ink">Connect your knowledge</h2>
        <p className="mt-1 text-[13.5px] text-ink/65">
          Pick a source to import. Connecting hits the live ingestion pipeline and shows real progress.
        </p>
      </div>
      <ResultCount
        from={1}
        to={tiles.length}
        total={connectorCount}
        noun="connectors"
        note="all available connectors"
      />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {tiles.map((t) => {
          const inner = (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-ink/12"><SourceMark provider={t.key} size={20} /></span>
              <span className="min-w-0 flex-1">
                <b className="block text-[13.5px] font-semibold text-ink">{t.name}</b>
                <span className="block truncate text-[12px] text-ink/60">{t.blurb}</span>
              </span>
              {t.connected
                ? <Chip label="Connected" tone="ok" icon={<CheckCircle2 size={11} />} className="shrink-0" />
                : <span className="shrink-0 font-term text-[11.5px] text-biscay-2">Connect →</span>}
            </>
          );
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                if (t.key === "upload") {
                  nav.go("connect-upload");
                  return;
                }
                onSelect(t.key);
                nav.go("connect-generic");
              }}
              className={cls(t.active)}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 1: inline connector setup (provider header + fields + progress) ─ */

function ConnectorHeader({ provider, name, blurb, onDocs }: {
  provider: string; name: string; blurb: string;
  /** Opens the provider's credential docs. Omitted: the link is not drawn. */
  onDocs?: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-ink/12">
        {provider === "github" ? <GithubMark size={24} /> : <SourceMark provider={provider} size={24} />}
      </span>
      <div className="min-w-0">
        {/* The "Step 2 · Connect" chip is gone. It was hardcoded on every
            connector step and it restated the Stepper sitting directly above
            it, so its only possible contribution was to be wrong (P-WE-6). */}
        <h2 className="font-display text-[19px] font-semibold text-ink">Connect {name}</h2>
        <p className="mt-0.5 text-[13px] text-ink/65">
          {blurb}{" "}
          {onDocs && (
            <button
              type="button"
              onClick={onDocs}
              className={`inline-flex items-center gap-1 font-medium text-biscay-2 hover:underline rounded-[3px] ${focusRing}`}
            >
              Where do I get these? <ExternalLink size={11} />
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

function BackToConnectors({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className={`inline-flex items-center gap-1 font-term text-[12px] text-ink/65 rounded-[3px] ${focusRing}`}>
      ← All connectors
    </button>
  );
}

/* The one submit for every connector step: busy while the server works, and
   the server's own refusal above the button. "Bad credentials" and
   "Repository acme/docs not found" are the two things this fails on, and both
   name exactly what the user has to change — so neither may be flattened into
   a house apology (CONVENTIONS.md §8). */
function ConnectFooter({ hint, label = "Connect & sync", disabled = false, run, onDone }: {
  hint: ReactNode;
  label?: string;
  disabled?: boolean;
  /** Omitted (canvas, no server): the step simply advances. */
  run?: () => void | Promise<void>;
  onDone: () => void;
}) {
  // XA-04: a busy flag, a failed string and a try/catch around one optional call.
  const write = useWrite();
  const go = () => write.run(run, onDone);

  return (
    <>
      {/* XA-02: a refused connect belongs to the whole action, not to any one
          credential field, so it is the shared write banner. */}
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      <div className="mt-4 flex items-center gap-3 border-t border-ink/10 pt-3">
        <span className="flex-1 text-[12px] text-ink/65">{hint}</span>
        <Button variant="primary" disabled={write.busy || disabled} onClick={() => void go()}>
          {write.busy ? <><Spinner size="sm" /> Connecting…</> : <>{label} <ArrowRight size={14} /></>}
        </Button>
      </div>
    </>
  );
}

/** Controlled credential form. `values`/`onChange` live in the step, because
    the values have to leave the form for the connect call. */
function CredFields({ fields, values, onChange }: {
  fields: CField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          {f.multiline ? (
            <Textarea className="w-full font-term" rows={4} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} autoComplete="off" />
          ) : (
            <Input className="w-full" type={f.secret ? "password" : "text"} placeholder={f.placeholder} value={values[f.key] ?? ""} onChange={(e) => onChange(f.key, e.target.value)} autoComplete="off" />
          )}
          {f.help && <p className="mt-1 text-[11.5px] text-ink/65">{f.help}</p>}
        </Field>
      ))}
      <p className="text-[11.5px] text-ink/65">Credentials are stored server-side and never shown again.</p>
    </div>
  );
}

/** Every connector step shares this: seeded values, a back link, a submit. */
function useCredValues(fields: CField[]) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value ?? ""])));
  return {
    values,
    set: (key: string, value: string) => setValues((s) => ({ ...s, [key]: value })),
    filled: fields.filter((f) => f.required !== false)
      .every((f) => (values[f.key] ?? "").trim().length > 0),
  };
}

type StepNav = {
  go: (step: WelcomeStep) => void;
  selectProvider?: (provider: string) => void;
  startSync?: (source: SyncRow) => void;
};

function GithubConnect({ data, actions, nav }: { data: WelcomeData; actions?: WelcomeActions; nav: StepNav }) {
  /* Which repo, and which glob: choices the user makes here. They used to be
     `defaultChecked`/`defaultValue` against the data, so the picker moved but
     the selection never left the form. */
  const [selected, setSelected] = useState(data.selectedRepo);
  const [glob, setGlob] = useState(data.pathsGlob);
  return (
    <div className="space-y-4">
      <ConnectorHeader provider="github" name="GitHub" blurb="Pick a repository from your token’s scope, then narrow to a paths glob." />
      <BackToConnectors onBack={() => nav.go("connect")} />
      {data.repos.length === 0 && (
        <p className="text-[13px] text-ink/70">
          No repositories are visible to this workspace’s GitHub token. Add a token with repository read access, then reload this step.
        </p>
      )}
      <div role="radiogroup" aria-label="Repositories" className="grid grid-cols-1 gap-1.5">
        {data.repos.map((r) => {
          const active = r.name === selected;
          return (
            <label key={r.name}
              className={`flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border p-2.5 ${active ? "border-biscay-2 ring-1 ring-biscay-2/40 bg-biscay/[0.04]" : "border-ink/15 hover:border-ink/35"}`}>
              <input type="radio" name="repo" className="accent-biscay shrink-0" checked={active} onChange={() => setSelected(r.name)} />
              <GitFork size={14} className="shrink-0 text-ink/65" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <b className="truncate text-[13px] font-semibold text-ink">{r.name}</b>
                  {r.priv && <Chip label="Private" tone="neutral" icon={<Lock size={10} />} />}
                </span>
                <span className="block truncate text-[11.5px] text-ink/65">{r.desc}</span>
              </span>
              <span className="shrink-0 font-term text-[11px] text-ink/65">{r.branch}</span>
            </label>
          );
        })}
      </div>
      <Field label="Paths filter (glob)">
        <Input className="w-full font-term" value={glob} onChange={(e) => setGlob(e.target.value)} placeholder="docs/**" />
      </Field>
      <ConnectFooter
        hint="Mari syncs Markdown docs read-only."
        disabled={!selected}
        run={actions?.connectGithubRepo ? () => actions.connectGithubRepo!({ repo: selected, paths: glob }) : undefined}
        onDone={() => nav.go("connect-syncing")}
      />
    </div>
  );
}

/** Slack, Notion and Google Drive differ only in copy: one credential form,
    one connect call against the catalog provider key. */
function CredConnect({ provider, name, blurb, hint, fields, note, actions, nav }: {
  provider: string; name: string; blurb: string; hint: string;
  fields: CField[]; note?: ReactNode; actions?: WelcomeActions; nav: StepNav;
}) {
  const cred = useCredValues(fields);
  const [test, setTest] = useState<{ busy: boolean; ok: boolean | null; error: string }>({
    busy: false, ok: null, error: "",
  });
  const setField = (key: string, value: string) => {
    cred.set(key, value);
    setTest({ busy: false, ok: null, error: "" });
  };
  const runTest = async () => {
    if (!actions?.testConnection || !cred.filled || test.busy) return;
    setTest({ busy: true, ok: null, error: "" });
    try {
      const result = await actions.testConnection({ provider, config: cred.values });
      setTest({ busy: false, ok: result.ok, error: result.error ?? "" });
    } catch (err) {
      setTest({ busy: false, ok: false, error: why(err, "The connection test failed.") });
    }
  };
  return (
    <div className="space-y-4">
      <ConnectorHeader provider={provider} name={name} blurb={blurb}
        onDocs={actions?.openDocs ? () => actions.openDocs!(provider) : undefined} />
      <BackToConnectors onBack={() => nav.go("connect")} />
      <CredFields fields={fields} values={cred.values} onChange={setField} />
      {note}
      {test.ok === true && (
        <div className="inline-flex items-center gap-1.5 text-[12.5px] text-moss">
          <CheckCircle2 size={14} /> Connection OK. Credentials verified.
        </div>
      )}
      {test.ok === false && <WriteError>{test.error || "The connection test failed without details."}</WriteError>}
      {actions?.testConnection && fields.length > 0 && (
        <Button disabled={!cred.filled || test.busy} onClick={() => void runTest()}>
          {test.busy ? <><Spinner size="sm" /> Testing…</> : "Test connection"}
        </Button>
      )}
      <ConnectFooter
        hint={hint}
        disabled={!cred.filled}
        run={actions?.connectSource ? () => actions.connectSource!({ provider, config: cred.values }) : undefined}
        onDone={() => {
          nav.startSync?.({
            id: `pending-${provider}`,
            provider,
            name,
            state: "syncing",
          });
          nav.go("connect-syncing");
        }}
      />
    </div>
  );
}

function UploadConnect({ data, actions, nav }: { data: WelcomeData; actions?: WelcomeActions; nav: StepNav }) {
  const [chosen, setChosen] = useState<File[]>([]);
  const [ingested, setIngested] = useState<string[]>([]);
  // XA-04: hand-rolled busy/failed pair around one awaited upload.
  const write = useWrite();

  const upload = async (files: File[]) => {
    setChosen(files);
    /* The guard stays: with no handler nothing has been ingested, so the
       manifest must not echo "Ingested" against files no server ever saw. */
    if (!actions?.uploadFiles || files.length === 0) return;
    await write.run(() => actions.uploadFiles!(files), () => setIngested(files.map((f) => f.name)));
  };

  /* Rows the server has actually ingested win over rows this session picked;
     the manifest from the last read is the floor. */
  const rows = ingested.length
    ? ingested.map((name) => ({ name, detail: "Ingested" }))
    : chosen.length
      ? chosen.map((f) => ({ name: f.name, detail: `${Math.max(1, Math.round(f.size / 1024))} KB` }))
      : data.uploadFiles;

  return (
    <div className="space-y-4">
      <ConnectorHeader provider="upload" name="files" blurb="Drag in .md / .txt files. They run the same chunk to embed pipeline as sync." />
      <BackToConnectors onBack={() => nav.go("connect")} />
      <label className={`grid cursor-pointer place-items-center gap-2 rounded-md border-2 border-dashed border-ink/20 px-6 py-9 text-center ${focusRing}`}>
        <input type="file" multiple className="sr-only" accept=".md,.mdx,.markdown,.txt"
          onChange={(e) => void upload(Array.from(e.target.files ?? []))} />
        <Send size={22} className="-rotate-45 text-ink/35" />
        <span className="text-[13px] text-ink/60">Drag files here, or</span>
        {/* A <button> inside the <label> would swallow the click and never
            reach the file input, so the affordance is a styled span and the
            whole drop zone is the control. */}
        <span className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-ink/20 bg-paper px-3 text-[13px] font-medium text-ink/80">
          {write.busy ? <><Spinner size="sm" /> Uploading…</> : "Browse files"}
        </span>
      </label>
      {/* XA-02: a refused upload has no input to sit under. */}
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      <div>
        <p className="text-[12.5px] text-ink/70">{data.uploadSummary} <span className="text-ink/65">(unchanged chunks skipped by content hash)</span></p>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {rows.map((f) => (
            <div key={f.name} className="flex items-center gap-2 rounded-md border border-ink/12 p-2">
              <FileText size={14} className="shrink-0 text-ink/65" />
              <span className="flex-1 truncate text-[13px] text-ink">{f.name}</span>
              <span className="shrink-0 font-term text-[11px] text-ink/65">{f.detail}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 border-t border-ink/10 pt-3">
        <span className="flex-1 text-[12px] text-ink/65">.md / .txt · up to 20 files · 1 MB each</span>
        <Button variant="primary" disabled={write.busy} onClick={() => nav.go("glossary")}>Done <CheckCircle2 size={14} /></Button>
      </div>
    </div>
  );
}

function ConnectSyncing({ row, nav }: { row: SyncRow; nav: StepNav }) {
  /* The brand mark is built from the provider key, so the row itself stays
     plain JSON. */
  const source: SyncSource = {
    ...row,
    provider: row.provider,
  };
  /* An empty row means the source was just created and this step has no live
     status for it: the wizard reads its data once, and the sync started after
     that read. Saying so beats rendering an all-zero progress panel, which
     reads as a sync that is stuck. */
  const live = row.id !== "";
  return (
    <div className="space-y-4">
      <ConnectorHeader provider={row.provider || "github"} name={row.name || "your source"}
        blurb="The initial sync runs on the server." />
      {live ? (
        <SyncPanel sources={[source]} />
      ) : (
        <p className="text-[13px] leading-relaxed text-ink/70">
          The source is connected and its first sync is running on the server.
          Progress shows up on the Finish step and on Sources, and it keeps
          running whether or not this window stays open.
        </p>
      )}
      <div className="flex items-center gap-3 border-t border-ink/10 pt-3">
        <span className="flex-1 text-[12px] text-ink/65">Sync continues on the server. Leaving this step won’t interrupt it.</span>
        <Button variant="primary" onClick={() => nav.go("glossary")}>Done <CheckCircle2 size={14} /></Button>
      </div>
    </div>
  );
}

/* ── Steps 2–3 ────────────────────────────────────────────────────────── */

function GlossaryStep({ candidates, actions }: { candidates: Candidate[]; actions?: WelcomeActions }) {
  const [failed, setFailed] = useState<string | null>(null);
  /* Not useWrite: this wrapper has to RETHROW so WelcomeGlossaryStep's own
     scan/add busy states resolve, and useWrite swallows the throw by design. */
  const guard = async <T,>(fn: () => Promise<T> | T): Promise<T> => {
    setFailed(null);
    try { return await fn(); }
    catch (err) {
      setFailed(why(err, "The glossary step failed."));
      throw err; // the step keeps its own busy state honest
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[20px] font-semibold text-ink">Seed your glossary</h2>
        <p className="mt-1 text-[13.5px] text-ink/65">Harvest candidate terms from the documents you just connected.</p>
      </div>
      <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
      <WelcomeGlossaryStep
        candidates={candidates}
        onScan={actions?.harvestGlossary ? () => guard(() => actions.harvestGlossary!()) : undefined}
        onAdd={actions?.addGlossaryTerms ? (picked) => guard(() => actions.addGlossaryTerms!(picked)) : undefined}
      />
    </div>
  );
}

function FinishStep({ rows, actions, onDone }: { rows: SyncRow[]; actions?: WelcomeActions; onDone: () => void }) {
  /* This is now the ONLY "Finish setup" on the screen (the footer no longer
     draws a second one), so with no handler it has to advance the wizard the
     way every other step does rather than sitting there inert (§2) — which is
     exactly useWrite's no-handler branch (XA-04). */
  const write = useWrite();
  const finish = () => write.run(actions?.finish && (() => actions.finish!()), onDone);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[20px] font-semibold text-ink">Finish setup</h2>
        <p className="mt-1 text-[13.5px] text-ink/65">Here’s what actually happened: live sync state from your sources.</p>
      </div>
      <WelcomeSyncPanel sources={rows} />
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      <div className={AUTH_ACTIONS}>
        <Button variant="primary" disabled={write.busy} onClick={() => void finish()}>
          {write.busy ? <><Spinner size="sm" /> Finishing…</> : "Finish setup"}
        </Button>
      </div>
    </div>
  );
}

/* Where each card actually goes. These were three <div>s with a hover border
   and no handler: the last screen of onboarding offered three destinations and
   led to none of them (§2, P-WE-3). Bots are configured on Sources, which is
   what the Slack step above already tells the user. */
const NEXT = [
  { icon: <BookOpen size={18} />, title: "Explore Knowledge", sub: "Browse everything you just imported.", href: "/knowledge" },
  { icon: <GitBranch size={18} />, title: "See Lineage", sub: "How facts trace back to sources.", href: "/lineage" },
  { icon: <Bot size={18} />, title: "Set up bots", sub: "Answer questions in Slack.", href: "/sources" },
];

function DoneStep({ summary, onNavigate }: { summary: WelcomeSummary; onNavigate?: (href: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-md border border-moss/30 bg-moss/[0.06] p-4">
        <span className="mt-0.5 text-moss"><CheckCircle2 size={22} /></span>
        <div>
          <h2 className="text-[16px] font-semibold text-ink">Your workspace is ready</h2>
          <p className="mt-0.5 text-[13px] text-ink/65">
            {summary.sourcesSynced} sources synced · {summary.glossaryTerms} glossary terms added.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {NEXT.map((n) => (
          <button
            key={n.title}
            type="button"
            onClick={() => onNavigate?.(n.href)}
            className={`flex items-start gap-2.5 rounded-md border border-ink/15 p-3 text-left hover:border-ink/35 ${focusRing}`}
          >
            <span className="mt-0.5 text-biscay-2">{n.icon}</span>
            <span className="min-w-0">
              <b className="block text-[13px] font-semibold text-ink">{n.title}</b>
              <span className="block text-[12px] text-ink/60">{n.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Body dispatch ────────────────────────────────────────────────────── */

function StepBody({ data, current, actions, nav, selectedTile, connectRow, finishRows }: {
  data: WelcomeData;
  current: WelcomeStep;
  actions?: WelcomeActions;
  nav: StepNav;
  selectedTile: Tile | null;
  connectRow: SyncRow;
  finishRows: SyncRow[];
}) {
  switch (current) {
    case "connect":
      return <ConnectGrid
        tiles={data.tiles}
        connectorCount={data.connectorCount}
        nav={nav}
        onSelect={(provider) => nav.selectProvider?.(provider)}
      />;
    case "connect-generic":
      return selectedTile ? (
        <CredConnect
          provider={selectedTile.key}
          name={selectedTile.name}
          blurb={selectedTile.blurb}
          hint={`Mari validates ${selectedTile.name} before starting its first sync.`}
          fields={selectedTile.fields ?? []}
          actions={actions}
          nav={nav}
        />
      ) : <ConnectGrid
        tiles={data.tiles}
        connectorCount={data.connectorCount}
        nav={nav}
        onSelect={(provider) => nav.selectProvider?.(provider)}
      />;
    case "connect-github": return <GithubConnect data={data} actions={actions} nav={nav} />;
    case "connect-slack":
      return <CredConnect provider="slack" name="Slack"
        blurb="Import channel history into your shared knowledge library."
        hint="Credentials validate against the Slack API before syncing."
        fields={data.slackFields} actions={actions} nav={nav}
        note={
          <div className="flex items-start gap-2 rounded-[4px] border border-ink/12 bg-flysch px-3 py-2 text-[12px] text-ink/70">
            <Bot size={13} className="mt-0.5 shrink-0" />
            Importing channel history is separate from the answering bot. Set that up under Settings, Sources, Bots.
          </div>
        } />;
    case "connect-notion":
      return <CredConnect provider="notion" name="Notion"
        blurb="Sync pages and databases shared with an internal integration."
        hint="Only pages shared with the integration are visible."
        fields={data.notionFields} actions={actions} nav={nav} />;
    case "connect-gdrive":
      return <CredConnect provider="gdrive" name="Google Drive"
        blurb="Sync Docs and folders through a service account."
        hint="Google Docs are exported to Markdown on sync."
        fields={data.gdriveFields} actions={actions} nav={nav} />;
    case "connect-upload": return <UploadConnect data={data} actions={actions} nav={nav} />;
    case "connect-syncing": return <ConnectSyncing row={connectRow} nav={nav} />;
    case "glossary": return <GlossaryStep candidates={data.glossaryCandidates} actions={actions} />;
    case "finish": return <FinishStep rows={finishRows} actions={actions} onDone={() => nav.go("done")} />;
    case "done": return <DoneStep summary={data.doneSummary} onNavigate={actions?.navigate} />;
    default: return <Hero />;
  }
}

/** The four wizard positions, in order, for Continue / Back. Connecting a
    source detours off this spine and rejoins it at `glossary`. */
const SPINE: WelcomeStep[] = ["hero", "connect", "glossary", "finish"];

/** Steps that carry their own primary action, so the wizard footer must not
 *  draw a second one.
 *
 *  Every connector step ends in "Connect & sync" or "Done", and Finish ends in
 *  "Finish setup". The footer put "Continue" beside each of them: two primary
 *  actions on one screen, and the more prominent of the two was the one that
 *  skipped the work the step existed to do. Pressing Continue on the GitHub
 *  step left onboarding with no source connected and no sign that anything had
 *  been missed (§2, P-WE-1). */
const OWNS_PRIMARY = new Set<WelcomeStep>([
  "connect-github", "connect-slack", "connect-notion", "connect-gdrive",
  "connect-generic", "connect-upload", "connect-syncing", "finish",
]);

function WelcomePage({ data, loading = false, error = null, actions, mobile = false }: PageProps<WelcomeData, WelcomeActions>) {
  /* Which step is on screen is the user's own progress through the wizard,
     seeded by the data and then owned here. It used to come from `data` only,
     which meant Continue and Back did nothing at all and onboarding could
     never leave its first screen. */
  const [current, setCurrent] = useState<WelcomeStep>(data.step);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [sessionSync, setSessionSync] = useState<SyncRow | null>(null);
  const [seen, setSeen] = useState(data.step);
  if (seen !== data.step) { setSeen(data.step); setCurrent(data.step); }

  if (loading) {
    return (
      <div className={AUTH_SHELL}>
        <SkeletonPage
          variant="auth"
          /* Which onboarding step you are on is server state, and every
             headline in the wizard belongs to a step. */
          label="setup"
          mobile={mobile}
        />
      </div>
    );
  }
  const step = STEP_INDEX[current];
  const last = LABELS.length - 1;
  const done = current === "done";
  const nextLabel =
    done ? "Go to Overview" : step === 0 ? "Set up my workspace" : step === last ? "Finish setup" : "Continue";

  const nav: StepNav = {
    go: setCurrent,
    selectProvider: setSelectedProvider,
    startSync: setSessionSync,
  };
  const selectedTile = data.tiles.find((tile) => tile.key === selectedProvider) ?? null;
  const liveSelected = selectedProvider
    ? data.syncRows.find((row) => row.provider === selectedProvider) ?? null
    : null;
  const connectRow = liveSelected ?? sessionSync ?? data.connectSync;
  const finishRows = sessionSync && !data.syncRows.some((row) => row.provider === sessionSync.provider)
    ? [sessionSync, ...data.syncRows]
    : data.syncRows;
  const advance = () => {
    if (done) { actions?.navigate?.("/"); return; }
    if (step === last) { setCurrent("done"); return; }
    setCurrent(SPINE[Math.min(step + 1, SPINE.length - 1)]);
  };
  /* Back off a connector step returns to the GRID it was launched from. It
     used to be `SPINE[step - 1]`, and every connector step shares the spine
     index of "connect", so "← Back" from the GitHub form landed on the Hero:
     two screens back, past the grid the user had just come through
     (P-WE-2). */
  const back = () => {
    if (current === "done") { setCurrent("finish"); return; }
    if (STEP_INDEX[current] === 1 && current !== "connect") { setCurrent("connect"); return; }
    setCurrent(SPINE[Math.max(step - 1, 0)]);
  };

  return (
    <main id="main-content" aria-label="Main content" className={AUTH_SHELL}>
      <AuthBackdrop />
      <div className={`${AUTH_COL} ${mobile ? "px-4 py-10" : "px-6 py-16"}`}>
        <AuthHeader title="Welcome to Mari" sub="Your product knowledge, curated. Four steps, all of them real." />

        <Card variant="plain">
          <div className="mb-5">
            <Stepper labels={[...LABELS]} current={step} ariaLabel="Onboarding steps" />
          </div>

          {/* A failed onboarding query used to render as a normal, empty
              wizard: the user saw "no repositories found" when the truth was
              that the request failed. Catalog copy carries the explanation and
              the recovery action (§8); `error` carries the real detail. */}
          {error && (
            <div className="mb-4">
              {/* XA-01: exactly what ReadError wraps, written out by hand. */}
              <ReadError>{error}</ReadError>
            </div>
          )}

          <StepBody
            data={data}
            current={current}
            actions={actions}
            nav={nav}
            selectedTile={selectedTile}
            connectRow={connectRow}
            finishRows={finishRows}
          />

          {/* Primary bottom LEFT, secondary to its right (§2). On a step that
              owns its primary action the footer contributes only the way back
              and the way out, so the screen never offers two. */}
          <div className={`mt-7 border-t border-ink/10 pt-4 ${AUTH_ACTIONS}`}>
            {!OWNS_PRIMARY.has(current) && <Button variant="primary" onClick={advance}>{nextLabel}</Button>}
            <Button variant="default" disabled={current === "hero"} onClick={back}>← Back</Button>
            <Button variant="link" onClick={() => actions?.navigate?.("/")}>Save and finish later</Button>
            <span className="ml-auto font-term text-[12px] text-ink/65">
              {done ? <span className="inline-flex items-center gap-1 text-moss"><Sparkles size={12} /> Setup complete</span> : `${step + 1} of ${LABELS.length}`}
            </span>
          </div>
        </Card>
      </div>
    </main>
  );
}

export const page: PageModule<WelcomeData, WelcomeActions> = {
  id: "welcome",
  title: "Welcome",
  route: "/welcome",
  component: WelcomePage,
  states: STATES.map((s) => ({ ...s })),
};
