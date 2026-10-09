import { useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Play, XCircle, Clock, RefreshCw, Sparkles, MoreVertical, Pencil, Plus, Trash2, Unplug, UploadCloud } from "lucide-react";
import { card } from "../tokens/card";
import { Chip } from "./Chip";
import { Sparkline } from "./Sparkline";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Menu, MenuItem } from "../navigation/Menu";
import { WriteError } from "../feedback/WriteError";
import { Skeleton, SkeletonLine, SkeletonCircle, SkeletonChip } from "./Skeleton";

/* ConnectorCard — one connected-source pulse card: provider mark, name, a
   health chip, document counts, a live sync line, and a mini activity
   sparkline. Ported from pages/sources/ConnectorCard.tsx; the sync-status
   query + gql mutations are lifted out — state comes in as props, and each
   action is a callback. */

export type ConnectorHealth = "Unknown" | "Healthy" | "Syncing" | "Error" | "Paused" | "Backfilling";

const HEALTH: Record<ConnectorHealth, { tone: string; icon: ReactNode }> = {
  Unknown: { tone: "neutral", icon: <Clock size={12} /> },
  Healthy: { tone: "ok", icon: <CheckCircle2 size={12} /> },
  Syncing: { tone: "attention", icon: <Play size={12} /> },
  Backfilling: { tone: "attention", icon: <Play size={12} /> },
  Error: { tone: "blocked", icon: <XCircle size={12} /> },
  Paused: { tone: "neutral", icon: <Clock size={12} /> },
};

const SPARK_TONE: Record<ConnectorHealth, "ok" | "attention" | "blocked" | "neutral"> = {
  Unknown: "neutral", Healthy: "ok", Syncing: "attention", Backfilling: "attention", Error: "blocked", Paused: "neutral",
};

export type ConnectorCardProps = {
  name: string;
  /** Provider logo/mark (e.g. an <img> or brand glyph). */
  mark?: ReactNode;
  health?: ConnectorHealth;
  /** Document/chunk counts line. */
  counts?: ReactNode;
  /** Sync-status line — "Last sync: …", a running phase, or an error. */
  sync?: ReactNode;
  /** Recent activity, rendered as a sparkline. */
  bars?: number[];
  /** What to say in the activity slot when there is no series to draw. Grids of
      these cards keep equal heights (§15), so a card with no sparkline is
      otherwise padded to its neighbour's height with nothing in it. Omit it
      where the card stands alone and the slot can simply close up. */
  barsNote?: ReactNode;
  busy?: boolean;
  running?: boolean;
  paused?: boolean;
  /** Show the "Full resync" action (connector-framework / GitHub sources). */
  canResync?: boolean;
  onSyncNow?: () => void;
  onFullResync?: () => void;
  /** Open the edit-connection dialog: correct a stored config value (a wrong
      space key, a rotated token) without disconnecting the source. */
  onEditConnection?: () => void;
  /** Start connecting a SECOND instance of this card's provider ("Add another
      Confluence"): opens the Add-source wizard preselected to it. Drawn only
      when provided (§2). */
  onAddAnother?: () => void;
  /** The provider's display name, for the Add-another item's label. Falls
      back to the card name, so pass it whenever the card name carries an
      instance detail ("Confluence · Ops"). */
  providerName?: string;
  onPause?: () => void;
  onResume?: () => void;
  /** Open the remove-source confirm. A menu entry is allowed for this
      destructive action because selecting it only opens the dialog that owns
      the deliberate second step (§2) — nothing is deleted on the click. */
  onRemove?: () => void;
  /** Destructive: drops the connection. Rendered as a two-step
      <ConfirmButton> at the card's bottom left (CONVENTIONS.md §2), not as a
      menu item, because a kebab entry fires on first click. */
  onDisconnect?: () => void;
  /** Add files to this source — the upload source's own primary action, so
      it lives on the card footer beside Pause, at Pause's size, not in a
      toolbar two scrolls away from the card it feeds. */
  onUpload?: (files: File[]) => void | Promise<void>;
  /** A write this card attempted that the server refused, verbatim. */
  actionError?: string | null;
  /** Render a content-shaped skeleton placeholder instead of the card. */
  loading?: boolean;
  className?: string;
};

