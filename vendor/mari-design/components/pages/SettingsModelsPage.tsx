import { type ReactNode } from "react";
import { Layers } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor, SPLIT } from "./PageFrame";
import { Card } from "../layout/Card";
import { EmptyState } from "../data-display/EmptyState";
import { ReadError } from "../feedback/ReadError";
import { SettingsTabs, SETTINGS_TAB_LABELS } from "./SettingsTabs";
import { PageHeader } from "../layout/PageHeader";
import { SkeletonPage } from "../data-display/Skeletons";
import { PropertyList, type PropertyItem } from "../data-display/PropertyList";
import {
  SettingsModelsConfig, type ChunkRow, type GatewaySettings, type ProviderKeys, type SettingsModelsActions,
} from "../features/SettingsModelsConfig";

/** What Settings → Models can do. Defined with the panel that renders the
    controls and re-exported here, so an app types its handlers off the page. */
export type { SettingsModelsActions };

/* Settings → Models (pages/settings-models.md). Configure the embedding model,
   LLM provider + keys, connection test, and per-source chunking. Every state,
   including the editing / test-connection / saved steps, is the
   SettingsModelsConfig feature driven through its own props. Under the shared
   settings tab strip.

   Pure presenter: the model selection, the provider keys, the chunking table
   and the rail summary all arrive in `data`. "Not configured" is derived from
   there being no model and no provider, never from a flag. */

const STATES = [
  { id: "default", label: "Model config" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Not configured" },
  { id: "editing-embedding", label: "Editing embedding model" },
  { id: "editing-llm", label: "Editing LLM provider" },
  { id: "test-idle", label: "Test connection (idle)" },
  { id: "test-testing", label: "Testing connection…" },
  { id: "test-ok", label: "Connection OK" },
  { id: "test-fail", label: "Connection failed" },
  { id: "saved", label: "Saved" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** Which lifecycle step of the model form is on screen. Each one is the real
    panel put into that step, not a picture of it. */
export type ModelsPhase =
  | "config" | "editing-embedding" | "editing-llm"
  | "test-idle" | "test-testing" | "test-ok" | "test-fail" | "saved";

/** Everything Settings → Models renders. */
export type SettingsModelsData = {
  phase: ModelsPhase;
  /** The models this workspace is configured with. Empty strings mean the
      workspace has not chosen one yet. */
  embedding: string;
  llm: string;
  dims: number;
  /** What the two dropdowns can offer. */
  embeddingOptions: string[];
  llmOptions: string[];
  /** Per-source chunking table. */
  chunking: ChunkRow[];
  keys: ProviderKeys;
  gateway?: GatewaySettings;
  /** Corpus line appended to a healthy connection test. */
  indexSummary: string;
  /** Detail lines the last connection test produced. */
  testOk: string;
  testError: string;
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
function ModelsRail({ summary }: { summary: PropertyItem[] }) {
  return (
    <>
      <Card title="At a glance" hint="Read only">
        <PropertyList items={summary} />
      </Card>
      <Card title="Changing a model">
        <p className="text-[12.5px] leading-relaxed text-ink/70">
          Switching the embedding model re-indexes every document, so search is
          degraded until the run finishes. Changing the LLM provider takes effect
          on the next answer.
        </p>
      </Card>
    </>
  );
}

/** A workspace that has chosen no models at all. Derived from the data. */
function isEmpty(d: SettingsModelsData): boolean {
  return !d.embedding && !d.llm;
}

function Body({ data, error, actions }: { data: SettingsModelsData; error: string | null; actions?: SettingsModelsActions }) {
  // XA-01: a failed read is a blocked banner, never the "nothing here yet" surface.
  if (error) return <ReadError>{error}</ReadError>;
  if (isEmpty(data)) {
    return (
      <EmptyState icon={<Layers size={22} />} title="No models configured">
        Choose an embedding model and LLM provider to start indexing.
      </EmptyState>
    );
  }
  /* Every lifecycle step is the REAL panel, put into that state through its
     own props. It used to be a second, hand-drawn copy of the form built in
     this file: `defaultValue` selects with no `onChange`, three buttons with
     no `onClick`, and a key field whose draft nothing read — so any phase but
     "config" rendered a form that could not do anything (P-SD-1). The
     API-keys and Members pages were fixed the same way. */
  return (
    <SettingsModelsConfig
      embedded
      embedding={data.embedding}
      llm={data.llm}
      dims={data.dims}
      embeddingOptions={data.embeddingOptions}
      llmOptions={data.llmOptions}
      chunking={data.chunking}
      keys={data.keys}
      gateway={data.gateway}
      actions={actions}
      indexSummary={data.indexSummary}
      unsaved={data.phase === "editing-embedding" ? "embedding" : data.phase === "editing-llm" ? "llm" : null}
      testStatus={testStatusOf(data)}
      savedFlash={data.phase === "saved"}
    />
  );
}

/** The connection test's step, as the page's phase describes it. */
function testStatusOf(d: SettingsModelsData): { status: "testing" | "ok" | "fail"; text: string } | null {
  if (d.phase === "test-testing") return { status: "testing", text: "" };
  if (d.phase === "test-ok") return { status: "ok", text: d.testOk };
  if (d.phase === "test-fail") return { status: "fail", text: d.testError };
  return null;
}

function SettingsModelsPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<SettingsModelsData, SettingsModelsActions>) {
  return (
    <PageFrame chrome={chrome} active={navFor("settings")} title="Settings" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="settings"
          eyebrow="Settings"
          title="Models"
          description="Which models embed, search, and answer for this workspace."
          tabs={SETTINGS_TAB_LABELS}
          activeTab="Models"
          rail={["At a glance"]}
          actions={0}
          mobile={mobile}
        />
      ) : (
        <div className={PAGE}>
          <PageHeader
            eyebrow="Settings"
            title="Models"
            description="Which models embed, search, and answer for this workspace."
          />
          <div className="mt-5"><SettingsTabs active="models" onNavigate={chrome?.onNavigate} /></div>
          <SettingsBody mobile={mobile} rail={<ModelsRail summary={data.summary} />}>
            <Body data={data} error={error} actions={actions} />
          </SettingsBody>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<SettingsModelsData, SettingsModelsActions> = {
  id: "settings-models",
  title: "Settings · Models",
  route: "/settings/models",
  component: SettingsModelsPage,
  states: STATES.map((s) => ({ ...s })),
};
