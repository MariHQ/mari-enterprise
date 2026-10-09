/* Mari console component library — one file per component, organized by
 * type. This is a standalone reference implementation (not wired into any
 * app's build) — copy what you need into your project. Source of truth
 * for each component's behavior is mari-cc/console; if that diverges from
 * here, this repo is stale until re-synced. */

export { card } from "./tokens/card";
export { focusRing } from "./tokens/focusRing";
export { fmtDate, fmtDateTime, fmtAgo, type DateInput } from "./tokens/format";

export { btn, btnPrimary, btnDanger } from "./actions/buttons";
export { Button, type ButtonProps } from "./actions/Button";
export { ConfirmButton, type ConfirmButtonProps } from "./actions/ConfirmButton";
export { Toggle, ToggleGroup, type ToggleGroupOption, type ToggleGroupProps } from "./actions/Toggle";

export { Page } from "./layout/Page";
export { PageHeader, type PageHeaderProps } from "./layout/PageHeader";
export { Drawer } from "./layout/Drawer";
export { Card, type CardProps } from "./layout/Card";
export { Dialog, type DialogProps } from "./layout/Dialog";
export { Separator } from "./layout/Separator";

export { Field } from "./forms/Field";
export { SectionLabel } from "./forms/SectionLabel";
export { FormField } from "./forms/FormField";
export { Input } from "./forms/Input";
export { Select } from "./forms/Select";
export { Textarea, type TextareaProps } from "./forms/Textarea";
export { Switch, type SwitchProps } from "./forms/Switch";
export { Checkbox, type CheckboxProps } from "./forms/Checkbox";
export { RadioGroup, type RadioOption } from "./forms/RadioGroup";
export { Combobox, type ComboboxOption } from "./forms/Combobox";
export { TagInput } from "./forms/TagInput";

export { Badge, resolveTone, resolveToneKey } from "./data-display/Badge";
export { Table } from "./data-display/Table";
export { DataTable, type Column } from "./data-display/DataTable";
export { Chip, StatusChip, SeverityChip, CountChip, DryChip, type ChipProps, type ChipTone, type ChipStatus, type ChipSeverity } from "./data-display/Chip";
export { EmptyState } from "./data-display/EmptyState";
export { Spinner } from "./data-display/Spinner";
export { Stepper } from "./data-display/Stepper";
export { Stat, type StatTone } from "./data-display/Stat";
export { IconRing, type IconRingTone } from "./data-display/IconRing";
export { Avatar } from "./data-display/Avatar";
export { Swatch } from "./data-display/Swatch";
export { Sparkline } from "./data-display/Sparkline";
export {
  Skeleton, SkeletonLine, SkeletonText, SkeletonCircle, SkeletonChip, SkeletonButton,
  SkeletonCard, SkeletonStat, SkeletonListRow, SkeletonList, SkeletonTable, SkeletonRows,
  SkeletonRegion, SkeletonSwitch, CELL_WIDTHS,
} from "./data-display/Skeleton";
export { SkeletonPage, type SkeletonPageVariant, type SkeletonPageProps, type SkeletonAction } from "./data-display/Skeletons";
export { Progress, type ProgressTone } from "./data-display/Progress";
export { Pagination } from "./data-display/Pagination";
export { Accordion, type AccordionItemData, type AccordionProps } from "./data-display/Accordion";
export { ActivityFeed, type ActivityItem } from "./data-display/ActivityFeed";
export { TreeView, type TreeNode } from "./data-display/TreeView";
export { Lineage, type LineageNode, type LineageProps, type LineageTone } from "./data-display/Lineage";

// Tables — richer patterns harvested from the console (DataTable covers search + single facet + sort + paging)
export { TableToolbar, type ToolbarFacet, type ToolbarSort } from "./data-display/TableToolbar";
export { SelectableTable } from "./data-display/SelectableTable";
export { ExpandableTable } from "./data-display/ExpandableTable";
export { PropertyList, type PropertyItem } from "./data-display/PropertyList";

