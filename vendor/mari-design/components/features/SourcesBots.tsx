import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, GitFork, RefreshCw, Copy, Slack, Github } from "lucide-react";
import { card } from "../tokens/card";
import { Button } from "../actions/Button";
import { Drawer } from "../layout/Drawer";
import { Stepper } from "../data-display/Stepper";
import { Chip, StatusChip } from "../data-display/Chip";
import { Spinner } from "../data-display/Spinner";
import { SkeletonLine, SkeletonCircle, SkeletonChip, SkeletonButton, SkeletonText } from "../data-display/Skeleton";
import { IconRing } from "../data-display/IconRing";
import { CodeBlock } from "../data-display/CodeBlock";
import { Truncate } from "../data-display/Truncate";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { SectionLabel } from "../forms/SectionLabel";
import { SlackMark, GithubMark } from "../icons/marks";
import { fmtDateTime } from "../tokens/format";
import { useWrite } from "../actions/useWrite";
import { WriteError } from "../feedback/WriteError";

/* SourcesBots — the Destinations page "Bots" tab: self-serve setup for the two
   push-into-Mari integrations (Slack answering bot + GitHub push webhook).
   Two honest status cards ("Waiting for first event" is a real state) each
   open a guided-setup Drawer with a Stepper. Composes Card/Drawer/Stepper/
   Chip/Input/CodeBlock; the /bots/status + updateSetting layer is baked in.
   Standalone: the Slack setup drawer opens by default. */

export type SlackStatus = { configured: boolean; teamName?: string; lastEventAt?: string; lastError?: string };
export type GithubStatus = { webhookConfigured: boolean; lastDeliveryAt?: string; repos: string[] };

/** What the Bots destination can DO. The presenter used to be handed status and nothing
 *  else, so every credential it collected died in local state: "Saved" was a
 *  word, not a write.
 *
 *  All optional. With none of them the drawers keep the local echo the design
 *  canvas renders (CONVENTIONS.md §2) — except the connection test, which is
 *  not drawn at all without a handler, because a test that reports "Connected
 *  as @Mari" without asking Slack is invented data. */
export type SourcesBotsActions = {
  /** Store the bot token and signing secret server-side. Throws with the
      server's own words: "invalid_auth" is the one thing the user can fix. */
  saveSlackCredentials?: (v: { botToken: string; appToken: string; signingSecret: string }) => void | Promise<void>;
  /** Read the deployment-generated Slack manifest. The callback matters:
      browser origin is not necessarily the public API origin Slack calls. */
  loadSlackManifest?: () => Promise<string>;
  /** Slack's `auth.test`. Answers rather than throws: "not ok" is a normal
      outcome of a test. */
  testSlackConnection?: () => Promise<{ ok: boolean; teamName?: string; error?: string }>;
  /** Store the webhook signing secret this workspace verifies deliveries with. */
  saveGithubWebhookSecret?: (secret: string) => void | Promise<void>;
};

const fallbackSlackManifest = () => `display_information:
  name: Mari
features:
  app_home:
    home_tab_enabled: false
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  bot_user:
    display_name: Mari
oauth_config:
  scopes:
    bot: [app_mentions:read, channels:history, chat:write, im:history, im:read, im:write]
settings:
  event_subscriptions:
    request_url: ${origin}/webhooks/slack
    bot_events: [app_mention, message.channels, message.im]`;

function botChip(status: "not-set-up" | "error" | "waiting" | "configured"): ReactNode {
  switch (status) {
    case "not-set-up": return <Chip label="Not set up" tone="neutral" dot />;
    case "error": return <Chip label="Error" tone="blocked" dot />;
    case "waiting": return <Chip label="Waiting for first event" tone="attention" dot pulse />;
    case "configured": return <Chip label="Configured" tone="ok" dot />;
  }
}

