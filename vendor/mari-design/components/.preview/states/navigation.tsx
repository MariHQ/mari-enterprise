import { useState } from "react";
import type { ComponentSpec } from "./types";
import {
  Tabs, Menu, MenuItem, MenuLabel, MenuSeparator, MenuCheckboxItem,
  Popover, Tooltip, Breadcrumb, NotificationBell, Kbd, SearchField,
  ContextMenu, ContextMenuItem, ContextMenuSeparator,
  Button, Chip, StatusChip, EmptyState,
  IconGear, IconDoc, IconTrash, IconSearch, IconBook, IconPencil,
} from "../../index";

/* State matrix for the navigation group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks.

   Menu, Tooltip, ContextMenu and GlobalSearch portal their
   panels to <body>, which sits outside the captured frame. Their open panels
   are reviewed on the library preview page; here we cover the trigger states.
   Popover can opt out of the portal, so its open panel IS captured. */

const LONG = "Quarterly revenue recognition policy for multi-year enterprise agreements with usage-based true-ups";
const HUGE = "SupercalifragilisticexpialidociousnavigationlabelthatwillneverwrapAAAAAAAAAAAAAAAAAAAAAAA";

function TabsDemo({
  options, variant = "seg" as "seg" | "underline", start = "a",
}: {
  options: { id: string; label: string; count?: number; icon?: React.ReactNode }[];
  variant?: "seg" | "underline";
  start?: string;
}) {
  const [value, setValue] = useState(start);
  return <Tabs ariaLabel="Demo tabs" variant={variant} options={options} value={value} onChange={setValue} />;
}

const TABS = [
  { id: "a", label: "Overview" },
  { id: "b", label: "Metrics", count: 4 },
  { id: "c", label: "Logs" },
];
const TABS_MANY = [
  { id: "a", label: "Overview" },
  { id: "b", label: "Verified facts", count: 128 },
  { id: "c", label: "Contradictions", count: 12 },
  { id: "d", label: "Unsupported claims", count: 44 },
  { id: "e", label: "Revision history" },
  { id: "f", label: "Access" },
];
const TABS_LONG = [
  { id: "a", label: LONG, count: 128000 },
  { id: "b", label: HUGE },
];

const NOTIS = [
  { id: "n1", title: "Fact-check passed", body: "pricing.md, 12 claims", time: "2m ago", unread: true },
  { id: "n2", title: "Review requested", body: "onboarding-guide", time: "1h ago" },
  { id: "n3", title: "Sync finished", body: "GitHub, 402 documents", time: "3h ago" },
];
const NOTIS_MANY = Array.from({ length: 14 }, (_, i) => ({
  id: `n${i}`, title: `Notification ${i + 1}`, body: LONG, time: `${i + 1}h ago`, unread: i < 12,
}));

function SearchFieldDemo({ value = "", ...rest }: { value?: string; placeholder?: string; shortcut?: string }) {
  const [q, setQ] = useState(value);
  return <SearchField value={q} onChange={setQ} {...rest} />;
}

function PopoverDemo({ children, open = true }: { children: React.ReactNode; open?: boolean }) {
  return (
    <div className="h-[240px]">
      <Popover open={open} onOpenChange={() => {}} portal={false} align="start" trigger={<Button>Open panel</Button>}>
        {children}
      </Popover>
    </div>
  );
}

