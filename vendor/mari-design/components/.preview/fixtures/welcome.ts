/* Welcome (onboarding) canvas fixtures. Lifted out of `pages/WelcomePage.tsx`
   and the Welcome* features, which are now pure presenters. Everything here is
   plain JSON: brand marks are derived from a provider key by the page. */

import type { CField, Repo, Tile, UploadedFile, WelcomeData, WelcomeStep } from "../../pages/WelcomePage";
import type { Candidate } from "../../features/WelcomeGlossaryStep";
import type { SyncRow } from "../../features/WelcomeSyncPanel";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_SOURCE, LONG_URL, UNBREAKABLE,
  LONG_WORD, HUGE_NUMBER, MIXED_SCRIPT,
} from "./stress";

const TILES: Tile[] = [
  { key: "github", name: "GitHub", blurb: "Markdown docs from repos in your token’s scope.", active: true },
  { key: "slack", name: "Slack", blurb: "Import channel history into the library." },
  { key: "notion", name: "Notion", blurb: "Pages and databases from a shared integration." },
  { key: "gdrive", name: "Google Drive", blurb: "Docs & folders via a service account." },
  { key: "confluence", name: "Confluence", blurb: "Spaces and pages from Cloud or Server.", connected: true },
  { key: "jira", name: "Jira", blurb: "Issues and project docs." },
];

const REPOS: Repo[] = [
  { name: "acme/handbook", desc: "Company handbook & policies", priv: true, branch: "main" },
  { name: "acme/api-docs", desc: "Public API reference", priv: false, branch: "main" },
  { name: "acme/runbooks", desc: "On-call runbooks", priv: true, branch: "master" },
  { name: "acme/blog", desc: "Engineering blog (Markdown)", priv: false, branch: "main" },
];

const SLACK_FIELDS: CField[] = [
  { key: "bot_token", label: "Bot token", secret: true, placeholder: "xoxb-…", value: "xoxb-2117-••••••••", help: "Needs channels:history and channels:read." },
  { key: "app_token", label: "App-level token", secret: true, placeholder: "xapp-…", value: "xapp-1-A05••••" },
  { key: "channel", label: "Channel", placeholder: "#engineering", value: "#engineering" },
];

const NOTION_FIELDS: CField[] = [
  { key: "token", label: "Internal integration token", secret: true, placeholder: "secret_…", value: "secret_9Fh2••••", help: "Share the pages you want with the integration first." },
  { key: "root", label: "Page or database ID", placeholder: "8f3c2b1a-…", value: "8f3c2b1a-004d-42e7-9b11" },
];

const GDRIVE_FIELDS: CField[] = [
  { key: "service_account_json", label: "Service-account JSON", secret: false, multiline: true, value: '{\n  "type": "service_account",\n  "project_id": "acme-docs",\n  "client_email": "mari@acme-docs.iam…"\n}', help: "Paste the downloaded key file; grant it viewer access to the folder." },
  { key: "folder_id", label: "Folder ID", placeholder: "1A2b3C…", value: "1A2b3C4d5E6f7G8h" },
];

const UPLOAD_FILES: UploadedFile[] = [
  { name: "pricing.md", detail: "88 chunks · 88 embedded" },
  { name: "onboarding.md", detail: "71 chunks · 71 embedded" },
  { name: "faq.md", detail: "55 chunks · 30 embedded" },
];

const CONNECT_SYNC: SyncRow = {
  id: "gh", provider: "github", name: "GitHub · acme/handbook",
  state: "syncing", phase: "Embedding", done: 340, total: 512, chunkCount: 8912, embeddedCount: 5780,
};

const SYNC_ROWS: SyncRow[] = [
  { id: "gh", provider: "github", name: "GitHub · acme/handbook", state: "syncing", phase: "Embedding", done: 340, total: 512, chunkCount: 8912, embeddedCount: 5780 },
  { id: "slack", provider: "slack", name: "Slack · #engineering", state: "done", docCount: 210, chunkCount: 1980, embeddedCount: 1980, lastSyncAt: "2026-07-21T13:20:00" },
  { id: "notion", provider: "notion", name: "Notion · Product wiki", state: "queued" },
  { id: "conf", provider: "confluence", name: "Confluence · Ops", state: "error", error: "GET /rest/api/content returned 401, the token expired." },
];

