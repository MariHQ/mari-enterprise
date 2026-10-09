import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clock, Plug } from "lucide-react";
import { EmptyState } from "../data-display/EmptyState";
import { ConnectorCard as ConnectorCardUI, type ConnectorHealth } from "../data-display/ConnectorCard";
import { Spinner } from "../data-display/Spinner";
import { SkeletonLine, SkeletonCircle, SkeletonChip, SkeletonButton } from "../data-display/Skeleton";
import { Button } from "../actions/Button";
import { useWrite, why } from "../actions/useWrite";
import { Dialog } from "../layout/Dialog";
import { FormField } from "../forms/FormField";
import { Input } from "../forms/Input";
import { Textarea } from "../forms/Textarea";
import { WriteError } from "../feedback/WriteError";
import type { ConnectorField } from "../forms/ConnectorWizard";
import type { WizardProviderSpec } from "./SourcesConnectorWizard";
import { SourceMark } from "../icons/marks";
import { Truncate } from "../data-display/Truncate";
import { fmtDateTime } from "../tokens/format";

/* SourcesConnectorCard — the Sources page "Connectors" grid: one pulse card per
   connected source. Composes the catalog <ConnectorCard> and reproduces the
   three-tier honesty model from pages/sources/ConnectorCard.tsx:

     • live      — real-time phase/counts (github + connector-framework sources)
     • legacy    — renders only what the server seeded; no fabricated last-sync
     • actionless — a live-kind source with no id yet → "sync status unavailable"

   Every sync line is rendered from the source's own state, never invented.
   Pure presenter: sources arrive as a required prop; busy/running/paused is
   local state, and nothing hits the network. */

/* Exported: an adapter mapping an API response onto `Source` needs to name
   these, and reaching them through `Source["tier"]` is a workaround for them
   being private, not a preference. */
export type Tier = "live" | "legacy" | "actionless";
export type SyncState = "healthy" | "running" | "failed" | "paused";

const PHASE_LABEL: Record<string, string> = {
  listing: "Listing", fetching: "Fetching", chunking: "Chunking",
  embedding: "Embedding", indexing: "Indexing",
};

export type Source = {
  id: string;
  provider: string;
  name: string;
  tier: Tier;
  state: SyncState;
  /** Live phase while running. */
  phase?: keyof typeof PHASE_LABEL;
  done?: number;
  total?: number;
  docCount?: number;
  chunkCount?: number;
  embeddedCount?: number;
  /** Legacy "N documents" count when live counts aren't available. */
  docsCount?: number;
  lastSyncAt?: string | null;
  lastError?: string;
  bars?: number[];
  /** Minutes between automatic syncs; `null` is "manual only".
   *
   *  `undefined` means the server did not report a schedule for this source,
   *  and the schedule control is then not drawn at all: a select showing
   *  "Every hour" over an unknown value would be inventing the answer. */
  syncIntervalMinutes?: number | null;
  /** Stored connector settings, as the API is willing to show them: secret
   *  values arrive masked or not at all. The edit dialog prefills non-secret
   *  fields from here; omit it and every field simply starts empty. */
  config?: Record<string, string>;
};

const HEALTH: Record<SyncState, ConnectorHealth> = {
  healthy: "Healthy", running: "Syncing", failed: "Error", paused: "Paused",
};

/* Every card carries the same three lines — counts, sync, activity — because
   siblings in a row keep equal heights (§15) and a card that skips a line is
   padded to its neighbour's height with nothing in it: "Notion · Product wiki"
   said "620 documents" and then held 90px of blank. A line the server did not
   report says so; none of them invents a figure. */
function counts(s: Source): ReactNode {
  if (s.docCount != null) {
    return `${s.docCount.toLocaleString()} documents · ${(s.chunkCount ?? 0).toLocaleString()} chunks · ${(s.embeddedCount ?? 0).toLocaleString()} embedded`;
  }
  if (s.docsCount != null) return `${s.docsCount.toLocaleString()} documents`;
  return "Document count not reported";
}

/** What a connected-source card can DO. Every handler may throw; the card
    shows the server's message on the card that failed, so a refused write is
    as visible as a refused read. Omit them and the card keeps the local echo
    below, which is what the design canvas renders (CONVENTIONS.md §2). */
