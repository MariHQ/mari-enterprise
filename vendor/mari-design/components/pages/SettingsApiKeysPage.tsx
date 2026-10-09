import { useState, type ReactNode } from "react";
import { KeyRound, Plus } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, SPLIT } from "./PageFrame";
import { SettingsTabs, SETTINGS_TAB_LABELS } from "./SettingsTabs";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { PropertyList } from "../data-display/PropertyList";
import { EmptyState } from "../data-display/EmptyState";
import { ReadError } from "../feedback/ReadError";
import { SkeletonPage } from "../data-display/Skeletons";
import { SettingsApiKeys, API_SCOPES, type ApiKey, type SettingsApiKeysActions } from "../features/SettingsApiKeys";
import type { PropertyItem } from "../data-display/PropertyList";

/** What Settings → API keys can do. Defined with the panel that renders the
    controls and re-exported here, so an app types its handlers off the page. */
export type { SettingsApiKeysActions };

/* Settings → API keys (pages/settings-api-keys.md). Create and revoke
   programmatic-access keys. List variants render the SettingsApiKeys feature;
   the create / key-created (one-time reveal) / revoke-confirm variants render
   inline so each lifecycle step is captured. Under the shared settings tab
   strip.

   Pure presenter: the key list, the draft being created, the one-time secret
   and the rail summary all arrive in `data`. "No keys yet" is derived from the
   list being empty. */

const STATES = [
  { id: "default", label: "Keys list" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "No keys yet" },
  { id: "single", label: "Single key" },
  { id: "many", label: "Many keys" },
  { id: "create-key", label: "Create-key form" },
  { id: "key-created", label: "Key created (revealed)" },
  { id: "revoke-confirm", label: "Revoke key (confirm)" },
  { id: "revoked", label: "Revoked key in list" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** Which lifecycle step of key management is on screen.

    Each of these used to render a static copy of the keys table and its
    controls, built in this file beside the real SettingsApiKeys feature —
    five buttons that looked like create, cancel and revoke and did none of
    them. They now drive the real component through its own props.

    "plain-table" is gone: it existed only to render the twin without any
    lifecycle step on top, which is what "list" already is. */
export type KeysPhase =
  | "list" | "create-key" | "key-created" | "revoke-confirm";

/** A key being created, before the server has minted it. */
export type ApiKeyDraft = { name: string; scopes: string };

/** Everything Settings → API keys renders. */
export type SettingsApiKeysData = {
  phase: KeysPhase;
  keys: ApiKey[];
  /** The create form's current values. */
  draft: ApiKeyDraft;
  /** The one-time secret, shown once right after creation. `null` = none. */
  newSecret: string | null;
  /** The key a revoke confirmation is pending on. */
  confirmKeyId: number | null;
  /** Read-only facts in the rail. */
  summary: PropertyItem[];
};


/* ── §11 page grid ─────────────────────────────────────────────────────────
   Shared verbatim with the other four Settings pages: one container width, one
   main/rail split. The form-field grid lives with the forms, in the feature. */
const PAGE = "mx-auto max-w-[1400px] px-5 py-6 sm:px-8";

function SettingsBody({ mobile, rail, children }: { mobile: boolean; rail: ReactNode; children: ReactNode }) {
  return (
    <div className={mobile ? "mt-6 flex flex-col gap-5" : `mt-6 ${SPLIT[320]}`}>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="flex min-w-0 flex-col gap-5">{rail}</aside>
    </div>
  );
}

/* Supporting rail (§11, 320px) — matches the other four Settings rails. */
function KeysRail({ summary }: { summary: PropertyItem[] }) {
  return (
    <>
      <Card title="At a glance" hint="Read only">
        <PropertyList items={summary} />
      </Card>
      {/* The same four scopes the create form offers, from the same list, so
          the rail and the checkboxes can never document different vocabularies. */}
      <Card title="Scopes">
        <ul className="flex flex-col gap-2 font-term text-[12px] text-ink/70">
          {API_SCOPES.map((s) => (
            <li key={s.id}><b className="text-ink">{s.id}</b> {s.blurb.toLowerCase()}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/** No keys at all. Derived from the list, so it is true in the real app for
    exactly the same reason it is true on the canvas. */
function isEmpty(d: SettingsApiKeysData): boolean {
  return d.keys.length === 0;
}

function Body({ data, error, actions, createOpen, onCreateOpenChange }: {
  data: SettingsApiKeysData;
  error: string | null;
  actions?: SettingsApiKeysActions;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  // XA-01: a failed read is a blocked banner, never the "nothing here yet" surface.
  if (error) return <ReadError>{error}</ReadError>;
  if (isEmpty(data)) {
    return (
      <EmptyState icon={<KeyRound size={22} />} title="No keys yet">
        Create a key to authenticate CI, bots, and the MCP gateway.
      </EmptyState>
    );
  }
  return (
    <SettingsApiKeys
      embedded
      keys={data.keys}
      actions={actions}
      /* The form opens from the page header, or because the state under review
         says it is open. */
      createOpen={createOpen || data.phase === "create-key"}
      draft={data.draft}
      confirmRevokeId={data.phase === "revoke-confirm" ? data.confirmKeyId : null}
      revealToken={data.phase === "key-created" ? data.newSecret : null}
      onCreateOpenChange={onCreateOpenChange}
    />
  );
}

function SettingsApiKeysPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<SettingsApiKeysData, SettingsApiKeysActions>) {
  /* The header owns the "Create key" button, so it owns whether the form
     below it is open: the panel's own header is hidden when embedded (§2). */
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <PageFrame chrome={chrome} active={navFor("settings")} title="Settings" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="settings"
          eyebrow="Settings"
          title="API keys"
          description="Programmatic access for CI, bots, and the MCP gateway."
          tabs={SETTINGS_TAB_LABELS}
          activeTab="API keys"
          rail={["At a glance", "Scopes"]}
          sections={["Keys"]}
          columns={["Name", "Key", "Scopes", "Created", "Last used", "Status", "Actions"]}
          actions={[{ label: "Create key", variant: "primary" }]}
          mobile={mobile}
        />
      ) : (
        <div className={PAGE}>
          <PageHeader
            eyebrow="Settings"
            title="API keys"
            description="Programmatic access for CI, bots, and the MCP gateway."
            actions={<Button variant="primary" onClick={() => setCreateOpen((v) => !v)}><Plus size={15} /> Create key</Button>}
          />
          <div className="mt-5"><SettingsTabs active="api-keys" onNavigate={chrome?.onNavigate} /></div>
          <SettingsBody mobile={mobile} rail={<KeysRail summary={data.summary} />}>
            <Body data={data} error={error} actions={actions} createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
          </SettingsBody>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<SettingsApiKeysData, SettingsApiKeysActions> = {
  id: "settings-api-keys",
  title: "Settings · API keys",
  route: "/settings/api-keys",
  component: SettingsApiKeysPage,
  states: STATES.map((s) => ({ ...s })),
};
