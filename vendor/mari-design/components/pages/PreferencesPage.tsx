import { useState } from "react";
import { UserRound, KeyRound, Bell, IdCard, AlertTriangle, Trash2 } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, DASH2 } from "./PageFrame";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { FormField } from "../forms/FormField";
import { Input } from "../forms/Input";
import { Select } from "../forms/Select";
import { Combobox } from "../forms/Combobox";
import { Switch } from "../forms/Switch";
import { normalizeTimezone, timezoneOptions } from "../tokens/timezones";
import { Avatar } from "../data-display/Avatar";
import { PropertyList, type PropertyItem } from "../data-display/PropertyList";
import { SkeletonPage } from "../data-display/Skeletons";
import { Alert } from "../feedback/Alert";
import { useWrite } from "../actions/useWrite";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";

/* Preferences — the signed-in person's own account.
 *
 * This exists because the account menu offered "Preferences" and sent you to
 * Settings → Workspace, which is a different thing owned by a different
 * person: workspace name, plan and billing are an admin's business, while your
 * display name, your password and whether you get email are yours. On a
 * workspace where you are not an admin that link led somewhere you could only
 * read, which is why it read as broken.
 *
 * Pure presenter: the profile, which sign-in method is in use, and the
 * notification switches all arrive in `data`. The page owns only the edit
 * buffer for the two forms — what you have typed but not yet saved.
 */