export const NAVIGATION: ComponentSpec[] = [
  {
    id: "Tabs", title: "Tabs", width: 720,
    states: [
      { id: "seg", label: "Segmented (default), first tab selected", node: <TabsDemo options={TABS} /> },
      { id: "seg-mid", label: "Segmented, a middle tab selected", node: <TabsDemo options={TABS} start="b" /> },
      { id: "underline", label: "Underline variant", node: <TabsDemo options={TABS} variant="underline" start="b" /> },
      { id: "icons", label: "With icons", node: (
        <TabsDemo options={[
          { id: "a", label: "Docs", icon: <IconDoc size={16} /> },
          { id: "b", label: "Rules", icon: <IconBook size={16} />, count: 22 },
          { id: "c", label: "Settings", icon: <IconGear size={16} /> },
        ]} />) },
      { id: "single", label: "A single tab", node: <TabsDemo options={[{ id: "a", label: "Overview" }]} /> },
      { id: "many", label: "Overflow: six tabs with counts", node: <TabsDemo options={TABS_MANY} start="c" /> },
      { id: "many-narrow", label: "Overflow: six tabs in a 340px frame", width: 340, node: <TabsDemo options={TABS_MANY} start="c" /> },
      { id: "overflow", label: "Overflow: long label + unbreakable label", width: 320, node: <TabsDemo options={TABS_LONG} /> },
      { id: "underline-narrow", label: "Overflow: underline variant, narrow frame", width: 320, node: (
        <TabsDemo options={TABS_MANY} variant="underline" start="d" />) },
    ],
  },
  {
    id: "Breadcrumb", title: "Breadcrumb", width: 720,
    states: [
      { id: "default", label: "Default", node: (
        <Breadcrumb items={[{ label: "Knowledge", href: "#" }, { label: "Runbooks", href: "#" }, { label: "Authentication rollout" }]} />) },
      { id: "single", label: "One crumb", node: <Breadcrumb items={[{ label: "Knowledge" }]} /> },
      { id: "empty", label: "Empty: no crumbs", node: (
        <div className="text-[12px] text-ink/70"><Breadcrumb items={[]} />(nothing should render above this line)</div>) },
      { id: "deep", label: "Overflow: seven levels deep", node: (
        <Breadcrumb items={[
          { label: "Workspace", href: "#" }, { label: "Knowledge", href: "#" }, { label: "Sources", href: "#" },
          { label: "GitHub", href: "#" }, { label: "mari/web", href: "#" }, { label: "docs", href: "#" },
          { label: "authentication-rollout.md" },
        ]} />) },
      { id: "overflow", label: "Overflow: long + unbreakable crumbs, narrow frame", width: 320, node: (
        <Breadcrumb items={[{ label: LONG, href: "#" }, { label: HUGE }]} />) },
    ],
  },
  {
    id: "Kbd", title: "Kbd", width: 480,
    states: [
      { id: "default", label: "Single keys and chords", node: (
        <div className="flex flex-wrap items-center gap-3">
          <Kbd keys="⌘ K" /><Kbd keys="Ctrl Shift P" /><Kbd keys="ESC" /><Kbd>?</Kbd>
        </div>) },
      { id: "empty", label: "Empty key", node: <Kbd keys="" /> },
      { id: "overflow", label: "Overflow: a long chord in a narrow frame", width: 240, node: (
        <Kbd keys="Ctrl Alt Shift Meta Backspace" />) },
    ],
  },
  {
    id: "SearchField", title: "SearchField", width: 620,
    states: [
      { id: "resting", label: "Resting", node: <SearchFieldDemo /> },
      { id: "filled", label: "Filled", node: <SearchFieldDemo value="pricing policy" /> },
      { id: "noshortcut", label: "No shortcut hint", node: <SearchFieldDemo shortcut="" /> },
      { id: "overflow", label: "Overflow: long placeholder + long value, narrow frame", width: 320, node: (
        <SearchFieldDemo value={HUGE} placeholder={LONG} />) },
    ],
  },
  {
    id: "NotificationBell", title: "NotificationBell", width: 420,
    states: [
      { id: "default", label: "Unread badge", node: <NotificationBell items={NOTIS} /> },
      { id: "read", label: "Nothing unread", node: <NotificationBell items={NOTIS.map((n) => ({ ...n, unread: false }))} /> },
      { id: "empty", label: "Empty", node: <NotificationBell items={[]} /> },
      { id: "loading", label: "Loading", node: <NotificationBell items={[]} loading /> },
      { id: "overflow", label: "Overflow: 12+ unread caps the badge at 9+", node: <NotificationBell items={NOTIS_MANY} /> },
    ],
  },
  {
    id: "Popover", title: "Popover", width: 520,
    states: [
      { id: "closed", label: "Trigger, closed", node: (
        <Popover trigger={<Button>Open panel</Button>}>Panel body</Popover>) },
      { id: "open", label: "Open (rendered inline via portal={false})", node: (
        <PopoverDemo>
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-ink">Filter documents</p>
            <div className="flex flex-wrap gap-1.5"><Chip label="Verified" selected onClick={() => {}} /><Chip label="Draft" onClick={() => {}} /></div>
            <Button variant="primary" compact>Apply</Button>
          </div>
        </PopoverDemo>) },
      { id: "empty", label: "Open with an empty body", node: <PopoverDemo><EmptyState>Nothing to configure.</EmptyState></PopoverDemo> },
      { id: "overflow", label: "Overflow: unbreakable body, narrow frame", width: 320, node: (
        <PopoverDemo><p className="break-words text-[13px]">{HUGE}</p></PopoverDemo>) },
    ],
  },
  {
    id: "Menu", title: "Menu", width: 480,
    states: [
      { id: "trigger", label: "Trigger (the panel portals to body)", node: (
        <Menu trigger={<Button>Actions</Button>}>
          <MenuLabel>Document</MenuLabel>
          <MenuItem icon={<IconPencil size={16} />}>Rename</MenuItem>
          <MenuItem icon={<IconDoc size={16} />} end={<Kbd keys="⌘ O" />}>Open</MenuItem>
          <MenuCheckboxItem checked onCheckedChange={() => {}}>Show archived</MenuCheckboxItem>
          <MenuSeparator />
          <MenuItem danger icon={<IconTrash size={16} />}>Delete</MenuItem>
        </Menu>) },
      { id: "icon-trigger", label: "Icon-only trigger", node: (
        <Menu trigger={<Button icon aria-label="More actions"><IconGear size={18} /></Button>}>
          <MenuItem>Preferences</MenuItem>
        </Menu>) },
      { id: "overflow", label: "Overflow: long trigger label, narrow frame", width: 260, node: (
        <Menu trigger={<Button className="max-w-full"><span className="min-w-0 truncate">{LONG}</span></Button>}>
          <MenuItem>Only item</MenuItem>
        </Menu>) },
    ],
  },
  {
    id: "ContextMenu", title: "ContextMenu", width: 520,
    states: [
      { id: "default", label: "Right-click target (the panel portals to body)", node: (
        <ContextMenu trigger={
          <div className="grid h-24 place-items-center rounded-[4px] border border-dashed border-ink/30 text-[13px] text-ink/70">
            Right-click this area
          </div>
        }>
          <ContextMenuItem>Open</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem danger>Delete</ContextMenuItem>
        </ContextMenu>) },
    ],
  },
  {
    id: "Tooltip", title: "Tooltip", width: 480,
    states: [
      { id: "default", label: "Trigger at rest (the bubble portals to body)", node: (
        <div className="flex items-center gap-3">
          <Tooltip label="Re-run the last sync"><Button icon aria-label="Sync"><IconSearch size={18} /></Button></Tooltip>
          <Tooltip label={LONG} side="right"><Button>Long tooltip</Button></Tooltip>
        </div>) },
    ],
  },
  {
    id: "GlobalSearch", title: "GlobalSearch", width: 620,
    states: [
      { id: "triggers", label: "Launchers (the overlay portals to body)", node: (
        <div className="space-y-3">
          <SearchFieldDemo />
          <div className="flex items-center gap-2">
            <Button variant="primary" compact>Open global search</Button>
            <Kbd keys="⌘ K" />
            <StatusChip status="connected" />
          </div>
        </div>) },
    ],
  },
];
