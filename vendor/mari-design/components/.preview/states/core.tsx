import { Settings, Trash2 } from "lucide-react";
import type { ComponentSpec } from "./types";
import {
  Button, ConfirmButton, Chip, StatusChip, SeverityChip, CountChip, Badge,
  Table, DataTable, Pagination, Stat, Card, Alert, ErrorMessage, Input,
  TableToolbar, Tabs, EmptyState, type Column,
} from "../../index";

/* State matrices for the core primitives.
   Author the ugly cases, not just the happy path: loading, empty, error,
   disabled, selected, and OVERFLOW (absurdly long strings, too many items,
   a frame too narrow to hold the content). Overflow states are the ones that
   catch real layout bugs. */

const LONG = "Quarterly revenue recognition policy for multi-year enterprise agreements with usage-based true-ups";
const HUGE = "Supercalifragilisticexpialidocious_configuration_parameter_value_that_never_wraps_because_it_has_no_spaces";

type Row = { id: string; doc: string; owner: string; region: string; status: "verified" | "stale" | "draft" };
const ROWS: Row[] = [
  { id: "1", doc: "Pricing sheet", owner: "Ana Ruiz", region: "us-west-2", status: "verified" },
  { id: "2", doc: "Onboarding runbook", owner: "Dev Park", region: "us-east-1", status: "stale" },
  { id: "3", doc: "Q3 launch plan", owner: "Mia Chen", region: "eu-west-1", status: "draft" },
];
const LONG_ROWS: Row[] = [
  { id: "1", doc: LONG, owner: "Aleksandra Konstantinopoulou-Whitfield", region: "ap-southeast-2", status: "verified" },
  { id: "2", doc: HUGE, owner: "Dev Park", region: "us-east-1", status: "stale" },
];
const COLS: Column<Row>[] = [
  { key: "doc", header: "Document", sortable: true, sort: (r) => r.doc, render: (r) => <span className="font-medium text-ink">{r.doc}</span> },
  { key: "owner", header: "Owner", sortable: true, sort: (r) => r.owner, render: (r) => <span className="text-[13px] text-ink/70">{r.owner}</span> },
  { key: "region", header: "Region", sortable: true, sort: (r) => r.region, render: (r) => r.region },
  { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} /> },
];

