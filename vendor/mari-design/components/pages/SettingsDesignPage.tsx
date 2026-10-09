import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor } from "./PageFrame";
import { SettingsTabs, SETTINGS_TAB_LABELS } from "./SettingsTabs";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { ReadError } from "../feedback/ReadError";
import { Alert } from "../feedback/Alert";
import { PropertyList, type PropertyItem } from "../data-display/PropertyList";
import { SkeletonPage } from "../data-display/Skeletons";
import { Palette } from "lucide-react";
import {
  BrandingEditor,
  type Branding, type BrandHarvest, type BrandPreviewStat, type BrandingEditorActions,
} from "../features/BrandingEditor";

/* Settings → Design & brand.
 *
 * The tab existed and pointed at the component catalog — the library's own
 * documentation, which is about this design system rather than about your
 * workspace, and which crashed outright in an app because it is the one page
 * with no adapter behind it. So the one Settings tab named after the thing a
 * customer most wants to change was the one tab that did not work.
 *
 * This is the real destination: the brand a workspace publishes under. Its
 * editor already existed and was reachable only as a sub-section of the
 * workspace form, where it had no way to persist anything.
 *
 * Pure presenter: the saved brand, the import evidence and the preview figures
 * all arrive in `data`.
 */

const STATES = [
  { id: "default", label: "Default" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Still on the defaults" },
  { id: "branded", label: "Brand already set" },
  { id: "imported", label: "Imported from a site" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

export type SettingsDesignData = {
  /** The saved brand. An empty object is "still on the Mari defaults", which
      is a real state and not a missing one. */
  branding: Branding;
  /** What the last import read, replayed when no import handler is supplied. */
  harvest: BrandHarvest;
  /** Figures the live preview shows off, so the preview is about THIS
      workspace rather than invented numbers. */
  previewStats: BrandPreviewStat[];
  /** Read-only facts in the band under the editor. */
  summary: PropertyItem[];
};

export type SettingsDesignActions = BrandingEditorActions;

const PAGE = "mx-auto max-w-[1400px] px-5 py-6 sm:px-8";

/** Nothing chosen yet: the workspace is still on the Mari defaults. A real
    state, and the one the page had no words for (P-SS-1) — the editor drew
    itself as though a brand had been set. */
function isEmpty(d: SettingsDesignData): boolean {
  return Object.values(d.branding).every((v) => !v);
}

function SettingsDesignPage({
  data, loading = false, error = null, actions, chrome, mobile = false,
}: PageProps<SettingsDesignData, SettingsDesignActions>) {
  return (
    <PageFrame chrome={chrome} active={navFor("settings")} title="Settings" mobile={mobile}>
      {loading ? (
        <SkeletonPage
          variant="settings"
          eyebrow="Settings"
          title="Design & brand"
          description="The colours, type, and logo used by workspace-owned experiences."
          tabs={SETTINGS_TAB_LABELS}
          activeTab="Design & brand"
          actions={0}
          mobile={mobile}
        />
      ) : (
        <div className={PAGE}>
          <PageHeader
            eyebrow="Settings"
            title="Design & brand"
            description="The colours, type, and logo used by workspace-owned experiences."
            icon={<span className="text-clay"><Palette size={24} /></span>}
          />
          <div className="mt-5"><SettingsTabs active="design" onNavigate={chrome?.onNavigate} /></div>
          {/* One column, not an editor plus a rail.
              "Where this shows up" is three read-only facts — about 240px of
              card — and the branding editor below it runs past 1,300px, so as a
              320px rail it left the right third of the page empty from the
              palette down. It reads as a closing footnote to the editor anyway
              ("set this, and here is what picks it up"), so that is where it
              sits, full width, with its facts laid out across rather than down
              (§11). */}
          <div className="mt-6 flex min-w-0 flex-col gap-5">
            <div className="flex min-w-0 flex-col gap-5">
              {error ? (
                /* XA-01: a failed read is a blocked banner, never the
                   "nothing here yet" surface. */
                <ReadError>{error}</ReadError>
              ) : (
                <>
                  {/* The editor cannot say "nothing is set here yet" about
                      itself: every control has a default behind it, so a
                      workspace on the Mari palette looks identical to one that
                      chose it. The page says which it is (P-SS-1). */}
                  {isEmpty(data) && (
                    <Alert tone="info" title="Still on the Mari defaults">
                      Nothing has been branded yet. Set an accent and typeface below to establish this workspace's identity.
                    </Alert>
                  )}
                  {!actions?.save && (
                    <Alert tone="attention" title="Read only">
                      This workspace has no way to save a brand yet, so the editor below previews changes without
                      keeping them.
                    </Alert>
                  )}
                  <BrandingEditor
                    branding={data.branding}
                    harvest={data.harvest}
                    previewStats={data.previewStats}
                    actions={actions}
                  />
                </>
              )}
            </div>
            <Card title="Where this shows up" hint="Read only">
              {/* An empty PropertyList renders as a blank box that reads as a
                  loading failure. It says what it means instead. */}
              {data.summary.length === 0 ? (
                <p className="text-[12.5px] leading-relaxed text-ink/70">
                  No workspace-owned destination currently consumes these settings.
                </p>
              ) : (
                <PropertyList items={data.summary} layout="grid" columns={3} boxed={false} />
              )}
            </Card>
          </div>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<SettingsDesignData, SettingsDesignActions> = {
  id: "settings-design",
  title: "Settings · Design & brand",
  route: "/settings/design",
  component: SettingsDesignPage,
  states: STATES.map((s) => ({ ...s })),
};