const STATES = [
  { id: "default", label: "Default" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "editing", label: "Dirty / unsaved" },
  { id: "saved", label: "Just saved" },
  { id: "oauth", label: "OAuth account (no password)" },
  { id: "notifications-off", label: "All notifications off" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** How this account signs in. `password` is the only one that can change a
    password — for a GitHub or Google account the credential lives there, and
    offering a change-password form would be a form that cannot work. */
export type AuthProvider = "password" | "github" | "google";

/** The switches under Notifications. Deliberately a fixed record rather than a
    free-form list: each one is a real delivery decision the server acts on. */
export type NotificationPrefs = {
  /** Someone @-mentions you, or asks you to review a document. */
  mentions: boolean;
  /** The weekly digest email. */
  digest: boolean;
  /** A scheduled flow you own finished with errors. */
  flowFailures: boolean;
};

export type PreferencesProfile = {
  name: string;
  email: string;
  initials: string;
  /** IANA zone id, from tokens/timezones.ts. */
  timezone: string;
  /** UI language, as a BCP 47 tag ("en", "es", "de"). Absent means the server
      does not store one, and the control is not drawn: a language select that
      cannot persist is a control that does nothing (§2). */
  language?: string;
};

export type PreferencesData = {
  profile: PreferencesProfile;
  provider: AuthProvider;
  notifications: NotificationPrefs;
  /** Read-only facts in the rail — role, when the account was created, last
      sign-in. Empty renders the card with no rows. */
  summary: PropertyItem[];
};

export type PreferencesActions = {
  /** `language` is only sent when the account has one to change. */
  saveProfile?: (p: { name: string; timezone: string; language?: string }) => void | Promise<void>;
  changePassword?: (p: { current: string; next: string }) => void | Promise<void>;
  setNotification?: (key: keyof NotificationPrefs, on: boolean) => void | Promise<void>;
  /** Close the account for good. Destructive and final, so it goes through
      <ConfirmButton> and only ever runs on the second click. The card is drawn
      ONLY when this handler exists: an app with no way to close an account
      must not show a button that says it can. */
  deleteAccount?: () => void | Promise<void>;
};

const PAGE = "mx-auto max-w-[1400px] px-5 py-6 sm:px-8";
const FORM_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2";

/* Timezones come from tokens/timezones.ts. The list used to live here: eight
   zones, labelled with em dashes ("Pacific — Los Angeles") that §5 forbids in
   user-visible copy, and disagreeing with the three ids Settings → General
   offered for the same account (C8, C9). */

/* Languages the console is translated into. Sentence case, in the language
   itself, which is how a person finds their own. */
const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
];

const PROVIDER_LABEL: Record<AuthProvider, string> = {
  password: "email and password",
  github: "GitHub",
  google: "Google",
};

function ProfileCard({ data, actions }: { data: PreferencesData; actions?: PreferencesActions }) {
  const zoneOf = (p: PreferencesProfile) => normalizeTimezone(p.timezone);
  const [name, setName] = useState(data.profile.name);
  const [timezone, setTimezone] = useState(zoneOf(data.profile));
  const [language, setLanguage] = useState(data.profile.language ?? "");
  const [saved, setSaved] = useState(false);
  const { busy, failed, run } = useWrite();

  /* `useState` reads its seed once, so after a refetch this buffer kept
     rendering the first response and would have written it back (C1). */
  const [seen, setSeen] = useState(data.profile);
  if (seen !== data.profile) {
    setSeen(data.profile);
    setName(data.profile.name);
    setTimezone(zoneOf(data.profile));
    setLanguage(data.profile.language ?? "");
    setSaved(false);
  }

  const hasLanguage = data.profile.language !== undefined;
  const dirty = name !== data.profile.name
    || timezone !== zoneOf(data.profile)
    || (hasLanguage && language !== data.profile.language);
  // A blank display name is not a save the server should have to reject.
  const valid = name.trim().length > 0;

  // The zone the account is on may not be one this build has a label for.
  // Showing it rather than silently snapping the picker to UTC, which would
  // rewrite the setting on the next save without anyone asking.
  const zones = timezoneOptions(timezone);

  return (
    <Card title="Profile" icon={<UserRound size={18} />}>
      <div className="flex items-center gap-3 pb-4">
        <Avatar initials={data.profile.initials} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium text-ink">{data.profile.name}</div>
          <div className="truncate font-term text-[11.5px] text-ink/65">{data.profile.email}</div>
        </div>
      </div>
      <div className={FORM_GRID}>
        <FormField label="Display name" hint="Shown on your comments, reviews and decisions.">
          <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </FormField>
        <FormField label="Time zone" hint="Dates and digest delivery times use this.">
          {/* The canonical list is long enough that scanning a native select
              is not practical, so this is the searchable Combobox (§7). */}
          <Combobox
            ariaLabel="Time zone"
            value={timezone}
            onChange={(v) => { setTimezone(v); setSaved(false); }}
            options={zones}
            placeholder="Select a time zone"
            searchPlaceholder="Search time zones…"
          />
        </FormField>
        {/* Drawn only when the account HAS a language the server stores.
            Otherwise this would be a select that saves nothing (§2). */}
        {hasLanguage && (
          <FormField label="Language" hint="The console's own labels and buttons.">
            <Select value={language} onChange={(e) => { setLanguage(e.target.value); setSaved(false); }}>
              {(LANGUAGES.some((l) => l.value === language) ? LANGUAGES : [{ value: language, label: language }, ...LANGUAGES])
                .map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </FormField>
        )}
      </div>
      {/* Email is read-only here on purpose. It is the account identifier and
          the OAuth join key, so changing it is a verification flow, not a text
          field — an editable box that silently refused to save would be the
          worse lie. */}
      <p className="mt-4 rounded-[4px] border border-ink/12 bg-flysch/50 px-3 py-2 text-[12.5px] text-ink/70">
        You sign in with <b className="font-medium text-ink">{PROVIDER_LABEL[data.provider]}</b>. Your email address is your
        account identifier and cannot be changed here.
      </p>
      <WriteError>{failed}</WriteError>
      {saved && !failed && (
        <div className="mt-3"><Alert tone="ok" title="Profile saved">Your name and time zone are up to date.</Alert></div>
      )}
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="primary"
          disabled={!dirty || !valid || busy}
          onClick={() => run(
            () => actions?.saveProfile?.({ name: name.trim(), timezone, ...(hasLanguage ? { language } : {}) }),
            () => setSaved(true),
          )}
        >
          {busy ? "Saving…" : "Save profile"}
        </Button>
        {dirty && !busy && (
          /* The muted way-out idiom (ConfirmButton's Cancel): text, small,
             ink/70 — the floor that clears 4.5:1. It rendered as a full-size
             blue link, which gave the escape hatch the same visual weight as
             the action beside it. */
          <button
            type="button"
            className="text-[12px] text-ink/70 underline-offset-2 hover:underline"
            onClick={() => { setName(data.profile.name); setTimezone(zoneOf(data.profile)); setLanguage(data.profile.language ?? ""); setSaved(false); }}
          >
            Discard
          </button>
        )}
      </div>
    </Card>
  );
}

function PasswordCard({ data, actions }: { data: PreferencesData; actions?: PreferencesActions }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changed, setChanged] = useState(false);
  const { busy, failed, run } = useWrite();

  if (data.provider !== "password") {
    return (
      <Card title="Password" icon={<KeyRound size={18} />}>
        <p className="text-[13px] text-ink/70">
          You sign in with {PROVIDER_LABEL[data.provider]}, so there is no password here to change. Manage that credential
          from your {PROVIDER_LABEL[data.provider]} account.
        </p>
      </Card>
    );
  }

  // Checked before the request, so a mismatch is caught where it happened
  // instead of after a round trip that never had a chance of succeeding.
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const ready = current.length > 0 && next.length >= 8 && next === confirm;

  return (
    <Card title="Password" icon={<KeyRound size={18} />}>
      <div className="flex flex-col gap-4">
        <FormField label="Current password">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </FormField>
        <div className={FORM_GRID}>
          <FormField label="New password" hint={tooShort ? "Use at least 8 characters." : "At least 8 characters."}>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setChanged(false); }} />
          </FormField>
          <FormField label="Confirm new password" hint={mismatch ? "The two passwords do not match." : undefined}>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setChanged(false); }} />
          </FormField>
        </div>
      </div>
      <WriteError>{failed}</WriteError>
      {changed && !failed && (
        <div className="mt-3"><Alert tone="ok" title="Password changed">Use the new password the next time you sign in.</Alert></div>
      )}
      <div className="mt-4">
        <Button
          variant="primary"
          disabled={!ready || busy}
          onClick={() => run(
            () => actions?.changePassword?.({ current, next }),
            // Cleared only on success: a rejected change should leave what you
            // typed in place so you can correct it.
            () => { setChanged(true); setCurrent(""); setNext(""); setConfirm(""); },
          )}
        >
          {busy ? "Changing…" : "Change password"}
        </Button>
      </div>
    </Card>
  );
}

