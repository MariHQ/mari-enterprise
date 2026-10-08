import { loginActions } from './login';
import { platformWorkflowActions } from '../platform-workflows';
import { platformFactActions } from '../platform-facts';
import { platformDecisionActions } from '../platform-decisions';
import { platformScheduledActions } from '../platform-operations';
import { platformKnowledgeActions, platformDocumentActions, platformLineageActions } from '../platform';

export type ActionContext = {
  /** Last confirmed signed-in display name, for ownership defaults. */
  currentUserName: string;
  /** Re-read /auth/me; the auth screens route off the result. */
  refresh: () => Promise<void> | void;
  /** Follow an in-app href. The library must never navigate itself — a
      component doing `window.location.href = "/"` hard-reloads the SPA and
      hardcodes one app's URL scheme into a shared component. */
  navigate: (href: string) => void;
  /** Same, but replacing the current entry instead of pushing a new one. For
      state that lives in the URL because it must be shareable, not because
      every keystroke of it is a place to go back to (a search box). */
  replace: (href: string) => void;
};

export const ACTION_FACTORIES: Record<string, (ctx: ActionContext) => unknown> = {
  login: loginActions, workflows: platformWorkflowActions, facts: platformFactActions,
  decisions: platformDecisionActions, 'scheduled-tasks': platformScheduledActions,
  knowledge: platformKnowledgeActions, 'doc-review': platformDocumentActions,
  lineage: platformLineageActions,
};