export type SourceCardActions = {
  syncNow?: (s: Source) => void | Promise<void>;
  fullResync?: (s: Source) => void | Promise<void>;
  /** Merge changed settings into a source's stored config: only the keys the
      user actually edited are passed, so untouched secrets stay stored. The
      handler also starts the full resync that makes the change take effect. */
  updateConfig?: (s: Source, config: Record<string, string>) => void | Promise<void>;
  /** Destructive: goes through <ConfirmButton> inside the card. */
  disconnect?: (s: Source) => void | Promise<void>;
  /** Destructive for real: deletes the source and its indexed documents.
      Goes through the remove dialog's confirm, and on success the row leaves
      the grid — there is nothing left to draw. Without this handler the
      Remove action is simply not drawn (§2). */
  removeSource?: (s: Source, deleteDocuments: boolean) => void | Promise<void>;
  /** Add files to the upload source. Drawn only on the card whose provider is
      "upload" (§2): every other source gets its documents from its connector. */
  uploadFiles?: (files: File[]) => void | Promise<void>;
  /** One reading of a started run; the card polls it to completion. */
  syncProgress?: (sourceId: string) => Promise<{
    state: "running" | "done" | "failed";
    phase?: string; done?: number; total?: number; error?: string;
  }>;
};

export type SourcesConnectorCardProps = {
  /** Override the baked-in demo sources. */
  sources: Source[];
  actions?: SourceCardActions;
  /** The connector catalog, for the edit-connection dialog's field
      definitions. Without it, or without `actions.updateConfig`, the edit
      action is simply not drawn (§2: no control without a behaviour). */
  catalog?: WizardProviderSpec[];
  /** "Add another <Provider>" on a card's menu: receives the CATALOG key to
      preselect in the Add-source wizard, which the parent owns. Drawn only
      with this handler and a catalog entry that names the provider (§2). */
  onAddAnother?: (providerKey: string) => void;
  /** Ask the grid to open one source's Edit connection dialog: the wizard's
      "Edit the existing source" on a duplicate refusal lands here. Re-fires
      whenever `token` changes. With no `updateConfig` handler or no catalog
      fields for the provider the dialog cannot be drawn, and the request is
      dropped rather than half-honoured. */
  editRequest?: { sourceId: string; token: number } | null;
  loading?: boolean;
  className?: string;
};

/* ── Edit connection ───────────────────────────────────────────────────────
   The fix for a wrong config value (a bad Confluence space key, a rotated
   token) used to be disconnect-and-reconnect. This dialog reuses the wizard's
   field definitions for the provider, prefills what the API is willing to
   show, and saves ONLY the fields the user changed: the server merges them
   into the stored config, so an untouched secret stays exactly as stored. */

const KEEP_BLANK = "Leave blank to keep the current value.";

function EditConnectionDialog({ source, spec, onSave, onSaved, onClose }: {
  source: Source;
  spec: WizardProviderSpec;
  onSave: (config: Record<string, string>) => void | Promise<void>;
  /** Fired after the server accepted the save, with the changed NON-secret
      fields, so the card can echo them. Secrets never live in page state. */
  onSaved: (shown: Record<string, string>) => void;
  onClose: () => void;
}) {
  /* Prefill only what the API actually reported. Secret values never arrive
     in the clear (the server masks them), so a secret field starts empty and
     blank means "keep what is stored". A masked value is not a value either,
     whatever field it sits in. */
  const stored = (f: ConnectorField): string => {
    if (f.secret) return "";
    const v = source.config?.[f.key];
    if (v == null || String(v).includes("•")) return "";
    return String(v);
  };
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(spec.fields.map((f) => [f.key, stored(f)])));
  const write = useWrite();

  /* Only what the user changed or filled travels: the server merges keys into
     the stored config, so sending an untouched field would be restating it and
     sending an untouched secret would overwrite it with nothing. */
  const changed = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const f of spec.fields) {
      const v = (values[f.key] ?? "").trim();
      if (f.secret) { if (v) out[f.key] = v; continue; }
      if (v !== stored(f)) out[f.key] = v;
    }
    return out;
  };
  const dirty = Object.keys(changed()).length > 0;

  const save = async () => {
    const cfg = changed();
    const ok = await write.run(() => onSave(cfg));
    if (!ok) return;
    const secret = new Set(spec.fields.filter((f) => f.secret).map((f) => f.key));
    onSaved(Object.fromEntries(Object.entries(cfg).filter(([k]) => !secret.has(k))));
  };

  const hintFor = (f: ConnectorField): string | undefined =>
    f.secret ? (f.help ? `${f.help} ${KEEP_BLANK}` : KEEP_BLANK) : f.help;

  /* §2: primary bottom LEFT, secondary to its right. */
  const footer = (
    <div className="flex flex-1 items-center gap-2">
      <Button variant="primary" disabled={write.busy || !dirty} onClick={() => void save()}>
        {write.busy ? <><Spinner size="sm" /> Saving…</> : <>Save &amp; resync</>}
      </Button>
      <Button disabled={write.busy} onClick={onClose}>Cancel</Button>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} title="Edit connection" description={source.name} width={520} footer={footer}>
      <p className="text-[13px] text-ink/70">
        Correct the settings for {spec.name}. Only the fields you change are saved.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {spec.fields.map((f) => (
          <FormField key={f.key} label={f.label} hint={hintFor(f)}>
            {f.multiline ? (
              <Textarea
                rows={5}
                className="font-term"
                autoComplete="off"
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            ) : (
              <Input
                className="w-full"
                type={f.secret ? "password" : "text"}
                autoComplete={f.secret ? "new-password" : "off"}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            )}
          </FormField>
        ))}
      </div>
      {/* XA-02: a refused save accuses no one field (the server rejects the
          set), so it is a WriteError carrying the server's own words. */}
      {write.failed && <div className="mt-3"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>}
      <p className="mt-3 text-[12px] text-ink/65">Saving starts a full resync so the change takes effect.</p>
    </Dialog>
  );
}

