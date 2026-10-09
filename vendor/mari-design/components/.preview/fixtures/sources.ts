/* Sources & connectors canvas fixtures. Lifted out of `pages/SourcesPage.tsx`
   and the Sources* features, which are now pure presenters. Everything here is
   plain JSON: brand marks are derived from the provider key by the page. */

import type {
  Connector, FirstSync, SourcesData, SourcesView,
} from "../../pages/SourcesPage";
import type { Source } from "../../features/SourcesConnectorCard";
import type { WizardProviderSpec } from "../../features/SourcesConnectorWizard";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_SOURCE, LONG_DOC_TITLE, LONG_URL,
  UNBREAKABLE, LONG_WORD, HUGE_NUMBER, MIXED_SCRIPT,
} from "./stress";

/* `syncIntervalMinutes` is what the schedule card is drawn from, per source:
   a number is an automatic schedule, `null` is manual only, and OMITTING it
   means the server reported no schedule for that source — so that row is left
   out of the card entirely rather than shown a guessed value. All three cases
   appear here, because all three are the point of the control. */
const SOURCES: Source[] = [
  {
    id: "gh", provider: "github", name: "acme/handbook", tier: "live", state: "running",
    phase: "embedding", done: 340, total: 512,
    docCount: 1284, chunkCount: 8912, embeddedCount: 8340,
    lastSyncAt: "2026-07-21T14:12:00", bars: [3, 5, 4, 8, 6, 9, 7, 11],
    syncIntervalMinutes: 60,
  },
  {
    id: "slack", provider: "slack", name: "Slack · #engineering", tier: "live", state: "healthy",
    docCount: 4210, chunkCount: 15330, embeddedCount: 15330,
    lastSyncAt: "2026-07-21T09:41:00", bars: [6, 4, 7, 5, 8, 6, 9, 7],
    syncIntervalMinutes: 1440,
  },
  {
    id: "notion", provider: "notion", name: "Notion · Product wiki", tier: "legacy", state: "healthy",
    docsCount: 620, lastSyncAt: null, syncIntervalMinutes: null,
  },
  {
    id: "gdrive", provider: "gdrive", name: "Google Drive · Design", tier: "actionless", state: "healthy",
    docsCount: 88, lastSyncAt: null,
  },
  {
    id: "web", provider: "dropbox", name: "Dropbox · /docs", tier: "legacy", state: "paused",
    docsCount: 143, lastSyncAt: "2026-07-19T18:02:00", bars: [4, 3, 5, 2, 4, 3, 4, 3],
  },
  {
    id: "conf", provider: "confluence", name: "Confluence · Ops", tier: "live", state: "failed",
    docCount: 512, chunkCount: 3100, embeddedCount: 2870,
    lastSyncAt: "2026-07-20T22:15:00",
    lastError: "GET /rest/api/content returned 401, the token expired.",
    /* Stored settings as the API reports them: secrets masked, never in the
       clear. The edit-connection dialog prefills the non-secret values. */
    config: { base_url: "https://acme.atlassian.net/wiki", email: "dana@acme.com", api_token: "••••••" },
  },
  /* A SECOND instance of the same provider: the multi-instance case the
     wizard's Add-another tile and the card menu's "Add another Confluence"
     exist for. Never given a display name, so every surface that shows it
     falls back to its qualifier. */
  {
    id: "conf2", provider: "confluence", name: "rippling.atlassian.net", tier: "live", state: "healthy",
    docCount: 96, chunkCount: 540, embeddedCount: 540,
    lastSyncAt: "2026-07-21T07:40:00",
    config: { base_url: "https://rippling.atlassian.net/wiki", email: "dana@acme.com", api_token: "••••••" },
  },
];

