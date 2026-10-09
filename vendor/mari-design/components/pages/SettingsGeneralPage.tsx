import { useState } from "react";
import type { ReactNode } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, SPLIT } from "./PageFrame";
import { Tag, Clock, ArrowRight, AlertTriangle, Trash2, Palette } from "lucide-react";
import { SettingsTabs, SETTINGS_TAB_LABELS } from "./SettingsTabs";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { Select } from "../forms/Select";
import { Combobox } from "../forms/Combobox";
import { normalizeTimezone, timezoneOptions } from "../tokens/timezones";
import { Spinner } from "../data-display/Spinner";
import { SkeletonPage } from "../data-display/Skeletons";
import { ReadError } from "../feedback/ReadError";
import { Alert } from "../feedback/Alert";
import type { Branding, BrandHarvest, BrandPreviewStat } from "../features/BrandingEditor";
import { useWrite } from "../actions/useWrite";
import { WriteError } from "../feedback/WriteError";
import { PropertyList, type PropertyItem } from "../data-display/PropertyList";

/* Settings → General (pages/settings-general.md). Workspace identity form
   (name / slug / plan / timezone / language) plus the two sign-post link
   cards for features that moved out of Settings, the branding sub-section,
   and a danger zone. Sits under the shared settings tab strip.

   Pure presenter: the workspace record, where the save lifecycle has got to,
   any field-level validation the server sent back, and the read-only summary
   in the rail all arrive in `data`. */