export function ConnectorCard({
  name, mark, health = "Healthy", counts, sync, bars, barsNote,
  busy = false, running = false, paused = false, canResync = false,
  onSyncNow, onFullResync, onEditConnection, onAddAnother, providerName,
  onPause, onResume, onRemove, onDisconnect, onUpload, actionError = null,
  loading = false, className = "",
}: ConnectorCardProps) {
  /* WHICH connector this card is for is the caller's own choice — the name
     and the provider mark are in hand before a single sync fact comes back,
     and hiding them behind a grey circle turned a page of connectors into a
     page of identical grey cards. The HEALTH is the thing being fetched, so
     the chip is a bar of the chip's exact size; likewise the counts, the sync
     line and the sparkline. Same p-4 box, same gaps, so nothing shifts. */
  if (loading) {
    return (
      <div className={`${card} p-4 ${className}`.trim()} aria-busy="true">
        <div className="flex items-center gap-3">
          {mark
            ? <span className="grid place-items-center shrink-0 w-[26px] h-[26px]" aria-hidden="true">{mark}</span>
            : <SkeletonCircle size={26} className="shrink-0" />}
          <span className="min-w-0 flex-1 flex flex-col gap-1">
            <b className="text-[14px] font-semibold text-ink truncate">{name}</b>
            <SkeletonChip w={72} className="self-start" />
          </span>
        </div>
        <SkeletonLine w="42%" h={11.5} className="mt-3" />
        <SkeletonLine w="60%" h={12.5} className="mt-1.5" />
        <Skeleton width={150} height={20} className="mt-3" />
      </div>
    );
  }
  const h = HEALTH[health];
  const hasMenu = Boolean(onSyncNow || onFullResync || onEditConnection || onAddAnother || onPause || onResume || onRemove);
  return (
    <div className={`${card} p-4 ${paused ? "opacity-70" : ""} ${className}`.trim()}>
      <div className="flex items-center gap-3">
        {mark && <span className="grid place-items-center shrink-0 w-[26px] h-[26px]">{mark}</span>}
        <span className="min-w-0 flex-1 flex flex-col gap-1">
          <b className="text-[14px] font-semibold text-ink truncate">{name}</b>
          <Chip label={health} tone={h.tone} icon={h.icon} className="self-start" />
        </span>
        {hasMenu && (
          <Menu trigger={<Button icon aria-label={`Actions for ${name}`}><MoreVertical size={15} /></Button>}>
            {onSyncNow && (
              <MenuItem icon={<RefreshCw size={13} />} disabled={busy || running || paused} onSelect={onSyncNow}>
                {running ? "Sync running…" : "Sync now"}
              </MenuItem>
            )}
            {canResync && onFullResync && (
              <MenuItem icon={<Sparkles size={13} />} disabled={busy || running} onSelect={onFullResync}>Full resync</MenuItem>
            )}
            {onEditConnection && (
              <MenuItem icon={<Pencil size={13} />} disabled={busy} onSelect={onEditConnection}>Edit connection</MenuItem>
            )}
            {/* Constructive, so no confirm: selecting it only opens the
                Add-source wizard on this provider's configure step. */}
            {onAddAnother && (
              <MenuItem icon={<Plus size={13} />} disabled={busy} onSelect={onAddAnother}>
                Add another {providerName ?? name}
              </MenuItem>
            )}
            {paused
              ? onResume && <MenuItem icon={<Play size={13} />} disabled={busy} onSelect={onResume}>Resume</MenuItem>
              : onPause && <MenuItem icon={<Clock size={13} />} disabled={busy} onSelect={onPause}>Pause</MenuItem>}
            {onRemove && (
              <MenuItem danger icon={<Trash2 size={13} />} disabled={busy || running} onSelect={onRemove}>Remove…</MenuItem>
            )}
          </Menu>
        )}
      </div>
      {/* text-ink/65 is the meta floor (§6); break-words keeps a long count or
          error line inside the card instead of past its right edge. */}
      {counts && <div className="mt-3 font-term text-[11.5px] text-ink/65 break-words">{counts}</div>}
      {sync && <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink/70 break-words">{sync}</div>}
      {bars && bars.length > 1 ? (
        <div className="mt-3">
          <Sparkline values={bars} width={150} height={20} tone={SPARK_TONE[health]} />
        </div>
      ) : barsNote ? (
        /* The sparkline's own slot, at the sparkline's height, saying why it is
           not drawn. Never a flat or invented series. */
        <div className="mt-3 font-term text-[11px] leading-[20px] text-ink/65">{barsNote}</div>
      ) : null}
      {/* XA-02: a refused sync or disconnect is a failed WRITE, and it was
          rendered here as a bespoke 12px red line while the same event is a
          banner everywhere else. The body is still the server's own words, not
          a generic apology: "bad credentials" and "repository not found" both
          tell the user exactly what to change. */}
      {actionError && <div className="mt-3"><WriteError>{actionError}</WriteError></div>}
      {(onDisconnect || onUpload) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
          {onUpload && <UploadFilesAction busy={busy} onUpload={onUpload} />}
          {onDisconnect && (
            <ConfirmButton compact disabled={busy} confirmLabel="Pause this source?" onConfirm={onDisconnect}>
              <Unplug size={13} /> Pause
            </ConfirmButton>
          )}
        </div>
      )}
    </div>
  );
}

/** The upload source's footer action: a compact button at Pause's size that
    opens the file picker and reports what landed. Self-contained busy/failed
    state, the same way the card's other writes report (XA-02). */
function UploadFilesAction({ busy, onUpload }: {
  busy: boolean;
  onUpload: (files: File[]) => void | Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [added, setAdded] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  const choose = async (files: File[]) => {
    if (files.length === 0) return;
    setWorking(true);
    setFailed(null);
    try {
      await onUpload(files);
      setAdded(files.length);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setWorking(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <input ref={input} type="file" multiple className="sr-only" accept=".md,.mdx,.markdown,.txt"
        aria-label="Choose files to upload"
        onChange={(e) => void choose(Array.from(e.target.files ?? []))} />
      <Button compact disabled={busy || working} onClick={() => input.current?.click()}>
        <UploadCloud size={13} /> {working ? "Uploading…" : "Upload files"}
      </Button>
      {failed && <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>}
      {!failed && added > 0 && (
        <span className="text-[12px] text-moss">{added} file{added === 1 ? "" : "s"} ingested.</span>
      )}
    </span>
  );
}