// Markdown
export { MarkdownView, type MarkdownViewProps } from "./data-display/MarkdownView";
export { MarkdownEditor, type MarkdownEditorProps } from "./data-display/MarkdownEditor";
/* The round trip is the contract: `serializeBlocks(parseMarkdown(md))` is what
   Doc Review writes back, and a consumer that parses without it loses every
   construct the editor holds opaquely (tables, blockquotes, front matter,
   h4-h6). `RawKind` says which construct a block is holding verbatim. */
export {
  parseMarkdown, serializeBlocks, blockToMarkdown, mdInline, escapeHtml,
  type Block, type BlockType, type RawKind,
} from "./data-display/markdown";

// Cards & panels
export { ImpactPanel, type ImpactDoc, type ImpactPanelProps } from "./data-display/ImpactPanel";
export { DecisionCard, type DecisionCardProps, type DecisionStatus } from "./data-display/DecisionCard";
export { DigestCard, type DigestCardProps, type DigestTopic, type DigestWhere, type DigestImpact } from "./data-display/DigestCard";
export { ConnectorCard, type ConnectorCardProps, type ConnectorHealth } from "./data-display/ConnectorCard";
export { TokenReveal, type TokenRevealProps } from "./data-display/TokenReveal";
export { TagChip, TAG_OPTIONS, type TagChipProps, type TagKind } from "./data-display/TagChip";

export { Tabs, type TabsProps, type TabOption, type TabsVariant } from "./navigation/Tabs";
export { Menu, MenuItem, MenuCheckboxItem, MenuRadioGroup, MenuRadioItem, MenuLabel, MenuSeparator, type MenuProps } from "./navigation/Menu";
export { Popover, type PopoverProps } from "./navigation/Popover";
export { Tooltip } from "./navigation/Tooltip";
export { Breadcrumb, type Crumb } from "./navigation/Breadcrumb";
export { NotificationBell, type NotificationItem } from "./navigation/NotificationBell";
export { ContextMenu, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuSeparator } from "./navigation/ContextMenu";

export { Toaster, useToast, type ToastTone } from "./feedback/Toast";
export { Alert, type AlertTone } from "./feedback/Alert";

// Forms
export { TagPicker, type TagPickerProps } from "./forms/TagPicker";

// Chat / agent
export { ChatDock, type ChatDockProps } from "./chat/ChatDock";
export { ChatMessage, CHAT_INDENT, type ChatMessageProps } from "./chat/ChatMessage";
export { Sources, citeIndex, cleanSnippet, type SourcesProps, type SourceFocus } from "./chat/Sources";
export { ToolCall } from "./chat/ToolCall";
export { Composer, type ComposerProps } from "./chat/Composer";
export { TypingIndicator } from "./chat/TypingIndicator";
export {
  type ChatRole, type ChatMessageData, type ToolCallData, type ToolAuthData,
  type ChatSourceData, type SourceVariant,
} from "./chat/types";

// Workflow / flows
export type { WorkflowRun, RunStatus, RunStepRow, RunStat } from "./workflow/RunHistory";

/* ══════════════ Wave 2 — app shell, search, icons, connect/sync, more ══════════════ */

// Global search
export { Kbd } from "./navigation/Kbd";
export { SearchField } from "./navigation/SearchField";
export { GlobalSearch, type SearchScope, type SearchResult, type SearchResultGroup, type GlobalSearchProps } from "./navigation/GlobalSearch";

// Icons — bespoke line-art UI set + source/provider brand marks
export * from "./icons";
export type { IconProps, IconName, Provider, MarkProps } from "./icons";

// App shell — header bar, sidebar, layout
export { Logo, Brandmark, type LogoProps } from "./shell/Logo";
export { Sidebar, SidebarSection, SidebarItem, type SidebarProps, type NavItem, type NavSection } from "./shell/Sidebar";
export { HeaderBar, SearchTrigger, type HeaderBarProps, type HeaderUser } from "./shell/HeaderBar";
export { AppShell, type AppShellProps, type ShellContext } from "./shell/AppShell";
export { DockRail, DockLauncher, type DockRailProps, type DockLauncherProps } from "./shell/DockRail";

