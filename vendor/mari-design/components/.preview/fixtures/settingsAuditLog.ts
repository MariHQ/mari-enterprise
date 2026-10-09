/* Settings → Audit log canvas fixtures. Lifted out of
   `pages/SettingsAuditLogPage.tsx` and `features/SettingsAuditLog.tsx`. */

import type { AuditDetail, SettingsAuditLogData } from "../../pages/SettingsAuditLogPage";
import type { AuditEvent } from "../../features/SettingsAuditLog";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import {
  LONG_NAME, LONG_SOURCE, LONG_URL, LONG_WORD, UNBREAKABLE, MIXED_SCRIPT,
  HUGE_NUMBER_STR, repeat,
} from "./stress";

/* Detail rides the EVENT now: the log lets you expand any row, so a row
   without its own `detail` draws no expand control at all. Most rows carry
   theirs; event 3 deliberately does not, so the page-level `detail` merge
   (the shape an app that resolves only the expanded row sends) still gets
   exercised by the `expanded` state below. Event 8 carries none either — a
   row with nothing to expand is a real row. */
const EVENTS: AuditEvent[] = [
  { id: 1, actor: "Maya Chen", verb: "invited member", target: "sam@team.com", at: "2025-07-20T15:42:00",
    detail: [
      { label: "Event ID", value: "evt_1a44b02" },
      { label: "Actor IP", value: "203.0.113.24" },
      { label: "Role offered", value: "member" },
      { label: "Source", value: "web · console" },
    ] },
  { id: 2, actor: "Devon Park", verb: "revoked API key", target: "Old bot (rotated)", at: "2025-07-20T11:08:00",
    detail: [
      { label: "Event ID", value: "evt_2b71c9d" },
      { label: "Key prefix", value: "mk_live_4f2c…" },
      { label: "Last used", value: "Jul 12, 2025" },
    ] },
  { id: 3, actor: "Priya Nair", verb: "changed role", target: "devon@team.com to Manager", at: "2025-07-19T18:20:00" },
  { id: 4, actor: "Maya Chen", verb: "deployed site", target: "docs.acme.com v14", at: "2025-07-19T09:55:00",
    detail: [
      { label: "Event ID", value: "evt_4d09e13" },
      { label: "Before", value: "v13" },
      { label: "After", value: "v14" },
      { label: "Docs deployed", value: "148" },
    ] },
  { id: 5, actor: "System", verb: "synced source", target: "GitHub · acme/handbook", at: "2025-07-18T22:03:00",
    detail: [
      { label: "Event ID", value: "evt_5e22f80" },
      { label: "Documents", value: "62 added, 11 updated" },
      { label: "Source", value: "scheduled sync" },
    ] },
  { id: 6, actor: "Devon Park", verb: "updated setting", target: "llm set to anthropic:claude-3.5", at: "2025-07-18T14:17:00",
    detail: [
      { label: "Event ID", value: "evt_6f13a55" },
      { label: "Before", value: "llm=openai:gpt-4o" },
      { label: "After", value: "llm=anthropic:claude-3.5" },
    ] },
  { id: 7, actor: "Priya Nair", verb: "created MCP server", target: "support-kb", at: "2025-07-17T10:44:00",
    detail: [
      { label: "Event ID", value: "evt_7a90c31" },
      { label: "Scope", value: "product" },
      { label: "Capabilities", value: "search, facts, answers" },
    ] },
  { id: 8, actor: "Maya Chen", verb: "verified fact", target: "SLA response time", at: "2025-07-16T16:30:00" },
];

const DETAIL: AuditDetail[] = [
  { label: "Event ID", value: "evt_3f8a20c" },
  { label: "Actor IP", value: "203.0.113.24" },
  { label: "Before", value: "role=user" },
  { label: "After", value: "role=manager" },
  { label: "Source", value: "web · console" },
  { label: "Request", value: "req_9c1e…" },
];

const SUMMARY: PropertyItem[] = [
  { label: "Events, 30 days", value: "214" },
  { label: "Retention", value: "90 days" },
  { label: "Actors", value: "6 people, 1 system" },
  { label: "Last event", value: "Jul 20, 2025" },
];

const BASE: SettingsAuditLogData = {
  events: EVENTS,
  total: EVENTS.length,
  filter: null,
  expandedId: null,
  detail: DETAIL,
  pager: null,
  summary: SUMMARY,
};

/** A workspace where nothing has happened yet. */
const EMPTY: SettingsAuditLogData = { ...BASE, events: [], total: 0 };

function strained(extreme: boolean): SettingsAuditLogData {
  const events: AuditEvent[] = extreme
    ? repeat((i) => ({
        id: i + 1,
        actor: [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT][i % 3],
        verb: UNBREAKABLE,
        target: `${LONG_WORD} → ${MIXED_SCRIPT} ${HUGE_NUMBER_STR}`,
        at: "2025-07-20T15:42:00",
      }), 6)
    : repeat((i) => ({
        id: i + 1,
        actor: LONG_NAME,
        verb: "updated a very long-named workspace setting and reconciled it across regions",
        target: `${LONG_SOURCE} → ${LONG_URL}`,
        at: "2025-07-20T15:42:00",
      }), 6);
  const strainedDetail: AuditDetail[] = DETAIL.map((d) => ({
    label: extreme ? MIXED_SCRIPT : d.label,
    value: extreme ? UNBREAKABLE : LONG_URL,
  }));
  return {
    ...BASE,
    /* Row detail is user data too, so the expanded panel gets strained with
       everything else — and one row starts open to prove it. */
    events: events.map((e) => ({ ...e, detail: strainedDetail })),
    expandedId: 1,
    total: extreme ? 987654321 : 214,
    detail: strainedDetail,
    summary: [
      { label: "Events, 30 days", value: extreme ? `${HUGE_NUMBER_STR} ${UNBREAKABLE}` : HUGE_NUMBER_STR },
      { label: "Retention", value: extreme ? MIXED_SCRIPT : "90 days" },
      { label: "Actors", value: extreme ? UNBREAKABLE : LONG_NAME },
      { label: "Last event", value: extreme ? UNBREAKABLE : LONG_SOURCE, stacked: true },
    ],
  };
}

export const FIXTURES: PageFixtures<SettingsAuditLogData> = {
  default: { data: BASE },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "The audit log is temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  "filtered-actor": {
    data: {
      ...BASE,
      filter: { label: "actor: Maya Chen", matches: EVENTS.filter((e) => e.actor === "Maya Chen") },
    },
  },
  "filtered-action": {
    data: {
      ...BASE,
      filter: { label: "action: changed role", matches: EVENTS.filter((e) => e.verb.includes("role")) },
    },
  },
  "filtered-date": {
    data: {
      ...BASE,
      filter: { label: "date: 2025-07-20", matches: EVENTS.filter((e) => e.at.startsWith("2025-07-20")) },
    },
  },
  "no-match": { data: { ...BASE, filter: { label: "actor: nobody", matches: [] } } },
  expanded: { data: { ...BASE, expandedId: 3 } },
  many: {
    data: {
      ...BASE,
      total: 214,
      pager: { page: 0, pageCount: 27, label: "Showing 1 to 8 of 214" },
    },
  },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
