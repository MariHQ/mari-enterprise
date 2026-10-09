import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Toaster } from "../feedback/Toast";
import * as F from "../features";
import { FEATURE_PROPS } from "./fixtures/features";

/* One macro/page component per feature spec (mari-pages/features). The
   features themselves are pure presenters and ship no demo data
   (MIGRATION.md), so the gallery hands each one the same fixture the
   corresponding page renders — see `.preview/fixtures/features.ts`. `props`
   below only carries per-tile overrides on top of that. Grouped by product
   area. */

type Entry = { name: keyof typeof F; title: string; props?: Record<string, unknown> };
type Group = { group: string; items: Entry[] };

const GROUPS: Group[] = [
  { group: "Overview", items: [
    { name: "OverviewStatTiles", title: "Headline stat tiles" },
    { name: "OverviewDigestCard", title: "This week's digest" },
    { name: "OverviewSourcePulse", title: "Source pulse" },
    { name: "OverviewLiveActivity", title: "Live activity" },
    { name: "OverviewRecentDocs", title: "Recent docs" },
  ] },
  { group: "Knowledge", items: [
    { name: "KnowledgeBrowser", title: "Knowledge browser (facets + feed)" },
    { name: "KnowledgeInspector", title: "Knowledge inspector rail" },
  ] },
  { group: "Doc review", items: [
    { name: "DocReviewEditor", title: "Block editor" },
    { name: "DocReviewMarkdown", title: "Markdown engine" },
    { name: "DocReviewFindingsPanel", title: "Findings / fact-check" },
    { name: "DocReviewChangeQueue", title: "Change queue (word diff)" },
    { name: "DocReviewRefinePanel", title: "Refine panel" },
    { name: "DocReviewOutlinePanel", title: "Outline + revisions" },
  ] },
  { group: "Lineage", items: [
    { name: "LineageGraph", title: "Graph canvas" },
    { name: "LineageToolbar", title: "Toolbar" },
    { name: "LineageTimeScrubber", title: "Time scrubber" },
    { name: "LineageDataModel", title: "Model — legend" },
    { name: "LineageNodeDrawer", title: "Node drawer" },
    { name: "LineageEdgeDrawer", title: "Edge drawer" },
    { name: "LineageGroupDrawer", title: "Group (roll-up) drawer" },
    { name: "LineageAssertDrawer", title: "Impact-analysis drawer" },
  ] },
  { group: "Insights", items: [
    { name: "InsightsWidgets", title: "Insights widgets" },
    { name: "InsightsFreshnessChart", title: "Freshness chart" },
  ] },
  { group: "Audit", items: [
    { name: "AuditFindingsChecklist", title: "Findings checklist" },
    { name: "FactsVerificationAudit", title: "Facts verification audit" },
  ] },
  { group: "Library", items: [
    { name: "LibraryGlossaryPanel", title: "Glossary panel" },
    { name: "LibraryGuidesPanel", title: "Style guides panel" },
    { name: "LibraryRulesPanel", title: "Rules panel" },
    { name: "LibraryTagsPanel", title: "Tags panel" },
    { name: "LibraryTemplatesPanel", title: "Templates panel" },
  ] },
  { group: "Answers", items: [
    { name: "AnswersHarvestWizard", title: "Harvest wizard" },
    { name: "AnswerCard", title: "Answer card" },
  ] },
  { group: "Sources", items: [
    { name: "SourcesConnectorCard", title: "Connector card grid" },
    { name: "SourcesConnectorWizard", title: "Add-source wizard", props: { defaultOpen: false } },
    { name: "SourcesSyncStatus", title: "Sync status & phases" },
    { name: "SourcesBots", title: "Bots (Slack + webhook)", props: { defaultOpen: null } },
  ] },
  { group: "Onboarding", items: [
    { name: "WelcomeGenericConnect", title: "Connect a connector", props: { defaultOpen: false } },
    { name: "WelcomeGithubConnect", title: "Connect GitHub", props: { defaultOpen: false } },
    { name: "WelcomeGlossaryStep", title: "Seed the glossary" },
    { name: "WelcomeGuideStep", title: "Pick a style guide" },
    { name: "WelcomeSyncPanel", title: "Live sync panel" },
    { name: "WelcomeUploadConnect", title: "Upload files", props: { defaultOpen: false } },
  ] },
  { group: "Admin", items: [
    { name: "SettingsMembersTable", title: "Members & roles" },
    { name: "SettingsApiKeys", title: "API keys" },
    { name: "SettingsAuditLog", title: "Audit log" },
    { name: "SettingsModelsConfig", title: "Models config" },
    { name: "BrandingEditor", title: "Branding editor" },
    { name: "AuthSession", title: "Sign in & session" },
  ] },
  { group: "Publish", items: [
    { name: "PublishMcpServers", title: "MCP servers" },
  ] },
  { group: "Misc (macro of a primitive)", items: [
    { name: "ImpactPanelFeature", title: "Impact panel (Facts context)" },
    { name: "DecisionCardFeature", title: "Decision card (ledger)" },
    { name: "TokenRevealFeature", title: "Token reveal (API keys)" },
    { name: "TagPickerFeature", title: "Tag picker (documents)" },
    { name: "GlobalIconsArt", title: "Icons, marks & notebook art" },
    { name: "ChatDockFeature", title: "Chat dock (agent)" },
  ] },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function FeatureBlock({ name, title, props }: Entry) {
  const Cmp = F[name] as React.ComponentType<Record<string, unknown>>;
  /* Fixture first, tile override second: a tile that pins `defaultOpen` still
     gets the shared data props underneath it. */
  const resolved = { ...(FEATURE_PROPS[name] ?? {}), ...(props ?? {}) };
  return (
    // id = the feature's export name, so QA tooling can screenshot exactly one
    // feature (`node scripts/shot.mjs psec:<Name>`).
    <div id={name} className="mb-8 scroll-mt-4">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <span className="font-mono text-[10.5px] text-ink/35">{name}</span>
      </div>
      <div className="rounded-md border border-ink/12 bg-flysch/40 p-4 overflow-x-auto">
        {Cmp ? <Cmp {...resolved} /> : <div className="text-[13px] text-espelette">Missing export: {name}</div>}
      </div>
    </div>
  );
}

function Pages() {
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-espelette">Mari Design</div>
          <a href="./index.html" className="font-mono text-[11px] uppercase tracking-widest text-biscay-2 hover:text-ink underline underline-offset-4 decoration-biscay-2/40">← Components</a>
        </div>
        <h1 className="text-2xl font-semibold text-ink mt-1">Page components</h1>
        <p className="text-[13px] text-ink/55 mt-1">
          {total} macro / page-level features distilled from the Mari console — each composes the primitives from the
          <a href="./index.html" className="text-biscay-2 hover:underline"> component library</a>. Live and interactive, on the same canvas fixtures the pages render.
        </p>
        <nav className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
          {GROUPS.map((g) => (
            <a key={g.group} href={`#${slug(g.group)}`} className="font-mono text-[11px] text-ink/50 hover:text-biscay-2">{g.group}</a>
          ))}
        </nav>
      </header>

      {GROUPS.map((g) => (
        <section key={g.group} id={slug(g.group)} className="mb-12 scroll-mt-4">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-ink/45 mb-4 pb-2 border-b border-ink/10">{g.group}</h2>
          {g.items.map((it) => <FeatureBlock key={it.name} {...it} />)}
        </section>
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster>
      <Pages />
    </Toaster>
  </StrictMode>,
);