const CATALOG: WizardProviderSpec[] = [
  {
    key: "github", name: "GitHub", blurb: "Sync Markdown docs from a repository, read-only.", connected: false,
    docsUrl: "https://docs.github.com/authentication",
    fields: [
      { key: "repo", label: "Repository", placeholder: "acme/handbook", help: "owner/name of a repo your token can read." },
      { key: "paths", label: "Paths filter (glob)", placeholder: "**/*.md" },
    ],
  },
  {
    /* Connected WITH instance data: the tile names the live source and offers
       "Add another" in place of the Connected chip. */
    key: "slack", name: "Slack", blurb: "Import channel history into your knowledge library.",
    connected: true,
    instances: [{ sourceId: "slack", name: "Slack · #engineering", qualifier: "" }],
    fields: [
      { key: "bot_token", label: "Bot token", secret: true, placeholder: "xoxb-…", help: "Needs channels:history + channels:read." },
      { key: "channel", label: "Channel", placeholder: "#engineering" },
    ],
  },
  {
    key: "gdrive", name: "Google Drive", blurb: "Index docs from a shared Drive folder.",
    fields: [
      { key: "service_account_json", label: "Service account JSON", secret: true, multiline: true, placeholder: '{ "type": "service_account", … }' },
      { key: "folder_id", label: "Folder ID", placeholder: "1a2B3c…" },
    ],
  },
  {
    key: "notion", name: "Notion", blurb: "Sync pages from a Notion database.",
    fields: [
      { key: "token", label: "Internal integration token", secret: true, placeholder: "secret_…" },
      { key: "database_id", label: "Database ID", placeholder: "8a5f…" },
    ],
  },
  {
    key: "granola", name: "Granola", blurb: "Bring in meeting notes and transcripts.",
    fields: [{ key: "api_key", label: "API key", secret: true, placeholder: "gr-…" }],
  },
  {
    /* Two live instances, the second with no display name: the tile's list
       falls back to the qualifier for it, which is the fallback's demo. */
    key: "confluence", name: "Confluence", blurb: "Index spaces and pages from Confluence Cloud.",
    connected: true,
    instances: [
      { sourceId: "conf", name: "Confluence · Ops", qualifier: "acme.atlassian.net" },
      { sourceId: "conf2", name: "", qualifier: "rippling.atlassian.net" },
    ],
    fields: [
      { key: "base_url", label: "Base URL", placeholder: "https://acme.atlassian.net/wiki" },
      { key: "email", label: "Email", placeholder: "you@acme.com" },
      { key: "api_token", label: "API token", secret: true, placeholder: "ATATT…" },
    ],
  },
  {
    key: "jira", name: "Jira", blurb: "Sync issues and comments from a Jira project.",
    fields: [
      { key: "base_url", label: "Base URL", placeholder: "https://acme.atlassian.net" },
      { key: "email", label: "Email", placeholder: "you@acme.com" },
      { key: "api_token", label: "API token", secret: true },
    ],
  },
  {
    key: "linear", name: "Linear", blurb: "Index issues and docs from Linear.",
    fields: [{ key: "api_key", label: "API key", secret: true, placeholder: "lin_api_…" }],
  },
];

const CONNECTORS: Record<string, Connector> = {
  github: {
    key: "github", name: "GitHub", blurb: "Sync Markdown docs from a repository, read-only.",
    docsUrl: "https://docs.github.com/authentication", detail: "acme/handbook",
    fields: [
      { label: "Repository", value: "acme/handbook", help: "owner/name of a repo your token can read." },
      { label: "Access token", value: "ghp_R8xQ2v••••••••••••••", secret: true },
      { label: "Paths filter (glob)", value: "**/*.md" },
    ],
    sync: { done: 340, total: 512, docCount: 1284, chunkCount: 8912, embeddedCount: 8340 },
  },
  slack: {
    key: "slack", name: "Slack", blurb: "Import channel history into your knowledge library.",
    detail: "#engineering",
    fields: [
      { label: "Bot token", value: "xoxb-2481••••••••••••", secret: true, help: "Needs channels:history + channels:read." },
      { label: "Channel", value: "#engineering" },
    ],
    sync: { done: 210, total: 480, docCount: 4210, chunkCount: 15330, embeddedCount: 12040 },
  },
  notion: {
    key: "notion", name: "Notion", blurb: "Sync pages from a Notion database.",
    detail: "Product wiki",
    fields: [
      { label: "Internal integration token", value: "secret_9Fa2••••••••", secret: true },
      { label: "Database ID", value: "8a5f0e2c-91d4-4b77-a1e2-6f3c" },
    ],
    sync: { done: 88, total: 240, docCount: 620, chunkCount: 3120, embeddedCount: 2140 },
  },
  gdrive: {
    key: "gdrive", name: "Google Drive", blurb: "Index docs from a shared Drive folder.",
    detail: "Design",
    fields: [
      { label: "Service account JSON", value: '{ "type": "service_account", "project_id": "acme-docs", "private_key_id": "a1b2c3" … }', secret: true, multiline: true },
      { label: "Folder ID", value: "1a2B3c4D5e6F7g8H9i0J" },
    ],
    sync: { done: 44, total: 120, docCount: 340, chunkCount: 1980, embeddedCount: 1120 },
  },
  confluence: {
    key: "confluence", name: "Confluence", blurb: "Index spaces and pages from Confluence Cloud.",
    detail: "Ops space",
    fields: [
      { label: "Base URL", value: "https://acme.atlassian.net/wiki" },
      { label: "Email", value: "dana@acme.com" },
      { label: "API token", value: "ATATT3xFfGF0••••••••", secret: true },
    ],
    sync: { done: 160, total: 512, docCount: 512, chunkCount: 3100, embeddedCount: 2870 },
  },
  jira: {
    key: "jira", name: "Jira", blurb: "Sync issues and comments from a Jira project.",
    detail: "PLAT project",
    fields: [
      { label: "Base URL", value: "https://acme.atlassian.net" },
      { label: "Email", value: "dana@acme.com" },
      { label: "API token", value: "ATATT3xFfGF0••••••••", secret: true },
      { label: "Project key", value: "PLAT" },
    ],
    sync: { done: 96, total: 320, docCount: 780, chunkCount: 4200, embeddedCount: 3010 },
  },
  linear: {
    key: "linear", name: "Linear", blurb: "Index issues and docs from Linear.",
    detail: "Engineering team",
    fields: [
      { label: "API key", value: "lin_api_9Xa2••••••••", secret: true },
      { label: "Team", value: "Engineering" },
    ],
    sync: { done: 120, total: 260, docCount: 430, chunkCount: 1740, embeddedCount: 1290 },
  },
  upload: {
    key: "upload", name: "Upload", blurb: "Drop files to index them directly — no credentials needed.",
    detail: "6 files", upload: true, fields: [],
    sync: { done: 4, total: 6, docCount: 6, chunkCount: 210, embeddedCount: 140 },
  },
};

