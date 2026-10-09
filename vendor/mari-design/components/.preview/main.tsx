import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search, Settings, Trash2, Plus, Bell, FileText, Folder, GitBranch,
  Rocket, Check, Copy, Download, User, Tag, Trash, Github, Slack,
  Database, Zap,
} from "lucide-react";
import "./index.css";

import {
  // actions
  Button, ConfirmButton, Toggle, ToggleGroup,
  // layout
  Page, PageHeader, Drawer, Card, Dialog, Separator,
  // forms
  Field, SectionLabel, FormField, Input, Select, Textarea, Switch, Checkbox,
  RadioGroup, Combobox, TagInput, TagPicker,
  // data-display
  Badge, Table, DataTable, Chip, StatusChip, SeverityChip, CountChip,
  EmptyState, Spinner, Stepper, Stat, IconRing, Avatar, Swatch, Sparkline,
  Skeleton, Progress, Pagination, Accordion, ActivityFeed, TreeView, Lineage,
  type Column,
  // data-display — tables (wave 1)
  TableToolbar, SelectableTable, ExpandableTable, PropertyList,
  // data-display — markdown (wave 1)
  MarkdownView, MarkdownEditor,
  // data-display — cards (wave 1)
  ImpactPanel, DecisionCard, DigestCard, ConnectorCard, TokenReveal, TagChip,
  // chat (wave 1)
  ChatDock, type ChatMessageData,
  // navigation
  Tabs, Menu, MenuItem, MenuCheckboxItem, MenuLabel, MenuSeparator,
  Popover, Tooltip, Breadcrumb, NotificationBell,
  ContextMenu, ContextMenuItem, ContextMenuSeparator,
  // feedback
  Toaster, useToast, Alert,
  // tokens
  fmtDate,
  // wave 2 — global search
  SearchField, Kbd, GlobalSearch, type SearchScope, type SearchResultGroup,
  // wave 2 — icons
  ICONS, SourceMark, PROVIDERS, PROVIDER_NAME, type IconName,
  // wave 2 — app shell
  AppShell, Sidebar, HeaderBar, Logo, Brandmark, SearchTrigger,
  // wave 2 — connect & sync
  ConnectorWizard, ConnectDrawer, SyncPanel, SyncStatusLine,
  type SyncSource, type WizardProvider,
  // wave 2 — insights / knowledge
  Pill, GradeChip, FreshBar, Scrubber, Inspector, GlossaryPanel, RulesPanel, type RuleRow,
  // wave 2 — generic additions
  CopyButton, CodeBlock, Timeline, AvatarGroup,
} from "../index";

/* ---------- layout helpers ---------- */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-8 scroll-mt-4">
      <h2 className="text-[11px] font-mono uppercase tracking-widest text-ink/45 mb-3">{title}</h2>
      <div className="rounded-md border border-ink/15 bg-paper divide-y divide-ink/5">{children}</div>
    </section>
  );
}

/** Slug used as the row's DOM id, so QA tooling can screenshot ONE component
    demo in isolation: `node scripts/shot.mjs comp:<slug>`. */
function rowId(label: string) {
  return "c-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div id={rowId(label)} className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-4 px-5 py-4 scroll-mt-4">
      <span className="pt-1.5 text-[11px] font-mono text-ink/40 leading-none">{label}</span>
      <div className="flex flex-wrap items-center gap-3 min-w-0">{children}</div>
    </div>
  );
}

/* ---------- sample data ---------- */

type ServerRow = { id: string; name: string; region: string; status: string };
const SERVERS: ServerRow[] = [
  { id: "1", name: "api-gateway", region: "us-east", status: "running" },
  { id: "2", name: "worker-01", region: "us-west", status: "running" },
  { id: "3", name: "cache-redis", region: "eu-west", status: "failed" },
  { id: "4", name: "db-primary", region: "us-east", status: "running" },
];
const COLUMNS: Column<ServerRow>[] = [
  { key: "name", header: "Name", sortable: true, sort: (r) => r.name, render: (r) => <span className="font-medium text-ink">{r.name}</span> },
  { key: "region", header: "Region", render: (r) => r.region },
  { key: "status", header: "Status", render: (r) => <StatusChip status={r.status === "failed" ? "failed" : "running"} /> },
];

/* ---------- wave-1 sample data ---------- */

type TblDoc = { id: string; title: string; owner: string; source: string; status: "verified" | "stale" | "draft"; updated: string; summary: string };
const tblDocs: TblDoc[] = [
  { id: "d1", title: "Pricing sheet", owner: "Ana Ruiz", source: "Notion", status: "verified", updated: "2026-06-14", summary: "Current published pricing across all tiers, reviewed quarterly by finance." },
  { id: "d2", title: "Onboarding runbook", owner: "Dev Park", source: "GitHub", status: "stale", updated: "2026-02-03", summary: "First-week checklist and access grants. Flagged: two steps reference a retired tool." },
  { id: "d3", title: "Q3 launch plan", owner: "Mia Chen", source: "Slack", status: "draft", updated: "2026-07-09", summary: "Draft rollout timeline, still gathering sign-off from marketing and support." },
  { id: "d4", title: "Security policy", owner: "Ana Ruiz", source: "GitHub", status: "verified", updated: "2026-05-21", summary: "Supported versions, disclosure process, and response targets." },
];
const tblCols: Column<TblDoc>[] = [
  { key: "title", header: "Document", render: (r) => <span className="font-medium text-ink">{r.title}</span> },
  { key: "owner", header: "Owner", render: (r) => <span className="text-ink/70 text-[13px]">{r.owner}</span> },
  { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} /> },
  { key: "updated", header: "Updated", align: "right", render: (r) => <span className="font-term text-[12px] text-ink/55">{fmtDate(r.updated)}</span> },
];

const mdSample = `# Rollout phases

We ship in **three** stages, each gated on the prior. See \`config.yaml\` for the
canary weights and *do not* skip the bake window.

## Phase 1 — Canary
- Route **5%** of traffic to the new build
- Watch \`p99_latency\` and the error budget
- Hold for *24h* before widening

## Phase 2 — Ramp
Widen to 50% once the canary is clean.

\`\`\`ts
const weight = phase === "canary" ? 0.05 : 0.5;
\`\`\``;