const CANDIDATES: Candidate[] = [
  { term: "Backfill", definition: "The initial full sync that ingests every historical document from a source.", evidence: "sources/ingest.md" },
  { term: "Content hash", definition: "A fingerprint of a chunk's text; unchanged chunks are skipped on re-sync.", evidence: "architecture/dedupe.md" },
  { term: "Canonical", definition: "The single source-of-truth version of a fact or document.", evidence: "glossary/status.md" },
  { term: "Embedding", definition: "A vector representation of a text chunk used for semantic retrieval.", evidence: "search/retrieval.md" },
  { term: "Workflow", definition: "A recorded run of what Mari did, promoted into a trusted answer once approved.", evidence: "workflows/overview.md" },
];

const BASE: WelcomeData = {
  step: "hero",
  tiles: TILES,
  connectorCount: 14,
  repos: REPOS,
  selectedRepo: "acme/handbook",
  pathsGlob: "**/*.md",
  slackFields: SLACK_FIELDS,
  notionFields: NOTION_FIELDS,
  gdriveFields: GDRIVE_FIELDS,
  uploadSummary: "3 files ingested · 214 chunks · 189 embedded",
  uploadFiles: UPLOAD_FILES,
  connectSync: CONNECT_SYNC,
  glossaryCandidates: CANDIDATES,
  syncRows: SYNC_ROWS,
  doneSummary: { sourcesSynced: 2, glossaryTerms: 5 },
};

const at = (step: WelcomeStep, over: Partial<WelcomeData> = {}): { data: WelcomeData } =>
  ({ data: { ...BASE, step, ...over } });

/** Long natural text on the connector grid; pathological content on the
    finish step's sync table. */
function strained(extreme: boolean): WelcomeData {
  if (extreme) {
    return {
      ...BASE,
      step: "finish",
      tiles: [
        { key: "github", name: UNBREAKABLE, blurb: LONG_URL, active: true },
        { key: "slack", name: MIXED_SCRIPT, blurb: LONG_WORD },
        { key: "notion", name: LONG_WORD, blurb: UNBREAKABLE, connected: true },
      ],
      syncRows: [
        { id: "gh", provider: "github", name: UNBREAKABLE, state: "syncing", phase: LONG_WORD, done: HUGE_NUMBER, total: 99999999, chunkCount: HUGE_NUMBER, embeddedCount: 5780 },
        { id: "x", provider: "slack", name: MIXED_SCRIPT, state: "error", error: LONG_URL },
      ],
      doneSummary: { sourcesSynced: HUGE_NUMBER, glossaryTerms: HUGE_NUMBER },
    };
  }
  return {
    ...BASE,
    step: "connect",
    connectorCount: 12847392,
    tiles: [
      { key: "github", name: LONG_TITLE, blurb: LONG_PARAGRAPH, active: true },
      { key: "confluence", name: LONG_NAME, blurb: LONG_PARAGRAPH, connected: true },
      { key: "slack", name: "Slack workspace with an extraordinarily long organization name", blurb: LONG_PARAGRAPH },
      { key: "gdrive", name: LONG_SOURCE, blurb: LONG_PARAGRAPH },
    ],
    syncRows: [
      { id: "gh", provider: "github", name: LONG_SOURCE, state: "syncing", phase: LONG_TITLE, done: 340, total: 512, chunkCount: 8912, embeddedCount: 5780 },
      { id: "conf", provider: "confluence", name: LONG_NAME, state: "error", error: LONG_PARAGRAPH },
    ],
    doneSummary: { sourcesSynced: 12847392, glossaryTerms: 12847392 },
  };
}

export const FIXTURES: PageFixtures<WelcomeData> = {
  default: at("hero"),
  connect: at("connect"),
  "connect-github": at("connect-github"),
  "connect-slack": at("connect-slack"),
  "connect-notion": at("connect-notion"),
  "connect-gdrive": at("connect-gdrive"),
  "connect-upload": at("connect-upload"),
  "connect-syncing": at("connect-syncing"),
  glossary: at("glossary"),
  /* The initial sync renders the auth skeleton while the first status lands. */
  syncing: { ...at("finish"), loading: true },
  done: at("done"),
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