function slackState(s: SlackStatus) {
  if (!s.configured) return "not-set-up" as const;
  if (s.lastError) return "error" as const;
  if (!s.lastEventAt) return "waiting" as const;
  return "configured" as const;
}
function githubState(s: GithubStatus) {
  if (!s.webhookConfigured) return "not-set-up" as const;
  if (!s.lastDeliveryAt) return "waiting" as const;
  return "configured" as const;
}

function randomHexSecret(): string {
  const bytes = new Uint8Array(24);
  (globalThis.crypto ?? window.crypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const origin = typeof window !== "undefined" ? window.location.origin : "https://acme.mari.app";

/* ── Slack setup drawer ─────────────────────────────────────────────────── */
const SLACK_STEPS = ["Create the app", "Connect", "Verify", "Use it"];

function SlackDrawer({
  open, onClose, status, actions,
}: { open: boolean; onClose: () => void; status: SlackStatus; actions?: SourcesBotsActions }) {
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [appToken, setAppToken] = useState("");
  const [secret, setSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [manifest, setManifest] = useState(fallbackSlackManifest);
  const [manifestError, setManifestError] = useState("");
  /* The verify step reports what Slack answered, and nothing else: it used to
     flip to "Connected as @Mari" from a click alone. */
  const [tested, setTested] = useState<{ ok: boolean; teamName?: string; error?: string } | null>(null);
  const write = useWrite();
  /* Its own hook, not the one Save uses: the two steps are separately
     disableable and a failure on one must not surface on the other. */
  const tester = useWrite();

  useEffect(() => {
    if (!open || step !== 0 || !actions?.loadSlackManifest) return;
    let live = true;
    setManifestError("");
    void actions.loadSlackManifest()
      .then((value) => { if (live) setManifest(value); })
      .catch((error) => { if (live) setManifestError(error instanceof Error ? error.message : String(error)); });
    return () => { live = false; };
  }, [open, step, actions?.loadSlackManifest]);

  const save = () => write.run(
    actions?.saveSlackCredentials && (() => actions.saveSlackCredentials!({ botToken: token, appToken, signingSecret: secret.trim() })),
    () => setSaved(true),
  );
  const test = async () => {
    setTested(null);
    const result = await tester.runFor(actions?.testSlackConnection && (() => actions.testSlackConnection!()));
    if (result) setTested(result);
  };

  const tokenOk = token.startsWith("xoxb-");
  const tokenErr = token.length > 0 && (token.startsWith("xoxp-") || !token.startsWith("xoxb-"));
  const appTokenOk = appToken.startsWith("xapp-");
  const appTokenErr = appToken.length > 0 && !appTokenOk;
  const canSave = tokenOk && appTokenOk && secret.trim().length > 0;

  const body = () => {
    if (step === 0) return (
      <div className="grid grid-cols-1 gap-3">
        <p className="text-[13px] text-ink/70">Create a Slack app "From a manifest", or replace the manifest on an existing app. It enables two-way DMs, scopes, and the events URL.</p>
        <CodeBlock code={manifest} title="app-manifest.yml" />
        {manifestError && <WriteError>{manifestError}</WriteError>}
      </div>
    );
    if (step === 1) return (
      <div className="grid grid-cols-1 gap-1">
        <p className="text-[13px] text-ink/70 mb-1">Paste the credentials from your Slack app's settings.</p>
        <Field label="Bot token">
          <Input className="w-full font-term" type="password" placeholder="xoxb-…" value={token} onChange={(e) => { setToken(e.target.value); setSaved(false); }} />
          {tokenErr && <p className="mt-1 text-[11.5px] text-espelette">Bot tokens start with <code>xoxb-</code> (not <code>xoxp-</code>).</p>}
        </Field>
        <Field label="App-level token">
          <Input className="w-full font-term" type="password" placeholder="xapp-…" value={appToken} onChange={(e) => { setAppToken(e.target.value); setSaved(false); }} />
          {appTokenErr && <p className="mt-1 text-[11.5px] text-espelette">App-level tokens start with <code>xapp-</code>.</p>}
          <p className="mt-1 text-[11.5px] text-ink/60">Create it under Basic Information → App-Level Tokens with <code>connections:write</code>. Mari uses it for immediate Socket Mode delivery.</p>
        </Field>
        <Field label="Signing secret">
          <Input className="w-full font-term" type="password" placeholder="••••••••" value={secret} onChange={(e) => { setSecret(e.target.value); setSaved(false); }} />
        </Field>
        {status.configured && <p className="mt-2 text-[11.5px] text-ink/70">Already configured. Enter new values only to replace them.</p>}
        <div className="mt-3">
          <Button variant="primary" compact disabled={!canSave || write.busy} onClick={() => void save()}>{write.busy ? "Saving…" : "Save credentials"}</Button>
          {saved && <span className="ml-2 inline-flex items-center gap-1 text-[12.5px] text-moss"><CheckCircle2 size={14} /> Saved</span>}
        </div>
        <div className="mt-3"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>
      </div>
    );
    if (step === 2) return (
      <div className="grid grid-cols-1 gap-3">
        {/* Without a handler there is nothing to run, and a button that
            answers "Connected" on its own would be inventing the result of a
            call it never made (§2). */}
        {actions?.testSlackConnection ? (
          <>
            <p className="text-[13px] text-ink/70">Run Slack's <code>auth.test</code> to confirm the token works.</p>
            <div>
              <Button compact disabled={tester.busy} onClick={() => void test()}>
                {tester.busy ? <><Spinner size="sm" /> Testing…</> : <><RefreshCw size={13} /> Test connection</>}
              </Button>
              {tested?.ok && (
                <div className="mt-3 flex items-center gap-2">
                  <StatusChip status="approved" />
                  <span className="text-[12.5px] text-ink/70">
                    Connected{tested.teamName || status.teamName ? <> in <b>{tested.teamName ?? status.teamName}</b></> : null}.
                  </span>
                </div>
              )}
              {/* XA-02: a refused connection test is a failed WRITE beside a
                  button, not a note under an input, and it used to render as a
                  bespoke red <p> at a third of the weight the same event gets
                  everywhere else. Either source of the failure lands here: the
                  call threw, or it came back saying no. */}
              {(tester.failed || (tested && !tested.ok)) && (
                <div className="mt-3">
                  <WriteError onDismiss={() => { tester.setFailed(null); setTested(null); }}>
                    {tester.failed ?? tested?.error ?? "auth.test failed. Check the token and try again."}
                  </WriteError>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-[13px] text-ink/70">
            Slack verifies the credentials on the first event. Invite the bot and mention it to confirm the setup.
          </p>
        )}
      </div>
    );
    return (
      <div className="grid grid-cols-1 gap-3">
        <p className="text-[13px] text-ink/70">Invite the bot and ask it anything:</p>
        <ul className="text-[13px] text-ink/70 list-disc pl-5 grid grid-cols-1 gap-1">
          <li><code>/invite @Mari</code> in a channel</li>
          <li>@mention <b>@Mari</b> with a question</li>
          <li>DM <b>Mari</b> directly</li>
        </ul>
        <p className="text-[12px] text-ink/65">If Slack blocks the DM composer, update the app from this manifest and confirm App Home → Messages Tab allows messages.</p>
        <div className={`${card} p-3 flex items-center gap-2`}>
          {botChip(slackState(status))}
          {status.lastEventAt && <span className="ml-auto font-term text-[11px] text-ink/65">Last event {fmtDateTime(status.lastEventAt)}</span>}
        </div>
      </div>
    );
  };

  const nextBlocked = step === 1 && !(saved || status.configured);
  const footer = (
    <div className="flex-1 flex items-center justify-between gap-2">
      <Button compact disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
      {step < SLACK_STEPS.length - 1
        ? <Button variant="primary" compact disabled={nextBlocked} onClick={() => setStep((s) => s + 1)}>Next</Button>
        : <Button variant="primary" compact onClick={onClose}>Done</Button>}
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Set up Slack bot" subtitle="Guided setup"
      icon={<IconRing size={31}><SlackMark size={18} /></IconRing>} footer={footer}>
      <div className="mb-5"><Stepper labels={SLACK_STEPS} current={step} onSelect={(i) => i < step && setStep(i)} ariaLabel="Slack setup progress" /></div>
      {body()}
    </Drawer>
  );
}

/* ── GitHub webhook drawer ──────────────────────────────────────────────── */
const GH_STEPS = ["Add the webhook", "Secret", "Verify"];

function GithubDrawer({
  open, onClose, status, actions,
}: { open: boolean; onClose: () => void; status: GithubStatus; actions?: SourcesBotsActions }) {
  const [step, setStep] = useState(0);
  const [secret, setSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const write = useWrite();
  const payloadUrl = `${origin}/webhooks/github`;

  const save = () => write.run(
    actions?.saveGithubWebhookSecret && (() => actions.saveGithubWebhookSecret!(secret)),
    () => setSaved(true),
  );

  const body = () => {
    if (step === 0) return (
      <div className="grid grid-cols-1 gap-3">
        <p className="text-[13px] text-ink/70">In the repository's <b>Settings → Webhooks → Add webhook</b>, use:</p>
        <Field label="Payload URL"><Truncate className="font-term text-[12.5px]">{payloadUrl}</Truncate></Field>
        <Field label="Content type"><span className="font-term text-[12.5px]">application/json</span></Field>
        <Field label="Events"><span className="text-[13px]">Choose <b>Let me select individual events</b>, then tick <b>Pushes</b>, <b>Issue comments</b>, and <b>Pull requests</b></span></Field>
      </div>
    );
    if (step === 1) return (
      <div className="grid grid-cols-1 gap-1">
        <p className="text-[13px] text-ink/70 mb-1">Set a webhook secret so Mari can verify deliveries.</p>
        <Field label="Webhook secret">
          <div className="flex items-center gap-2">
            <Input className="flex-1 font-term" value={secret} placeholder="click Generate" onChange={(e) => { setSecret(e.target.value); setSaved(false); }} />
            <Button compact onClick={() => { setSecret(randomHexSecret()); setSaved(false); }}><RefreshCw size={13} /> Generate</Button>
            <Button icon aria-label="Copy secret" disabled={!secret} onClick={() => navigator.clipboard?.writeText(secret)}><Copy size={14} /></Button>
          </div>
        </Field>
        <div className="mt-3">
          <Button variant="primary" compact disabled={!secret || write.busy} onClick={() => void save()}>{write.busy ? "Saving…" : "Save secret"}</Button>
          {saved && <span className="ml-2 inline-flex items-center gap-1 text-[12.5px] text-moss"><CheckCircle2 size={14} /> Saved</span>}
        </div>
        <div className="mt-3"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>
        <p className="mt-2 text-[11.5px] text-ink/70">Paste the same value into GitHub's "Secret" field. In a pull request, write <code>@Mari validate facts</code> to request a fact check.</p>
      </div>
    );
    return (
      <div className="grid grid-cols-1 gap-3">
        {status.lastDeliveryAt ? (
          <div className="flex items-center gap-2">
            <StatusChip status="approved" /> <span className="text-[12.5px] text-ink/70">Delivery received {fmtDateTime(status.lastDeliveryAt)}.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-ink/70"><Spinner size="sm" /> Waiting for the first delivery. Push a commit to trigger one.</div>
        )}
        <div>
          <SectionLabel>Connected repositories</SectionLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {status.repos.length > 0
              ? status.repos.map((r) => <Chip key={r} label={r} tone="neutral" icon={<GitFork size={11} />} />)
              : <span className="text-[12.5px] text-ink/65">Connect a repo on the Connectors tab.</span>}
          </div>
        </div>
      </div>
    );
  };

  const nextBlocked = step === 1 && !(saved || status.webhookConfigured);
  const footer = (
    <div className="flex-1 flex items-center justify-between gap-2">
      <Button compact disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
      {step < GH_STEPS.length - 1
        ? <Button variant="primary" compact disabled={nextBlocked} onClick={() => setStep((s) => s + 1)}>Next</Button>
        : <Button variant="primary" compact onClick={onClose}>Done</Button>}
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Set up GitHub bot" subtitle="Repository webhook"
      icon={<IconRing size={31}><GithubMark size={18} /></IconRing>} footer={footer}>
      <div className="mb-5"><Stepper labels={GH_STEPS} current={step} onSelect={(i) => i < step && setStep(i)} ariaLabel="GitHub webhook setup progress" /></div>
      {body()}
    </Drawer>
  );
}

/* ── BotsTab ────────────────────────────────────────────────────────────── */
export type SourcesBotsProps = {
  slack: SlackStatus;
  github: GithubStatus;
  actions?: SourcesBotsActions;
  /** Which setup drawer opens on mount (so it shows in a static gallery). */
  defaultOpen?: "slack" | "github" | null;
  loading?: boolean;
  className?: string;
};

export function SourcesBots({
  slack, github, actions, defaultOpen = "slack", loading = false, className = "",
}: SourcesBotsProps) {
  const [drawer, setDrawer] = useState<"slack" | "github" | null>(defaultOpen);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`.trim()} aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className={`${card} flex flex-col gap-3 p-4`}>
            <div className="flex items-center gap-3">
              <SkeletonCircle size={31} />
              <SkeletonLine w="40%" h={13} />
              <span className="ml-auto"><SkeletonChip w={84} /></span>
            </div>
            <SkeletonText lines={1} lastWidth="82%" />
            <SkeletonLine w="50%" h={10} />
            <SkeletonLine w="60%" h={10} />
            <SkeletonButton w={140} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`.trim()}>
      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <IconRing size={31}><SlackMark size={18} /></IconRing>
          <b className="min-w-0 flex-1 basis-[7rem] truncate text-[14px] font-semibold text-ink">Slack bot</b>
          {botChip(slackState(slack))}
        </div>
        <p className="text-[12.5px] text-ink/65">Answers @mentions and DMs from your knowledge base.</p>
        <Field label="Workspace"><Truncate className="text-[13px]">{slack.teamName ?? "Not connected"}</Truncate></Field>
        <Field label="Last event"><span className="font-term text-[12px] text-ink/70">{slack.lastEventAt ? fmtDateTime(slack.lastEventAt) : "none yet"}</span></Field>
        <Button variant="primary" compact className="self-start" onClick={() => setDrawer("slack")}>
          <Slack size={14} /> {slack.configured ? "Manage setup" : "Set up Slack bot"}
        </Button>
      </div>

      <div className={`${card} p-4 flex flex-col gap-3`}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <IconRing size={31}><GithubMark size={18} /></IconRing>
          <b className="min-w-0 flex-1 basis-[7rem] truncate text-[14px] font-semibold text-ink">GitHub bot</b>
          {botChip(githubState(github))}
        </div>
        <p className="text-[12.5px] text-ink/65">Refreshes repository content and validates facts when @Mari is tagged in a pull request.</p>
        <Field label="Payload URL"><Truncate className="font-term text-[12px] text-ink/70" title={`${origin}/webhooks/github`}>{origin}/webhooks/github</Truncate></Field>
        <Field label="Repositories">
          <div className="flex flex-wrap gap-1.5">
            {github.repos.length > 0
              ? github.repos.map((r) => <Chip key={r} label={r} tone="neutral" icon={<GitFork size={11} />} className="max-w-full [&>span]:truncate" />)
              : <span className="text-[12.5px] text-ink/70">Connect a repository in Sources.</span>}
          </div>
        </Field>
        <Button variant="primary" compact className="self-start" onClick={() => setDrawer("github")}>
          <Github size={14} /> {github.webhookConfigured ? "Manage setup" : "Set up GitHub bot"}
        </Button>
      </div>

      <SlackDrawer open={drawer === "slack"} onClose={() => setDrawer(null)} status={slack} actions={actions} />
      <GithubDrawer open={drawer === "github"} onClose={() => setDrawer(null)} status={github} actions={actions} />
    </div>
  );
}