const CHAT_SEED: ChatMessageData[] = [
  { id: "u1", role: "user", content: "Tag the auth RFC needs-review and take me to it" },
  {
    id: "a1", role: "assistant",
    content: "Done — tagged the auth RFC as needs-review and opened it for you.",
    tools: [
      { name: "search_docs", args: { query: "auth RFC" }, summary: "3 matches — top: RFC-014 Auth", ok: true },
      { name: "tag_doc", args: { id: "RFC-014", tag: "needs-review" }, summary: "Tagged RFC-014", ok: true },
    ],
  },
  { id: "w1", role: "warning", content: "Running in local mode — gemma3, your own permissions." },
];

const cardImpactDocs = [
  { title: "Onboarding guide", source: "Notion", severity: "update-required", reason: "References the deprecated 30-day trial length." },
  { title: "Pricing FAQ", source: "GitHub", severity: "review", reason: "Mentions the trial in passing — worth a glance." },
  { title: "Sales deck", source: "Drive", severity: "minor", reason: "Footnote only." },
];
const cardDigest = [
  {
    title: "Trial length shortened to 14 days",
    summary: "Growth decided to cut the free trial from 30 to 14 days after the activation analysis.",
    where: [
      { source: "slack", label: "#growth", icon: <Slack size={14} /> },
      { source: "github", label: "PR #412", icon: <Github size={14} /> },
    ],
    impact: [{ name: "Onboarding", tone: "attention" }, { name: "Billing", tone: "info" }],
  },
];

function ChatDemo() {
  const [chatMsgs, setChatMsgs] = useState<ChatMessageData[]>(CHAT_SEED);
  const [chatStreaming, setChatStreaming] = useState(false);

  function chatSend(text: string) {
    const id = String(Date.now());
    setChatMsgs((m) => [...m, { id, role: "user", content: text }]);
    setChatStreaming(true);
    const reply = "Here's what I found for “" + text + "”. (demo reply)";
    const aId = id + "-a";
    setChatMsgs((m) => [...m, { id: aId, role: "assistant", content: "", streaming: true,
      tools: [{ name: "search_docs", args: { query: text }, ok: null }] }]);
    let i = 0;
    const t = setInterval(() => {
      i += 3;
      setChatMsgs((m) => m.map((x) =>
        x.id === aId ? { ...x, content: reply.slice(0, i),
          tools: [{ name: "search_docs", args: { query: text }, summary: "2 matches", ok: true }],
          streaming: i < reply.length } : x));
      if (i >= reply.length) { clearInterval(t); setChatStreaming(false); }
    }, 40);
  }

  return (
    <ChatDock
      title="Mari agent"
      className="h-[440px] w-[420px]"
      messages={chatMsgs}
      isStreaming={chatStreaming}
      onSend={chatSend}
      onStop={() => setChatStreaming(false)}
      suggestions={["What sources are connected?", "Find docs about session timeout"]}
      hint="Tools run with your own permissions · gemma3 local"
    />
  );
}

const TREE: Parameters<typeof TreeView>[0]["data"] = [
  { id: "src", label: "src", icon: <Folder size={14} />, children: [
    { id: "index", label: "index.ts", icon: <FileText size={14} /> },
    { id: "comp", label: "components", icon: <Folder size={14} />, children: [
      { id: "btn", label: "Button.tsx", icon: <FileText size={14} /> },
    ] },
  ] },
  { id: "readme", label: "README.md", icon: <FileText size={14} /> },
];

/* ---------- wave-2 demo components ---------- */

function SearchDemo() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchScopes: SearchScope[] = [
    { id: "docs", label: "Docs", icon: <FileText size={12} /> },
    { id: "people", label: "People", icon: <User size={12} /> },
    { id: "sources", label: "Sources", icon: <Database size={12} /> },
    { id: "actions", label: "Actions", icon: <Zap size={12} /> },
  ];
  const searchResults: SearchResultGroup[] = [
    { scope: searchScopes[0], results: [
      { id: "d1", scope: "docs", title: "Auth service runbook", subtitle: "On-call escalation + token rotation", meta: "2h ago", icon: <FileText size={15} /> },
      { id: "d2", scope: "docs", title: "Search ranking design", subtitle: "BM25 + embedding fusion notes", meta: "May 3", icon: <FileText size={15} /> },
    ] },
    { scope: searchScopes[1], results: [
      { id: "p1", scope: "people", title: "Maya Chen", subtitle: "Platform · Auth Team", meta: "Owner", icon: <Avatar initials="MC" /> },
      { id: "p2", scope: "people", title: "Alex Rivera", subtitle: "Infrastructure", icon: <Avatar initials="AR" /> },
    ] },
    { scope: searchScopes[2], results: [
      { id: "s1", scope: "sources", title: "github/mari-cloud", subtitle: "Repository · synced", meta: "5m ago", icon: <Database size={15} /> },
    ] },
    { scope: searchScopes[3], results: [
      { id: "a1", scope: "actions", title: "Create new deployment", subtitle: "Run the release pipeline", meta: "⌘D", icon: <Zap size={15} /> },
    ] },
  ];
  return (
    <Section id="global-search" title="Global search">
      <Row label="SearchField">
        <SearchField value={searchValue} onChange={setSearchValue} onOpen={() => setSearchOpen(true)} />
      </Row>
      <Row label="Kbd">
        <Kbd keys="⌘ K" /><Kbd keys="Esc" /><Kbd keys="Ctrl Shift P" /><Kbd>↵</Kbd>
      </Row>
      <Row label="GlobalSearch">
        <Button onClick={() => setSearchOpen(true)}>Open global search</Button>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} scopes={searchScopes} results={searchResults}
          recentSearches={["token rotation", "search ranking", "Maya Chen"]} onSelect={() => setSearchOpen(false)} />
      </Row>
    </Section>
  );
}