const UPLOAD_FILES = [
  "product-brief.pdf", "pricing-2026.md", "security-overview.docx",
  "onboarding-runbook.md", "faq.md", "architecture.pdf",
];

const FIRST_SYNC: FirstSync = {
  provider: "github",
  name: "GitHub · acme/handbook",
  phase: "Chunking",
  done: 180,
  total: 512,
  docCount: 500,
  chunkCount: 8912,
  embeddedCount: 3100,
  lastSyncAt: "2026-07-21T14:12:00",
  error: "GET /repos/acme/handbook returned 401: the token expired or was revoked.",
};

const SUMMARY: PropertyItem[] = [
  { label: "Connected sources", value: "7 of 14" },
  { label: "Documents", value: "12,480" },
  { label: "Chunks embedded", value: "12,201" },
  { label: "Last sync", value: "Jul 21, 2026" },
];

const BASE: SourcesData = {
  view: "grid",
  sources: SOURCES,
  catalog: CATALOG,
  connector: null,
  connectPhase: "configure",
  uploadFiles: UPLOAD_FILES,
  syncPhase: "queued",
  firstSync: FIRST_SYNC,
  summary: SUMMARY,
};

/** Nothing connected at all. */
const EMPTY: SourcesData = { ...BASE, sources: [] };

const view = (v: SourcesView, over: Partial<SourcesData> = {}): { data: SourcesData } =>
  ({ data: { ...BASE, view: v, ...over } });

const connect = (key: string, phase: SourcesData["connectPhase"]): { data: SourcesData } =>
  view("connect", { connector: CONNECTORS[key], connectPhase: phase });

const sync = (phase: SourcesData["syncPhase"]): { data: SourcesData } =>
  view("sync-status", { syncPhase: phase });

/** Long connector names and the credential token/URL fields are the prime
    horizontal-overflow cases here. Overflow strains the connectors grid;
    stress strains the inline connect flow's credential fields. */
