/** Pure presentation mapping shared by platform adapters. */
import type { OverviewData } from "@mari-design/components/pages/OverviewPage";

const ACTIVITY_POLL_MS = 10_000;

export const EMPTY: OverviewData = {
  personName: "",
  stats: { changes: 0, factsReview: 0, workflowsActive: 0 },
  digest: [], activity: [], docs: [], sources: [],
  activityPollMs: ACTIVITY_POLL_MS,
};