function IconsDemo() {
  const iconNames = Object.keys(ICONS) as IconName[];
  return (
    <>
      <Section id="icons-ui" title="Icons — UI set">
        <Row label={`${iconNames.length} glyphs`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 w-full">
            {iconNames.map((name) => {
              const Cmp = ICONS[name];
              return (
                <div key={name} className="flex flex-col items-center gap-1.5 rounded-md border border-ink/10 py-3 text-ink">
                  <Cmp size={20} />
                  <span className="text-[9px] font-mono text-ink/40 text-center leading-tight">{name}</span>
                </div>
              );
            })}
          </div>
        </Row>
      </Section>
      <Section id="icons-marks" title="Icons — provider marks">
        <Row label="SourceMark">
          <div className="flex flex-wrap items-center gap-4 text-ink">
            {PROVIDERS.map((p) => (
              <div key={p} className="flex flex-col items-center gap-1.5">
                <SourceMark provider={p} size={24} />
                <span className="text-[9px] font-mono text-ink/40">{PROVIDER_NAME[p] ?? p}</span>
              </div>
            ))}
          </div>
        </Row>
      </Section>
    </>
  );
}

const SHELL_SECTIONS = [
  { heading: "Workspace", items: [
    { id: "overview", label: "Overview", icon: <FileText size={17} /> },
    { id: "knowledge", label: "Knowledge", icon: <Folder size={17} />, count: 128 },
    { id: "workflows", label: "Workflows", icon: <GitBranch size={17} />, children: [
      { id: "workflows-observed", label: "Observed", count: 3 },
      { id: "workflows-answers", label: "Approved answers" },
    ] },
    { id: "publish", label: "Publish", icon: <Rocket size={17} />, badge: <CountChip count={2} /> },
  ] },
  { divider: true, items: [
    { id: "settings", label: "Settings", icon: <Settings size={17} /> },
  ] },
];
const SHELL_NOTIS = [
  { id: "n1", title: "Fact-check passed", body: "pricing.md · 12 claims", time: "2m ago", unread: true },
  { id: "n2", title: "Review requested", body: "onboarding-guide", time: "1h ago" },
];

function ShellDemo() {
  const [shellActive, setShellActive] = useState("knowledge");
  const shellUser = { name: "Dana Reyes", initials: "DR", detail: "Owner" };
  const shellActions = (
    <>
      <NotificationBell items={SHELL_NOTIS} />
      <Button icon variant="link" aria-label="Help"><Search size={16} /></Button>
    </>
  );
  const shellUserMenu = (
    <>
      <MenuItem icon={<Settings size={14} />}>Preferences</MenuItem>
      <MenuItem icon={<FileText size={14} />}>API keys</MenuItem>
      <MenuSeparator />
      <MenuItem danger>Sign out</MenuItem>
    </>
  );
  return (
    <Section id="shell-chrome" title="App shell">
      <Row label="AppShell">
        <div className="w-full h-[520px] overflow-hidden rounded-md border border-ink/15">
          <AppShell
            defaultCollapsed={false}
            sidebar={({ collapsed }) => (
              <Sidebar
                sections={SHELL_SECTIONS}
                activeId={shellActive}
                onNavigate={setShellActive}
                collapsed={collapsed}
                brand={collapsed ? <span className="text-white"><Brandmark size={26} /></span> : <span className="text-white"><Logo /></span>}
                footer={!collapsed && (
                  <button className="w-full rounded-[6px] bg-white/10 px-3 py-2 text-left text-[12.5px] text-white/80 hover:bg-white/15">
                    <b className="block font-medium text-white">Need help?</b>
                    Ask Mari anything ↗
                  </button>
                )}
              />
            )}
            header={({ toggle }) => (
              <HeaderBar
                onToggleSidebar={toggle}
                searchPlaceholder="Search knowledge, people, facts…"
                searchShortcut="⌘K"
                actions={shellActions}
                user={shellUser}
                userMenu={shellUserMenu}
              />
            )}
          >
            <div className="p-6">
              <h3 className="font-display text-[20px] font-semibold text-ink">Knowledge</h3>
              <p className="mt-1 text-[13px] text-ink/60">Active section: <span className="font-term">{shellActive}</span></p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((n) => <div key={n} className="h-24 rounded-md border border-ink/10 bg-paper" />)}
              </div>
            </div>
          </AppShell>
        </div>
      </Row>
      <Row label="Sidebar">
        <div className="flex gap-4 h-[420px]">
          <div className="rounded-md overflow-hidden border border-ink/15">
            <Sidebar sections={SHELL_SECTIONS} activeId={shellActive} onNavigate={setShellActive} brand={<span className="text-white"><Logo /></span>} />
          </div>
          <div className="rounded-md overflow-hidden border border-ink/15">
            <Sidebar sections={SHELL_SECTIONS} activeId={shellActive} onNavigate={setShellActive} collapsed brand={<span className="text-white"><Brandmark size={26} /></span>} />
          </div>
        </div>
      </Row>
      <Row label="HeaderBar">
        <div className="w-full rounded-md border border-ink/15 overflow-hidden">
          <HeaderBar brand={<Logo />} searchPlaceholder="Search…" searchShortcut="⌘K" actions={shellActions} user={shellUser} userMenu={shellUserMenu} />
        </div>
      </Row>
      <Row label="SearchTrigger">
        <div className="w-[360px]"><SearchTrigger placeholder="Search knowledge…" shortcut="⌘K" /></div>
      </Row>
    </Section>
  );
}

