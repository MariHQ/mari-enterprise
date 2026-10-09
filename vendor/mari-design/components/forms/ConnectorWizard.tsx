import { useEffect, useState, type ReactNode } from "react";
import { Plug } from "lucide-react";
import { EmptyState } from "../data-display/EmptyState";
import { ChevronLeft, ChevronRight, ArrowRight, CheckCircle2, ShieldCheck, ExternalLink, Plus } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { Dialog } from "../layout/Dialog";
import { Stepper } from "../data-display/Stepper";
import { Button } from "../actions/Button";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Spinner } from "../data-display/Spinner";
import { Chip } from "../data-display/Chip";
import { Skeleton, SkeletonLine } from "../data-display/Skeleton";
import { SyncPanel, type SyncSource } from "../feedback/SyncPanel";
import { WriteError } from "../feedback/WriteError";

/* ConnectorWizard — a 3-step connect flow in a centered modal, ported from
   pages/sources/ConnectorWizard.tsx: pick provider → configure credentials →
   confirm/sync. The source's gql/useSyncStatus data layer is abstracted away —
   the provider catalog, an optional test handler, and the live sync status all
   arrive as props; the flow exposes onFinish(values). Built on Dialog +
   Stepper + FormField/Input + Button, reusing SyncPanel for the sync step. */

export type ConnectorField = {
  key: string;
  label: string;
  /** Defaults to true. Optional fields never gate Test or Connect. */
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  help?: string;
  /** Render a multi-line textarea (e.g. a service-account JSON blob). */
  multiline?: boolean;
};

/** One live instance of a provider: a source that already exists. `sourceId`
    is the library's opaque string id. `qualifier` is what scopes the instance
    ("rippling.atlassian.net"), or "" when the provider has one natural scope,
    and it is the label of last resort when `name` is empty. */
export type WizardInstance = { sourceId: string; name: string; qualifier: string };

export type WizardProvider = {
  key: string;
  name: string;
  blurb: string;
  /** Provider logo/mark; a letter tile is shown when omitted. */
  mark?: ReactNode;
  fields: ConnectorField[];
  docsUrl?: string;
  connected?: boolean;
  /** The provider's live sources. With any listed, the chooser tile names
      them and offers "Add another" in place of the plain Connected badge:
      connecting again is a normal thing to do, not a state to be warned off. */
  instances?: WizardInstance[];
};

export type ConnectTestResult = { ok: boolean; error?: string };

type TestState = { busy: boolean; ok: boolean | null; error: string };
const IDLE_TEST: TestState = { busy: false, ok: null, error: "" };

export type ConnectorWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: WizardProvider[];
  initialProvider?: string | null;
  title?: string;
  /** Optional "Test connection" handler — omit to hide the button. */
  onTest?: (provider: string, config: Record<string, string>) => Promise<ConnectTestResult> | ConnectTestResult;
  /** Fired when the user clicks Connect & sync; advances to the sync step.
      `name` is the optional display name typed on the configure step, absent
      when the user left it blank. */
  onFinish: (values: { provider: string; config: Record<string, string>; name?: string }) => void;
  /** Parent-driven live sync status for the final step (no hooks here). */
  syncStatus?: SyncSource | null;
  onRetrySync?: () => void;
  /** Rendered under the sync step's status panel: the caller's follow-up
      action for a failure it understands (e.g. "Edit the existing source"
      after a duplicate refusal). */
  syncExtra?: ReactNode;
  /** Render a skeleton in the dialog body while the catalog/form loads. */
  loading?: boolean;
};

function WizardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <SkeletonLine w="72%" h={11} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonLine w={100} h={10} />
          <Skeleton height={38} />
        </div>
      ))}
    </div>
  );
}

function ProviderMark({ p, size = 24 }: { p: WizardProvider; size?: number }) {
  if (p.mark) return <>{p.mark}</>;
  return (
    <span
      className="grid place-items-center rounded-[5px] bg-biscay/10 text-biscay-2 font-display font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
    >
      {p.name.charAt(0)}
    </span>
  );
}