const NOTIFICATION_ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "mentions", label: "Mentions and review requests", hint: "Someone @-mentions you or asks you to review a document." },
  { key: "digest", label: "Weekly digest", hint: "What changed across the workspace, once a week." },
  { key: "flowFailures", label: "Flow failures", hint: "A scheduled flow you own finished with errors." },
];

function NotificationsCard({ data, actions }: { data: PreferencesData; actions?: PreferencesActions }) {
  // Local echo so a switch moves under the finger; `useWrite` only keeps it
  // moved once the server has taken the change.
  const [local, setLocal] = useState(data.notifications);
  /* The echo used to be seeded once and never again, so a preference changed
     on another device (or rejected here and refetched) kept showing this tab's
     stale switch position forever (P-PR-4, C1). */
  const [seen, setSeen] = useState(data.notifications);
  if (seen !== data.notifications) {
    setSeen(data.notifications);
    setLocal(data.notifications);
  }
  const { failed, run } = useWrite();

  return (
    <Card title="Notifications" icon={<Bell size={18} />}>
      <div className="flex flex-col divide-y divide-ink/10">
        {NOTIFICATION_ROWS.map((r) => (
          <div key={r.key} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] text-ink">{r.label}</div>
              <div className="text-[12px] text-ink/65">{r.hint}</div>
            </div>
            <Switch
              checked={local[r.key]}
              aria-label={r.label}
              onCheckedChange={(on) => run(
                () => actions?.setNotification?.(r.key, on),
                () => setLocal((p) => ({ ...p, [r.key]: on })),
              )}
            />
          </div>
        ))}
      </div>
      <WriteError>{failed}</WriteError>
    </Card>
  );
}