export const CORE: ComponentSpec[] = [
  {
    id: "Button", title: "Button", width: 640,
    states: [
      { id: "variants", label: "All variants", node: (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button>Default</Button>
          <Button variant="success">Approve</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="link">Link</Button>
        </div>) },
      { id: "sizes", label: "Sizes", node: (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Normal</Button>
          <Button compact variant="primary">Compact</Button>
          <Button icon aria-label="Settings"><Settings size={15} /></Button>
        </div>) },
      { id: "disabled", label: "Disabled (contrast check)", node: (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled>Primary</Button>
          <Button disabled>Default</Button>
          <Button variant="success" disabled>Approve</Button>
          <Button variant="danger" disabled>Delete</Button>
        </div>) },
      { id: "overflow", label: "Overflow: long labels in a narrow frame", width: 300, node: (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">{LONG}</Button>
          <Button>{HUGE}</Button>
        </div>) },
    ],
  },
  {
    id: "ConfirmButton", title: "ConfirmButton", width: 520,
    states: [
      { id: "default", label: "Resting", node: <ConfirmButton onConfirm={() => {}}>Delete source</ConfirmButton> },
      { id: "icon", label: "With icon", node: <ConfirmButton onConfirm={() => {}}><Trash2 size={14} /> Delete</ConfirmButton> },
      { id: "overflow", label: "Overflow: long label, narrow frame", width: 260,
        node: <ConfirmButton onConfirm={() => {}}>Delete every synced document from this workspace</ConfirmButton> },
    ],
  },
  {
    id: "Chip", title: "Chip / StatusChip / SeverityChip", width: 640,
    states: [
      { id: "tones", label: "Tones", node: (
        <div className="flex flex-wrap gap-2">
          <Chip label="Ok" tone="ok" dot /><Chip label="Attention" tone="attention" dot />
          <Chip label="Blocked" tone="blocked" dot /><Chip label="Info" tone="info" dot />
          <Chip label="Neutral" tone="neutral" />
        </div>) },
      { id: "statuses", label: "Every StatusChip", node: (
        <div className="flex flex-wrap gap-2">
          {(["verified", "canonical", "approved", "stale", "draft", "retired", "running", "failed",
             "needs-review", "supported", "contradiction", "unsupported", "error", "warn", "advisory",
             "healthy", "syncing", "paused", "queued", "succeeded", "skipped", "connected", "disconnected", "dry"] as const)
            .map((s) => <StatusChip key={s} status={s} />)}
        </div>) },
      { id: "interactive", label: "Selected / removable / severity", node: (
        <div className="flex flex-wrap gap-2">
          <Chip label="Unselected" onClick={() => {}} />
          <Chip label="Selected" selected onClick={() => {}} />
          <Chip label="Removable" onRemove={() => {}} />
          <SeverityChip severity="high" /><SeverityChip severity="med" /><SeverityChip severity="low" />
          <CountChip count={3} /><CountChip count={128} tone="blocked" />
          <Badge label="Badge" tone="info" />
        </div>) },
      { id: "overflow", label: "Overflow: long labels, narrow frame", width: 280, node: (
        <div className="flex flex-wrap gap-2">
          <Chip label={LONG} tone="info" dot /><Chip label={HUGE} tone="blocked" />
        </div>) },
    ],
  },
  {
    id: "Table", title: "Table", width: 820,
    states: [
      { id: "default", label: "Default", node: (
        <Table title="Documents" count={3} head={["Document", "Owner", "Region", "Status"]}>
          {ROWS.map((r) => (
            <tr key={r.id} className="border-b border-ink/10 last:border-0">
              <td className="px-4 py-3 font-medium text-ink">{r.doc}</td>
              <td className="px-4 py-3 text-[13px] text-ink/70">{r.owner}</td>
              <td className="px-4 py-3 text-[13px] text-ink/70">{r.region}</td>
              <td className="px-4 py-3"><StatusChip status={r.status} /></td>
            </tr>))}
        </Table>) },
      { id: "loading", label: "Loading", node: (
        <Table title="Documents" head={["Document", "Owner", "Region", "Status"]} loading><tr /></Table>) },
      { id: "empty", label: "Empty", node: (
        <Table title="Documents" count={0} head={["Document", "Owner", "Region", "Status"]}>
          <tr><td colSpan={4} className="px-4 py-10"><EmptyState>No documents yet.</EmptyState></td></tr>
        </Table>) },
      { id: "overflow", label: "Overflow: unbreakable + very long cells", node: (
        <Table title="Documents" count={2} head={["Document", "Owner", "Region", "Status"]}>
          {LONG_ROWS.map((r) => (
            <tr key={r.id} className="border-b border-ink/10 last:border-0">
              <td className="px-4 py-3 font-medium text-ink">{r.doc}</td>
              <td className="px-4 py-3 text-[13px] text-ink/70">{r.owner}</td>
              <td className="px-4 py-3 text-[13px] text-ink/70">{r.region}</td>
              <td className="px-4 py-3"><StatusChip status={r.status} /></td>
            </tr>))}
        </Table>) },
    ],
  },
  {
    id: "DataTable", title: "DataTable", width: 860,
    states: [
      { id: "default", label: "Default", node: (
        <DataTable title="Documents" count={3} rows={ROWS} columns={COLS} rowKey={(r) => r.id}
          search={(r) => r.doc} facet={{ label: "All regions", get: (r) => r.region }} />) },
      { id: "loading", label: "Loading", node: (
        <DataTable title="Documents" rows={[]} columns={COLS} rowKey={(r) => r.id} loading />) },
      { id: "empty", label: "Empty", node: (
        <DataTable title="Documents" count={0} rows={[]} columns={COLS} rowKey={(r) => r.id}
          empty="Nothing matches those filters." />) },
      { id: "overflow", label: "Overflow: very long cells", node: (
        <DataTable title="Documents" count={2} rows={LONG_ROWS} columns={COLS} rowKey={(r) => r.id} search={(r) => r.doc} />) },
    ],
  },
  {
    id: "TableToolbar", title: "TableToolbar", width: 820,
    states: [
      { id: "default", label: "Default", node: (
        <TableToolbar title="Documents" count={4}
          search={{ value: "", onChange: () => {} }}
          facets={[
            { label: "Source", value: "", onChange: () => {}, options: [{ value: "gh", label: "GitHub" }, { value: "no", label: "Notion" }, { value: "sl", label: "Slack" }] },
            { label: "Status", value: "verified", onChange: () => {}, allLabel: "All statuses", options: [{ value: "verified", label: "Verified" }, { value: "stale", label: "Stale" }] },
          ]}
          onClearAll={() => {}}
          sort={{ value: "updated", onChange: () => {}, dir: "desc", onDirChange: () => {}, options: [{ value: "updated", label: "Updated" }, { value: "title", label: "Title" }] }}
          actions={<Button compact variant="primary">New</Button>} />) },
      { id: "overflow", label: "Overflow: narrow frame", width: 380, node: (
        <TableToolbar title="Documents" count={4}
          search={{ value: "", onChange: () => {} }}
          facets={[{ label: "Source", value: "", onChange: () => {}, options: [{ value: "gh", label: "GitHub" }, { value: "no", label: "Notion" }] }]}
          actions={<Button compact variant="primary">New</Button>} />) },
    ],
  },
  {
    id: "Alert", title: "Alert / ErrorMessage", width: 700,
    states: [
      { id: "tones", label: "All tones", node: (
        <div className="space-y-3">
          <Alert tone="info" title="Heads up">An informational banner.</Alert>
          <Alert tone="ok" title="Sync finished">All sources are healthy.</Alert>
          <Alert tone="attention" title="Attention">A certificate expires soon.</Alert>
          <Alert tone="blocked" title="Action required" onDismiss={() => {}}>A migration is pending.</Alert>
        </div>) },
      { id: "errors", label: "Standard error catalog", node: (
        <div className="space-y-3">
          <ErrorMessage id="network.offline" onAction={() => {}} />
          <ErrorMessage id="connector.authFailed" onAction={() => {}} />
          <ErrorMessage id="upload.unsupportedType">report-q3.numbers</ErrorMessage>
          <ErrorMessage id="run.needsApproval" onAction={() => {}} />
        </div>) },
      { id: "overflow", label: "Overflow: long body, narrow frame", width: 320, node: (
        <ErrorMessage id="generic.unknown" onAction={() => {}}>{HUGE}</ErrorMessage>) },
    ],
  },
  {
    id: "Stat", title: "Stat", width: 760,
    states: [
      { id: "row", label: "Row of stats (equal widths?)", node: (
        <div className="flex gap-3">
          <Stat label="Requests" value="1,284" sub="+12% this week" tone="ok" />
          <Stat label="Incidents" value="3" tone="attention" />
          <Stat label="Uptime" value="99.98%" />
        </div>) },
      { id: "overflow", label: "Overflow: long labels and values", node: (
        <div className="flex gap-3">
          <Stat label="Documents pending human verification" value="1,284,905" />
          <Stat label="Uptime" value="99.98%" />
          <Stat label={HUGE.slice(0, 48)} value="7" tone="blocked" />
        </div>) },
    ],
  },
  {
    id: "Pagination", title: "Pagination", width: 520,
    states: [
      { id: "middle", label: "Middle page", node: <Pagination page={3} pageCount={9} onChange={() => {}} itemLabel="Showing 25 to 32 of 71" /> },
      { id: "first", label: "First page (prev disabled)", node: <Pagination page={0} pageCount={9} onChange={() => {}} /> },
      { id: "last", label: "Last page (next disabled)", node: <Pagination page={8} pageCount={9} onChange={() => {}} /> },
      { id: "single", label: "Single page (both disabled)", node: <Pagination page={0} pageCount={1} onChange={() => {}} /> },
      { id: "outofrange", label: "Out of range (must clamp)", node: <Pagination page={99} pageCount={9} onChange={() => {}} /> },
    ],
  },
  {
    id: "Card", title: "Card", width: 640,
    states: [
      { id: "default", label: "Default", node: (
        <Card eyebrow="This month" title="Usage" hint="Updated 2m ago" actions={<Button compact>Export</Button>}>
          <p className="text-[13px] text-ink/70">1,284 requests across 4 services.</p>
        </Card>) },
      { id: "overflow", label: "Overflow: long title + hint + action", width: 360, node: (
        <Card eyebrow="This month" title={LONG} hint="Updated 2 minutes ago" actions={<Button compact>Export everything</Button>}>
          <p className="text-[13px] text-ink/70">{HUGE}</p>
        </Card>) },
    ],
  },
  {
    id: "Input", title: "Input / form field states", width: 560,
    states: [
      { id: "states", label: "Resting / filled / disabled", node: (
        <div className="space-y-2">
          <Input placeholder="Search knowledge, people, facts…" className="w-full" />
          <Input defaultValue="pricing policy" className="w-full" />
          <Input defaultValue="Read only" disabled className="w-full" />
        </div>) },
      { id: "error", label: "With field error", node: (
        <div className="space-y-2">
          <Input defaultValue="not-an-email" className="w-full" aria-invalid />
          <ErrorMessage id="field.invalidEmail" />
        </div>) },
    ],
  },
  {
    id: "Tabs", title: "Tabs", width: 640,
    states: [
      { id: "seg", label: "Segmented", node: (
        <Tabs ariaLabel="Views" value="a" onChange={() => {}}
          options={[{ id: "a", label: "Overview" }, { id: "b", label: "Metrics", count: 4 }, { id: "c", label: "Logs" }]} />) },
      { id: "underline", label: "Underline", node: (
        <Tabs ariaLabel="Views" variant="underline" value="b" onChange={() => {}}
          options={[{ id: "a", label: "Overview" }, { id: "b", label: "Metrics", count: 4 }, { id: "c", label: "Logs" }]} />) },
      { id: "overflow", label: "Overflow: many long tabs, narrow frame", width: 340, node: (
        <Tabs ariaLabel="Views" value="a" onChange={() => {}} options={[
          { id: "a", label: "Overview" }, { id: "b", label: "Verified facts", count: 128 },
          { id: "c", label: "Contradictions", count: 12 }, { id: "d", label: "Unsupported claims", count: 44 },
          { id: "e", label: "Revision history" }]} />) },
    ],
  },
];