export function ConnectorWizard({
  open, onOpenChange, providers, initialProvider = null, title = "Connect a source",
  onTest, onFinish, syncStatus = null, onRetrySync, syncExtra, loading = false,
}: ConnectorWizardProps) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<string | null>(initialProvider);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [sourceName, setSourceName] = useState("");
  const [test, setTest] = useState<TestState>(IDLE_TEST);

  // Reset the flow each time the dialog is opened.
  useEffect(() => {
    if (!open) return;
    setStep(initialProvider ? 1 : 0);
    setProvider(initialProvider);
    setConfig({});
    setSourceName("");
    setTest(IDLE_TEST);
  }, [open, initialProvider]);

  const chosen = providers.find((p) => p.key === provider) ?? null;
  const stepLabels = ["Choose source", "Configure", "Sync"];
  const filled = chosen
    ? chosen.fields.filter((f) => f.required !== false)
        .every((f) => (config[f.key] ?? "").trim().length > 0)
    : false;

  const pick = (key: string) => {
    setProvider(key);
    setConfig({});
    setSourceName("");
    setTest(IDLE_TEST);
  };
  const setField = (key: string, value: string) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setTest(IDLE_TEST);
  };
  const trimmed = () => Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v.trim()]));

  const runTest = async () => {
    if (!provider || !onTest || test.busy) return;
    setTest({ busy: true, ok: null, error: "" });
    try {
      const r = await onTest(provider, trimmed());
      setTest({ busy: false, ok: r.ok, error: r.error ?? "" });
    } catch {
      setTest({ busy: false, ok: false, error: "The test handler threw an error." });
    }
  };

  const connect = () => {
    if (!provider) return;
    const name = sourceName.trim();
    onFinish({ provider, config: trimmed(), ...(name ? { name } : {}) });
    setStep(2);
  };

  const body = () => {
    if (step === 0) {
      /* An empty catalog rendered as a blank gap between the stepper and the
         Back/Next bar, which reads as a broken dialog. Every sibling panel
         says why it is empty (§15); this one has to as well. */
      if (!providers.length) {
        return (
          <EmptyState icon={<Plug size={24} />} title="No connectors available">
            No source types are configured for this workspace. Check the server's
            connector catalog, or add a source from the Sources page.
          </EmptyState>
        );
      }
      return (
        <div>
          <div className="text-[13px] text-ink/70 mb-3">
            Pick the system to bring into your knowledge library.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {providers.map((p) => {
              const selected = provider === p.key;
              /* Each live instance is named by its display name, falling back
                 to its qualifier: both come from the server, never invented. */
              const live = (p.instances ?? []).map((i) => i.name || i.qualifier || p.name);
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(p.key)}
                  className={`flex flex-col items-start gap-1.5 text-left p-3 rounded-md border transition-colors ${focusRing} ${
                    selected ? "border-biscay-2 bg-biscay/[0.04] ring-1 ring-biscay-2/40" : "border-ink/15 hover:border-ink/35"
                  }`}
                >
                  <span className="flex items-center gap-2 w-full">
                    <ProviderMark p={p} size={22} />
                    <span className="text-[13px] font-semibold text-ink truncate flex-1">{p.name}</span>
                    {/* A provider with live instances is not a closed door: the
                        badge slot says the tile ADDS one more, and the names
                        below say what already exists. Without instance data the
                        old Connected chip stands, so nothing regresses. */}
                    {p.connected && (live.length > 0
                      ? (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-biscay-2">
                          <Plus size={11} /> Add another
                        </span>
                      )
                      : <Chip label="Connected" tone="ok" caps className="shrink-0" />)}
                  </span>
                  <span className="text-[11.5px] text-ink/65 leading-snug line-clamp-2">{p.blurb}</span>
                  {live.length > 0 && (
                    <span className="w-full truncate font-term text-[11px] text-ink/65" title={live.join(", ")}>
                      Connected: {live.join(", ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === 1) {
      if (!chosen) return null;
      return (
        <div>
          {/* FRM-16: the fallback here used to be "Credentials stay on the
              server and are never shown again" — an unrelated second sentence
              sharing one slot, and a claim about server-side storage that this
              component cannot see and must not make. A provider with no blurb
              simply has no blurb. */}
          {chosen.blurb && <div className="text-[13px] text-ink/70 mb-1">{chosen.blurb}</div>}
          {chosen.docsUrl && (
            <a className="inline-flex items-center gap-1 text-[12px] text-biscay-2 hover:underline" href={chosen.docsUrl} target="_blank" rel="noreferrer">
              {chosen.name} setup docs <ExternalLink size={11} />
            </a>
          )}
          {chosen.fields.length === 0 ? (
            <div className="mt-3 text-[13px] text-ink/70">No credentials needed. Connect to start the first sync.</div>
          ) : (
            /* FRM-03: credential inputs need accessible names. These sat in
               <Field>, the READ-ONLY key/value display row (a div + a span, no
               htmlFor, no wrapping label), so every token box in the wizard was
               an unnamed text field to assistive tech. FormField is the
               editable sibling and associates label and control. */
            <div className="mt-2 flex flex-col gap-3">
              {chosen.fields.map((f) => (
                <FormField key={f.key} label={f.label} hint={f.help}>
                  {f.multiline ? (
                    <Textarea
                      rows={5}
                      className="font-term"
                      autoComplete="off"
                      placeholder={f.placeholder}
                      value={config[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  ) : (
                    <Input
                      className="w-full"
                      type={f.secret ? "password" : "text"}
                      autoComplete={f.secret ? "new-password" : "off"}
                      placeholder={f.placeholder}
                      value={config[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}
                </FormField>
              ))}
            </div>
          )}
          {/* Last in the field list, and never required: the display name is
              what tells two instances of the same system apart on Sources, so
              it belongs to every provider rather than any one field spec. */}
          <div className="mt-3">
            <FormField label="Name" hint="Optional. A display name that tells multiple connections of the same system apart.">
              <Input
                className="w-full"
                autoComplete="off"
                placeholder={`${chosen.name} · production`}
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
              />
            </FormField>
          </div>
          {test.ok === true && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-moss">
              <CheckCircle2 size={14} /> Connection OK: credentials verified.
            </div>
          )}
          {/* XA-02: the refused test was a bespoke red box here and a slightly
              different bespoke red box in ConnectDrawer, for one event. */}
          {test.ok === false && (
            <div className="mt-3">
              <WriteError onDismiss={() => setTest(IDLE_TEST)}>
                {test.error || "The connection test failed without details."}
              </WriteError>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="text-[13px] text-ink/70 mb-3">
          The initial sync runs on the server. Closing this dialog won’t interrupt it.
        </div>
        {syncStatus ? (
          <>
            <SyncPanel sources={[syncStatus]} onRetry={onRetrySync ? () => onRetrySync() : undefined} />
            {syncExtra}
          </>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-ink/70 py-4">
            <Spinner size="sm" /> Starting sync for <b className="font-term">{chosen?.name}</b>…
          </div>
        )}
      </div>
    );
  };

  /* FRM-20 / §2: the primary action is BOTTOM LEFT with the secondary to its
     right, on every step. This footer used to be `justify-between` with the
     primary pinned to the right, which is the layout §2 names explicitly.
     Step 0's Back button is also gone rather than drawn disabled: there is
     nothing behind the first step, and §2 says a control that cannot act is
     not drawn. */
  const footer = (
    <div className="flex-1 flex items-center gap-2">
      {step === 0 && (
        <Button variant="primary" disabled={!chosen} onClick={() => setStep(1)}>
          Next <ChevronRight size={13} />
        </Button>
      )}
      {step === 1 && (
        <>
          <Button variant="primary" disabled={!chosen || (chosen.fields.length > 0 && !filled)} onClick={connect}>
            Connect &amp; sync <ArrowRight size={14} />
          </Button>
          {onTest && chosen && chosen.fields.length > 0 && (
            <Button disabled={!filled || test.busy} onClick={runTest}>
              {test.busy ? <><Spinner size="sm" /> Testing…</> : <><ShieldCheck size={13} /> Test connection</>}
            </Button>
          )}
          <Button onClick={() => setStep(0)}><ChevronLeft size={13} /> Back</Button>
        </>
      )}
      {step === 2 && (
        <>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done <CheckCircle2 size={14} />
          </Button>
          <span className="min-w-0 text-[12px] text-ink/65">Sync continues in the background.</span>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={chosen ? `Connect ${chosen.name}` : title} width={640} footer={footer}>
      <div className="mb-5">
        <Stepper labels={stepLabels} current={step} ariaLabel="Connector setup progress" />
      </div>
      <div className="min-h-[240px]">{loading ? <WizardSkeleton /> : body()}</div>
    </Dialog>
  );
}
