/** Pure presentation mapping shared by platform adapters. */
/* Sources & connectors adapter.
 *
 * `connectorCatalog` exposes the same catalog as the REST connector endpoint,
 * so the console and ingestion surface cannot disagree about what is wired.
 * Bot delivery belongs to Destinations and is deliberately not queried here. */
import type { FirstSync, SourcesData } from "@mari-design/components/pages/SourcesPage";

const NO_FIRST_SYNC: FirstSync = {
  provider: "", name: "", phase: "", done: 0, total: 0,
  docCount: 0, chunkCount: 0, embeddedCount: 0, lastSyncAt: "", error: "",
};

export const EMPTY: SourcesData = {
  view: "grid", sources: [], catalog: [], connector: null, connectPhase: "configure",
  uploadFiles: [], syncPhase: "queued", firstSync: NO_FIRST_SYNC,
  summary: [],
};
