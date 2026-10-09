import { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { Logo, Brandmark } from "../shell/Logo";
import { Card } from "../layout/Card";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { Button } from "../actions/Button";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite } from "../actions/useWrite";
import { Spinner } from "../data-display/Spinner";
import { SkeletonPage } from "../data-display/Skeletons";
/* The password rule is imported, not restated. Setup, Login's register mode
   and Preferences all create or change the same credential, and they used to
   disagree about what a valid one was: Preferences demanded 8 characters and a
   confirmation, these two demanded nothing (P-ST-1, P-LG-6). */
import { PASSWORD_MIN, PASSWORD_HINT } from "./LoginPage";

/* Setup — first-owner claim. Shown when a fresh workspace has no owner yet;
   renders outside the console shell on the same full-bleed auth backdrop as
   Login. The browser form is the complete workflow; no operator token or
   server-log handoff is involved. */

const STATES = [
  { id: "default", label: "Create workspace" },
  { id: "admin", label: "Admin account" },
  { id: "saving", label: "Setting up…" },
  { id: "error", label: "Error / service unavailable" },
  { id: "success", label: "Complete" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** The owner form, or its successful hand-off. */
export type SetupStep = "admin" | "done";

/** The first owner account and workspace created by this screen. */
export type Claim = { name: string; email: string; password: string; workspace: string };

/** What first-run setup can DO. One call, because the server validates the
 *  token and creates the admin in one step: a token that was mistyped or
 *  already used comes back as a rejection on the finish button, and that
 *  wording is shown verbatim. Optional (§2): with no handler the two steps
 *  still walk, which is what the design canvas renders. */
export type SetupActions = {
  claimWorkspace?: (c: Claim) => void | Promise<void>;
  /** Leave first-run setup. The workspace is claimed and the admin is signed
      in by this point, so both exits are ordinary navigation — the screen just
      names which one was chosen. */
  finish?: (target: "overview" | "sources") => void;
};

/** Everything the Setup screen renders. */
export type SetupData = {
  step: SetupStep;
  /** The admin account being created, and the workspace it will own. */
  name: string;
  email: string;
  password: string;
  workspace: string;
};

/* ── Shared unauthenticated framing ────────────────────────────────────────
   Kept identical to LoginPage / WelcomePage: one backdrop, one 672px column,
   one centered logo/title/sub header, one card, primary-bottom-left actions.
   Deliberately OFF the 1400px console grid (§11): no sidebar here. */
const AUTH_SHELL = "relative h-full w-full overflow-x-hidden overflow-y-auto bg-paper";
const AUTH_COL = "relative mx-auto flex min-h-full max-w-2xl flex-col justify-center";
const AUTH_ACTIONS = "flex flex-wrap items-center gap-2";
/* Two-up field grid: the auth card is 672px wide, so a single stretched input
   would read absurd. Matches the field width the console Settings pages use. */
const FORM_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2";

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

function AdminStep({ error, failed, onDismissFailed, claim, set, busy, onBack, onSubmit }: {
  error: string | null;
  /** What `claimWorkspace` threw. A refused write, not a failed read. */
  failed: string | null;
  onDismissFailed: () => void;
  claim: Claim; set: (patch: Partial<Claim>) => void;
  busy: boolean; onBack?: () => void; onSubmit: () => void;
}) {
  /* Confirmation lives here rather than on `Claim`, because it never leaves
     the form: the server is sent one password, and the second box exists only
     so a typo in the first is caught on the screen that created it. */
  const [confirm, setConfirm] = useState("");
  const tooShort = claim.password.length > 0 && claim.password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && claim.password !== confirm;
  /* Every field here is required to create the admin: this is the only account
     the workspace will have. */
  const ready = Boolean(claim.name.trim() && claim.email.trim() && claim.workspace.trim())
    && claim.password.length >= PASSWORD_MIN && claim.password === confirm;
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] leading-relaxed text-ink/70">
        Create the admin account and name your workspace.
      </p>
      {/* XA-01: this was `<Alert tone="blocked" title={error}>` — the SERVER'S
          text used as the heading, so whatever a rejection happened to say
          replaced the catalog's wording at the one moment §5 and §8 matter
          most. The catalog owns the heading; the server's message and our
          recovery step are the detail underneath it. */}
      <WriteError onDismiss={onDismissFailed}>{failed}</WriteError>
      {!failed && error && <ReadError>{error}</ReadError>}
      <div className={FORM_GRID}>
        <Field label="Your name">
          <Input className="w-full" placeholder="Maya Chen" autoComplete="name" value={claim.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input className="w-full" type="email" placeholder="maya@team.com" autoComplete="email" value={claim.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Password">
          <Input className="w-full" type="password" placeholder="••••••••" autoComplete="new-password" value={claim.password} onChange={(e) => set({ password: e.target.value })} />
          <p className={`mt-1 text-[12px] ${tooShort ? "text-espelette" : "text-ink/70"}`}>
            {tooShort ? `Use at least ${PASSWORD_MIN} characters.` : PASSWORD_HINT}
          </p>
        </Field>
        <Field label="Confirm password">
          <Input className="w-full" type="password" placeholder="••••••••" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {mismatch && <p className="mt-1 text-[12px] text-espelette">The two passwords do not match.</p>}
        </Field>
        <Field label="Workspace name">
          <Input className="w-full" placeholder="Acme Product" value={claim.workspace} onChange={(e) => set({ workspace: e.target.value })} />
        </Field>
      </div>
      <p className="-mt-2 text-[12px] text-ink/65">Shown in the sidebar and on published pages.</p>
      <div className={`pt-1 ${AUTH_ACTIONS}`}>
        <Button variant="primary" disabled={busy || !ready} onClick={onSubmit}>
          {busy ? <><Spinner size="sm" /> Setting up…</> : "Finish setup"}
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({ workspace, actions }: { workspace: string; actions?: SetupActions }) {
  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-moss/35 text-moss"><CheckCircle2 size={26} /></span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-ink">Your workspace is ready</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink/70">
            <b className="text-ink/80">{workspace}</b> is claimed and you’re signed in as its admin.
            Next, connect a source to start building your knowledge base.
          </p>
        </div>
      </div>
      {/* Biggest action last, and bottom left (§1, §2). */}
      <div className={`mt-1 ${AUTH_ACTIONS}`}>
        <Button variant="primary" onClick={() => actions?.finish?.("overview")}>Go to Overview <ArrowRight size={14} /></Button>
        <Button variant="link" onClick={() => actions?.finish?.("sources")}>Connect a source first</Button>
      </div>
    </div>
  );
}

function SetupPage({ data, loading = false, error = null, actions, mobile = false }: PageProps<SetupData, SetupActions>) {
  /* The claim is typed here and has to leave the form, so it is local state
     seeded from the data. Both steps used to be uncontrolled `defaultValue`
     inputs under buttons with no handler: the whole screen was a picture. */
  const [claim, setClaim] = useState<Claim>({
    name: data.name, email: data.email, password: data.password, workspace: data.workspace,
  });
  const [step, setStep] = useState<SetupStep>(data.step);
  const [seen, setSeen] = useState(data.step);
  if (seen !== data.step) { setSeen(data.step); setStep(data.step); }
  /* The shared write lifecycle prevents duplicate submits and keeps a failed
     first-owner claim recoverable without losing the form. */
  const write = useWrite();

  const set = (patch: Partial<Claim>) => setClaim((c) => ({ ...c, ...patch }));

  const submit = () => write.run(
    actions?.claimWorkspace && (() => actions.claimWorkspace!(claim)),
    () => setStep("done"),
  );

  if (loading) {
    return (
      <main id="main-content" aria-label="Main content" className={AUTH_SHELL}>
        <SkeletonPage
          variant="auth"
          title="Welcome to Mari"
          description="Claim this workspace and create the admin account."
          mobile={mobile}
        />
      </main>
    );
  }

  const done = step === "done";
  return (
    <main id="main-content" aria-label="Main content" className={AUTH_SHELL}>
      <AuthBackdrop />
      <div className={`${AUTH_COL} ${mobile ? "px-4 py-10" : "px-6 py-16"}`}>
        <AuthHeader
          title={done ? "Workspace claimed" : "Welcome to Mari"}
          sub={done ? "Your workspace is claimed and ready." : "Claim this workspace and create the admin account."}
        />
        <Card variant="plain">
          {done ? <SuccessStep workspace={claim.workspace || data.workspace} actions={actions} />
            : <AdminStep error={error} failed={write.failed} onDismissFailed={() => write.setFailed(null)} claim={claim} set={set} busy={write.busy} onSubmit={() => void submit()} />}
        </Card>
      </div>
    </main>
  );
}

export const page: PageModule<SetupData, SetupActions> = {
  id: "setup",
  title: "Setup",
  route: "/setup",
  component: SetupPage,
  states: STATES.map((s) => ({ ...s })),
};