function ConnectDemo() {
  const [connWizardOpen, setConnWizardOpen] = useState(false);
  const [connDrawerOpen, setConnDrawerOpen] = useState(false);
  const [connWizardSync, setConnWizardSync] = useState<SyncSource | null>(null);
  const [connDrawerSync, setConnDrawerSync] = useState<SyncSource | null>(null);

  const connProviders: WizardProvider[] = [
    { key: "slack", name: "Slack", blurb: "Channel history from selected public channels.",
      fields: [
        { key: "bot_token", label: "Bot token", secret: true, placeholder: "xoxb-…", help: "OAuth & Permissions → Bot User OAuth Token" },
        { key: "channels", label: "Channels", placeholder: "general, engineering", help: "Comma-separated public channel names" },
      ], docsUrl: "https://api.slack.com/apps" },
    { key: "notion", name: "Notion", blurb: "Pages and databases your team writes in.",
      fields: [{ key: "token", label: "Internal integration token", secret: true, placeholder: "ntn_…" }] },
    { key: "github", name: "GitHub", blurb: "Markdown docs from your repositories.", fields: [], connected: true },
    { key: "gdrive", name: "Google Drive", blurb: "Docs from shared folders via a service account.",
      fields: [{ key: "service_account_json", label: "Service account JSON", secret: true, multiline: true, placeholder: '{"type":"service_account", …}' }] },
  ];
  const connSources: SyncSource[] = [
    { id: "slack", name: "Slack · #engineering", state: "syncing", phase: "Embedding", done: 812, total: 1240, chunkCount: 3400, embeddedCount: 2100, lastSyncAt: new Date(Date.now() - 40_000) },
    { id: "gh", name: "GitHub · acme/docs", state: "done", docCount: 342, chunkCount: 5120, embeddedCount: 5120, lastSyncAt: new Date(Date.now() - 6 * 3600_000) },
    { id: "notion", name: "Notion · Handbook", state: "queued", lastSyncAt: null },
    { id: "jira", name: "Jira · SUP project", state: "error", error: "401 — API token rejected.", lastSyncAt: new Date(Date.now() - 2 * 3600_000) },
  ];
  return (
    <Section id="connect" title="Connect & sync">
      <Row label="ConnectorWizard">
        <Button onClick={() => { setConnWizardSync(null); setConnWizardOpen(true); }}>Connect a source…</Button>
        <ConnectorWizard open={connWizardOpen} onOpenChange={setConnWizardOpen} providers={connProviders}
          onTest={(_p, cfg) => ({ ok: Boolean(cfg.bot_token || cfg.token || cfg.service_account_json) })}
          onFinish={({ provider }) => setConnWizardSync({ id: provider, name: provider, state: "syncing", phase: "Listing", done: 0, total: 0 })}
          syncStatus={connWizardSync} onRetrySync={() => {}} />
      </Row>
      <Row label="ConnectDrawer">
        <Button onClick={() => { setConnDrawerSync(null); setConnDrawerOpen(true); }}>Connect Confluence…</Button>
        <ConnectDrawer open={connDrawerOpen} onClose={() => setConnDrawerOpen(false)} providerName="Confluence"
          blurb="Spaces and pages from your wiki." docsUrl="https://team.atlassian.net/wiki"
          fields={[
            { key: "site_url", label: "Site URL", placeholder: "https://team.atlassian.net/wiki" },
            { key: "email", label: "Account email", placeholder: "you@team.com" },
            { key: "token", label: "API token", secret: true },
          ]}
          onTest={(v) => ({ ok: Boolean(v.token), error: v.token ? undefined : "Token is required." })}
          onConnect={() => setConnDrawerSync({ id: "confluence", name: "Confluence · Team wiki", state: "syncing", phase: "Chunking", done: 64, total: 210, chunkCount: 900, embeddedCount: 410 })}
          syncStatus={connDrawerSync} />
      </Row>
      <Row label="SyncPanel">
        <div className="w-[440px]"><SyncPanel sources={connSources} onRetry={() => {}} /></div>
      </Row>
      <Row label="SyncStatusLine">
        <SyncStatusLine sources={connSources} />
      </Row>
    </Section>
  );
}

const INS_DATES = ["2026-05-02", "2026-05-14", "2026-06-01", "2026-06-20", "2026-07-11"];
const INS_ACTIVITY = [
  { date: "2026-05-02", count: 3 }, { date: "2026-05-14", count: 8 },
  { date: "2026-06-01", count: 2 }, { date: "2026-06-20", count: 11 }, { date: "2026-07-11", count: 5 },
];

function InsightsDemo() {
  const [insAsof, setInsAsof] = useState<number | null>(null);
  const [insTerms, setInsTerms] = useState([
    { id: "t1", term: "Drift", definition: "A doc whose claims no longer match the source of truth.", meta: "Alex · updated Jul 9" },
    { id: "t2", term: "Canonical", definition: "The single approved answer Mari cites first.", meta: "Sam · updated Jul 2" },
  ]);
  const [insRules, setInsRules] = useState<RuleRow[]>([
    { id: "passive-voice", family: "Clarity", severity: "warn", pack: "Core", description: "Surfaces passive constructions so the actor can be made explicit.", status: "active" },
    { id: "vague-link-text", family: "Inclusive", severity: "error", pack: "Accessible", description: "Flags links such as “click here” that lack context.", status: "zero" },
    { id: "em-dash-overuse", family: "AI slop", severity: "advisory", pack: "Core", description: "Flags dense em-dash use when a sentence break reads better.", status: "ignored" },
  ]);
  return (
    <>
      <Section id="insights" title="Insights & knowledge">
        <Row label="Pill">
          <Pill kind="canonical" /><Pill kind="verified" /><Pill kind="factcheck" /><Pill kind="needs-review" /><Pill kind="deprecated" />
        </Row>
        <Row label="GradeChip">
          <GradeChip grade="A" /><GradeChip grade="B+" /><GradeChip grade="C" /><GradeChip grade="F" /><GradeChip grade="?" />
        </Row>
        <Row label="FreshBar">
          <div className="w-72"><FreshBar segments={[
            { label: "Fresh", value: 42, tone: "ok" },
            { label: "Aging", value: 13, tone: "attention" },
            { label: "Stale", value: 6, tone: "blocked" },
          ]} /></div>
        </Row>
        <Row label="Scrubber">
          <div className="w-full max-w-md"><Scrubber dates={INS_DATES} activity={INS_ACTIVITY} value={insAsof} onChange={setInsAsof} /></div>
        </Row>
        <Row label="Inspector">
          <div className="w-80">
            <Inspector icon={<FileText size={20} />} eyebrow="Google Docs" title="Authentication rollout plan"
              tags={<><Pill kind="canonical" /><Pill kind="verified" /></>}
              properties={[
                { label: "Owner", value: "Alex Rivera" },
                { label: "Updated", value: "Jul 16" },
                { label: "Kind", value: "Runbook" },
              ]}
              sections={[
                { title: "Verified facts", count: 2, content: (
                  <ul className="space-y-1"><li>SSO migration completed Jun 20.</li><li>Fallback documented and tested.</li></ul>
                ) },
              ]}
              actions={<><Button variant="primary" compact>Open document</Button><Button compact>View lineage</Button></>}
            />
          </div>
        </Row>
        <Row label="GlossaryPanel">
          <div className="w-full max-w-xl">
            <GlossaryPanel entries={insTerms} hint="Shared definitions Mari uses when writing"
              onAdd={(term, definition) => setInsTerms((t) => [...t, { id: `t${Date.now()}`, term, definition, meta: "just now" }])}
              onEdit={(id, term, definition) => setInsTerms((t) => t.map((e) => (e.id === id ? { ...e, term, definition } : e)))}
              onDelete={(id) => setInsTerms((t) => t.filter((e) => e.id !== id))}
            />
          </div>
        </Row>
        <Row label="RulesPanel">
          <div className="w-full max-w-2xl">
            <RulesPanel rules={insRules} onStatusChange={(id, status) => setInsRules((r) => r.map((x) => (x.id === id ? { ...x, status } : x)))} />
          </div>
        </Row>
      </Section>
      <Section id="additions" title="Generic additions">
        <Row label="CopyButton">
          <CopyButton value="npm i @mari/design" />
          <CopyButton value="npm i @mari/design" label="Copy install" />
          <CopyButton value="token_abc123" label="Copy token" variant="primary" compact={false} />
        </Row>
        <Row label="CodeBlock">
          <div className="w-full max-w-lg"><CodeBlock language="bash" code={"npm i @mari/design\nimport { Button } from \"@mari/design\";"} /></div>
        </Row>
        <Row label="Timeline">
          <div className="w-80"><Timeline items={[
            { title: "Doc created", time: "Jul 2", tone: "info", description: "Drafted from the SSO spec." },
            { title: "Marked canonical", time: "Jul 9", tone: "ok" },
            { title: "Drift detected", time: "Jul 16", tone: "blocked", description: "Source changed after MFA rollout." },
          ]} /></div>
        </Row>
        <Row label="AvatarGroup">
          <AvatarGroup people={[{ initials: "AR" }, { initials: "SM" }, { initials: "JL" }, { initials: "KP" }, { initials: "DH" }, { initials: "TN" }]} max={4} />
        </Row>
      </Section>
    </>
  );
}

