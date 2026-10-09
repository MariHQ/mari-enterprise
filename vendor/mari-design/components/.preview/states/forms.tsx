import { useState } from "react";
import type { ComponentSpec } from "./types";
import {
  Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, TagInput,
  TagPicker, Field, FormField, SectionLabel, FieldError, ErrorMessage,
  Button, Chip, REGION_OPTIONS, REGIONS, regionLabel,
  type ComboboxOption,
} from "../../index";

/* State matrix for the forms group. Author EVERY state worth reviewing:
   resting, filled, focused, disabled, invalid-with-error, and the overflow
   cases (very long option labels, unbreakable strings, too many options, a
   frame too narrow).

   Region and server names come from tokens/regions.ts (CONVENTIONS.md §5), and
   every member/owner picker is a searchable Combobox (§7), never a Select. */

const LONG = "Quarterly revenue recognition policy for multi-year enterprise agreements with usage-based true-ups";
const HUGE = "SupercalifragilisticexpialidociousconfigurationparametervaluethatwillneverwrapAAAAAAAAAAAAA";

/* Members are people, so this list feeds a SEARCHABLE combobox. */
const MEMBERS: ComboboxOption[] = [
  { value: "dana", label: "Dana Reyes (Owner)" },
  { value: "alex", label: "Alex Rivera (Editor)" },
  { value: "mia", label: "Mia Chen (Editor)" },
  { value: "dev", label: "Dev Park (Viewer)" },
  { value: "aleks", label: "Aleksandra Konstantinopoulou-Whitfield (Viewer)" },
];
const MEMBERS_MANY: ComboboxOption[] = Array.from({ length: 60 }, (_, i) => ({
  value: `m${i}`, label: `Member ${String(i + 1).padStart(2, "0")} (Viewer)`,
}));

const ROLES = ["Owner", "Editor", "Viewer"];

