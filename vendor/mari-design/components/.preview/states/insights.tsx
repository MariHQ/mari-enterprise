import { useState } from "react";
import type { ComponentSpec } from "./types";
import {
  Pill, GradeChip, FreshBar, LegendSwatch, Sparkline, Progress, Stepper,
  Scrubber, Inspector, GlossaryPanel, RulesPanel, type RuleRow, type RuleStatus,
  Avatar, AvatarGroup, IconRing, Swatch, CodeBlock, Spinner, EmptyState, Badge,
  Button, Chip, StatusChip, Card,
  IconBook, IconDoc, IconSearch, IconShieldCheck, IconSparkle,
} from "../../index";
import { DateRangePicker, type DateRange } from "../../data-display/DateRangePicker";

/* State matrix for the insights group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks. */

const LONG =
  "Quarterly revenue recognition policy for multi-year enterprise agreements with usage-based true-ups";
/** 90 characters, no spaces and no hyphens: nothing in it can break. */
const HUGE = "SupercalifragilisticexpialidociousconfigurationparametervaluethatwillneverwrapAAAAAAAAAAAAA";

const DATES = [
  "2026-01-14", "2026-02-02", "2026-03-11", "2026-04-06", "2026-05-19",
  "2026-06-08", "2026-07-01", "2026-07-14", "2026-07-20",
];
const ACTIVITY = DATES.map((d, i) => ({ date: d, count: [3, 9, 2, 14, 6, 11, 4, 18, 7][i] }));

const RULES: RuleRow[] = [
  { id: "clarity.passive-voice", family: "Clarity", severity: "warn", description: "Prefer the active voice in procedures.", pack: "House style", status: "active" },
  { id: "clarity.long-sentence", family: "Clarity", severity: "advisory", description: "Sentences over 32 words are hard to scan.", pack: "House style", status: "zero" },
  { id: "grammar.subject-verb", family: "Grammar", severity: "error", description: "Subject and verb must agree in number.", pack: "Core", status: "active" },
  { id: "inclusive.gendered-terms", family: "Inclusive", severity: "error", description: "Replace gendered role nouns with neutral ones.", pack: "Core", status: "ignored" },
  { id: "facts.undated-claim", family: "Facts", severity: "warn", description: "A quantitative claim needs a dated source.", pack: "Evidence", status: "active" },
];
const RULES_LONG: RuleRow[] = [
  { id: HUGE, family: "Clarity", severity: "error", description: LONG, pack: "House style pack for long-form enterprise documentation", status: "active" },
  { id: "grammar.subject-verb-agreement-across-coordinated-clauses", family: "Grammar and mechanics", severity: "warn", description: LONG, status: "zero" },
];
const RULES_MANY: RuleRow[] = Array.from({ length: 14 }, (_, i) => ({
  id: `pack.rule-${String(i + 1).padStart(2, "0")}`,
  family: ["Clarity", "Grammar", "Inclusive", "Facts"][i % 4],
  severity: (["error", "warn", "advisory"] as const)[i % 3],
  description: `Deterministic check number ${i + 1} in the imported pack.`,
  pack: "Imported",
  status: (["active", "zero", "ignored"] as const)[i % 3],
}));

type Entry = { id: string; term: string; definition: string; meta?: string };
const GLOSSARY: Entry[] = [
  { id: "g1", term: "Canonical", definition: "The single approved answer for a question.", meta: "Alex Rivera · updated Jul 9, 2026" },
  { id: "g2", term: "Freshness", definition: "How recently a document was verified against its source.", meta: "Dana Reyes · updated Jul 2, 2026" },
];
const GLOSSARY_LONG: Entry[] = [
  { id: "g1", term: "Revenue recognition true-up", definition: LONG, meta: "Aleksandra Konstantinopoulou-Whitfield · updated Jul 16, 2026" },
  { id: "g2", term: HUGE.slice(0, 44), definition: HUGE, meta: "Dev Park · updated Jul 16, 2026" },
];

/* Live wrappers: a state node is static JSX, so anything needing its own state
   gets a tiny stateful shell here rather than a hook inside the matrix. */
