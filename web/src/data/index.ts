import { usePlatformWorkflows } from './platform-workflows';
import { usePlatformFacts } from './platform-facts';
import { usePlatformDecisions } from './platform-decisions';
import { usePlatformOverview, usePlatformSources } from './platform-views';
import { usePlatformScheduledTasks } from './platform-operations';
import { usePlatformKnowledge, usePlatformDocument, usePlatformLineage } from './platform';
import { useLogin } from './auth-pages';
import { pageReadError } from './requirements';
import type { Adapter } from './types';

const ADAPTERS: Record<string, Adapter<any>> = {
  workflows: usePlatformWorkflows, facts: usePlatformFacts, decisions: usePlatformDecisions,
  overview: usePlatformOverview, sources: usePlatformSources,
  'scheduled-tasks': usePlatformScheduledTasks, knowledge: usePlatformKnowledge,
  'doc-review': usePlatformDocument, lineage: usePlatformLineage,
  login: useLogin,
};

export function adapterFor(pageId: string): Adapter<any> {
  return ADAPTERS[pageId] ?? (() => ({data: null, loading: false,
    error: pageReadError(pageId, 'GRAPH_MAPPING_REQUIRED: This view needs a platform mapping.')}));
}