/* ── Remove source ─────────────────────────────────────────────────────────
   Disconnect only pauses. This is the real delete for a source that should
   never have existed — a misconfigured connector holding 0 documents had no
   way out at all. The menu entry only opens this dialog; the deliberate
   destructive step lives on the danger button here (§2), and a refusal (the
   server declines while a sync is running) lands in the dialog verbatim. */

function RemoveSourceDialog({ source, onRemove, onRemoved, onClose }: {
  source: Source;
  onRemove: (deleteDocuments: boolean) => void | Promise<void>;
  /** Fired after the server accepted the delete: the row leaves the grid. */
  onRemoved: () => void;
  onClose: () => void;
}) {
  const write = useWrite();
  const [deleteDocuments, setDeleteDocuments] = useState(true);

  const remove = async () => {
    const ok = await write.run(() => onRemove(deleteDocuments));
    if (ok) onRemoved();
  };

  /* §2: primary bottom LEFT, secondary to its right. */
  const footer = (
    <div className="flex flex-1 items-center gap-2">
      <Button variant="danger" disabled={write.busy} onClick={() => void remove()}>
        {write.busy ? <><Spinner size="sm" /> Removing…</> : <>Remove source</>}
      </Button>
      <Button disabled={write.busy} onClick={onClose}>Cancel</Button>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} title="Remove source" description={source.name} width={440} footer={footer}>
      <p className="text-[13px] text-ink/70">Choose what happens to documents already indexed from this source.</p>
      <fieldset className="mt-4 space-y-2" disabled={write.busy}>
        <legend className="sr-only">Indexed document handling</legend>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[4px] border border-ink/15 p-3 text-[13px]">
          <input type="radio" name="document-handling" className="mt-0.5" checked={deleteDocuments}
            onChange={() => setDeleteDocuments(true)} />
          <span><strong className="block font-semibold text-ink">Delete indexed documents</strong>
            <span className="text-ink/65">Remove the connector’s documents and derived chunks. This cannot be undone.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[4px] border border-ink/15 p-3 text-[13px]">
          <input type="radio" name="document-handling" className="mt-0.5" checked={!deleteDocuments}
            onChange={() => setDeleteDocuments(false)} />
          <span><strong className="block font-semibold text-ink">Keep indexed documents</strong>
            <span className="text-ink/65">Keep a disconnected snapshot in Knowledge; it will no longer sync.</span></span>
        </label>
      </fieldset>
      {write.failed && <div className="mt-3"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>}
    </Dialog>
  );
}