function ScrubberDemo({ at = null, dates = DATES }: { at?: number | null; dates?: string[] }) {
  const [value, setValue] = useState<number | null>(at);
  return <Scrubber dates={dates} activity={ACTIVITY} value={value} onChange={setValue} />;
}
function RangeDemo(
  { start, open, compact, disabled }:
  { start: DateRange; open?: boolean; compact?: boolean; disabled?: boolean },
) {
  const [value, setValue] = useState<DateRange>(start);
  return <DateRangePicker value={value} onChange={setValue} open={open} compact={compact} disabled={disabled} portal={false} />;
}
function RulesDemo({ rules, editable = true }: { rules: RuleRow[]; editable?: boolean }) {
  const [rows, setRows] = useState(rules);
  const change = (id: string, status: RuleStatus) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  return <RulesPanel rules={rows} onStatusChange={editable ? change : undefined} />;
}
function GlossaryDemo({ entries }: { entries: Entry[] }) {
  const [rows, setRows] = useState(entries);
  return (
    <GlossaryPanel
      entries={rows}
      onAdd={(term, definition) => setRows((r) => [...r, { id: `n${r.length}`, term, definition, meta: "You · just now" }])}
      onEdit={(id, term, definition) => setRows((r) => r.map((e) => (e.id === id ? { ...e, term, definition } : e)))}
      onDelete={(id) => setRows((r) => r.filter((e) => e.id !== id))}
    />
  );
}

