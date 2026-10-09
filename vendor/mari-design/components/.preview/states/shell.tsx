import { useState } from "react";
import type { ComponentSpec } from "./types";
import {
  AppShell, Sidebar, HeaderBar, SearchTrigger, Logo, Brandmark,
  MenuItem, MenuSeparator, NotificationBell, CountChip, StatusChip,
  Button, EmptyState, type NavSection,
  IconHome, IconBook, IconLayers, IconFlow, IconSend,
  IconSparkle, IconGear, IconShieldCheck, IconTag,
} from "../../index";

/* State matrix for the shell group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks. */

const LONG = "Quarterly revenue recognition policy for multi-year enterprise agreements";
const HUGE = "SupercalifragilisticexpialidociousnavigationlabelthatwillneverwrapAAAAAAAAAAAAAAAAAAAAAAA";

/* Nav config as the client asked for it: no "Admin" section label, and the
   utility group (Settings) ruled off instead of named. */
const NAV: NavSection[] = [
  { heading: "Workspace", items: [
    { id: "overview", label: "Overview", icon: <IconHome size={18} /> },
    { id: "knowledge", label: "Knowledge", icon: <IconBook size={18} />, count: 128 },
    { id: "library", label: "Library", icon: <IconTag size={18} /> },
    { id: "lineage", label: "Lineage", icon: <IconLayers size={18} /> },
    { id: "facts", label: "Facts", icon: <IconShieldCheck size={18} /> },
    { id: "workflows", label: "Workflows", icon: <IconFlow size={18} />, children: [
      { id: "workflows-observed", label: "Observed", count: 3 },
      { id: "workflows-answers", label: "Approved answers" },
    ] },
    { id: "publish", label: "Publish", icon: <IconSend size={18} />, badge: <CountChip count={2} /> },
    { id: "insights", label: "Insights", icon: <IconSparkle size={18} /> },
  ] },
  { id: "utility", divider: true, items: [
    { id: "settings", label: "Settings", icon: <IconGear size={18} /> },
  ] },
];

const NAV_DISABLED: NavSection[] = [
  { heading: "Workspace", items: [
    { id: "overview", label: "Overview", icon: <IconHome size={18} /> },
    { id: "publish", label: "Publish (needs a plan upgrade)", icon: <IconSend size={18} />, disabled: true },
  ] },
  { id: "utility", divider: true, items: [
    { id: "settings", label: "Settings", icon: <IconGear size={18} /> },
    { id: "billing", label: "Billing", icon: <IconGear size={18} />, disabled: true },
  ] },
];

const NAV_LONG: NavSection[] = [
  { heading: "A workspace section heading long enough to wrap twice over", items: [
    { id: "a", label: LONG, icon: <IconBook size={18} />, count: 128000 },
    { id: "b", label: HUGE, icon: <IconBook size={18} /> },
    { id: "c", label: "Nested", icon: <IconFlow size={18} />, children: [
      { id: "c1", label: LONG },
      { id: "c2", label: HUGE },
    ] },
  ] },
  { id: "utility", divider: true, items: [
    { id: "settings", label: "Settings", icon: <IconGear size={18} /> },
  ] },
];

const NAV_MANY: NavSection[] = [
  { heading: "Workspace", items: Array.from({ length: 22 }, (_, i) => ({
    id: `n${i}`, label: `Navigation item ${i + 1}`, icon: <IconBook size={18} />, count: i * 7,
  })) },
  { id: "utility", divider: true, items: [
    { id: "settings", label: "Settings", icon: <IconGear size={18} /> },
  ] },
];

const NOTIS = [
  { id: "n1", title: "Fact-check passed", body: "pricing.md, 12 claims", time: "2m ago", unread: true },
  { id: "n2", title: "Review requested", body: "onboarding-guide", time: "1h ago" },
];
const USER = { name: "Dana Reyes", initials: "DR", detail: "Owner" };
const USER_LONG = { name: "Aleksandra Konstantinopoulou-Whitfield", initials: "AKW", detail: "Workspace administrator" };

