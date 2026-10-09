/* Macro / page-level feature components — each composes the library's
 * primitives into a full feature (card / panel / view / drawer / wizard /
 * editor), distilled from the mari-cloud console (see mari-pages/features).
 * Every component renders standalone with baked-in demo data; all props are
 * optional. Kept in their own barrel (not re-exported by the root index) so
 * macro names can mirror the primitives they build on. */

// Overview
export { OverviewStatTiles } from "./OverviewStatTiles";
export { OverviewDigestCard } from "./OverviewDigestCard";
export { OverviewSourcePulse } from "./OverviewSourcePulse";
export { OverviewLiveActivity } from "./OverviewLiveActivity";
export { OverviewRecentDocs } from "./OverviewRecentDocs";

// Knowledge
export { KnowledgeBrowser } from "./KnowledgeBrowser";
export { KnowledgeInspector } from "./KnowledgeInspector";

// Doc review
export { DocReviewEditor } from "./DocReviewEditor";
export { DocReviewMarkdown } from "./DocReviewMarkdown";
export { DocReviewFindingsPanel } from "./DocReviewFindingsPanel";
export { DocReviewChangeQueue } from "./DocReviewChangeQueue";
export { DocReviewRefinePanel } from "./DocReviewRefinePanel";
export { DocReviewOutlinePanel } from "./DocReviewOutlinePanel";

// Lineage
export { LineageDataModel, type GraphView, type DocHistoryRow } from "./LineageDataModel";
export { LineageGraph } from "./LineageGraph";
export { LineageToolbar } from "./LineageToolbar";
export { LineageTimeScrubber } from "./LineageTimeScrubber";
export { LineageNodeDrawer } from "./LineageNodeDrawer";
export { LineageEdgeDrawer } from "./LineageEdgeDrawer";
export { LineageGroupDrawer } from "./LineageGroupDrawer";
export { LineageAssertDrawer } from "./LineageAssertDrawer";

// Insights
export { InsightsWidgets } from "./InsightsWidgets";
/* `Freshness` carries the source's display LABEL now: the chart no longer has
   a table turning "github" into a repository name it cannot know, so a caller
   has to name its own sources. `BandKey` is what `openFreshness` reports. */
export { InsightsFreshnessChart, type Freshness, type BandKey } from "./InsightsFreshnessChart";

// Audit
export { AuditFindingsChecklist } from "./AuditFindingsChecklist";
/* `factStatusKey` / `isVerifiedFact` are the one place a status string is
   normalised. An adapter that spells the test itself ("status === 'verified'")
   disagrees with the page about "Verified", "verified" and "VERIFIED". */
export {
  FactsVerificationAudit, factStatusKey, isVerifiedFact, type Fact,
} from "./FactsVerificationAudit";

// Library
export { LibraryGlossaryPanel } from "./LibraryGlossaryPanel";
export { LibraryGuidesPanel } from "./LibraryGuidesPanel";
/* `rulesMatching` counts the compiled rule registry against a query. The
   registry lives inside the panel (live RegExps, no server rows), so a page
   that searches across the whole Library has no other way to say how many
   rules matched. */
export {
  LibraryRulesPanel, RULE_COUNT, rulesMatching,
  type CheckerDoc, type LibraryRulesActions,
} from "./LibraryRulesPanel";
export { LibraryTagsPanel } from "./LibraryTagsPanel";
export { LibraryTemplatesPanel } from "./LibraryTemplatesPanel";

// Answers
/* `SourceId` is what the wizard asks a scan for; `HarvestProposal` is what a
   scan answers with. Both are the handler's signature, so a caller cannot
   implement the scan without them. */
export {
  AnswersHarvestWizard, type SourceId, type HarvestProposal,
} from "./AnswersHarvestWizard";
export { AnswerCard } from "./AnswerCard";

// Sources
export { SourcesConnectorCard, type Source, type Tier, type SyncState } from "./SourcesConnectorCard";
export { SourcesConnectorWizard } from "./SourcesConnectorWizard";
export { SourcesSyncStatus } from "./SourcesSyncStatus";
export {
  SourcesBots, type SourcesBotsActions, type SlackStatus, type GithubStatus,
} from "./SourcesBots";

// Onboarding
export { WelcomeGenericConnect } from "./WelcomeGenericConnect";
export { WelcomeGithubConnect } from "./WelcomeGithubConnect";
export { WelcomeGlossaryStep } from "./WelcomeGlossaryStep";
export { WelcomeGuideStep } from "./WelcomeGuideStep";
export { WelcomeSyncPanel } from "./WelcomeSyncPanel";
export { WelcomeUploadConnect } from "./WelcomeUploadConnect";

// Admin
export { SettingsMembersTable } from "./SettingsMembersTable";
/* `API_SCOPES` is the scope vocabulary the key form offers; a caller that
   invents its own list mints keys the server has no scope for. */
export {
  SettingsApiKeys, API_SCOPES, type ApiKey, type SettingsApiKeysActions,
} from "./SettingsApiKeys";
/* `detail` rides the event now (any row expands), so an adapter builds rows of
   this shape rather than a page-level detail list. */
export { SettingsAuditLog, type AuditEvent, type AuditDetail } from "./SettingsAuditLog";
export { SettingsModelsConfig } from "./SettingsModelsConfig";
export { BrandingEditor } from "./BrandingEditor";
export { AuthSession } from "./AuthSession";

// Publish
export { PublishMcpServers } from "./PublishMcpServers";

// Misc (macro versions of single primitives, in page context)
export { ImpactPanelFeature } from "./ImpactPanelFeature";
export { DecisionCardFeature } from "./DecisionCardFeature";
export { TokenRevealFeature } from "./TokenRevealFeature";
export { TagPickerFeature } from "./TagPickerFeature";
export { GlobalIconsArt } from "./GlobalIconsArt";
export { ChatDockFeature } from "./ChatDockFeature";
