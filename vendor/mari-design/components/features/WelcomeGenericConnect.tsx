import { useState } from "react";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { ConnectDrawer } from "../forms/ConnectDrawer";
import { type ConnectorField, type ConnectTestResult } from "../forms/ConnectorWizard";
import { type SyncSource } from "../feedback/SyncPanel";
import { Button } from "../actions/Button";
import { Alert } from "../feedback/Alert";
import { Skeleton, SkeletonLine, SkeletonCircle, SkeletonButton } from "../data-display/Skeleton";
import { SourceMark } from "../icons/marks";

/* WelcomeGenericConnect — the Welcome wizard's Step 1 sub-flow for any catalog
   provider that isn't GitHub or Upload (Slack, Notion, Drive, Confluence, …).
   A dynamic credential form driven by the provider's field spec, with an
   advisory "Test connection" and "Connect & sync" that hands off to a live
   <SyncPanel>. Composes the catalog <ConnectDrawer>; validate/connect are
   baked in. Standalone: opens by default and via a visible trigger. */

const SLACK_FIELDS: ConnectorField[] = [
  { key: "bot_token", label: "Bot token", secret: true, placeholder: "xoxb-…", help: "Needs channels:history and channels:read." },
  { key: "app_token", label: "App-level token", secret: true, placeholder: "xapp-…" },
  { key: "channel", label: "Channel", placeholder: "#engineering" },
];

export type WelcomeGenericConnectProps = {
  providerKey?: string;
  providerName?: string;
  blurb?: string;
  fields?: ConnectorField[];
  docsUrl?: string;
  defaultOpen?: boolean;
  loading?: boolean;
  className?: string;
};

export function WelcomeGenericConnect({
  providerKey = "slack",
  providerName = "Slack",
  blurb = "Import channel history into your shared knowledge library.",
  fields = SLACK_FIELDS,
  docsUrl = "https://api.slack.com/authentication/token-types",
  defaultOpen = true,
  loading = false,
  className = "",
}: WelcomeGenericConnectProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [sync, setSync] = useState<SyncSource | null>(null);
  /* Where the source LANDED. "Done" on its own left people wondering whether
     the connection had gone anywhere at all. */
  const [landed, setLanded] = useState<string | null>(null);

  const test = (_v: Record<string, string>): ConnectTestResult => ({ ok: true });

  const connect = (values: Record<string, string>) => {
    const detail = values.channel || providerName;
    const running: SyncSource = {
      id: providerKey, name: `${providerName} · ${detail}`, provider: providerKey,
      state: "syncing", phase: "Chunking", done: 40, total: 210, chunkCount: 640, embeddedCount: 210,
    };
    setSync(running);
    setLanded(running.name);
    window.setTimeout(() => setSync({
      ...running, state: "done", phase: undefined,
      docCount: 210, chunkCount: 1980, embeddedCount: 1980, lastSyncAt: new Date().toISOString(),
    }), 1600);
  };

  if (loading) return <ConnectPanelSkeleton rows={Math.max(1, fields.length)} className={className} />;

  return (
    <div className={className}>
      {/* Every connector trigger carries its provider mark. Either they all
          have an icon or none do; GitHub used to be the only one with one. */}
      <Button variant="primary" onClick={() => { setSync(null); setOpen(true); }}>
        <SourceMark provider={providerKey} size={15} /> Connect {providerName}
      </Button>
      {landed && !open && (
        <div className="mt-3">
          {/* "The Connectors tab" was removed releases ago, and Open
              Connectors only dismissed. Name the real destination. */}
          <Alert tone="info" title="Source connected" onDismiss={() => setLanded(null)}>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-moss" />
              {landed} now lives on Sources. Its first sync keeps running there.
            </span>
          </Alert>
        </div>
      )}
      <ConnectDrawer
        open={open}
        onClose={() => { setOpen(false); setSync(null); }}
        providerName={providerName}
        blurb={blurb}
        icon={<SourceMark provider={providerKey} size={20} />}
        fields={fields}
        docsUrl={docsUrl}
        onTest={test}
        onConnect={connect}
        note={providerKey === "slack" ? (
          <span><MessageSquare size={13} className="inline mr-1" /> Importing channel history is separate from the answering bot. Set that up under Settings, Sources, Bots.</span>
        ) : undefined}
        syncStatus={sync}
        onRetrySync={() => setSync((s) => (s ? { ...s, state: "syncing" } : s))}
      />
    </div>
  );
}

/* Loading silhouette that mirrors a connector setup panel: provider header
   (mark + title + blurb) over a stack of credential field rows and the
   Connect & sync footer. Shared by the Welcome connect features. */
export function ConnectPanelSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex items-start gap-3">
        <SkeletonCircle size={44} />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <SkeletonLine w="45%" h={14} />
          <SkeletonLine w="72%" h={10} />
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <SkeletonLine w={90} h={10} />
            <Skeleton height={38} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-ink/10 pt-3">
        <SkeletonLine w="40%" h={10} />
        <span className="ml-auto"><SkeletonButton w={130} /></span>
      </div>
    </div>
  );
}