function UserMenu() {
  return (
    <>
      <MenuItem icon={<IconGear size={16} />}>Preferences</MenuItem>
      <MenuItem>API keys</MenuItem>
      <MenuSeparator />
      <MenuItem danger>Sign out</MenuItem>
    </>
  );
}

function SidebarDemo({ sections = NAV, collapsed = false, active = "knowledge", brand = true, footer = false }) {
  const [id, setId] = useState(active);
  return (
    <div className="h-[520px]">
      <Sidebar
        sections={sections}
        activeId={id}
        onNavigate={setId}
        collapsed={collapsed}
        brand={brand ? <Logo wordmark={collapsed ? false : "Mari"} /> : undefined}
        footer={footer ? <div className="rounded-[4px] bg-white/10 px-3 py-2 text-[12px] text-white/80">Trial ends Aug 1, 2026</div> : undefined}
      />
    </div>
  );
}

function ShellDemo({ collapsed = false, empty = false }) {
  const [id, setId] = useState("knowledge");
  return (
    <div className="h-[520px] overflow-hidden rounded-md border border-ink/15">
      <AppShell
        collapsed={collapsed}
        sidebar={(ctx) => (
          <Sidebar sections={NAV} activeId={id} onNavigate={setId} collapsed={ctx.collapsed} brand={<Logo wordmark={ctx.collapsed ? false : "Mari"} />} />
        )}
        header={(ctx) => (
          <HeaderBar
            onToggleSidebar={ctx.toggle}
            searchPlaceholder="Search knowledge, people, sources…"
            actions={<NotificationBell items={NOTIS} />}
            user={USER}
            userMenu={<UserMenu />}
          />
        )}
      >
        <div className="p-6">
          {empty
            ? <EmptyState title="Nothing here yet" action={<Button variant="primary" compact>Connect a source</Button>}>Connect a source to start syncing knowledge.</EmptyState>
            : (
              <div className="space-y-3">
                <h1 className="text-[18px] font-semibold">Knowledge</h1>
                <div className="flex flex-wrap gap-2"><StatusChip status="healthy" /><StatusChip status="syncing" /></div>
                <p className="text-[13px] text-ink/70">128 documents across 4 sources.</p>
              </div>
            )}
        </div>
      </AppShell>
    </div>
  );
}