export const INSIGHTS: ComponentSpec[] = [
  {
    id: "Pill", title: "Pill", width: 640,
    states: [
      { id: "kinds", label: "Every kind (all caps)", node: (
        <div className="flex flex-wrap gap-2">
          {(["canonical", "verified", "approval", "factcheck", "needs-review", "stale", "deprecated", "draft"] as const)
            .map((k) => <Pill key={k} kind={k} />)}
        </div>) },
      { id: "unknown", label: "Unknown kind + label/tone overrides", node: (
        <div className="flex flex-wrap gap-2">
          <Pill kind="bespoke-state" />
          <Pill kind="verified" text="Verified by legal" />
          <Pill kind="draft" tone="blocked" />
        </div>) },
      { id: "overflow", label: "Overflow: long label, unbreakable string, narrow frame", width: 320, node: (
        <div className="flex flex-wrap gap-2">
          <Pill kind="canonical" text={LONG} />
          <Pill kind="stale" text={HUGE} />
        </div>) },
    ],
  },
  {
    id: "GradeChip", title: "GradeChip", width: 520,
    states: [
      { id: "grades", label: "A to F, with suffixes", node: (
        <div className="flex flex-wrap gap-2">
          {["A", "A-", "B+", "B", "C", "D", "E", "F"].map((g) => <GradeChip key={g} grade={g} />)}
        </div>) },
      { id: "unknown", label: "Unrecognised / empty grade", node: (
        <div className="flex flex-wrap gap-2">
          <GradeChip grade="?" /><GradeChip grade="" /><GradeChip grade="zzz" />
        </div>) },
    ],
  },
  {
    id: "FreshBar", title: "FreshBar", width: 560,
    states: [
      { id: "default", label: "Default (fresh / aging / stale)", node: (
        <FreshBar segments={[
          { label: "Fresh", value: 42, tone: "ok" },
          { label: "Aging", value: 13, tone: "attention" },
          { label: "Stale", value: 6, tone: "blocked" },
        ]} />) },
      { id: "nolegend", label: "No legend, taller bar", node: (
        <FreshBar height={16} legend={false} segments={[
          { label: "Fresh", value: 42, tone: "ok" },
          { label: "Stale", value: 6, tone: "blocked" },
        ]} />) },
      { id: "lopsided", label: "Lopsided split (1 vs 199)", node: (
        <FreshBar segments={[
          { label: "Fresh", value: 1, tone: "ok" },
          { label: "Stale", value: 199, tone: "blocked" },
        ]} />) },
      { id: "empty", label: "Empty: every segment is zero", node: (
        <FreshBar segments={[
          { label: "Fresh", value: 0, tone: "ok" },
          { label: "Aging", value: 0, tone: "attention" },
          { label: "Stale", value: 0, tone: "blocked" },
        ]} />) },
      { id: "overflow", label: "Overflow: many long-labelled segments, narrow frame", width: 320, node: (
        <FreshBar segments={[
          { label: "Verified in the last 24 hours", value: 12, tone: "ok" },
          { label: "Awaiting a human reviewer", value: 9, tone: "attention" },
          { label: "Contradicted by a newer source", value: 5, tone: "blocked" },
          { label: HUGE.slice(0, 40), value: 3, tone: "info" },
          { label: "Unclassified", value: 7 },
        ]} />) },
      { id: "swatches", label: "LegendSwatch on its own", node: (
        <div className="flex flex-wrap gap-4">
          <LegendSwatch tone="ok" label="Fresh" /><LegendSwatch tone="attention" label="Aging" />
          <LegendSwatch tone="blocked" label="Stale" /><LegendSwatch color="#6B21A8" label="Custom color" />
        </div>) },
    ],
  },
  {
    id: "Sparkline", title: "Sparkline", width: 520,
    states: [
      { id: "tones", label: "Every tone", node: (
        <div className="flex flex-wrap items-center gap-4">
          {(["ok", "attention", "blocked", "info", "neutral"] as const).map((t) => (
            <Sparkline key={t} tone={t} values={[3, 7, 4, 9, 6, 12, 8, 14]} />
          ))}
        </div>) },
      { id: "flat", label: "Flat line / all zeros", node: (
        <div className="flex items-center gap-4">
          <Sparkline values={[5, 5, 5, 5, 5]} />
          <Sparkline values={[0, 0, 0, 0, 0]} tone="neutral" />
        </div>) },
      { id: "empty", label: "Empty: fewer than two points, renders nothing", node: (
        <div className="flex items-center gap-2 text-[12px] text-ink/70">
          <Sparkline values={[4]} /><span>nothing should sit to the left of this text</span>
        </div>) },
      { id: "overflow", label: "Overflow: 200 points in a narrow frame", width: 320, node: (
        <Sparkline width={280} height={34} values={Array.from({ length: 200 }, (_, i) => Math.abs(Math.sin(i / 7)) * 20 + 2)} />) },
    ],
  },
  {
    id: "Progress", title: "Progress", width: 520,
    states: [
      { id: "tones", label: "Every tone, with labels", node: (
        <div className="space-y-3">
          <Progress value={72} label="Importing documents" tone="info" />
          <Progress value={100} label="Sync complete" tone="ok" />
          <Progress value={38} label="Re-indexing" tone="attention" />
          <Progress value={12} label="Failed batch retry" tone="blocked" />
        </div>) },
      { id: "bounds", label: "0%, 100%, and out-of-range input", node: (
        <div className="space-y-3">
          <Progress value={0} label="Not started" />
          <Progress value={100} label="Done" tone="ok" />
          <Progress value={-40} label="Negative input clamps to 0" tone="blocked" />
          <Progress value={480} label="Over 100 clamps to 100" tone="ok" />
        </div>) },
      { id: "nolabel", label: "Bar only", node: <Progress value={45} /> },
      { id: "overflow", label: "Overflow: long label, narrow frame", width: 320, node: (
        <Progress value={64} label={LONG} />) },
    ],
  },
  {
    id: "Stepper", title: "Stepper", width: 640,
    states: [
      { id: "default", label: "Mid-flow (read only)", node: (
        <Stepper labels={["Choose source", "Configure", "Sync"]} current={1} />) },
      { id: "first", label: "First step", node: (
        <Stepper labels={["Choose source", "Configure", "Sync"]} current={0} />) },
      { id: "done", label: "All steps complete", node: (
        <Stepper labels={["Choose source", "Configure", "Sync"]} current={3} />) },
      { id: "clickable", label: "Selectable steps", node: (
        <Stepper labels={["Token", "Account", "Finish"]} current={1} onSelect={() => {}} />) },
      { id: "overflow", label: "Overflow: seven long labels in a narrow frame", width: 320, node: (
        <Stepper current={2} labels={["Choose a source", "Authenticate", "Select repositories", "Configure filters", "Preview", "Confirm", "Sync"]} />) },
    ],
  },
  {
    id: "DateRangePicker", title: "DateRangePicker", width: 420,
    states: [
      { id: "default", label: "Resting (All time)", node: <RangeDemo start={{ preset: "all" }} /> },
      { id: "preset", label: "A preset selected", node: <RangeDemo start={{ preset: "30d" }} /> },
      { id: "custom-value", label: "Custom range selected (no dashes in copy)", node: (
        <RangeDemo start={{ preset: "custom", from: "2026-07-01", to: "2026-07-08" }} />) },
      { id: "open", label: "Open: all seven presets, one selected", node: (
        <div className="h-[380px]"><RangeDemo start={{ preset: "7d" }} open /></div>) },
      { id: "open-custom", label: "Open: custom range fields", node: (
        <div className="h-[470px]"><RangeDemo start={{ preset: "custom", from: "2026-07-01", to: "2026-07-08" }} open /></div>) },
      { id: "open-invalid", label: "Open: invalid range, Apply disabled", node: (
        <div className="h-[500px]"><RangeDemo start={{ preset: "custom", from: "2026-07-20", to: "2026-07-01" }} open /></div>) },
      { id: "disabled", label: "Disabled (must stay legible)", node: <RangeDemo start={{ preset: "7d" }} disabled /> },
      { id: "compact", label: "Compact trigger", node: <RangeDemo start={{ preset: "24h" }} compact /> },
      { id: "overflow", label: "Overflow: long custom label, narrow frame", width: 240, node: (
        <RangeDemo start={{ preset: "custom", from: "2026-01-01", to: "2026-12-31" }} />) },
    ],
  },
  {
    id: "Scrubber", title: "Scrubber", width: 820,
    states: [
      { id: "default", label: "Default (All time)", node: <ScrubberDemo /> },
      { id: "midway", label: "As of a mid-timeline date", node: <ScrubberDemo at={3} /> },
      { id: "oldest", label: "Oldest event", node: <ScrubberDemo at={0} /> },
      { id: "single", label: "One event date only", node: <ScrubberDemo dates={["2026-07-14"]} at={0} /> },
      { id: "empty", label: "Empty: no dates, every control disabled", node: <ScrubberDemo dates={[]} /> },
      { id: "many", label: "Overflow: 120 event dates", node: (
        <ScrubberDemo at={40} dates={Array.from({ length: 120 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`)} />) },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: <ScrubberDemo at={4} /> },
    ],
  },
  {
    id: "Inspector", title: "Inspector", width: 400,
    states: [
      { id: "default", label: "Default", node: (
        <Inspector
          sticky={false} icon={<IconDoc size={20} />} eyebrow="Google Docs"
          title="Authentication rollout plan"
          tags={<><Pill kind="canonical" /><Pill kind="verified" /></>}
          properties={[
            { label: "Owner", value: "Alex Rivera" },
            { label: "Updated", value: "Jul 16, 2026" },
            { label: "Kind", value: "Runbook" },
          ]}
          sections={[{ title: "Verified facts", count: 2, content: (
            <ul className="space-y-1"><li>SSO migration completed Jun 20, 2026.</li><li>Fallback documented and tested.</li></ul>) }]}
          actions={<><Button variant="primary" compact>Open document</Button><Button compact>View lineage</Button></>}
        />) },
      { id: "minimal", label: "Title only: no tags, properties, sections or actions", node: (
        <Inspector title="Untitled draft" sticky={false} />) },
      { id: "empty-section", label: "Empty section body", node: (
        <Inspector title="Pricing sheet" sticky={false} icon={<IconBook size={20} />}
          tags={<StatusChip status="draft" />}
          sections={[{ title: "Verified facts", count: 0, content: <EmptyState>No facts extracted yet.</EmptyState> }]}
        />) },
      { id: "overflow", label: "Overflow: long title, unbreakable property, many tags", width: 320, node: (
        <Inspector
          sticky={false} icon={<IconShieldCheck size={20} />} eyebrow="Confluence" title={LONG}
          tags={<>{(["canonical", "verified", "needs-review", "stale", "deprecated", "draft"] as const).map((k) => <Pill key={k} kind={k} />)}</>}
          properties={[
            { label: "Owner", value: "Aleksandra Konstantinopoulou-Whitfield" },
            { label: "Checksum", value: HUGE },
          ]}
          sections={[{ title: "References", count: 3, content: <p className="break-words">{HUGE}</p> }]}
          actions={<><Button variant="primary" compact>Open document</Button><Button compact>View lineage</Button><Button compact>Export</Button></>}
        />) },
    ],
  },
  {
    id: "GlossaryPanel", title: "GlossaryPanel", width: 760,
    states: [
      { id: "default", label: "Default (edit and delete are the same 36px button)", node: <GlossaryDemo entries={GLOSSARY} /> },
      { id: "readonly", label: "Read only: no handlers, no affordances", node: (
        <GlossaryPanel entries={GLOSSARY} hint="Read only" />) },
      { id: "empty", label: "Empty (editable)", node: <GlossaryDemo entries={[]} /> },
      { id: "empty-readonly", label: "Empty, read only", node: <GlossaryPanel entries={[]} /> },
      { id: "overflow", label: "Overflow: long definition + unbreakable term", node: <GlossaryDemo entries={GLOSSARY_LONG} /> },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: <GlossaryDemo entries={GLOSSARY_LONG} /> },
    ],
  },
  {
    id: "RulesPanel", title: "RulesPanel", width: 900,
    states: [
      { id: "default", label: "Default: sortable headers, status last and left-aligned", node: <RulesDemo rules={RULES} /> },
      { id: "readonly", label: "No status control (read only)", node: <RulesDemo rules={RULES} editable={false} /> },
      { id: "nosearch", label: "Search disabled", node: <RulesPanel rules={RULES} searchable={false} onStatusChange={() => {}} /> },
      { id: "many", label: "Overflow: 14 rules across 4 families", node: <RulesDemo rules={RULES_MANY} /> },
      { id: "empty", label: "Empty: no rules at all", node: <RulesDemo rules={[]} /> },
      { id: "overflow", label: "Overflow: unbreakable rule id + very long description", node: <RulesDemo rules={RULES_LONG} /> },
      { id: "narrow", label: "Overflow: narrow frame (the table scrolls, the page does not)", width: 320, node: <RulesDemo rules={RULES} /> },
    ],
  },
  {
    id: "Avatar", title: "Avatar / AvatarGroup", width: 560,
    states: [
      { id: "default", label: "Single avatars", node: (
        <div className="flex items-center gap-2">
          <Avatar initials="DR" /><Avatar initials="AK" /><Avatar initials="M" />
        </div>) },
      { id: "group", label: "Group with overflow bubble", node: (
        <div className="space-y-3">
          <AvatarGroup people={[{ initials: "DR" }, { initials: "AK" }, { initials: "MC" }]} />
          <AvatarGroup people={Array.from({ length: 9 }, (_, i) => ({ initials: `P${i}` }))} />
          <AvatarGroup max={2} people={Array.from({ length: 40 }, (_, i) => ({ initials: `P${i}` }))} />
        </div>) },
      { id: "empty", label: "Empty group", node: <AvatarGroup people={[]} /> },
      { id: "overflow", label: "Overflow: long initials, many avatars, narrow frame", width: 260, node: (
        <div className="space-y-3">
          <Avatar initials="ABCDEF" />
          <AvatarGroup max={12} people={Array.from({ length: 12 }, (_, i) => ({ initials: `AB${i}` }))} />
        </div>) },
    ],
  },
  {
    id: "IconRing", title: "IconRing", width: 520,
    states: [
      { id: "tones", label: "Every tone", node: (
        <div className="flex items-center gap-3">
          {(["ink", "ok", "attention", "blocked", "info"] as const).map((t) => (
            <IconRing key={t} tone={t}><IconSparkle size={16} /></IconRing>
          ))}
        </div>) },
      { id: "sizes", label: "Sizes", node: (
        <div className="flex items-center gap-3">
          <IconRing size={22}><IconDoc size={12} /></IconRing>
          <IconRing><IconDoc size={16} /></IconRing>
          <IconRing size={48}><IconDoc size={24} /></IconRing>
        </div>) },
      { id: "overflow", label: "Overflow: glyph larger than the ring", node: (
        <IconRing size={24}><IconSearch size={40} /></IconRing>) },
    ],
  },
  {
    id: "Swatch", title: "Swatch", width: 560,
    states: [
      { id: "default", label: "Static swatches", node: (
        <div className="flex flex-wrap gap-2">
          <Swatch color="#10263B" label="Biscay" /><Swatch color="#B23A1E" label="Espelette" />
          <Swatch color="#2C6E49" label="Moss" /><Swatch color="#A05E1C" label="Clay" />
        </div>) },
      { id: "selected", label: "Pickable: unselected vs selected (all four sides)", node: (
        <div className="flex flex-wrap gap-2">
          <Swatch color="#10263B" label="#10263B" onClick={() => {}} />
          <Swatch color="#B23A1E" label="#B23A1E" onClick={() => {}} selected />
        </div>) },
      { id: "nolabel", label: "No label", node: (
        <div className="flex gap-2"><Swatch color="#10263B" /><Swatch color="#2C6E49" /></div>) },
      { id: "overflow", label: "Overflow: long label, unknown color token, narrow frame", width: 260, node: (
        <div className="flex flex-wrap gap-2">
          <Swatch color="var(--not-a-real-token)" label={LONG} />
          <Swatch color="#2C6E49" label={HUGE} />
        </div>) },
    ],
  },
  {
    id: "CodeBlock", title: "CodeBlock", width: 640,
    states: [
      { id: "default", label: "Language header + copy", node: (
        <CodeBlock language="bash" code={"mari sync --source github --since 2026-07-01\nmari verify --all"} />) },
      { id: "title", label: "Custom title", node: (
        <CodeBlock title="curl" code={"curl -H 'Authorization: Bearer …' https://api.example.com/v1/docs"} />) },
      { id: "nocopy", label: "No header at all", node: (
        <CodeBlock copy={false} code={"{\n  \"region\": \"us-west-2\"\n}"} />) },
      { id: "wrap", label: "Soft wrap", node: <CodeBlock wrap language="text" code={HUGE} /> },
      { id: "empty", label: "Empty code", node: <CodeBlock language="json" code="" /> },
      { id: "overflow", label: "Overflow: unbreakable lines, narrow frame (scrolls inside)", width: 320, node: (
        <CodeBlock language="text" code={`${HUGE}\n${HUGE}`} />) },
    ],
  },
  {
    id: "Spinner", title: "Spinner", width: 420,
    states: [
      { id: "sizes", label: "Both sizes", node: (
        <div className="flex items-center gap-4"><Spinner size="sm" /><Spinner size="md" /></div>) },
      { id: "inline", label: "Inline in a disabled button and in text", node: (
        <div className="flex items-center gap-4">
          <Button disabled><Spinner size="sm" /> Testing…</Button>
          <span className="inline-flex items-center gap-2 text-[13px] text-ink/70"><Spinner size="sm" /> Loading results</span>
        </div>) },
    ],
  },
  {
    id: "EmptyState", title: "EmptyState", width: 640,
    states: [
      { id: "default", label: "Message only", node: <EmptyState>No documents yet.</EmptyState> },
      { id: "full", label: "Icon + title + action", node: (
        <EmptyState icon={<IconSearch size={26} />} title="No matches" action={<Button variant="primary" compact>Clear filters</Button>}>
          Nothing matches those filters. Try a broader query.
        </EmptyState>) },
      { id: "overflow", label: "Overflow: long title, unbreakable body, narrow frame", width: 320, node: (
        <EmptyState icon={<IconSearch size={26} />} title={LONG}>{HUGE}</EmptyState>) },
    ],
  },
  {
    id: "Badge", title: "Badge", width: 640,
    states: [
      { id: "tones", label: "Every tone plus the legacy aliases", node: (
        <div className="flex flex-wrap gap-2">
          {["ok", "attention", "blocked", "info", "neutral"].map((t) => <Badge key={t} label={t} tone={t} />)}
          {["approved", "pending", "flagged", "primary", "muted", "not-a-tone"].map((t) => <Badge key={t} label={t} tone={t} />)}
        </div>) },
      { id: "in-card", label: "In a card header, beside chips", node: (
        <Card title="Pricing sheet" hint="Updated Jul 16, 2026" actions={<Badge label="v4" tone="info" />}>
          <div className="flex flex-wrap gap-2">
            <StatusChip status="verified" /><Chip label="Finance" tone="info" /><Badge label="Read only" />
          </div>
        </Card>) },
      { id: "overflow", label: "Overflow: long label, unbreakable string, narrow frame", width: 260, node: (
        <div className="flex flex-wrap gap-2"><Badge label={LONG} tone="info" /><Badge label={HUGE} /></div>) },
    ],
  },
];