// Connect & sync
export { ConnectorWizard, type ConnectorWizardProps, type WizardProvider, type ConnectorField, type ConnectTestResult } from "./forms/ConnectorWizard";
export { ConnectDrawer, type ConnectDrawerProps } from "./forms/ConnectDrawer";
export { SyncPanel, SyncStatusLine, type SyncPanelProps, type SyncStatusLineProps, type SyncSource, type SyncState } from "./feedback/SyncPanel";

// Insights / knowledge primitives
export { Pill, type PillKind, type PillProps } from "./data-display/Pill";
export { GradeChip, type GradeChipProps } from "./data-display/GradeChip";
export { FreshBar, LegendSwatch, type FreshBarProps, type FreshSegment } from "./data-display/FreshBar";
export { DateRangePicker, DATE_RANGE_PRESETS, dateRangeStart, dateRangeLabel, type DateRangePickerProps, type DateRange, type DateRangePreset } from "./data-display/DateRangePicker";
export { Scrubber, type ScrubberProps, type ScrubberActivity } from "./data-display/Scrubber";
export { Inspector, type InspectorProps, type InspectorSection } from "./data-display/Inspector";
export { GlossaryPanel, type GlossaryPanelProps, type GlossaryEntry } from "./data-display/GlossaryPanel";
export { RulesPanel, type RulesPanelProps, type RuleRow, type RuleSeverity, type RuleStatus } from "./data-display/RulesPanel";

// Generic primitives
export { CopyButton, type CopyButtonProps } from "./actions/CopyButton";
export { CodeBlock, type CodeBlockProps } from "./data-display/CodeBlock";
export { Truncate, TruncateInline, type TruncateProps } from "./data-display/Truncate";
export { Scrollable, type ScrollableProps } from "./data-display/Scrollable";
export { Timeline, type TimelineProps, type TimelineItem } from "./data-display/Timeline";
export { AvatarGroup, type AvatarGroupProps } from "./data-display/AvatarGroup";

// ── Shared design-system foundations (CONVENTIONS.md) ──────────────────
// Table chrome: sortable headers + uniform cell padding.
export { SortHeader, useSort, thClass, thPad, tdPad, type SortState, type SortDir, type Align } from "./data-display/sortable";
// Card/drawer content ordering.
export { CardBody, CardTitleBlock, CardMeta, CardSection, CardActions } from "./layout/CardShell";
// Canonical error copy.
export { ERRORS, ERROR_LIST, type ErrorId, type ErrorSpec, type ErrorTone } from "./feedback/errors";
export { ErrorMessage, FieldError } from "./feedback/ErrorMessage";
/* The two failure surfaces, and the one hook that drives them (XA-01, XA-02,
   XA-03): <ReadError> for a failed read, <WriteError> for a failed page
   action, `useWrite` for the busy/failed pair behind the second. */
export { ReadError } from "./feedback/ReadError";
export { WriteError } from "./feedback/WriteError";
export { useWrite, why } from "./actions/useWrite";
/* The one resync sentinel (C1, XA-21): adopt a prop into local state when it
   changes, without clobbering an edit the reader has open. */
export { useResync, listSig } from "./actions/useResync";
// The one run-status vocabulary (XA-25, X2).
export { RUN_STATUS_CHIP, toRunStatus, runStatusChip } from "./tokens/runStatus";
// The one result-count strip and the one "show the rest" toggle (§13, §16).
export { ResultCount, PagerBar, usePaged, countOf, singularize } from "./data-display/Pagination";
export { ShowRest } from "./data-display/ShowRest";
// Actions that appear on more than one pane, spelled once (§16).
export {
  CreateReviewTaskButton, OpenDocumentButton, ExportButton, RefreshButton,
} from "./actions/RepeatedActions";
// Canonical server/region vocabulary.
export { REGIONS, REGION_OPTIONS, regionLabel, regionShort, type RegionCode } from "./tokens/regions";
/* Canonical timezone vocabulary — one list, shared by Preferences and Settings
   → General, which used to offer different ids for the same account. */
export {
  TIMEZONES, TIMEZONE_OPTIONS, timezoneOptions, timezoneLabel, normalizeTimezone,
  type TimezoneOption,
} from "./tokens/timezones";
// Disabled-state token for hand-rolled buttons.
export { btnDisabled } from "./actions/buttons";