/* Closing your own account. Drawn only when there is a handler to close it
   with, the way Settings → General gates its danger zone: a danger heading
   over a button that does nothing is worse than no heading at all (§2). */
function AccountDangerZone({ actions }: { actions?: PreferencesActions }) {
  const close = actions?.deleteAccount;
  const { busy, failed, run } = useWrite();
  if (!close) return null;
  return (
    <Card className="border-espelette/30">
      <div className="flex items-center gap-2 text-espelette">
        <AlertTriangle size={16} />
        <h3 className="text-[14px] font-semibold">Danger zone</h3>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-ink">Close this account</div>
          <p className="mt-0.5 text-[12.5px] text-ink/70">
            You lose access to every workspace you are a member of. Documents you wrote stay with the workspace. This
            cannot be undone.
          </p>
        </div>
        <ConfirmButton compact disabled={busy} confirmLabel="Close forever?" onConfirm={() => void run(() => close())}>
          <Trash2 size={14} /> Close account
        </ConfirmButton>
      </div>
      <WriteError>{failed}</WriteError>
    </Card>
  );
}

/* Two balanced columns, not a form column plus a rail.
 *
 * The rail held one card: four read-only facts about the account, about 220px
 * of it, beside a form column that runs past 1,100px. That is 730px of empty
 * right column on the default state, and there is no fifth account fact to
 * invent. So the four cards are dealt between two equal columns instead, in the
 * pairing that leaves the least at the bottom: profile and notifications (the
 * two things you set about yourself) on the left, the account facts, the
 * password form and the danger zone on the right (§11).
 */
function Body({ data, error, actions, mobile }: {
  data: PreferencesData; error: string | null; actions?: PreferencesActions; mobile: boolean;
}) {
  // XA-01: a failed read is a blocked banner, never the "nothing here yet" surface.
  if (error) return <ReadError>{error}</ReadError>;
  return (
    <div className={mobile ? "flex flex-col gap-5" : DASH2}>
      <div className="flex min-w-0 flex-col gap-5">
        <ProfileCard data={data} actions={actions} />
        <NotificationsCard data={data} actions={actions} />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <Card title="Account" icon={<IdCard size={18} />}>
          <PropertyList items={data.summary} />
        </Card>
        <PasswordCard data={data} actions={actions} />
        <AccountDangerZone actions={actions} />
      </div>
    </div>
  );
}

function PreferencesPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<PreferencesData, PreferencesActions>) {
  return (
    <PageFrame chrome={chrome} active={navFor("preferences")} title="Preferences" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="settings"
          eyebrow="Account"
          title="Preferences"
          description="Your profile, password and notifications. Workspace-wide settings live under Settings."
          /* Preferences is reached from the account menu and carries no
             Settings tab row, so it draws none here either. */
          sections={["Profile", "Password", "Notifications"]}
          fields={["Display name", "Time zone", "Language"]}
          actions={0}
          mobile={mobile}
        />
      ) : (
        <div className={PAGE}>
          <PageHeader
            eyebrow="Account"
            title="Preferences"
            description="Your profile, password and notifications. Workspace-wide settings live under Settings."
            icon={<span className="text-biscay-2"><UserRound size={24} /></span>}
          />
          <div className="mt-6">
            <Body data={data} error={error} actions={actions} mobile={mobile} />
          </div>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<PreferencesData, PreferencesActions> = {
  id: "preferences",
  title: "Preferences",
  route: "/preferences",
  component: PreferencesPage,
  states: STATES.map((s) => ({ ...s })),
};