const STATES = [
  { id: "default", label: "Default (saved)" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "editing", label: "Dirty / unsaved" },
  { id: "saving", label: "Saving…" },
  { id: "saved", label: "Just saved" },
  { id: "invalid", label: "Validation error" },
  { id: "branding", label: "Branding sub-section" },
  { id: "danger", label: "Danger zone" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** Which sub-section of General is on screen. */
export type GeneralSection = "workspace" | "branding";

/** The workspace identity record the form submits. */
export type WorkspaceIdentity = {
  name: string; slug: string; plan: string; timezone: string; language: string;
};

export type LineageTuning = { maxNodes: number; hopDepth: number; minConfidence: number };

/** What Settings → General can do.

    The danger-zone pair is offered per-row, and a row is only RENDERED when
    its handler exists. That is the rule the previous version got half right:
    it correctly refused to fake a transfer or a delete, but it drew both
    buttons anyway, so the page still promised two things it could not do. An
    app that implements them gets working controls; one that does not shows a
    danger zone with only the rows it can honour, and none at all if it has
    neither. `data.danger` gates the whole card on owning the workspace. */
export type SettingsGeneralActions = {
  saveWorkspace?: (w: WorkspaceIdentity) => void | Promise<void>;
  /** Workspace defaults for the task-first lineage explorer. */
  saveLineageTuning?: (tuning: LineageTuning) => void | Promise<void>;
  /** Hand the workspace to another admin. */
  transferWorkspace?: () => void | Promise<void>;
  /** Destructive and final. Goes through <ConfirmButton>, so this only ever
      runs on the second click. */
  deleteWorkspace?: () => void | Promise<void>;
};

/** Where the save of the identity form has got to. Validation is NOT a mode:
    it is derived from the field errors the server sent back. */
export type SaveState = "clean" | "dirty" | "saving" | "saved";

/** Everything Settings → General renders. */
export type SettingsGeneralData = {
  section: GeneralSection;
  /** The workspace record being edited. */
  name: string;
  slug: string;
  /** Values of the three enumerated fields, matching their option values. */
  plan: string;
  timezone: string;
  language: string;
  save: SaveState;
  /** Field-level rejection for the slug. `null` = the slug is fine. */
  slugError: string | null;
  /** Read-only facts in the rail. Empty renders the card with no rows. */
  summary: PropertyItem[];
  /** Owner-only destructive controls. */
  danger: boolean;
  lineage: LineageTuning;
  /** Branding, as General used to render it. The editor moved to Settings →
      Design & brand (the only place it has handlers), so these three are no
      longer read here and an app can stop sending them. */
  branding?: Branding;
  brandHarvest?: BrandHarvest;
  brandPreviewStats?: BrandPreviewStat[];
};


/* ── §11 page grid ─────────────────────────────────────────────────────────
   Every Settings page shares these three constants so the container edge, the
   main/rail plumb line, and the form-field width are identical on all five
   tabs. Do not localise them per page. */
const PAGE = "mx-auto max-w-[1400px] px-5 py-6 sm:px-8";
const FORM_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

function SettingsBody({ mobile, rail, children }: { mobile: boolean; rail: ReactNode; children: ReactNode }) {
  return (
    <div className={mobile ? "mt-6 flex flex-col gap-5" : `mt-6 ${SPLIT[320]}`}>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="flex min-w-0 flex-col gap-5">{rail}</aside>
    </div>
  );
}

/* A sign-post to a feature that used to live in Settings. The whole point of
   the card is the jump, so `to` is required: a LinkCard with nowhere to go is
   a paragraph with a button-shaped decoration on it, which is what these two
   were. */
function LinkCard({ icon, title, blurb, cta, to, onNavigate }: {
  icon: ReactNode; title: string; blurb: string; cta: string;
  to: string; onNavigate?: (pageId: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-flysch text-biscay">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink">{title}</div>
          <p className="mt-1 text-[13px] text-ink/70">{blurb}</p>
        </div>
      </div>
      <div className="mt-3">
        <Button variant="default" compact onClick={() => onNavigate?.(to)}>
          <ArrowRight size={15} /> {cta}
        </Button>
      </div>
    </Card>
  );
}

/* An option list has to be able to show a value the server already holds, even
   one this build has no label for: a timezone of "America/Los_Angeles" used to
   render as UTC because it matched no <option>, so the form silently misstated
   the workspace and saving it would have overwritten the real value. */
function withCurrent(options: { value: string; label: string }[], current: string) {
  if (!current || options.some((o) => o.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}

const PLANS = [
  { value: "free", label: "Free" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" },
];
/* Timezones come from tokens/timezones.ts, the way regions come from
   tokens/regions.ts. This page used to define its own three-item list whose
   ids (`utc`, `pt`, `et`) matched nothing Preferences offered, so the two
   pages could describe the same account incompatibly and neither could name
   the zone most people are in (C8). `normalizeTimezone` reads the old ids. */
const LANGUAGES = [
  { value: "en", label: "English" }, { value: "es", label: "Español" }, { value: "de", label: "Deutsch" },
];

/* Controlled, because the values have to leave the form. They were
   `defaultValue` on inputs inside a card whose Save button had no handler at
   all, so the whole form was a picture of itself. */
function WorkspaceForm({ data, actions }: { data: SettingsGeneralData; actions?: SettingsGeneralActions }) {
  const { slugError } = data;
  const [name, setName] = useState(data.name);
  const [slug, setSlug] = useState(data.slug);
  const [plan, setPlan] = useState(data.plan);
  const [timezone, setTimezone] = useState(normalizeTimezone(data.timezone));
  const [language, setLanguage] = useState(data.language);
  /* The edit buffer is seeded from `data`, and `useState` only reads its
     argument once — so after any refetch the form kept rendering the FIRST
     response and would have saved it back over the newer one (C1). The
     sentinel resyncs when, and only when, the server's record changes. */
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setName(data.name);
    setSlug(data.slug);
    setPlan(data.plan);
    setTimezone(normalizeTimezone(data.timezone));
    setLanguage(data.language);
  }
  const write = useWrite();
  /* Whether there is anything to save is derived from the fields against what
     the server sent, not from a mode: the two cannot disagree. `data.save` is
     still honoured, because the canvas drives the lifecycle through it. */
  const dirty = name !== data.name || slug !== data.slug || plan !== data.plan
    || timezone !== normalizeTimezone(data.timezone) || language !== data.language;
  const [justSaved, setJustSaved] = useState(false);
  const save = write.busy ? "saving" : justSaved ? "saved" : dirty ? "dirty" : data.save;
  const invalid = slugError !== null;

  const submit = () => write.run(
    actions?.saveWorkspace && (() => actions.saveWorkspace!({ name, slug, plan, timezone, language })),
    () => { setJustSaved(true); window.setTimeout(() => setJustSaved(false), 2000); },
  );

  return (
    /* The page header above already reads "Workspace" / "Workspace identity
       and language."; this card repeated both strings verbatim, 150px lower.
       It names the section it holds instead. */
    <Card title="Identity" hint="Name, slug, plan, timezone, and language.">
      <div className={FORM_GRID}>
        <Field label="Workspace name">
          <Input value={name} onChange={(e) => { setName(e.target.value); setJustSaved(false); }} className="w-full" />
        </Field>
        <Field label="Slug">
          <Input
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setJustSaved(false); }}
            className={`w-full font-term ${invalid ? "border-espelette ring-1 ring-espelette/40" : ""}`.trim()}
            aria-invalid={invalid || undefined}
          />
          {invalid && <p className="mt-1 text-[12px] text-espelette">{slugError}</p>}
        </Field>
        <Field label="Plan">
          <Select value={plan} onChange={(e) => { setPlan(e.target.value); setJustSaved(false); }} className="w-full">
            {withCurrent(PLANS, data.plan).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Timezone">
          {/* Forty-odd zones is past the point where a native select is
              scannable, so this is the searchable Combobox (§7). The option
              list is the canonical one, with the account's own zone appended
              when this build has no label for it. */}
          <Combobox
            ariaLabel="Timezone"
            value={timezone}
            onChange={(v) => { setTimezone(v); setJustSaved(false); }}
            options={timezoneOptions(timezone || data.timezone)}
            placeholder="Select a timezone"
            searchPlaceholder="Search timezones…"
          />
        </Field>
        <Field label="Language">
          <Select value={language} onChange={(e) => { setLanguage(e.target.value); setJustSaved(false); }} className="w-full">
            {withCurrent(LANGUAGES, data.language).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>
      {write.failed && (
        <div className="mt-4"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>
      )}
      <div className="mt-5 flex items-center gap-3 border-t border-ink/10 pt-4">
        <Button variant="primary" disabled={save === "clean" || save === "saved" || save === "saving" || invalid} onClick={() => void submit()}>
          {save === "saving" ? "Saving…" : "Save changes"}
        </Button>
        {save === "clean" && !invalid && <span className="text-[12.5px] text-moss">All changes saved</span>}
        {save === "saved" && <span className="font-term text-[12.5px] text-moss">✓ Saved just now</span>}
        {save === "dirty" && !invalid && <span className="text-[12.5px] text-ink/65">You have unsaved changes</span>}
        {save === "saving" && <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/65"><Spinner size="sm" /> Contacting API…</span>}
        {invalid && <span className="text-[12.5px] text-espelette">Fix the errors above to save</span>}
      </div>
    </Card>
  );
}

function LineageTuningForm({ data, actions }: { data: SettingsGeneralData; actions?: SettingsGeneralActions }) {
  const [maxNodes, setMaxNodes] = useState(data.lineage.maxNodes);
  const [hopDepth, setHopDepth] = useState(data.lineage.hopDepth);
  const [minConfidence, setMinConfidence] = useState(data.lineage.minConfidence);
  const [seen, setSeen] = useState(data.lineage);
  if (seen !== data.lineage) {
    setSeen(data.lineage);
    setMaxNodes(data.lineage.maxNodes);
    setHopDepth(data.lineage.hopDepth);
    setMinConfidence(data.lineage.minConfidence);
  }
  const write = useWrite();
  const dirty = maxNodes !== data.lineage.maxNodes || hopDepth !== data.lineage.hopDepth || minConfidence !== data.lineage.minConfidence;
  return (
    <Card title="Lineage defaults" hint="Safe workspace-wide limits for focused provenance and impact views.">
      <p className="mb-4 max-w-[720px] text-[12.5px] leading-relaxed text-ink/70">
        Overview always rolls documents up by source or repository. Focused views show only directional dependency links; similarity, discussion, and contradiction remain contextual and do not enter provenance or impact paths.
      </p>
      <div className={FORM_GRID}>
        <Field label="Maximum visible nodes">
          <Select aria-label="Maximum visible lineage nodes" value={String(maxNodes)} onChange={(event) => setMaxNodes(Number(event.target.value))} className="w-full">
            {[8, 12, 16, 24, 35].map((value) => <option key={value} value={value}>{value} nodes</option>)}
          </Select>
          <p className="mt-1 text-[11.5px] text-ink/65">Protects focused views from high-fanout graphs.</p>
        </Field>
        <Field label="Dependency depth">
          <Select aria-label="Lineage dependency depth" value={String(hopDepth)} onChange={(event) => setHopDepth(Number(event.target.value))} className="w-full">
            {[1, 2, 3].map((value) => <option key={value} value={value}>{value} hop{value === 1 ? "" : "s"}</option>)}
          </Select>
          <p className="mt-1 text-[11.5px] text-ink/65">How many upstream or downstream hops load initially.</p>
        </Field>
        <Field label="Machine-link confidence">
          <Select aria-label="Minimum lineage confidence" value={String(minConfidence)} onChange={(event) => setMinConfidence(Number(event.target.value))} className="w-full">
            {[0.7, 0.8, 0.9].map((value) => <option key={value} value={value}>{Math.round(value * 100)}% or higher</option>)}
          </Select>
          <p className="mt-1 text-[11.5px] text-ink/65">Authored links are always shown; this threshold applies only to machine proposals.</p>
        </Field>
      </div>
      {write.failed && <div className="mt-4"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>}
      <div className="mt-5 flex items-center gap-3 border-t border-ink/10 pt-4">
        <Button
          variant="primary"
          disabled={!dirty || write.busy || !actions?.saveLineageTuning}
          onClick={() => void write.run(actions?.saveLineageTuning && (() => actions.saveLineageTuning!({ maxNodes, hopDepth, minConfidence })))}
        >
          {write.busy ? "Saving…" : "Save lineage defaults"}
        </Button>
        {!dirty && <span className="text-[12.5px] text-ink/65">Defaults are saved</span>}
      </div>
    </Card>
  );
}

function DangerZone({ actions }: { actions?: SettingsGeneralActions }) {
  const transfer = actions?.transferWorkspace;
  const remove = actions?.deleteWorkspace;
  // Nothing to offer: no card. An empty danger zone is a heading warning you
  // about controls that are not there.
  if (!transfer && !remove) return null;
  return (
    <Card className="border-espelette/30">
      <div className="flex items-center gap-2 text-espelette">
        <AlertTriangle size={16} />
        <h3 className="text-[14px] font-semibold">Danger zone</h3>
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-ink/10">
        {transfer && (
          <li className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-ink">Transfer workspace</div>
              <p className="mt-0.5 text-[12.5px] text-ink/60">Move ownership to another admin. You keep admin access.</p>
            </div>
            {/* Handing the workspace to someone else is as irreversible as
                deleting it, and it used to fire on the first click while the
                row below it confirmed properly (§2). */}
            <ConfirmButton compact confirmLabel="Transfer ownership?" onConfirm={() => void transfer()}>Transfer</ConfirmButton>
          </li>
        )}
        {remove && (
          <li className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-ink">Delete workspace</div>
              <p className="mt-0.5 text-[12.5px] text-ink/60">Permanently remove all documents, members, and keys. This cannot be undone.</p>
            </div>
            <ConfirmButton compact confirmLabel="Delete forever?" onConfirm={() => void remove()}><Trash2 size={14} /> Delete</ConfirmButton>
          </li>
        )}
      </ul>
    </Card>
  );
}

/* Supporting rail (§11, 320px). Carries the read-only summary plus the two
   sign-post cards for features that moved out of Settings, so the main column
   is a single full-width form instead of a half-empty one. */
function GeneralRail({ summary, onNavigate }: { summary: PropertyItem[]; onNavigate?: (pageId: string) => void }) {
  return (
    <>
      <Card title="At a glance" hint="Read only">
        <PropertyList items={summary} />
      </Card>
      <LinkCard icon={<Tag size={18} />} title="Editorial library" blurb="Tags, glossary, and style guides now live in the Library." cta="Open Library" to="library" onNavigate={onNavigate} />
      <LinkCard icon={<Clock size={18} />} title="Weekly digest" blurb="The digest schedule moved to Workflows (cross-cluster runs)." cta="Open Workflows" to="workflows" onNavigate={onNavigate} />
    </>
  );
}

function Body({ data, error, actions, onNavigate }: {
  data: SettingsGeneralData; error: string | null; actions?: SettingsGeneralActions;
  onNavigate?: (pageId: string) => void;
}) {
  // XA-01: a failed read is a blocked banner, never the "nothing here yet" surface.
  if (error) return <ReadError>{error}</ReadError>;
  /* Branding used to render the real BrandingEditor here with NO `actions`, so
     every control in it was a control that could not save (§2) — and the same
     editor already lives on Settings → Design & brand, where it does have
     handlers. One editor, one place; General points at it. */
  if (data.section === "branding") {
    return (
      <LinkCard
        icon={<Palette size={18} />}
        title="Design & brand"
        blurb="Colours, type and the logo this workspace publishes under moved to their own tab, where they save."
        cta="Open Design & brand"
        to="settings-design"
        onNavigate={onNavigate}
      />
    );
  }
  return (
    <>
      {data.save === "saved" && <Alert tone="ok" title="Workspace saved">Your identity changes are live for all members.</Alert>}
      <WorkspaceForm data={data} actions={actions} />
      <LineageTuningForm data={data} actions={actions} />
      {data.danger && <DangerZone actions={actions} />}
    </>
  );
}

function SettingsGeneralPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<SettingsGeneralData, SettingsGeneralActions>) {
  return (
    <PageFrame chrome={chrome} active={navFor("settings")} title="Settings" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="settings"
          eyebrow="Settings"
          title="Workspace"
          description="Workspace identity and language."
          tabs={SETTINGS_TAB_LABELS}
          activeTab="General"
          sections={["Workspace"]}
          fields={["Workspace name", "Slug", "Plan", "Timezone", "Language"]}
          rail={["At a glance"]}
          actions={0}
          mobile={mobile}
        />
      ) : (
        <div className={PAGE}>
          <PageHeader eyebrow="Settings" title="Workspace" description="Workspace identity and language." />
          <div className="mt-5"><SettingsTabs active="general" onNavigate={chrome?.onNavigate} /></div>
          <SettingsBody mobile={mobile} rail={<GeneralRail summary={data.summary} onNavigate={chrome?.onNavigate} />}>
            <Body data={data} error={error} actions={actions} onNavigate={chrome?.onNavigate} />
          </SettingsBody>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<SettingsGeneralData, SettingsGeneralActions> = {
  id: "settings-general",
  title: "Settings · General",
  route: "/settings/general",
  component: SettingsGeneralPage,
  states: STATES.map((s) => ({ ...s })),
};
