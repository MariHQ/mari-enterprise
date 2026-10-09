import { useState } from "react";
import { Plus, CheckCircle2, Pencil } from "lucide-react";
import { Alert } from "../feedback/Alert";
import {
  ConnectorWizard as ConnectorWizardUI,
  type WizardProvider,
  type ConnectTestResult,
} from "../forms/ConnectorWizard";
import { type SyncSource } from "../feedback/SyncPanel";
import { Button } from "../actions/Button";
import { why } from "../actions/useWrite";
import { SkeletonButton } from "../data-display/Skeleton";
import { SourceMark } from "../icons/marks";

/* SourcesConnectorWizard — the Sources page "Add source" flow: choose a
   provider → enter credentials → watch the first sync. Composes the catalog
   <ConnectorWizard> and feeds it the connector catalog it is handed. Test-connection is advisory and never gates
   Connect; once Connect fires, a live <SyncPanel> step is driven by a simulated
   sync-status. Standalone: opens by default and via a visible trigger. */

/** A provider the wizard can offer, in plain JSON: `key` names the brand
    mark, so nothing here is a React element and the catalog can come straight
    off an API. */
export type WizardProviderSpec = Omit<WizardProvider, "mark">;

function demoTest(_provider: string, _config: Record<string, string>): ConnectTestResult {
  return { ok: true };
}

/** The source a duplicate connect refusal collided with. `sourceId` is the
    library's opaque string id, exactly what `onEditExisting` receives. */
export type ExistingSource = { sourceId: string; name: string };

/** A connect refusal that NAMES the live source it collided with. An adapter
    throws this (or any Error carrying the same `existing` shape) when the
    server answers a duplicate-active connect with `{error, existing}`. The
    message is the server's own prose and reaches the sync step verbatim, as
    every refused connect does; `existing` is what lets the failure offer
    "Edit the existing source" instead of a dead end. */
export class DuplicateSourceError extends Error {
  existing: ExistingSource;
  constructor(message: string, existing: ExistingSource) {
    super(message);
    this.name = "DuplicateSourceError";
    this.existing = existing;
  }
}

/** Duck-typed on purpose: an adapter's own error class, or a bundler's second
    copy of this module, still counts as long as it carries the shape. */
export function duplicateExisting(err: unknown): ExistingSource | null {
  const e = (err as { existing?: { sourceId?: unknown; name?: unknown } } | null)?.existing;
  return e && typeof e.sourceId === "string" && typeof e.name === "string"
    ? { sourceId: e.sourceId, name: e.name }
    : null;
}

/** What the Add-source wizard can DO.
    `connectSource` throws on refusal and the sync step shows that message: a
    connector fails for reasons the user can fix (wrong token, repo not
    visible, workspace already connected), so the wording must survive intact.
    A duplicate-active refusal thrown as `DuplicateSourceError` (or anything
    matching its shape) additionally offers the edit-existing follow-up.
    `testConnection` answers rather than throws, because "not ok" is a normal
    outcome of a test. */
export type ConnectorWizardActions = {
  /** `name` is the optional display name typed on the configure step, absent
      when the user left it blank. */
  connectSource?: (v: { provider: string; config: Record<string, string>; name?: string }) => void | string | Promise<void | string>;
  /** One reading of a started run; the dialog polls it to completion when
      connectSource answered with the new source's id. */
  syncProgress?: (sourceId: string) => Promise<{
    state: "running" | "done" | "failed";
    phase?: string; done?: number; total?: number; error?: string;
  }>;
  testConnection?: (v: { provider: string; config: Record<string, string> }) => Promise<ConnectTestResult>;
};

export type SourcesConnectorWizardProps = {
  /** The connector catalog this workspace can add from. */
  providers: WizardProviderSpec[];
  actions?: ConnectorWizardActions;
  /** Open the wizard on mount so it shows in a static gallery. */
  defaultOpen?: boolean;
  /** Open the wizard preselected to one provider, choose step skipped: the
      card menu's "Add another <Provider>" lands here. Re-fires whenever
      `token` changes, so the same provider can be added twice in a row. */
  preselect?: { provider: string; token: number } | null;
  /** A duplicate connect refusal named the live source it collided with
      (`DuplicateSourceError.existing`): close the wizard and open that
      source's Edit connection dialog. Without it the failure shows only the
      server's message, and no follow-up button is drawn (§2). */
  onEditExisting?: (sourceId: string) => void;
  loading?: boolean;
  className?: string;
};

