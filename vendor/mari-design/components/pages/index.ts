import type { PageModule } from "./types";

/* Registry of all console pages, in canvas row order (one row per page). */

import { page as overview } from "./OverviewPage";
import { page as knowledge } from "./KnowledgePage";
import { page as docReview } from "./DocReviewPage";
import { page as decisions } from "./DecisionsPage";
import { page as library } from "./LibraryPage";
import { page as lineage } from "./LineagePage";
import { page as facts } from "./FactsPage";
import { page as audit } from "./AuditPage";
import { page as publish } from "./PublishPage";
import { page as insights } from "./InsightsPage";
import { page as workflows } from "./WorkflowsPage";
import { page as scheduledTasks } from "./ScheduledTasksPage";
import { page as sources } from "./SourcesPage";
import { page as preferences } from "./PreferencesPage";
import { page as settingsGeneral } from "./SettingsGeneralPage";
import { page as settingsMembers } from "./SettingsMembersPage";
import { page as settingsModels } from "./SettingsModelsPage";
import { page as settingsApiKeys } from "./SettingsApiKeysPage";
import { page as settingsAuditLog } from "./SettingsAuditLogPage";
import { page as settingsDesign } from "./SettingsDesignPage";
import { page as lookbook } from "./LookbookPage";
import { page as login } from "./LoginPage";
import { page as setup } from "./SetupPage";
import { page as welcome } from "./WelcomePage";

export const PAGES: PageModule<any, any>[] = [
  overview,
  knowledge,
  docReview,
  decisions,
  library,
  lineage,
  facts,
  audit,
  publish,
  insights,
  workflows,
  scheduledTasks,
  sources,
  preferences,
  settingsGeneral,
  settingsMembers,
  settingsModels,
  settingsApiKeys,
  settingsAuditLog,
  settingsDesign,
  lookbook,
  login,
  setup,
  welcome,
];

export type { PageModule, PageStateDef, PageProps, PageComponent } from "./types";