export function SourcesConnectorCard({
  sources, actions, catalog, onAddAnother, editRequest = null, loading = false, className = "",
}: SourcesConnectorCardProps) {
  const [items, setItems] = useState<Source[]>(sources);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  /* Which source's edit-connection dialog is open. The id, not the row: the
     grid re-renders under a running sync and the dialog must follow the row's
     current truth, not the snapshot it opened over. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /* Which source's remove confirm is open. Same id-not-row rule as above. */
  const [removingId, setRemovingId] = useState<string | null>(null);
  /* `sources` is the server's truth and it changes under us: the parent
     re-reads after every write. Without this the grid froze on the rows it
     mounted with, so a sync that really did add 400 documents looked inert. */
  const [seen, setSeen] = useState(sources);
  if (seen !== sources) { setSeen(sources); setItems(sources); }
  /* The wizard's "Edit the existing source" arrives as a prop, because the
     dialog's open/closed state lives here. Same render-time watch as above:
     each new token opens the named source's dialog. */
  const [seenEdit, setSeenEdit] = useState(editRequest);
  if (editRequest !== seenEdit) {
    setSeenEdit(editRequest);
    if (editRequest) setEditingId(editRequest.sourceId);
  }

  if (loading) {
    return (
      <div className={`grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 ${className}`.trim()} aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-md border border-ink/12 bg-paper p-4">
            <div className="flex items-center gap-2.5">
              <SkeletonCircle size={26} />
              <SkeletonLine w="45%" h={12} />
              <span className="ml-auto"><SkeletonChip w={56} /></span>
            </div>
            <SkeletonLine w="82%" h={9} />
            <SkeletonLine w="55%" h={9} />
            <div className="flex gap-2 pt-1"><SkeletonButton w={76} /><SkeletonButton w={76} /></div>
          </div>
        ))}
      </div>
    );
  }

  const patch = (id: string, next: Partial<Source>) =>
    setItems((xs) => xs.map((s) => (s.id === id ? { ...s, ...next } : s)));

  /* One path for "start a sync on this source".
     With a handler: the card goes busy, the server is asked, and it STAYS on
     "running" afterwards — the sync is long, it continues on the server, and
     the parent's sync-status polling owns the progress from here. A refusal
     lands on the card verbatim.
     Without a handler (the canvas): the old local echo, so the control is
     still visibly alive with no server behind it. */
  /* Polling stops when the card leaves the page — a poll that outlives its
     component patches state nobody renders. */
  const alive = useRef(true);
  useEffect(() => {
    // Set on the way IN as well: StrictMode runs mount/cleanup/mount, and a
    // cleanup-only guard stays false forever after the rehearsal unmount.
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /** Follow a started run to its end. Without this the card held its first
      optimistic phase — "Listing…" — until a reload, however quickly the
      server actually finished. */
  const follow = async (id: string) => {
    const poll = actions?.syncProgress;
    if (!poll) return;
    for (let tick = 0; tick < 600 && alive.current; tick++) {
      await new Promise((r) => window.setTimeout(r, 2000));
      if (!alive.current) return;
      let reading;
      try {
        reading = await poll(id);
      } catch {
        continue; // one failed poll is not a failed sync
      }
      if (!alive.current) return;
      if (reading.state === "running") {
        patch(id, { state: "running", phase: reading.phase || "listing", done: reading.done, total: reading.total });
        continue;
      }
      if (reading.state === "failed") {
        patch(id, { state: "failed", phase: undefined, lastError: reading.error || "The sync failed." });
      } else {
        patch(id, {
          state: "healthy", phase: undefined, lastSyncAt: new Date().toISOString(),
          ...(reading.done ? { docsCount: reading.done } : {}),
        });
      }
      return;
    }
  };

  const kick = (s: Source, handler?: (s: Source) => void | Promise<void>) => {
    const id = s.id;
    setFailed((f) => ({ ...f, [id]: "" }));
    if (!handler) {
      setBusy((b) => ({ ...b, [id]: true }));
      patch(id, { state: "running", phase: "fetching", done: 0, total: 200 });
      window.setTimeout(() => {
        setBusy((b) => ({ ...b, [id]: false }));
        patch(id, { state: "healthy", phase: undefined, lastSyncAt: new Date().toISOString() });
      }, 1400);
      return;
    }
    setBusy((b) => ({ ...b, [id]: true }));
    void (async () => {
      try {
        await handler(s);
        patch(id, { state: "running", phase: "listing" });
        void follow(id);
      } catch (err) {
        setFailed((f) => ({ ...f, [id]: why(err, "Sync could not be started.") }));
      } finally {
        setBusy((b) => ({ ...b, [id]: false }));
      }
    })();
  };

  const disconnect = (s: Source) => {
    const id = s.id;
    setFailed((f) => ({ ...f, [id]: "" }));
    if (!actions?.disconnect) { patch(id, { state: "paused" }); return; }
    setBusy((b) => ({ ...b, [id]: true }));
    void (async () => {
      try {
        await actions.disconnect!(s);
        patch(id, { state: "paused" });
      } catch (err) {
        setFailed((f) => ({ ...f, [id]: why(err, "Pause failed.") }));
      } finally {
        setBusy((b) => ({ ...b, [id]: false }));
      }
    })();
  };

  /* The wizard's field definitions for this source's provider. A provider
     string can carry a qualifier ("confluence:OPS"), so the bare key is the
     fallback match. No fields means nothing to edit, so no edit action. */
  const specFor = (s: Source): WizardProviderSpec | null => {
    if (!catalog) return null;
    const p = catalog.find((x) => x.key === s.provider)
      ?? catalog.find((x) => x.key === s.provider.split(":")[0]);
    return p && p.fields.length > 0 ? p : null;
  };

  /* The catalog entry "Add another" preselects: fields or none, because adding
     an instance needs a wizard tile and a name, not editable fields. Uploads
     stay out. The Sources page shapes upload onto its own button and out of
     the wizard, so a preselect could land on a tile that is not there. */
  const addTargetFor = (s: Source): WizardProviderSpec | null => {
    if (!catalog) return null;
    const p = catalog.find((x) => x.key === s.provider)
      ?? catalog.find((x) => x.key === s.provider.split(":")[0]);
    return p && p.key !== "upload" ? p : null;
  };

  const syncLine = (s: Source, isBusy: boolean): ReactNode => {
    if (s.state === "paused") {
      return (
        <Button
          variant="link"
          className="text-[12.5px]"
          disabled={isBusy}
          onClick={() => kick(s, actions?.syncNow)}
        >
          Paused. Resume syncing
        </Button>
      );
    }
    if (isBusy && s.state !== "running") return <><Spinner size="sm" /> Working…</>;
    if (s.tier === "actionless") {
      return s.lastSyncAt
        ? <>Last sync: {fmtDateTime(s.lastSyncAt)}</>
        : <span className="text-ink/65">Sync status unavailable</span>;
    }
    /* A legacy source with no last-sync time in the seed is the SAME missing
       fact as an actionless one, and it used to render as nothing at all while
       Google Drive said "Sync status unavailable" two cards away — the reader
       had to guess whether the blank meant never or unknown. Still no
       fabricated time (the old reason for the blank): the card says the server
       did not report one. */
    if (s.tier === "legacy" && !s.lastSyncAt && s.state !== "running" && s.state !== "failed") {
      return <span className="text-ink/65">Sync status unavailable</span>;
    }
    if (s.state === "running") {
      const tail = s.total && s.total > 0 ? ` · ${s.done ?? 0}/${s.total} items` : "…";
      return <><Spinner size="sm" /> {PHASE_LABEL[s.phase ?? "listing"]}{tail}</>;
    }
    if (s.state === "failed") {
      return (
        <Truncate lines={2} className="text-espelette" title={`Sync failed. ${s.lastError ?? "No details were reported."}`}>
          Sync failed. {s.lastError ?? "No details were reported."}
        </Truncate>
      );
    }
    return s.lastSyncAt ? <>Last sync: {fmtDateTime(s.lastSyncAt)}</> : <>Never synced</>;
  };

  if (items.length === 0) {
    return (
      <div className={`rounded-md border border-ink/12 bg-paper ${className}`.trim()}>
        <EmptyState icon={<Plug size={24} />} title="No sources connected">
          Add a source to start syncing documents into your knowledge library.
        </EmptyState>
      </div>
    );
  }

  /* A wrapping gallery, not a fixed column count (CONVENTIONS.md §11).
     `lg:grid-cols-3` held three columns no matter how narrow the page column
     got, which squeezed each card to 124px and pushed its name and health chip
     out through the border. `flex-1 basis-[260px]` drops to two columns, then
     one, never renders a card under 260px, and — unlike the auto-fill grid that
     replaced it — lets a short last row stretch across the full width instead
     of leaving a dead bottom-right corner. Cards in a row share a height (§15),
     which is why each one fills all three of its content slots. */
  return (
    <div className={`flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[260px] ${className}`.trim()}>
      {items.map((s) => {
        const isBusy = Boolean(busy[s.id]);
        const running = s.state === "running";
        const paused = s.state === "paused";
        const isConnectorKind = s.tier === "live" || s.tier === "actionless";
        const addTarget = onAddAnother ? addTargetFor(s) : null;
        return (
          <ConnectorCardUI
            key={s.id}
            name={s.name}
            mark={<SourceMark provider={s.provider} size={26} />}
            health={HEALTH[s.state]}
            counts={counts(s)}
            sync={syncLine(s, isBusy)}
            bars={s.bars}
            barsNote="Recent activity not reported"
            busy={isBusy}
            running={running}
            paused={paused}
            /* Every card carries the SAME action menu. Google Drive used to
               render no kebab at all because its tier has no sync id, which
               made one square in the grid look broken. It now offers the same
               menu; the actions it cannot honour are simply disabled. */
            canResync={isConnectorKind}
            onSyncNow={() => kick(s, actions?.syncNow)}
            onFullResync={isConnectorKind ? () => kick(s, actions?.fullResync ?? actions?.syncNow) : undefined}
            /* Drawn only where it can act: a connector-kind source, a real
               updateConfig handler behind it, and a catalog entry that names
               fields to edit (§2). */
            onEditConnection={isConnectorKind && actions?.updateConfig && specFor(s) ? () => setEditingId(s.id) : undefined}
            /* A second instance of the same system, any tier: drawn only with
               a handler and a catalog entry to preselect (§2). */
            onAddAnother={addTarget ? () => onAddAnother!(addTarget.key) : undefined}
            providerName={addTarget?.name}
            /* With a real disconnect wired, pausing IS disconnecting, and a
               destructive action may not fire from a first menu click (§2):
               it moves to the ConfirmButton on the card. */
            onPause={!paused && !actions?.disconnect ? () => patch(s.id, { state: "paused" }) : undefined}
            onResume={paused ? () => kick(s, actions?.syncNow) : undefined}
            /* Drawn only with a real handler behind it (§2): the menu entry
               opens the confirm dialog, which owns the destructive step. */
            onRemove={isConnectorKind && actions?.removeSource ? () => setRemovingId(s.id) : undefined}
            onDisconnect={actions?.disconnect && !paused ? () => disconnect(s) : undefined}
            onUpload={s.provider === "upload" && actions?.uploadFiles
              ? (files) => actions.uploadFiles!(files) : undefined}
            actionError={failed[s.id] || null}
          />
        );
      })}
      {/* keep the Clock import referenced for the paused-tier legend below */}
      <p className="mt-1 flex w-full !flex-none items-center gap-1.5 font-term text-[11px] text-ink/65">
        <Clock size={12} /> Live sources poll while a sync runs; legacy sources show only what the server reports.
      </p>
      {(() => {
        const editing = editingId ? items.find((s) => s.id === editingId) ?? null : null;
        const spec = editing ? specFor(editing) : null;
        if (!editing || !spec || !actions?.updateConfig) return null;
        return (
          <EditConnectionDialog
            key={editing.id}
            source={editing}
            spec={spec}
            onSave={(cfg) => actions.updateConfig!(editing, cfg)}
            onSaved={(shown) => {
              /* The handler saved AND started the full resync, so the card
                 takes the same aftermath kick() does: mark the row running
                 and follow the run to its end. The non-secret changes are
                 echoed so the next open prefills the corrected values. */
              setEditingId(null);
              patch(editing.id, {
                config: { ...(editing.config ?? {}), ...shown },
                state: "running", phase: "listing",
              });
              void follow(editing.id);
            }}
            onClose={() => setEditingId(null)}
          />
        );
      })()}
      {(() => {
        const removing = removingId ? items.find((s) => s.id === removingId) ?? null : null;
        if (!removing || !actions?.removeSource) return null;
        return (
          <RemoveSourceDialog
            key={removing.id}
            source={removing}
            onRemove={(deleteDocuments) => actions.removeSource!(removing, deleteDocuments)}
            onRemoved={() => {
              /* The server deleted the row, so the grid stops drawing it —
                 unlike disconnect, there is no paused state to fall back to.
                 The parent's re-read then confirms what is already shown. */
              setRemovingId(null);
              setItems((xs) => xs.filter((x) => x.id !== removing.id));
            }}
            onClose={() => setRemovingId(null)}
          />
        );
      })()}
    </div>
  );
}