function InputRow({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function ComboDemo({
  options = REGION_OPTIONS, start = null as string | null, search = true, label = "Region",
}: { options?: ComboboxOption[]; start?: string | null; search?: boolean; label?: string }) {
  const [value, setValue] = useState<string | null>(start);
  return (
    <FormField label={label}>
      <Combobox ariaLabel={label} options={options} value={value} onChange={setValue} search={search} placeholder="Select…" searchPlaceholder="Search…" />
    </FormField>
  );
}

function TagInputDemo({ start = [] as string[] }) {
  const [tags, setTags] = useState(start);
  return <TagInput value={tags} onChange={setTags} />;
}
function TagPickerDemo({ start = ["Canonical"], compact = false, loading = false }) {
  const [tags, setTags] = useState(start);
  return <TagPicker tags={tags} onChange={setTags} compact={compact} loading={loading} onManage={() => {}} />;
}
function CheckDemo({ start = false, indeterminate = false, ...rest }: { start?: boolean; indeterminate?: boolean; label?: React.ReactNode; disabled?: boolean }) {
  const [on, setOn] = useState<boolean | "indeterminate">(indeterminate ? "indeterminate" : start);
  return <Checkbox checked={on} onCheckedChange={setOn} {...rest} />;
}
function SwitchDemo({ start = false, ...rest }: { start?: boolean; label?: React.ReactNode; disabled?: boolean }) {
  const [on, setOn] = useState(start);
  return <Switch checked={on} onCheckedChange={setOn} {...rest} />;
}
function RadioDemo({ options, start, disabled = false }: { options: { value: string; label: string; hint?: string }[]; start: string; disabled?: boolean }) {
  const [value, setValue] = useState(start);
  return <RadioGroup ariaLabel="Demo radio group" options={options} value={value} onValueChange={setValue} disabled={disabled} />;
}

export const FORMS: ComponentSpec[] = [
  {
    id: "Input", title: "Input", width: 560,
    states: [
      { id: "resting", label: "Resting (placeholder)", node: <Input placeholder="Search knowledge, people, facts…" className="w-full" /> },
      { id: "filled", label: "Filled", node: <Input defaultValue="pricing policy" className="w-full" /> },
      { id: "focused", label: "Focused (autofocus draws the ring)", node: <Input autoFocus defaultValue="pricing policy" className="w-full" /> },
      { id: "disabled", label: "Disabled (must stay legible)", node: (
        <InputRow>
          <Input defaultValue="Read only value" disabled className="w-full" />
          <Input placeholder="Disabled placeholder" disabled className="w-full" />
        </InputRow>) },
      { id: "invalid", label: "Invalid, with the inline field error", node: (
        <div>
          <Input defaultValue="not-an-email" aria-invalid className="w-full" />
          <FieldError id="field.invalidEmail" />
        </div>) },
      { id: "types", label: "Type variants (date, number, password)", node: (
        <InputRow>
          <Input type="date" defaultValue="2026-07-16" className="w-full" />
          <Input type="number" defaultValue={42} className="w-full" />
          <Input type="password" defaultValue="hunter2hunter2" className="w-full" />
        </InputRow>) },
      { id: "overflow", label: "Overflow: unbreakable value, narrow frame", width: 260, node: (
        <InputRow>
          <Input defaultValue={HUGE} className="w-full" />
          <Input placeholder={LONG} className="w-full" />
        </InputRow>) },
    ],
  },
  {
    id: "Textarea", title: "Textarea", width: 560,
    states: [
      { id: "resting", label: "Resting", node: <Textarea placeholder="What it means, in one sentence." /> },
      { id: "short", label: "Short variant, filled", node: <Textarea short defaultValue={LONG} /> },
      { id: "focused", label: "Focused", node: <Textarea autoFocus short defaultValue="Draft note" /> },
      { id: "disabled", label: "Disabled (must stay legible)", node: <Textarea short disabled defaultValue="Locked by policy." /> },
      { id: "invalid", label: "Invalid, with the inline field error", node: (
        <div><Textarea short aria-invalid defaultValue="" /><FieldError id="field.required" /></div>) },
      { id: "overflow", label: "Overflow: unbreakable content, narrow frame", width: 300, node: (
        <Textarea short defaultValue={`${HUGE}\n${HUGE}`} />) },
    ],
  },
  {
    id: "Select", title: "Select", width: 560,
    states: [
      { id: "resting", label: "Resting, sentence-case options", node: (
        <Select className="w-full" defaultValue="">
          <option value="">All statuses</option>
          <option value="verified">Verified</option>
          <option value="draft">Draft</option>
          <option value="retired">Retired</option>
        </Select>) },
      { id: "filled", label: "A value selected", node: (
        <Select className="w-full" defaultValue="verified">
          <option value="">All statuses</option><option value="verified">Verified</option>
        </Select>) },
      { id: "regions", label: "Regions from tokens/regions.ts (one canonical spelling)", node: (
        <Select className="w-full" defaultValue="us-west-2">
          {REGION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>) },
      { id: "disabled", label: "Disabled (must stay legible)", node: (
        <Select className="w-full" disabled defaultValue="verified"><option value="verified">Verified</option></Select>) },
      { id: "invalid", label: "Invalid, with the inline field error", node: (
        <div><Select className="w-full" aria-invalid defaultValue=""><option value="">All statuses</option></Select><FieldError id="field.required" /></div>) },
      { id: "overflow", label: "Overflow: very long option label, narrow frame", width: 260, node: (
        <Select className="w-full" defaultValue="long"><option value="long">{LONG}</option></Select>) },
    ],
  },
  {
    id: "Combobox", title: "Combobox", width: 560,
    states: [
      { id: "resting", label: "Resting", node: <ComboDemo /> },
      { id: "filled", label: "A region selected (canonical spelling)", node: <ComboDemo start="us-west-2" /> },
      { id: "member", label: "Member / owner picker: always searchable (§7)", node: (
        <ComboDemo label="Owner" options={MEMBERS} start="alex" />) },
      { id: "member-many", label: "Overflow: 60 members, the list scrolls", node: (
        <ComboDemo label="Assignee" options={MEMBERS_MANY} start="m12" />) },
      { id: "nosearch", label: "Search off (short lists only, never for people)", node: (
        <ComboDemo label="Role" options={ROLES.map((r) => ({ value: r.toLowerCase(), label: r }))} start="editor" search={false} />) },
      { id: "empty", label: "Empty: no options at all", node: <ComboDemo label="Source" options={[]} /> },
      { id: "invalid", label: "Invalid, with the inline field error", node: (
        <div>
          <SectionLabel>Owner</SectionLabel>
          <div className="mt-1.5"><Combobox ariaLabel="Owner" options={MEMBERS} value={null} onChange={() => {}} placeholder="Select an owner" /></div>
          <FieldError id="field.required" />
        </div>) },
      { id: "overflow", label: "Overflow: very long option label, narrow frame", width: 260, node: (
        <ComboDemo label="Document" options={[{ value: "a", label: LONG }, { value: "b", label: HUGE }]} start="a" />) },
    ],
  },
  {
    id: "Checkbox", title: "Checkbox", width: 520,
    states: [
      { id: "states", label: "Unchecked / checked / indeterminate", node: (
        <div className="flex flex-col gap-2.5">
          <CheckDemo label="Include archived documents" />
          <CheckDemo start label="Include archived documents" />
          <CheckDemo indeterminate label="Some rows selected" />
        </div>) },
      { id: "disabled", label: "Disabled, both states", node: (
        <div className="flex flex-col gap-2.5">
          <Checkbox checked={false} onCheckedChange={() => {}} disabled label="Locked off" />
          <Checkbox checked onCheckedChange={() => {}} disabled label="Locked on" />
        </div>) },
      { id: "nolabel", label: "Control only (row selection)", node: (
        <div className="flex items-center gap-3">
          <Checkbox checked={false} onCheckedChange={() => {}} aria-label="Select row" />
          <Checkbox checked onCheckedChange={() => {}} aria-label="Select row" />
        </div>) },
      { id: "overflow", label: "Overflow: long label, narrow frame", width: 260, node: <CheckDemo start label={LONG} /> },
    ],
  },
  {
    id: "RadioGroup", title: "RadioGroup", width: 560,
    states: [
      { id: "default", label: "Default, second option selected", node: (
        <RadioDemo start="weekly" options={[
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "never", label: "Never" },
        ]} />) },
      { id: "hints", label: "With hint text", node: (
        <RadioDemo start="scoped" options={[
          { value: "all", label: "Everything", hint: "Sync every repository in the org." },
          { value: "scoped", label: "Selected repositories", hint: "Choose which repositories to sync." },
        ]} />) },
      { id: "disabled", label: "Disabled group (must stay legible)", node: (
        <RadioDemo disabled start="weekly" options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />) },
      { id: "invalid", label: "Invalid, with the inline field error", node: (
        <div>
          <RadioDemo start="" options={[{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }]} />
          <FieldError id="field.required" />
        </div>) },
      { id: "overflow", label: "Overflow: long option label + hint, narrow frame", width: 300, node: (
        <RadioDemo start="a" options={[{ value: "a", label: LONG, hint: LONG }, { value: "b", label: HUGE }]} />) },
    ],
  },
  {
    id: "Switch", title: "Switch", width: 520,
    states: [
      { id: "states", label: "Off / on", node: (
        <div className="flex flex-col gap-2.5">
          <SwitchDemo label="Notify on contradictions" />
          <SwitchDemo start label="Notify on contradictions" />
        </div>) },
      { id: "disabled", label: "Disabled, both states", node: (
        <div className="flex flex-col gap-2.5">
          <Switch checked={false} onCheckedChange={() => {}} disabled label="Locked off" />
          <Switch checked onCheckedChange={() => {}} disabled label="Locked on" />
        </div>) },
      { id: "nolabel", label: "Control only", node: (
        <div className="flex items-center gap-3">
          <Switch checked={false} onCheckedChange={() => {}} aria-label="Toggle" />
          <Switch checked onCheckedChange={() => {}} aria-label="Toggle" />
        </div>) },
      { id: "overflow", label: "Overflow: long label, narrow frame", width: 260, node: <SwitchDemo start label={LONG} /> },
    ],
  },
  {
    id: "TagInput", title: "TagInput", width: 560,
    states: [
      { id: "empty", label: "Empty (placeholder showing)", node: <TagInputDemo /> },
      { id: "filled", label: "Filled", node: <TagInputDemo start={["pricing", "finance", "canonical"]} /> },
      { id: "many", label: "Overflow: 14 tags wrap onto several lines", node: (
        <TagInputDemo start={Array.from({ length: 14 }, (_, i) => `tag-${i + 1}`)} />) },
      { id: "overflow", label: "Overflow: long + unbreakable tags, narrow frame", width: 300, node: (
        <TagInputDemo start={[LONG.slice(0, 48), HUGE]} />) },
    ],
  },
  {
    id: "TagPicker", title: "TagPicker", width: 480,
    states: [
      { id: "default", label: "Trigger with tags applied", node: <TagPickerDemo /> },
      { id: "none", label: "Nothing applied", node: <TagPickerDemo start={[]} /> },
      { id: "compact", label: "Icon-only trigger", node: <TagPickerDemo compact /> },
      { id: "loading", label: "Loading vocabulary", node: <TagPickerDemo loading /> },
    ],
  },
  {
    id: "FormField", title: "FormField / Field / SectionLabel", width: 560,
    states: [
      { id: "default", label: "Label + control + hint", node: (
        <FormField label="Workspace name" hint="Shown to everyone in this workspace.">
          <Input defaultValue="Mari" className="w-full" />
        </FormField>) },
      { id: "invalid", label: "Invalid, with the inline field error", node: (
        <div>
          <FormField label="Contact email"><Input aria-invalid defaultValue="not-an-email" className="w-full" /></FormField>
          <FieldError id="field.invalidEmail" />
        </div>) },
      { id: "readonly", label: "Field: read-only key/value rows", node: (
        <div>
          <Field label="Owner">Alex Rivera</Field>
          <Field label="Region">{regionLabel("us-west-2")}</Field>
          <Field label="Status"><Chip label="Verified" tone="ok" dot /></Field>
        </div>) },
      { id: "section-label", label: "SectionLabel on its own", node: (
        <div className="space-y-3"><SectionLabel>Members</SectionLabel><SectionLabel>Endpoints</SectionLabel><SectionLabel>Owners</SectionLabel></div>) },
      { id: "overflow", label: "Overflow: long label, hint and value, narrow frame", width: 300, node: (
        <div>
          <FormField label={LONG.slice(0, 40)} hint={LONG}><Input defaultValue={HUGE} className="w-full" /></FormField>
          <Field label="Checksum">{HUGE}</Field>
        </div>) },
    ],
  },
  {
    id: "FormLayout", title: "Form layout (owner, priority, due date)", width: 720,
    states: [
      { id: "default", label: "Owner, priority, due date on one line, in that order (§7)", node: (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[15rem] flex-1"><ComboDemo label="Owner" options={MEMBERS} start="alex" /></div>
          <div className="w-40">
            <FormField label="Priority">
              <Select className="w-full" defaultValue="high"><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></Select>
            </FormField>
          </div>
          <div className="w-44"><FormField label="Due date"><Input type="date" className="w-full" defaultValue="2026-08-01" /></FormField></div>
        </div>) },
      { id: "errors", label: "Error banner above an invalid form", node: (
        <div className="space-y-3">
          <ErrorMessage id="field.required" />
          <div className="max-w-[22rem]">
            <SectionLabel>Owner</SectionLabel>
            <div className="mt-1.5"><Combobox ariaLabel="Owner" options={MEMBERS} value={null} onChange={() => {}} placeholder="Select an owner" /></div>
            <FieldError id="field.required" />
          </div>
          {/* Primary action bottom LEFT, secondary to its right (section 2). */}
          <div className="flex items-center gap-2">
            <Button variant="primary">Save</Button>
            <Button>Cancel</Button>
          </div>
        </div>) },
      { id: "regions", label: "Every canonical region label, one spelling each", node: (
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => <Chip key={r.code} label={r.label} tone="info" />)}
        </div>) },
      { id: "narrow", label: "Overflow: the same row in a 320px frame", width: 320, node: (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1"><ComboDemo label="Owner" options={MEMBERS} start="aleks" /></div>
          <div className="w-32"><FormField label="Priority"><Select className="w-full" defaultValue="high"><option value="high">High</option></Select></FormField></div>
          <div className="w-40"><FormField label="Due date"><Input type="date" className="w-full" defaultValue="2026-08-01" /></FormField></div>
        </div>) },
    ],
  },
];