export const SHELL: ComponentSpec[] = [
  {
    id: "Logo", title: "Logo / Brandmark", width: 560,
    states: [
      { id: "default", label: "On paper and on the biscay rail", node: (
        <div className="space-y-3">
          <div className="rounded-[4px] border border-ink/15 p-3 text-ink"><Logo /></div>
          <div className="rounded-[4px] bg-biscay p-3 text-white"><Logo /></div>
        </div>) },
      { id: "markonly", label: "Mark only, several sizes", node: (
        <div className="flex items-center gap-4 text-ink">
          <Brandmark size={18} /><Brandmark size={28} /><Brandmark size={44} />
          <Logo wordmark={false} />
        </div>) },
      { id: "overflow", label: "Overflow: long wordmark in a narrow frame", width: 220, node: (
        <Logo wordmark="Mari Knowledge Platform" />) },
    ],
  },
  {
    id: "SearchTrigger", title: "SearchTrigger", width: 520,
    states: [
      { id: "default", label: "Default", node: <SearchTrigger onClick={() => {}} /> },
      { id: "custom", label: "Custom placeholder + shortcut", node: (
        <SearchTrigger placeholder="Search knowledge, people, sources…" shortcut="Ctrl K" onClick={() => {}} />) },
      { id: "noshortcut", label: "No shortcut hint", node: <SearchTrigger shortcut="" onClick={() => {}} /> },
      { id: "overflow", label: "Overflow: long placeholder, narrow frame", width: 240, node: (
        <SearchTrigger placeholder={LONG} onClick={() => {}} />) },
    ],
  },
  {
    id: "Sidebar", title: "Sidebar", width: 300,
    states: [
      { id: "default", label: "Default: no Admin label, rule before Settings", node: <SidebarDemo /> },
      { id: "collapsed", label: "Collapsed rail", width: 140, node: <SidebarDemo collapsed /> },
      { id: "expanded-group", label: "Expandable group, child selected", node: <SidebarDemo active="workflows-observed" /> },
      { id: "footer", label: "With a pinned footer slot", node: <SidebarDemo footer /> },
      { id: "nobrand", label: "No brand slot", node: <SidebarDemo brand={false} /> },
      { id: "disabled", label: "Disabled items (must stay legible)", node: <SidebarDemo sections={NAV_DISABLED} active="overview" /> },
      { id: "empty", label: "Empty: no sections", node: <SidebarDemo sections={[]} /> },
      { id: "many", label: "Overflow: 22 items, the nav scrolls", node: <SidebarDemo sections={NAV_MANY} active="n3" /> },
      { id: "overflow", label: "Overflow: long labels, unbreakable label, huge count", node: <SidebarDemo sections={NAV_LONG} active="a" /> },
      { id: "overflow-collapsed", label: "Overflow: same content, collapsed rail", width: 140, node: <SidebarDemo sections={NAV_LONG} active="a" collapsed /> },
    ],
  },
  {
    id: "HeaderBar", title: "HeaderBar", width: 1000,
    states: [
      { id: "default", label: "Default: toggle, search, notifications, account menu", node: (
        <HeaderBar onToggleSidebar={() => {}} actions={<NotificationBell items={NOTIS} />} user={USER} userMenu={<UserMenu />} />) },
      { id: "brand", label: "With a brand slot and no toggle", node: (
        <HeaderBar brand={<Logo />} actions={<NotificationBell items={NOTIS} />} user={USER} userMenu={<UserMenu />} />) },
      { id: "minimal", label: "Search only", node: <HeaderBar /> },
      { id: "custom-search", label: "Custom search slot", node: (
        <HeaderBar
          onToggleSidebar={() => {}}
          search={<div className="flex h-9 items-center rounded-[6px] border border-ink/20 bg-flysch px-3 text-[13px] text-ink/70">Custom search slot</div>}
          user={USER}
        />) },
      { id: "plain-user", label: "Account button without a menu", node: (
        <HeaderBar onToggleSidebar={() => {}} user={USER} onUserClick={() => {}} />) },
      { id: "many-actions", label: "Many action slots", node: (
        <HeaderBar
          onToggleSidebar={() => {}}
          actions={<><NotificationBell items={NOTIS} /><Button icon variant="link" aria-label="Help"><IconBook size={18} /></Button><Button icon variant="link" aria-label="Settings"><IconGear size={18} /></Button></>}
          user={USER} userMenu={<UserMenu />}
        />) },
      { id: "loading", label: "Loading notifications", node: (
        <HeaderBar onToggleSidebar={() => {}} actions={<NotificationBell items={[]} loading />} user={USER} userMenu={<UserMenu />} />) },
      { id: "empty-notis", label: "Empty notifications", node: (
        <HeaderBar onToggleSidebar={() => {}} actions={<NotificationBell items={[]} />} user={USER} userMenu={<UserMenu />} />) },
      { id: "overflow", label: "Overflow: long user name, long placeholder", node: (
        <HeaderBar onToggleSidebar={() => {}} searchPlaceholder={LONG} actions={<NotificationBell items={NOTIS} />} user={USER_LONG} userMenu={<UserMenu />} />) },
      { id: "narrow", label: "Overflow: 320px frame", width: 320, node: (
        <HeaderBar onToggleSidebar={() => {}} searchPlaceholder={HUGE} actions={<NotificationBell items={NOTIS} />} user={USER_LONG} userMenu={<UserMenu />} />) },
    ],
  },
  {
    id: "AppShell", title: "AppShell", width: 1100,
    states: [
      { id: "default", label: "Default", node: <ShellDemo /> },
      { id: "collapsed", label: "Collapsed rail", node: <ShellDemo collapsed /> },
      { id: "empty", label: "Empty content region", node: <ShellDemo empty /> },
      { id: "narrow", label: "Overflow: 320px frame (desktop shell, not a mobile layout)", width: 320, node: <ShellDemo /> },
    ],
  },
];
