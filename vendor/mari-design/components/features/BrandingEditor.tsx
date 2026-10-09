import { useState } from "react";
import type { CSSProperties } from "react";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { WriteError } from "../feedback/WriteError";
import { why } from "../actions/useWrite";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Input } from "../forms/Input";
import { Field } from "../forms/Field";
import { SectionLabel } from "../forms/SectionLabel";
import { Chip } from "../data-display/Chip";
import { Spinner } from "../data-display/Spinner";
import { Skeleton, SkeletonLine, SkeletonCard } from "../data-display/Skeleton";
import { focusRing } from "../tokens/focusRing";
import { useResync } from "../actions/useResync";

/* Branding editor (bring-your-own-branding) ───────────────────────────────
   The proof that tokens ARE the brand: set accent/green/blue/gold colors,
   display + body fonts, and a logo, plus a live preview rendered under the
   draft tokens. Source: web/src/pages/settings/BrandingEditor.tsx. The preview
   is scoped inline and performs no network work. */

export type Branding = {
  accent?: string; accentDeep?: string; accentInk?: string;
  green?: string; blue?: string; gold?: string;
  displayFont?: string; bodyFont?: string; fontUrl?: string;
  logo?: string; logoAlt?: string;
};

const DEFAULTS: Required<Pick<Branding, "accent" | "green" | "blue" | "gold">> = {
  accent: "#B23A1E", green: "#2C6E49", blue: "#1E6FA8", gold: "#A05E1C",
};