/* ---------- the gallery ---------- */

function Gallery() {
  const toast = useToast();

  const [tab, setTab] = useState("overview");
  const [toggle, setToggle] = useState(false);
  const [tgroup, setTgroup] = useState("list");
  const [sw, setSw] = useState(true);
  const [cb, setCb] = useState(true);
  const [radio, setRadio] = useState("standard");
  const [combo, setCombo] = useState<string | null>("us-east");
  const [tags, setTags] = useState(["prod", "critical"]);
  const [page, setPage] = useState(0);
  const [selSwatch, setSelSwatch] = useState("#1C3F60");
  const [treeSel, setTreeSel] = useState("index");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inlineOpen, setInlineOpen] = useState(true);
  const [check1, setCheck1] = useState(true);

  // wave-1 state
  const [tblSearch, setTblSearch] = useState("");
  const [tblSource, setTblSource] = useState("");
  const [tblStatus, setTblStatus] = useState("");
  const [tblSortKey, setTblSortKey] = useState("updated");
  const [tblSortDir, setTblSortDir] = useState<"asc" | "desc">("desc");
  const [tblSelected, setTblSelected] = useState<TblDoc[]>([]);
  const [mdDoc, setMdDoc] = useState(mdSample);
  const [cardTags, setCardTags] = useState<string[]>(["canonical", "customer-facing"]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-espelette">Mari Design</div>
          <div className="flex items-center gap-4">
            <a href="./pages.html" className="font-mono text-[11px] uppercase tracking-widest text-biscay-2 hover:text-ink underline underline-offset-4 decoration-biscay-2/40">Page components →</a>
            <a href="./canvas.html" className="font-mono text-[11px] uppercase tracking-widest text-biscay-2 hover:text-ink underline underline-offset-4 decoration-biscay-2/40">Page canvas →</a>
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-ink mt-1">Component Preview — full library</h1>
        <p className="text-[13px] text-ink/55 mt-1">Every exported component, live. Edit any source file and it hot-reloads.</p>
      </header>

      {/* ACTIONS */}
      <Section id="actions" title="Actions">
        <Row label="Button">
          <Button variant="primary">Primary</Button>
          <Button>Default</Button>
          <Button variant="success">Success</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button variant="primary" compact>Compact</Button>
          <Button icon aria-label="Settings"><Settings size={15} /></Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row label="ConfirmButton">
          <ConfirmButton onConfirm={() => toast("Deleted", "error")}>Delete</ConfirmButton>
        </Row>
        <Row label="Toggle">
          <Toggle pressed={toggle} onPressedChange={setToggle} aria-label="Bold">B</Toggle>
        </Row>
        <Row label="ToggleGroup">
          <ToggleGroup
            type="single"
            value={tgroup}
            onValueChange={setTgroup}
            ariaLabel="View"
            options={[{ value: "list", label: "List" }, { value: "grid", label: "Grid" }, { value: "board", label: "Board" }]}
          />
        </Row>
      </Section>

      {/* LAYOUT */}
      <Section id="layout" title="Layout">
        <Row label="PageHeader">
          <div className="w-full">
            <PageHeader
              eyebrow="Console"
              title="Deployments"
              description="Manage and monitor your service deployments."
              icon={<Rocket size={18} />}
              actions={<Button variant="primary" compact><Plus size={14} /> New</Button>}
            />
          </div>
        </Row>
        <Row label="Card">
          <Card title="Usage" eyebrow="This month" icon={<FileText size={16} />} hint="Updated 2m ago" className="w-72">
            <p className="text-[13px] text-ink/70">1,284 requests across 4 services.</p>
          </Card>
        </Row>
        <Row label="Separator">
          <div className="w-full flex items-center gap-3 text-[13px] text-ink/60">
            <span>Left</span><Separator orientation="vertical" /><span>Right</span>
          </div>
          <Separator />
        </Row>
        <Row label="Dialog / Drawer">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button onClick={() => setDrawerOpen(true)}>Open drawer (overlay)</Button>
        </Row>
        <Row label="Drawer inline">
          <div className="w-full flex gap-4 h-64">
            <div className="flex-1 min-w-0 rounded border border-dashed border-ink/20 p-4 text-[13px] text-ink/50">
              Main content — the inline drawer docks beside it, no backdrop, no focus trap.
              {!inlineOpen && <div className="mt-3"><Button compact onClick={() => setInlineOpen(true)}>Show pane</Button></div>}
            </div>
            {inlineOpen && (
              <div className="w-[360px] shrink-0 h-full">
                <Drawer variant="inline" open={inlineOpen} onClose={() => setInlineOpen(false)} title="Details" subtitle="Docked pane" icon={<FileText size={16} />}>
                  <p className="text-[13px] text-ink/70">Lives in the layout flow — scrolls with the page, keeps focus where it is.</p>
                </Drawer>
              </div>
            )}
          </div>
        </Row>
        <Row label="Page">
          <div className="w-full rounded border border-ink/10 overflow-hidden">
            <Page kicker="Console" title="Overview" subtitle="A full-page shell wrapper." actions={<Button compact>Action</Button>}>
              <div className="mt-4 text-[13px] text-ink/60">Page body content goes here.</div>
            </Page>
          </div>
        </Row>
      </Section>

      {/* FORMS */}
      <Section id="forms" title="Forms">
        <Row label="Field / Input">
          <Field label="Email"><Input placeholder="you@example.com" /></Field>
        </Row>
        <Row label="FormField">
          <FormField label="Project name" hint="Lowercase, no spaces."><Input placeholder="my-project" /></FormField>
        </Row>
        <Row label="Select">
          <Select defaultValue="us-east">
            <option value="us-east">us-east</option>
            <option value="us-west">us-west</option>
            <option value="eu-west">eu-west</option>
          </Select>
        </Row>
        <Row label="Textarea"><Textarea placeholder="Notes…" className="w-72" /></Row>
        <Row label="SectionLabel"><SectionLabel>Advanced settings</SectionLabel></Row>
        <Row label="Switch"><Switch checked={sw} onCheckedChange={setSw} label="Enable notifications" /></Row>
        <Row label="Checkbox"><Checkbox checked={cb} onCheckedChange={setCb} label="I agree to the terms" /></Row>
        <Row label="RadioGroup">
          <RadioGroup
            value={radio}
            onValueChange={setRadio}
            ariaLabel="Plan"
            options={[
              { value: "standard", label: "Standard", hint: "Shared resources" },
              { value: "pro", label: "Pro", hint: "Dedicated resources" },
            ]}
          />
        </Row>
        <Row label="Combobox">
          <Combobox
            value={combo}
            onChange={setCombo}
            ariaLabel="Region"
            options={[{ value: "us-east", label: "US East" }, { value: "us-west", label: "US West" }, { value: "eu-west", label: "EU West" }]}
          />
        </Row>
        <Row label="TagInput"><TagInput value={tags} onChange={setTags} placeholder="Add tag…" /></Row>
      </Section>

      {/* DATA DISPLAY */}
      <Section id="data" title="Data display">
        <Row label="Badge">
          <Badge label="neutral" /><Badge label="ok" tone="ok" /><Badge label="attention" tone="attention" />
          <Badge label="blocked" tone="blocked" /><Badge label="info" tone="info" />
        </Row>
        <Row label="Chip">
          <Chip label="plain" /><Chip label="ok" tone="ok" dot /><Chip label="removable" onRemove={() => {}} />
          <Chip label="selectable" onClick={() => {}} selected />
        </Row>
        <Row label="StatusChip">
          <StatusChip status="canonical" /><StatusChip status="running" /><StatusChip status="stale" /><StatusChip status="failed" />
        </Row>
        <Row label="SeverityChip"><SeverityChip severity="low" /><SeverityChip severity="med" /><SeverityChip severity="high" /></Row>
        <Row label="CountChip"><CountChip count={3} /><CountChip count={12} tone="info" /><CountChip count={99} tone="blocked" /></Row>
        <Row label="Stat">
          <Stat value="1,284" label="Requests" sub="+12%" tone="ok" />
          <Stat value="3" label="Incidents" sub="attention" tone="attention" icon={<Bell size={15} />} />
          <Stat value="99.98%" label="Uptime" />
        </Row>
        <Row label="IconRing">
          <IconRing tone="ok"><Check size={15} /></IconRing>
          <IconRing tone="attention"><Bell size={15} /></IconRing>
          <IconRing tone="blocked"><Trash2 size={15} /></IconRing>
          <IconRing tone="info"><GitBranch size={15} /></IconRing>
        </Row>
        <Row label="Avatar"><Avatar initials="DH" /><Avatar initials="MG" /><Avatar initials="AB" /></Row>
        <Row label="Swatch">
          {["#1C3F60", "#B23A1E", "#2C6E49", "#A05E1C"].map((c) => (
            <Swatch key={c} color={c} selected={selSwatch === c} onClick={() => setSelSwatch(c)} title={c} />
          ))}
        </Row>
        <Row label="Sparkline">
          <Sparkline values={[3, 5, 4, 8, 6, 9, 7, 11, 10]} tone="ok" />
          <Sparkline values={[10, 8, 9, 5, 6, 3, 4, 2]} tone="blocked" />
        </Row>
        <Row label="Progress">
          <div className="w-full max-w-md space-y-3">
            <Progress value={72} label="Sync" tone="info" />
            <Progress value={40} label="Disk" tone="attention" />
          </div>
        </Row>
        <Row label="Spinner"><Spinner /><Spinner size="md" label="Working" /></Row>
        <Row label="Skeleton">
          <div className="w-64 space-y-2">
            <Skeleton height={14} /><Skeleton height={14} width="80%" /><Skeleton height={14} width="60%" />
          </div>
        </Row>
        <Row label="Stepper">
          <div className="w-full max-w-md"><Stepper labels={["Plan", "Build", "Review", "Ship"]} current={1} /></div>
        </Row>
        <Row label="Pagination"><Pagination page={page} pageCount={5} onChange={setPage} /></Row>
        <Row label="Accordion">
          <div className="w-full max-w-lg">
            <Accordion items={[
              { value: "a", title: "What is Mari?", content: "A console component library." },
              { value: "b", title: "How do I use it?", content: "Copy files into your app." },
            ]} />
          </div>
        </Row>
        <Row label="ActivityFeed">
          <ActivityFeed items={[
            { id: "1", actor: "Dana", action: "deployed api-gateway", time: "2m ago", icon: <Rocket size={13} /> },
            { id: "2", actor: "Max", action: "opened a pull request", time: "1h ago", icon: <GitBranch size={13} /> },
          ]} />
        </Row>
        <Row label="TreeView">
          <div className="w-64"><TreeView data={TREE} selected={treeSel} onSelect={(n) => setTreeSel(n.id)} /></div>
        </Row>
        <Row label="Lineage">
          <Lineage
            onSelect={(n) => toast(n.label)}
            upstream={[
              { id: "raw", label: "raw_events", sublabel: "source", icon: <FileText size={14} />, tone: "neutral" },
              { id: "users", label: "users", sublabel: "source", icon: <FileText size={14} />, tone: "neutral" },
            ]}
            focus={{ id: "sessions", label: "sessions", sublabel: "model", icon: <GitBranch size={14} /> }}
            downstream={[
              { id: "dash", label: "dashboard", sublabel: "output", icon: <Rocket size={14} />, tone: "ok" },
              { id: "report", label: "weekly_report", sublabel: "output", icon: <FileText size={14} />, tone: "attention" },
              { id: "alert", label: "anomaly_alert", sublabel: "output", icon: <Bell size={14} />, tone: "blocked" },
            ]}
          />
        </Row>
        <Row label="Table">
          <Table title="Regions" count={3} head={["Region", "Servers", "Status"]}>
            <tr><td className="px-4 py-2.5 text-[13px]">us-east</td><td className="px-4 py-2.5 text-[13px]">2</td><td className="px-4 py-2.5"><StatusChip status="running" /></td></tr>
            <tr><td className="px-4 py-2.5 text-[13px]">us-west</td><td className="px-4 py-2.5 text-[13px]">1</td><td className="px-4 py-2.5"><StatusChip status="running" /></td></tr>
            <tr><td className="px-4 py-2.5 text-[13px]">eu-west</td><td className="px-4 py-2.5 text-[13px]">1</td><td className="px-4 py-2.5"><StatusChip status="failed" /></td></tr>
          </Table>
        </Row>
        <Row label="DataTable">
          <div className="w-full">
            <DataTable
              title="Servers"
              rows={SERVERS}
              columns={COLUMNS}
              rowKey={(r) => r.id}
              search={(r) => r.name}
              facet={{ label: "Region", get: (r) => r.region }}
            />
          </div>
        </Row>
        <Row label="EmptyState">
          <div className="w-full">
            <EmptyState icon={<Folder size={28} />} title="No results" action={<Button variant="primary" compact>Create one</Button>}>
              Nothing here yet. Get started by creating your first item.
            </EmptyState>
          </div>
        </Row>
      </Section>

      {/* NAVIGATION */}
      <Section id="nav" title="Navigation">
        <Row label="Tabs">
          <div className="w-full">
            <Tabs
              ariaLabel="Views"
              value={tab}
              onChange={setTab}
              options={[
                { id: "overview", label: "Overview" },
                { id: "metrics", label: "Metrics", count: 4 },
                { id: "logs", label: "Logs" },
              ]}
            />
          </div>
        </Row>
        <Row label="Breadcrumb">
          <Breadcrumb items={[{ label: "Home", href: "#" }, { label: "Projects", href: "#" }, { label: "mari-design" }]} />
        </Row>
        <Row label="Menu">
          <Menu trigger={<Button compact>Open menu</Button>}>
            <MenuLabel>Actions</MenuLabel>
            <MenuItem icon={<Copy size={14} />} onSelect={() => toast("Copied")}>Copy</MenuItem>
            <MenuItem icon={<Download size={14} />} onSelect={() => toast("Downloaded")}>Download</MenuItem>
            <MenuCheckboxItem checked={check1} onCheckedChange={setCheck1}>Show hidden</MenuCheckboxItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={14} />} danger onSelect={() => toast("Deleted", "error")}>Delete</MenuItem>
          </Menu>
        </Row>
        <Row label="Popover">
          <Popover trigger={<Button compact>Show popover</Button>}>
            <div className="text-[13px] text-ink/70">Popover content with any markup.</div>
          </Popover>
        </Row>
        <Row label="Tooltip">
          <Tooltip label="Helpful hint"><Button compact><User size={14} /> Hover me</Button></Tooltip>
        </Row>
        <Row label="ContextMenu">
          <ContextMenu trigger={<div className="grid place-items-center h-16 w-full rounded border border-dashed border-ink/25 text-[12px] text-ink/50">Right-click here</div>}>
            <ContextMenuItem icon={<Copy size={14} />}>Copy</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem icon={<Trash2 size={14} />} danger>Delete</ContextMenuItem>
          </ContextMenu>
        </Row>
        <Row label="NotificationBell">
          <NotificationBell items={[
            { id: "1", title: "Deploy finished", body: "api-gateway is live", time: "2m", unread: true },
            { id: "2", title: "New comment", time: "1h" },
          ]} />
        </Row>
      </Section>

      {/* FEEDBACK */}
      <Section id="feedback" title="Feedback">
        <Row label="Alert">
          <div className="w-full space-y-3">
            <Alert tone="info" title="Heads up">This is an informational banner.</Alert>
            <Alert tone="ok" title="Deploy succeeded">All services are healthy.</Alert>
            <Alert tone="attention" title="Attention">A certificate expires soon.</Alert>
            <Alert tone="blocked" title="Action required" onDismiss={() => {}}>A migration is pending.</Alert>
          </div>
        </Row>
        <Row label="Toast">
          <Button compact onClick={() => toast("Saved changes")}>Default</Button>
          <Button compact variant="success" onClick={() => toast("Deployed", "success")}>Success</Button>
          <Button compact variant="danger" onClick={() => toast("Failed to save", "error")}>Error</Button>
        </Row>
      </Section>

      {/* TABLES (wave 1) */}
      <Section id="tables" title="Tables — filtering & types">
        <Row label="TableToolbar">
          <div className="w-full">
            <TableToolbar
              title="Documents"
              count={tblDocs.length}
              search={{ value: tblSearch, onChange: setTblSearch }}
              searchPlaceholder="Search documents…"
              facets={[
                { label: "Sources", value: tblSource, onChange: setTblSource, options: [{ value: "Notion", label: "Notion" }, { value: "GitHub", label: "GitHub" }, { value: "Slack", label: "Slack" }] },
                { label: "Status", value: tblStatus, onChange: setTblStatus, options: [{ value: "verified", label: "Verified" }, { value: "stale", label: "Stale" }, { value: "draft", label: "Draft" }] },
              ]}
              sort={{ value: tblSortKey, onChange: setTblSortKey, dir: tblSortDir, onDirChange: setTblSortDir, options: [{ value: "updated", label: "Updated" }, { value: "title", label: "Title" }, { value: "owner", label: "Owner" }] }}
              actions={<Button compact variant="primary">New doc</Button>}
              onClearAll={() => { setTblSearch(""); setTblSource(""); setTblStatus(""); }}
            />
          </div>
        </Row>
        <Row label="SelectableTable">
          <div className="w-full">
            <SelectableTable
              rows={tblDocs}
              columns={tblCols}
              rowKey={(r) => r.id}
              onSelectionChange={setTblSelected}
              bulkActions={() => (
                <>
                  <Button compact><Tag size={13} /> Tag</Button>
                  <Button compact><Download size={13} /> Export</Button>
                  <Button compact variant="danger"><Trash size={13} /> Delete</Button>
                </>
              )}
            />
            {tblSelected.length > 0 && <p className="mt-2 font-term text-[11px] text-ink/55">{tblSelected.map((d) => d.title).join(", ")}</p>}
          </div>
        </Row>
        <Row label="ExpandableTable">
          <div className="w-full">
            <ExpandableTable
              rows={tblDocs}
              columns={tblCols}
              rowKey={(r) => r.id}
              renderDetail={(r) => (
                <div className="max-w-2xl">
                  <p className="text-[13px] text-ink/75 leading-relaxed">{r.summary}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Chip label={r.source} tone="info" />
                    <Chip label={`Owner: ${r.owner}`} tone="neutral" />
                  </div>
                </div>
              )}
            />
          </div>
        </Row>
        <Row label="PropertyList">
          <div className="w-full max-w-sm">
            <PropertyList
              items={[
                { label: "ID", value: "d2" },
                { label: "Kind", value: "Runbook" },
                { label: "Source", value: <Chip label="GitHub" tone="info" /> },
                { label: "Owner", value: "Dev Park" },
                { label: "Status", value: <StatusChip status="stale" /> },
                { label: "Summary", value: "First-week checklist and access grants.", stacked: true },
              ]}
            />
          </div>
        </Row>
      </Section>

      {/* MARKDOWN (wave 1) */}
      <Section id="markdown" title="Markdown">
        <Row label="MarkdownView">
          <div className="w-full max-w-2xl"><MarkdownView>{mdSample}</MarkdownView></div>
        </Row>
        <Row label="MarkdownEditor">
          <div className="w-full"><MarkdownEditor value={mdDoc} onChange={setMdDoc} /></div>
        </Row>
      </Section>

      {/* CARDS (wave 1) */}
      <Section id="cards" title="Cards & panels">
        <Row label="DecisionCard">
          <div className="max-w-xl">
            <DecisionCard
              status="ratified"
              fresh
              statement="Adopt trunk-based development for the web app"
              context="Long-lived feature branches were causing painful merges; we ship behind flags now."
              sourceLabel="Slack · #eng"
              sourceIcon={<Slack size={14} />}
              owners={["Dana Ito", "Marco Reyes"]}
              decidedOn="2026-06-14"
              spine={false}
              onSupersede={() => {}}
              impact={<ImpactPanel summary="3 documents reference the old branching policy." docs={cardImpactDocs} />}
            />
          </div>
        </Row>
        <Row label="DigestCard">
          <div className="max-w-xl"><DigestCard topics={cardDigest} onRefresh={() => {}} /></div>
        </Row>
        <Row label="ConnectorCard">
          <div className="max-w-xs">
            <ConnectorCard
              name="mari-cloud / web"
              mark={<Github size={22} />}
              health="Healthy"
              counts="1,204 documents · 8,930 chunks · 8,930 embedded"
              sync="Last sync: Jul 20, 2:17 PM"
              bars={[3, 6, 4, 8, 5, 9, 7, 11, 6, 10]}
              canResync
              onSyncNow={() => {}}
              onFullResync={() => {}}
            />
          </div>
        </Row>
        <Row label="ImpactPanel">
          <div className="max-w-xl"><ImpactPanel boxed summary="3 documents depend on this claim." docs={cardImpactDocs} onClose={() => {}} /></div>
        </Row>
        <Row label="TokenReveal">
          <div className="max-w-xl"><TokenReveal token="mari_sk_9f2c7a1be44d0c83f6a1e7b2c9d40e5f" onDismiss={() => {}} /></div>
        </Row>
        <Row label="TagChip">
          <TagChip tag="canonical" />
          <TagChip tag="stale" />
          <TagChip tag="deprecated" />
          <TagChip tag="customer-facing" removable onRemove={() => {}} />
        </Row>
        <Row label="TagPicker">
          <TagPicker tags={cardTags} onChange={setCardTags} onManage={() => {}} />
        </Row>
      </Section>

      {/* CHAT / AGENT (wave 1) */}
      <Section id="chat" title="Chat / Agent">
        <Row label="ChatDock"><ChatDemo /></Row>
        <Row label="empty">
          <ChatDock title="Agent" className="h-[360px] w-[420px]" messages={[]}
            onSend={() => {}} suggestions={["Tag the auth RFC needs-review", "Sync the stale source"]} />
        </Row>
      </Section>

      {/* WAVE 2 — app shell, search, icons, connect/sync, insights, generics */}
      <ShellDemo />
      <SearchDemo />
      <ConnectDemo />
      <InsightsDemo />
      <IconsDemo />

      {/* overlays */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Confirm action" description="This is a modal dialog." footer={<><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setDialogOpen(false)}>Confirm</Button></>}>
        <p className="text-[13px] text-ink/70">Dialog body content.</p>
      </Dialog>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Details" subtitle="Slide-over panel" icon={<FileText size={16} />} footer={<Button variant="primary" onClick={() => setDrawerOpen(false)}>Done</Button>}>
        <p className="text-[13px] text-ink/70">Drawer body content.</p>
      </Drawer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster>
      <Gallery />
    </Toaster>
  </StrictMode>,
);