export function SourcesConnectorWizard({
  providers: providerSpecs, actions, defaultOpen = true, preselect = null, onEditExisting,
  loading = false, className = "",
}: SourcesConnectorWizardProps) {
  /* The brand mark is derived from the provider key, never carried in the
     data: an API returns strings, not React elements. */
  const providers: WizardProvider[] = providerSpecs.map((p) => ({
    ...p, provider: p.key,
  }));
  const [open, setOpen] = useState(defaultOpen);
  const [sync, setSync] = useState<SyncSource | null>(null);
  /* Where the connected source LANDED. Connecting used to end on "Done" with
     no statement of where the source went, so the flow felt like it dropped
     the source on the floor. */
  const [landed, setLanded] = useState<string | null>(null);
  /* The last connect attempt, so "Retry" re-sends the credentials the user
     typed instead of flipping the row back to "Syncing" while nothing runs. */
  const [attempt, setAttempt] = useState<{ provider: string; config: Record<string, string>; name?: string } | null>(null);
  /* The source a duplicate refusal named, for the edit-existing follow-up. */
  const [duplicate, setDuplicate] = useState<ExistingSource | null>(null);
  /* Which provider the DIALOG starts on. Preselect sets it; the plain "Add
     source" trigger clears it, so a later plain open starts at the chooser. */
  const [pre, setPre] = useState<string | null>(null);
  /* Render-time watch, same pattern the connector grid uses for `sources`:
     each new preselect token opens the dialog on that provider's configure
     step, even while the dialog is already open on something else. */
  const [seenPreselect, setSeenPreselect] = useState(preselect);
  if (preselect !== seenPreselect) {
    setSeenPreselect(preselect);
    if (preselect) {
      setPre(preselect.provider);
      setSync(null);
      setDuplicate(null);
      setOpen(true);
    }
  }

  const rowFor = (provider: string, config: Record<string, string>, name?: string) => {
    const p = providers.find((x) => x.key === provider);
    const detail = config.repo || config.channel || config.folder_id || p?.name || "source";
    return { id: provider, name: name || `${p?.name ?? provider} · ${detail}`, provider };
  };

  const finish = ({ provider, config, name }: { provider: string; config: Record<string, string>; name?: string }) => {
    const base = rowFor(provider, config, name);
    setAttempt({ provider, config, name });
    setDuplicate(null);

    if (!actions?.connectSource) {
      // Canvas: no server behind the page, so the step animates locally.
      const running: SyncSource = {
        ...base, state: "syncing", phase: "Embedding", done: 120, total: 460,
        chunkCount: 3120, embeddedCount: 1180,
      };
      setSync(running);
      setLanded(running.name);
      window.setTimeout(() => {
        setSync({
          ...running, state: "done", phase: undefined,
          docCount: 460, chunkCount: 3120, embeddedCount: 3120,
          lastSyncAt: new Date().toISOString(),
        });
      }, 1600);
      return;
    }

    /* Real connect. "Queued" is the honest state while the POST is in flight.
       When the server answers with the new source's id and the page can poll
       (`syncProgress`), the dialog follows the run to its end; otherwise it
       stays on "Syncing" with no counts, which held the FIRST phase label
       forever and read as a hang however fast the server finished. */
    setSync({ ...base, state: "queued" });
    setLanded(null);
    void (async () => {
      try {
        const sourceId = await actions.connectSource!({ provider, config, name });
        setSync({ ...base, state: "syncing", phase: "Listing" });
        setLanded(base.name);
        const poll = actions.syncProgress;
        if (typeof sourceId !== "string" || !poll) return;
        for (let tick = 0; tick < 600; tick++) {
          await new Promise((r) => window.setTimeout(r, 2000));
          let reading;
          try {
            reading = await poll(sourceId);
          } catch {
            continue; // one failed poll is not a failed sync
          }
          if (reading.state === "running") {
            setSync({
              ...base, state: "syncing",
              phase: reading.phase ? reading.phase[0].toUpperCase() + reading.phase.slice(1) : "Listing",
              done: reading.done, total: reading.total,
            });
            continue;
          }
          if (reading.state === "failed") {
            setSync({ ...base, state: "error", error: reading.error || "The first sync failed." });
          } else {
            setSync({
              ...base, state: "done", phase: undefined,
              docCount: reading.done, lastSyncAt: new Date().toISOString(),
            });
          }
          return;
        }
      } catch (err) {
        /* Verbatim, as every refused connect is. When the refusal also names
           the live source it collided with, the failure gains its follow-up
           action below instead of a Retry that could only collide again. */
        setDuplicate(duplicateExisting(err));
        setSync({
          ...base, state: "error",
          error: why(err, "The source could not be connected."),
        });
      }
    })();
  };

  if (loading) {
    return <div className={className} aria-hidden="true"><SkeletonButton w={124} /></div>;
  }

  return (
    /* grow + items-end: the trigger hugs the toolbar's right edge while the
       landed banner below takes the FULL row. The banner used to live inside
       a shrink-wrapped flex item, which dragged the button toward center and
       squeezed the banner to two-thirds of the page. */
    <div className={`min-w-0 grow flex flex-col items-end ${className}`.trim()}>
      <Button variant="primary" onClick={() => { setSync(null); setDuplicate(null); setPre(null); setOpen(true); }}>
        <Plus size={14} /> Add source
      </Button>
      {landed && !open && (
        <div className="mt-3 w-full text-left">
          {/* The copy used to send people to "the Connectors tab", a surface
              removed releases ago, via an Open Connectors button that only
              dismissed. The card is already on this page; say so. */}
          <Alert tone="info" title="Source connected" onDismiss={() => setLanded(null)}>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-moss" />
              {landed} is connected. Its card is below, and its first sync keeps running there.
            </span>
          </Alert>
        </div>
      )}
      <ConnectorWizardUI
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) { setSync(null); setDuplicate(null); } }}
        providers={providers}
        initialProvider={pre}
        title="Connect a source"
        onTest={actions?.testConnection
          ? (provider, config) => actions.testConnection!({ provider, config })
          : demoTest}
        onFinish={finish}
        syncStatus={sync}
        /* A duplicate refusal cannot be retried into success: re-sending the
           same connect collides with the same source. The follow-up below
           replaces Retry, so the failure still has exactly one way forward. */
        onRetrySync={duplicate ? undefined : () => {
          if (attempt) { finish(attempt); return; }
          setSync((s) => (s ? { ...s, state: "syncing" } : s));
        }}
        syncExtra={duplicate && onEditExisting ? (
          <div className="mt-3">
            <Button onClick={() => {
              setOpen(false);
              setSync(null);
              const id = duplicate.sourceId;
              setDuplicate(null);
              onEditExisting(id);
            }}>
              <Pencil size={13} /> Edit the existing source
            </Button>
          </div>
        ) : undefined}
      />
    </div>
  );
}
