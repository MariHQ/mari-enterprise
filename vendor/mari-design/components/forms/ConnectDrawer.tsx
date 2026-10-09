import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, ExternalLink } from "lucide-react";
import { Drawer } from "../layout/Drawer";
import { Button } from "../actions/Button";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Spinner } from "../data-display/Spinner";
import { Chip } from "../data-display/Chip";
import { Skeleton, SkeletonLine } from "../data-display/Skeleton";
import { SyncPanel, type SyncSource } from "../feedback/SyncPanel";
import { WriteError } from "../feedback/WriteError";
import type { ConnectorField, ConnectTestResult } from "./ConnectorWizard";

/* ConnectDrawer — a slide-over connect flow, ported from
   pages/welcome/GenericConnect.tsx: renders a provider's credential fields
   (secret → password, multiline → textarea), an optional "Test connection",
   then Connect & sync. The gql/validate/connect network layer is abstracted
   away — fields arrive as props and the flow exposes onConnect(values). Once
   the parent supplies a `syncStatus`, the drawer switches to live sync (built
   on our SyncPanel). Built on Drawer + FormField + Input + Button. */

export type ConnectDrawerProps = {
  open: boolean;
  onClose: () => void;
  providerName: string;
  blurb?: string;
  /** Provider logo/mark shown in the drawer header. */
  icon?: ReactNode;
  fields: ConnectorField[];
  docsUrl?: string;
  /** Fired with trimmed credential values when Connect & sync is clicked. */
  onConnect: (values: Record<string, string>) => void;
  /** Optional "Test connection" handler — omit to hide the button. */
  onTest?: (values: Record<string, string>) => Promise<ConnectTestResult> | ConnectTestResult;
  /** Extra note rendered under the fields (e.g. a Slack bot reminder). */
  note?: ReactNode;
  /** When present, the drawer shows live sync instead of the form. */
  syncStatus?: SyncSource | null;
  onRetrySync?: () => void;
  /** Render a skeleton form while credentials/config load. */
  loading?: boolean;
};

export function ConnectDrawer({
  open, onClose, providerName, blurb, icon, fields, docsUrl,
  onConnect, onTest, note, syncStatus = null, onRetrySync, loading = false,
}: ConnectDrawerProps) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [test, setTest] = useState<{ busy: boolean; ok: boolean | null; error: string }>({ busy: false, ok: null, error: "" });

  /* FRM-15: credentials must not survive a close. Nothing used to clear
     `config`, so closing the drawer half-way through typing a token and
     reopening it (for the same provider or a different one) redisplayed that
     token, and it went out with the next Connect. ConnectorWizard already does
     this; the drawer has to as well. Both edges are cleared, so the secret is
     also dropped on close rather than being held until the next open. */
  useEffect(() => {
    setConfig({});
    setTest({ busy: false, ok: null, error: "" });
  }, [open]);

  const filled = fields.every((f) => (config[f.key] ?? "").trim().length > 0);
  const set = (key: string, value: string) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setTest({ busy: false, ok: null, error: "" });
  };
  const trimmed = () => Object.fromEntries(Object.entries(config).map(([k, v]) => [k, v.trim()]));

  const runTest = async () => {
    if (!filled || !onTest || test.busy) return;
    setTest({ busy: true, ok: null, error: "" });
    try {
      const r = await onTest(trimmed());
      setTest({ busy: false, ok: r.ok, error: r.error ?? "" });
    } catch {
      setTest({ busy: false, ok: false, error: "The test handler threw an error." });
    }
  };

  const connected = syncStatus != null;

  /* FRM-20 / §2: the primary action goes BOTTOM LEFT with the secondary to its
     right. Both of these footers used to be right-aligned with the primary
     last. */
  const footer = connected ? (
    <div className="flex items-center gap-3 w-full">
      <Button variant="primary" onClick={onClose}>Done <CheckCircle2 size={16} /></Button>
      <span className="min-w-0 flex-1 text-[12px] text-ink/70">Sync continues on the server. Closing won’t interrupt it.</span>
    </div>
  ) : (
    <div className="flex items-center gap-2 w-full">
      <Button variant="primary" disabled={!filled} onClick={() => onConnect(trimmed())}>
        Connect &amp; sync <ArrowRight size={16} />
      </Button>
      {onTest && (
        <Button disabled={!filled || test.busy} onClick={runTest}>
          {test.busy ? <><Spinner size="sm" /> Testing…</> : <><ShieldCheck size={16} /> Test connection</>}
        </Button>
      )}
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Connect ${providerName}`}
      subtitle="Connector setup"
      icon={icon}
      footer={footer}
    >
      {loading ? (
        <div className="space-y-4" aria-hidden="true">
          <SkeletonLine w="80%" h={11} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine w={100} h={10} />
              <Skeleton height={38} />
            </div>
          ))}
        </div>
      ) : connected ? (
        <>
          <p className="text-[13px] text-ink/70 mb-3">The initial sync runs on the server. Live status below.</p>
          <SyncPanel sources={[syncStatus!]} onRetry={onRetrySync ? () => onRetrySync() : undefined} />
        </>
      ) : (
        <>
          {/* FRM-16: the drawer used to print "Credentials are stored
              server-side and never shown again" under every form, always. This
              component never talks to a server and cannot know what one does
              with a credential, so that was a security promise it had no way to
              keep. If a provider has something to say here it says it in
              `blurb`. */}
          {(blurb || docsUrl) && (
            <p className="text-[13px] text-ink/70">
              {blurb}
              {blurb && docsUrl ? " " : null}
              {docsUrl && (
                <a className="inline-flex items-center gap-1 text-biscay-2 hover:underline" href={docsUrl} target="_blank" rel="noreferrer">
                  Where do I get these? <ExternalLink size={14} />
                </a>
              )}
            </p>
          )}
          {/* FRM-03: these are credential inputs, so they need real labels.
              They used to sit inside <Field>, which is the READ-ONLY key/value
              display row: a div with a span, no htmlFor, no wrapping label. To
              a screen reader every token box in this drawer was an unnamed text
              field. FormField is the editable sibling and associates the two. */}
          <div className="mt-2 flex flex-col gap-3">
            {fields.map((f) => (
              <FormField key={f.key} label={f.label} hint={f.help}>
                {f.multiline ? (
                  <Textarea
                    rows={5}
                    className="font-term"
                    autoComplete="off"
                    placeholder={f.placeholder}
                    value={config[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : (
                  <Input
                    className="w-full"
                    type={f.secret ? "password" : "text"}
                    autoComplete={f.secret ? "new-password" : "off"}
                    placeholder={f.placeholder}
                    value={config[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </FormField>
            ))}
          </div>
          {test.ok === true && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-moss">
              <CheckCircle2 size={16} /> Connection test passed. <Chip label="Valid" tone="ok" caps />
            </div>
          )}
          {/* XA-02: a refused connection test is a failed write beside a
              button, not a note under any one field, and this bespoke red box
              was a fifth rendering of that same event. */}
          {test.ok === false && (
            <div className="mt-3">
              <WriteError onDismiss={() => setTest({ busy: false, ok: null, error: "" })}>
                {test.error || "The connection test failed without details."}
              </WriteError>
            </div>
          )}
          {note && (
            <div className="mt-3 flex items-start gap-2 rounded-[4px] border border-ink/12 bg-flysch px-3 py-2 text-[12px] text-ink/70">
              {note}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