function strained(extreme: boolean): SourcesData {
  if (extreme) {
    return {
      ...BASE,
      view: "connect",
      connectPhase: "configure",
      sources: [
        { id: "gh", provider: "github", name: UNBREAKABLE, tier: "live", state: "running", phase: "embedding", done: 340, total: 512, docCount: HUGE_NUMBER, chunkCount: HUGE_NUMBER, embeddedCount: HUGE_NUMBER, lastSyncAt: "2026-07-21T14:12:00", bars: [3, 5, 4, 8, 6, 9, 7, 11] },
        { id: "conf", provider: "confluence", name: LONG_WORD, tier: "live", state: "failed", docCount: HUGE_NUMBER, chunkCount: HUGE_NUMBER, embeddedCount: HUGE_NUMBER, lastSyncAt: "2026-07-20T22:15:00", lastError: `${UNBREAKABLE} ${LONG_URL}` },
        { id: "mix", provider: "slack", name: MIXED_SCRIPT, tier: "legacy", state: "healthy", docsCount: HUGE_NUMBER, lastSyncAt: "2026-07-19T18:02:00" },
      ],
      connector: {
        key: "github", name: UNBREAKABLE, blurb: MIXED_SCRIPT, detail: LONG_URL,
        fields: [
          { label: "Base URL", value: LONG_URL },
          { label: "Access token", value: UNBREAKABLE, secret: true, help: LONG_URL },
          { label: "Service account JSON", value: `${MIXED_SCRIPT} ${UNBREAKABLE}`, secret: true, multiline: true },
        ],
        sync: { done: 340, total: 512, docCount: HUGE_NUMBER, chunkCount: HUGE_NUMBER, embeddedCount: HUGE_NUMBER },
      },
      firstSync: { ...FIRST_SYNC, name: MIXED_SCRIPT, error: `${UNBREAKABLE} ${LONG_URL}` },
      summary: [
        { label: "Connected sources", value: UNBREAKABLE },
        { label: "Documents", value: MIXED_SCRIPT },
        { label: "Chunks embedded", value: UNBREAKABLE, stacked: true },
        { label: "Last sync", value: LONG_WORD },
      ],
    };
  }
  return {
    ...BASE,
    view: "grid",
    sources: [
      { id: "gh", provider: "github", name: `GitHub · ${LONG_SOURCE}`, tier: "live", state: "running", phase: "embedding", done: 340, total: 512, docCount: 1284, chunkCount: 8912, embeddedCount: 8340, lastSyncAt: "2026-07-21T14:12:00", bars: [3, 5, 4, 8, 6, 9, 7, 11] },
      { id: "conf", provider: "confluence", name: `Confluence · ${LONG_TITLE}`, tier: "live", state: "failed", docCount: 512, chunkCount: 3100, embeddedCount: 2870, lastSyncAt: "2026-07-20T22:15:00", lastError: LONG_PARAGRAPH },
      { id: "web", provider: "dropbox", name: LONG_DOC_TITLE, tier: "legacy", state: "paused", docsCount: 143, lastSyncAt: "2026-07-19T18:02:00", bars: [4, 3, 5, 2, 4, 3, 4, 3] },
    ],
    connector: {
      key: "github", name: LONG_SOURCE, blurb: LONG_PARAGRAPH, docsUrl: LONG_URL, detail: LONG_TITLE,
      fields: [
        { label: "Repository", value: LONG_SOURCE, help: LONG_PARAGRAPH },
        { label: "Access token", value: "ghp_R8xQ2v••••••••••••••", secret: true },
        { label: "Paths filter (glob)", value: "docs/**/runbooks/**/incident-response/**/*.md" },
      ],
      sync: { done: 340, total: 512, docCount: 1284, chunkCount: 8912, embeddedCount: 8340 },
    },
    firstSync: { ...FIRST_SYNC, name: `GitHub · ${LONG_SOURCE}`, phase: "Embedding chunks across every service, region, and on-call team" },
    summary: [
      { label: "Connected sources", value: LONG_TITLE, stacked: true },
      { label: "Documents", value: LONG_SOURCE },
      { label: "Chunks embedded", value: LONG_DOC_TITLE, stacked: true },
      { label: "Last sync", value: LONG_PARAGRAPH, stacked: true },
    ],
  };
}

export const FIXTURES: PageFixtures<SourcesData> = {
  default: view("grid"),
  adding: view("wizard"),

  "sync-queued": sync("queued"),
  "sync-syncing": sync("syncing"),
  "sync-done": sync("done"),
  "sync-error": sync("error"),

  "connect-github-configure": connect("github", "configure"),
  "connect-github-sync": connect("github", "sync"),
  "connect-github-done": connect("github", "done"),
  "connect-slack-configure": connect("slack", "configure"),
  "connect-slack-sync": connect("slack", "sync"),
  "connect-notion-configure": connect("notion", "configure"),
  "connect-notion-sync": connect("notion", "sync"),
  "connect-gdrive-configure": connect("gdrive", "configure"),
  "connect-gdrive-sync": connect("gdrive", "sync"),
  "connect-confluence-configure": connect("confluence", "configure"),
  "connect-confluence-sync": connect("confluence", "sync"),
  "connect-jira-configure": connect("jira", "configure"),
  "connect-jira-sync": connect("jira", "sync"),
  "connect-linear-configure": connect("linear", "configure"),
  "connect-linear-sync": connect("linear", "sync"),
  "connect-upload-configure": connect("upload", "configure"),
  "connect-upload-sync": connect("upload", "sync"),

  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "The API didn't answer. If the server is still starting up, retry in a moment." },
  empty: { data: EMPTY },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