function isHexColor(s?: string): s is string { return !!s && /^#[0-9a-fA-F]{6}$/.test(s); }
function darken(hex: string, amt: number): string {
  if (!isHexColor(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function inkFor(hex: string): string {
  if (!isHexColor(hex)) return "#10263B";
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.42 ? "#10263B" : "#F7F4EC";
}

const PALETTE_KEYS: { key: keyof Branding; label: string }[] = [
  { key: "accent", label: "Accent" }, { key: "accentDeep", label: "Accent deep" }, { key: "accentInk", label: "Accent ink" },
  { key: "green", label: "Green" }, { key: "blue", label: "Blue" }, { key: "gold", label: "Gold" },
];

function effectiveColor(d: Branding, key: keyof Branding): string {
  const v = d[key];
  if (isHexColor(v)) return v;
  const acc = isHexColor(d.accent) ? d.accent : DEFAULTS.accent;
  if (key === "accentDeep") return darken(acc, 0.12);
  if (key === "accentInk") return inkFor(acc);
  if (key === "accent") return acc;
  if (key === "green") return DEFAULTS.green;
  if (key === "blue") return DEFAULTS.blue;
  if (key === "gold") return DEFAULTS.gold;
  return "#000000";
}

/** What reading a homepage turned up: the palette, the fonts, and anything
    the harvester could not find. Plain JSON, exactly as an API returns it. */
export type BrandHarvest = {
  title: string;
  themeColor: string;
  /** [hex, occurrences] pairs, most used first. */
  cssColors: [string, number][];
  fonts: string[];
  logo: string | null;
  warnings: string[];
};

/** One tile in the live preview: the branded page this workspace would ship. */
export type BrandPreviewStat = { value: string; label: string };

function ColorField({ label, value, onChange, onAuto, explicit }: { label: string; value: string; onChange: (v: string) => void; onAuto: () => void; explicit: boolean }) {
  return (
    <div className="py-2.5 border-b border-ink/10 last:border-0">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {explicit && <button type="button" onClick={onAuto} className={`font-term text-[10.5px] text-biscay-2 hover:text-ink rounded-[3px] ${focusRing}`}>Auto</button>}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded-[4px] border border-ink/15 bg-transparent p-0.5 cursor-pointer" aria-label={label} />
        <code className="font-term text-[12px] text-ink/70">{value}</code>
      </div>
    </div>
  );
}

/** What the branding editor can DO.

    It had none of this: Save set a local flag and cleared the dirty mark, and
    Import replayed a baked `harvest` after a 700ms fake delay. Everything you
    did here was forgotten on reload, which makes it a colour picker rather
    than a workspace setting.

    Optional as always — with no actions the editor keeps exactly that local
    behaviour, which is what the design canvas renders. */
export type BrandingEditorActions = {
  /** Persist the brand for the whole workspace. */
  save?: (branding: Branding) => void | Promise<void>;
};

export type BrandingEditorProps = {
  branding: Branding;
  /** Result the import flow returns for the URL the user typed. Used when no
      `importFrom` handler is supplied. */
  harvest: BrandHarvest;
  /** Figures the live preview shows off. */
  previewStats: BrandPreviewStat[];
  actions?: BrandingEditorActions;
  loading?: boolean;
  className?: string;
};

export function BrandingEditor({ branding, previewStats, actions, loading = false, className = "" }: BrandingEditorProps) {
  const [draft, setDraft] = useState<Branding>(branding);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* The draft was taken once, at mount, so a brand saved from another tab —
     or the page's own refetch after Save — never reached the fields (C1).
     `dirty` is the guard: adopting mid-edit would throw away the brand the
     reader is in the middle of writing, which is a worse bug than the stale
     one. Identity is safe here: `web/src/data/settings-design.ts` memoises
     `branding` on the raw query answer, which `useQuery` holds in state. */
  useResync(branding, setDraft, { hold: dirty });

  const patch = (p: Branding) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); };
  const clearKey = (key: keyof Branding) => { setDraft((d) => { const next = { ...d }; delete next[key]; return next; }); setDirty(true); };

  const doSave = async () => {
    setFailed(null);
    try {
      await actions?.save?.(draft);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (e) {
      // The brand stays dirty, so the unsaved work is still on screen.
      setFailed(why(e, "That brand could not be saved."));
    }
  };
  const doReset = () => { setDraft({}); setDirty(false); };

  const preview = {
    ["--b-accent"]: effectiveColor(draft, "accent"),
    ["--b-accent-ink"]: effectiveColor(draft, "accentInk"),
    ["--b-green"]: effectiveColor(draft, "green"),
    ["--b-blue"]: effectiveColor(draft, "blue"),
    ["--b-gold"]: effectiveColor(draft, "gold"),
    ...(draft.bodyFont ? { fontFamily: `"${draft.bodyFont}", serif` } : {}),
  } as CSSProperties;

  if (loading) {
    return (
      <div className={`flex flex-col gap-5 ${className}`.trim()} aria-hidden="true">
        <div className="space-y-2.5"><Skeleton width={140} height={20} /><SkeletonLine w={360} h={11} /></div>
        <SkeletonCard lines={1} />
        <div className="rounded-md border border-ink/12 bg-paper p-4">
          <SkeletonLine w="30%" h={12} className="mb-4" />
          <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-ink/10 py-2.5">
                <Skeleton width={32} height={32} rounded="rounded-[4px]" />
                <SkeletonLine w={70} h={10} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3"><Skeleton width={130} height={34} rounded="rounded-[4px]" /><Skeleton width={150} height={34} rounded="rounded-[4px]" /></div>
        </div>
        <SkeletonCard lines={3} media />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`.trim()}>
      <PageHeader title="Branding" description="Tokens are the brand. Re-skin every primitive from one place." />

      {/* 2 — Brand palette */}
      <Card title="Brand palette">
        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-3">
          {PALETTE_KEYS.map((p) => (
            <ColorField key={p.key} label={p.label} value={effectiveColor(draft, p.key)} explicit={isHexColor(draft[p.key])}
              onChange={(v) => patch({ [p.key]: v })} onAuto={() => clearKey(p.key)} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Display font"><Input value={draft.displayFont ?? ""} onChange={(e) => patch({ displayFont: e.target.value })} placeholder="Playfair Display" className="w-full" /></Field>
          <Field label="Body font"><Input value={draft.bodyFont ?? ""} onChange={(e) => patch({ bodyFont: e.target.value })} placeholder="Lora" className="w-full" /></Field>
          <Field label="Font stylesheet URL"><Input type="url" value={draft.fontUrl ?? ""} onChange={(e) => patch({ fontUrl: e.target.value })} placeholder="https://fonts.googleapis.com/…" className="w-full font-term" /></Field>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Logo alt text"><Input value={draft.logoAlt ?? ""} onChange={(e) => patch({ logoAlt: e.target.value })} placeholder="Northwind Analytics" className="w-full" /></Field>
          {/* `w-full min-w-0`: a native file input carries a large intrinsic
              width (the browser sizes it for the button plus a filename), so
              without a floor override it pushed ~48px out through the card at
              a narrow width. The filename ellipsises instead (§12). */}
          <Field label="Logo"><input type="file" accept="image/*" className="w-full min-w-0 text-[12.5px] text-ink/80 file:mr-2 file:rounded-[4px] file:border file:border-ink/20 file:bg-paper file:px-2.5 file:py-1 file:text-[12px] file:text-ink/80" onChange={() => patch({ logo: "demo" })} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!dirty} onClick={() => void doSave()}>Save branding</Button>
          <ConfirmButton confirmLabel="Reset all?" onConfirm={doReset}>Reset to defaults</ConfirmButton>
          {saved && <span className="font-term text-[11.5px] text-moss">✓ Saved</span>}
        </div>
        <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
      </Card>

      {/* 3 — Live preview (scoped, inline-styled by the draft) */}
      <Card title="Live preview" hint="Rendered under your draft tokens">
        <div style={preview} className="rounded-md border border-ink/15 p-4">
          <div className="flex items-center justify-between border-b border-ink/10 pb-3">
            <span className="min-w-0 truncate text-[18px] font-bold" style={{ fontFamily: draft.displayFont ? `"${draft.displayFont}", serif` : undefined, color: "var(--b-accent)" }}>{draft.logoAlt || "Your Brand"}</span>
            <span className="inline-flex gap-2">
              <span className="inline-flex items-center h-8 px-3 rounded-[4px] text-[12.5px] font-semibold" style={{ background: "var(--b-accent)", color: "var(--b-accent-ink)" }}>Primary</span>
              <span className="inline-flex items-center h-8 px-3 rounded-[4px] border text-[12.5px] font-medium" style={{ borderColor: "var(--b-accent)", color: "var(--b-accent)" }}>Ghost</span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["green", "blue", "gold"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-[3px] font-term text-[11px] font-medium" style={{ color: `var(--b-${k})`, borderColor: `var(--b-${k})`, background: "transparent" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--b-${k})` }} />{k}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {previewStats.map(({ value, label }, i) => (
              <div key={label} className="grid place-items-center rounded-md border border-ink/15 p-3 text-center">
                <div className="text-[22px] font-bold" style={{ color: i === 0 ? "var(--b-accent)" : i === 1 ? "var(--b-green)" : "var(--b-blue)" }}>{value}</div>
                <div className="text-[12px] text-ink/70">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
