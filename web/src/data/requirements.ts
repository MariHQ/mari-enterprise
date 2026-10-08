/** Rendering requirements, to be resolved against the OrchidDB catalog.
 * These describe required relationships, not a claim that a mapping exists.
 */
export const PAGE_EDGES: Record<string, string[]> = {
  overview: ['Connector → ingested Record', 'Workflow → Run (status, started_at, finished_at)', 'Actor → Change → Record'],
  sources: ['Connector → Temporal polling Workflow or signed Webhook', 'Connector → ingested Record', 'Workflow → Run (status, last_success, error)'],
  workflows: ['Agent Run → Step (tool, outcome, order, timestamps)', 'Agent Run → supporting Record', 'Agent Run → reusable Workflow (review status)', 'Approved Answer → originating Agent Run and supporting Record'],
  'scheduled-tasks': ['Schedule → Workflow (interval, paused, next_run)', 'Workflow → Run (status, started_at, finished_at)'],
  facts: ['Fact → supporting Record', 'Fact → verification or review', 'Fact → conflicting Fact'],
  decisions: ['Decision → supporting Record', 'Decision → owner', 'Decision → affected Record or superseded Decision'],
  insights: ['Connector → ingested Record (observed_at)', 'Actor → Change → Record', 'Run → outcome (timestamp, duration)'],
  audit: ['Record → Review → Finding', 'Finding → supporting Record'],
  'settings-audit-log': ['Actor → Change → Record (timestamp, operation)'],
  publish: ['Approved answer → supporting Record', 'Approved answer → Destination'],
  library: ['Collection → Record'],
  welcome: ['Connector → ingested Record'],
  'settings-general': ['Project → configuration'],
  'settings-members': ['Principal → Project (role, permissions)'],
  'settings-api-keys': ['Service principal → Project (permissions)'],
  'settings-models': ['Model provider → configured Model'],
  'settings-design': ['Project → presentation settings'],
  preferences: ['Principal → preferences'],
};

export function pageReadError(page: string, error: string | null): string | null {
  // Never relabel a timeout, permission failure, or transport error as missing data.
  if (!error || !error.startsWith('GRAPH_MAPPING_REQUIRED:')) return error;
  const edges = PAGE_EDGES[page];
  if (!edges) return error;
  return 'GRAPH_REQUIREMENTS:This page needs these graph mappings:\n' + edges.map(edge => '• ' + edge).join('\n')
    + '\nMap these relationships in the OrchidDB catalog to enable this view. An empty mapped result is valid; a missing mapping is not an empty dataset.';
}
