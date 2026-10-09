import { useState, type ReactNode } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor } from "./PageFrame";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Chip, StatusChip, SeverityChip, CountChip } from "../data-display/Chip";
import { Scrollable } from "../data-display/Scrollable";
import { Stat } from "../data-display/Stat";
import { Badge } from "../data-display/Badge";
import { Swatch } from "../data-display/Swatch";
import { Truncate } from "../data-display/Truncate";
import { Avatar } from "../data-display/Avatar";
import { Progress } from "../data-display/Progress";
import { Sparkline } from "../data-display/Sparkline";
import { Skeleton } from "../data-display/Skeleton";
import { SkeletonPage } from "../data-display/Skeletons";
import { Spinner } from "../data-display/Spinner";
import { EmptyState } from "../data-display/EmptyState";
import { Alert } from "../feedback/Alert";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { Select } from "../forms/Select";
import { Textarea } from "../forms/Textarea";
import { Switch } from "../forms/Switch";
import { Checkbox } from "../forms/Checkbox";
import { RadioGroup } from "../forms/RadioGroup";
import { Tabs } from "../navigation/Tabs";
import { GlobalIconsArt } from "../features/GlobalIconsArt";
import { AvatarGroup } from "../data-display/AvatarGroup";
import { Sparkles, BookOpen, ShieldCheck, Inbox } from "lucide-react";

/* Lookbook (pages/lookbook.md). A live design-system showcase — the one
   auth/onboarding-adjacent page that renders INSIDE the console frame. Each
   state is a section of the gallery (foundations, buttons, inputs & forms,
   data display, feedback, icons & art) plus an "all" overview. Every exhibit
   pairs a usage rule + import path with a live demo, built only from the
   catalog primitives it documents.

   The catalog exhibits are the page's subject, so their copy is part of the
   documentation rather than content. The two long-text sections are not: the
   strings they push through the primitives are sample content, and they
   arrive in `data.samples` like every other page's data. */

const STATES = [
  { id: "all", label: "All components" },
  { id: "foundations", label: "Foundations" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs & forms" },
  { id: "data-display", label: "Data display" },
  { id: "feedback", label: "Feedback" },
  { id: "icons", label: "Icons & art" },
  { id: "loading", label: "Loading" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** Which slice of the gallery is on screen. An app drives it from its own
    route; `all` shows every section. */
export type LookbookSection =
  | "all" | "foundations" | "buttons" | "inputs" | "data-display" | "feedback"
  | "icons" | "overflow" | "stress";

/** Sample strings the two long-text sections push through the primitives, to
    prove they truncate, wrap, and scroll rather than widening the page. */
export type LookbookSamples = {
  title: string;
  paragraph: string;
  name: string;
  docTitle: string;
  importPath: string;
  url: string;
  token: string;
  word: string;
  mixedScript: string;
  bigNumber: string;
  percent: string;
  tags: string[];
  initials: string[];
};

/** Everything the Lookbook renders that is not the catalog itself. */
export type LookbookData = {
  section: LookbookSection;
  samples: LookbookSamples;
};

function Exhibit({ title, rule, imp, children }: {
  title: string; rule: string; imp: string; children: ReactNode;
}) {
  return (
    <Card title={title}>
      <p className="text-[13px] leading-relaxed text-ink/65">{rule}</p>
      <code className="mt-2 mb-4 block font-term text-[11.5px] text-biscay-2">{imp}</code>
      {/* Demo row: every exhibit item may shrink, and any bare text inside a
          catalog primitive ellipsises rather than pushing the card open (§12).
          The exhibits deliberately feed pathological strings into primitives
          whose own labels do not truncate (Progress, Button, Alert). */}
      <div className="flex min-w-0 flex-wrap items-center gap-3 [&_*]:min-w-0 [&>span]:max-w-full [&>span]:truncate">{children}</div>
    </Card>
  );
}

/* ── Foundations ──────────────────────────────────────────────────────── */

const TOKENS: { name: string; color: string }[] = [
  { name: "paper", color: "#FFFFFF" },
  { name: "flysch", color: "#F0F2F5" },
  { name: "ink", color: "#10263B" },
  { name: "biscay", color: "#1C3F60" },
  { name: "biscay-2", color: "#1E6FA8" },
  { name: "moss", color: "#2C6E49" },
  { name: "clay", color: "#A05E1C" },
  { name: "espelette", color: "#B23A1E" },
];

function Foundations() {
  return (
    <>
      <Exhibit
        title="Color tokens"
        rule="Eight semantic tokens carry the whole console: paper/flysch surfaces, ink text, biscay brand, and moss/clay/espelette for ok/attention/blocked. Swapping these is the brand."
        imp='import { Swatch } from "../data-display/Swatch"'
      >
        {TOKENS.map((t) => <Swatch key={t.name} color={t.color} label={t.name} />)}
      </Exhibit>

      <Card title="Type scale">
        <p className="mb-4 text-[13px] leading-relaxed text-ink/65">
          Display for headings, a system sans for body, and JetBrains Mono (font-term) for chrome: labels, counts, code.
        </p>
        <div className="space-y-2">
          <p className="font-display text-[26px] font-bold tracking-[-0.01em] text-ink">Display · 26 / bold</p>
          <p className="font-display text-[19px] font-semibold text-ink">Heading · 19 / semibold</p>
          <p className="text-[14px] text-ink/80">Body · 14: the readable default for paragraphs and descriptions.</p>
          <p className="text-[12.5px] text-ink/70">Small · 12.5: hints, captions, secondary copy.</p>
          <p className="font-term text-[11px] uppercase tracking-[0.1em] text-ink/65">Term · 11 uppercase: labels &amp; chrome</p>
        </div>
      </Card>
    </>
  );
}

/* ── Buttons ──────────────────────────────────────────────────────────── */

function Buttons() {
  return (
    <Exhibit
      title="Buttons"
      rule="One primary action per view; default for secondary; link for inline navigation. Danger is reserved for destructive intent."
      imp='import { Button } from "../actions/Button"'
    >
      <Button variant="primary">Primary</Button>
      <Button variant="default">Default</Button>
      <Button variant="success">Success</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="link">Link</Button>
      <Button variant="primary" compact>Compact</Button>
      <Button variant="default" disabled>Disabled</Button>
    </Exhibit>
  );
}

/* ── Inputs & forms ───────────────────────────────────────────────────── */

function FormsExhibit() {
  const [text, setText] = useState("Acme Product");
  const [sel, setSel] = useState("weekly");
  const [notes, setNotes] = useState("");
  const [sw, setSw] = useState(true);
  const [cb, setCb] = useState(false);
  const [radio, setRadio] = useState("markdown");
  return (
    <Card title="Inputs & controls">
      <p className="mb-4 text-[13px] leading-relaxed text-ink/65">
        Field wraps a labelled control; Input/Select/Textarea are the text primitives; Switch/Checkbox/RadioGroup carry boolean and single-choice state.
      </p>
      <code className="mb-4 block font-term text-[11.5px] text-biscay-2">import {"{ Field, Input, Select, Textarea, Switch, Checkbox, RadioGroup }"} from "../forms/*"</code>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Workspace name">
          <Input className="w-full" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label="Digest frequency">
          <Select className="w-full" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="off">Off</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <Textarea className="w-full" rows={3} placeholder="Shown on published pages…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-ink/10 pt-4">
        <Switch checked={sw} onCheckedChange={setSw} label="Auto-sync sources" />
        <Checkbox checked={cb} onCheckedChange={setCb} label="Email me a summary" />
        <div>
          <RadioGroup ariaLabel="Export format" value={radio} onValueChange={setRadio} options={[
            { value: "markdown", label: "Markdown", hint: "Portable .md files" },
            { value: "pdf", label: "PDF" },
          ]} />
        </div>
      </div>
    </Card>
  );
}

/* ── Data display ─────────────────────────────────────────────────────── */

function DataDisplay() {
  const [tab, setTab] = useState<"docs" | "facts">("docs");
  return (
    <>
      <Exhibit
        title="Chips & pills"
        rule="StatusChip carries lifecycle state; SeverityChip carries risk; tone Chips label neutral facets; CountChip shows a tally."
        imp='import { Chip, StatusChip, SeverityChip, CountChip } from "../data-display/Chip"'
      >
        <StatusChip status="verified" />
        <StatusChip status="canonical" />
        <StatusChip status="stale" />
        <StatusChip status="draft" />
        <SeverityChip severity="high" />
        <SeverityChip severity="med" />
        <SeverityChip severity="low" />
        <Chip label="info" tone="info" dot />
        <Chip label="ok" tone="ok" dot />
        <CountChip count={42} />
        <Badge label="badge" tone="info" />
      </Exhibit>

      <Exhibit
        title="Stats"
        rule="A KPI tile: big value, quiet label, optional tone, icon ring, and delta. Use tone to signal health, not decoration."
        imp='import { Stat } from "../data-display/Stat"'
      >
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <Stat value="1,204" label="Documents" sub="+38 this week" tone="ok" icon={<BookOpen size={18} />} />
          <Stat value="97%" label="Facts passing" sub="3 need review" tone="attention" icon={<ShieldCheck size={18} />} />
          <Stat value="12" label="Insights" sub="live" tone="info" icon={<Sparkles size={18} />} />
        </div>
      </Exhibit>

      <Exhibit
        title="Progress, sparklines & avatars"
        rule="Progress shows determinate work; Sparkline trends a series in-line; Avatar renders flat monogram identity."
        imp='import { Progress, Sparkline, Avatar } from "../data-display/*"'
      >
        <div className="w-full space-y-3">
          <Progress value={68} label="Embedding · 68%" tone="info" />
          <div className="flex items-center gap-4">
            <Sparkline values={[3, 6, 4, 8, 7, 11, 9, 14]} tone="ok" />
            <span className="flex items-center gap-1.5">
              <Avatar initials="MC" /><Avatar initials="DH" /><Avatar initials="AK" />
            </span>
          </div>
        </div>
      </Exhibit>

      <Card title="Tabs">
        <p className="mb-3 text-[13px] leading-relaxed text-ink/65">Segmented navigation for switching a single region’s content.</p>
        <Tabs ariaLabel="Sample" value={tab} onChange={setTab} options={[
          { id: "docs", label: "Documents" },
          { id: "facts", label: "Facts" },
        ]} />
        <p className="mt-3 text-[13px] text-ink/70">Showing the <b>{tab}</b> view.</p>
      </Card>
    </>
  );
}

/* ── Feedback ─────────────────────────────────────────────────────────── */

function Feedback() {
  return (
    <>
      <Exhibit
        title="Alerts"
        rule="Inline, dismissible feedback. Tone maps to intent: info, ok, attention, blocked, neutral: never stack more than one per region."
        imp='import { Alert } from "../feedback/Alert"'
      >
        <div className="w-full space-y-3">
          <Alert tone="info" title="Sync scheduled">Confluence · Ops will sync in 5 minutes.</Alert>
          <Alert tone="ok" title="Fact-check passed">All 12 claims in pricing.md verified.</Alert>
          <Alert tone="attention" title="Token expiring">Rotate the GitHub token within 7 days.</Alert>
          <Alert tone="blocked" title="Sync failed">GET /rest/api/content returned 401: token expired.</Alert>
        </div>
      </Exhibit>

      <Exhibit
        title="Spinners & skeletons"
        rule="Spinner for indeterminate waits with a label; Skeleton to reserve layout while content streams in."
        imp='import { Spinner, Skeleton } from "../data-display/*"'
      >
        <Spinner size="sm" />
        <Spinner size="md" label="Loading" />
        <div className="w-full max-w-xs space-y-2">
          <Skeleton height={12} width="70%" />
          <Skeleton height={12} width="90%" />
          <Skeleton height={12} width="55%" />
        </div>
      </Exhibit>

      <Card title="Empty state">
        <p className="mb-4 text-[13px] leading-relaxed text-ink/65">The blank-slate prompt: an icon, a title, guidance, and a single next action.</p>
        <EmptyState icon={<Inbox size={26} />} title="Nothing here yet" action={<Button compact>Connect a source</Button>}>
          Connect a source to start building your knowledge base.
        </EmptyState>
      </Card>
    </>
  );
}

/* ── Icons & art ──────────────────────────────────────────────────────── */

/* GlobalIconsArt renders its own heading and blurb, so wrapping it in a titled
   Card printed the same title twice. The Card stays for the surface, the title
   does not. */
function IconsArt() {
  return (
    <Card>
      <GlobalIconsArt />
    </Card>
  );
}

/* ── Overflow / stress stress-test sections ───────────────────────────── */

/* `overflow` — the gallery stuffed with very long NATURAL text: long titles,
   paragraphs, names, and huge stat values. Catches wrapping, truncation,
   line-clamp, and vertical-overflow failures. */
function OverflowSection({ s }: { s: LookbookSamples }) {
  return (
    <>
      <Exhibit title={s.title} rule={s.paragraph} imp={s.importPath}>
        <Button variant="primary">{s.title}</Button>
        <Chip label={s.docTitle} tone="neutral" />
        <Badge label={s.name} tone="info" />
        <StatusChip status="canonical" />
      </Exhibit>

      <Card title={s.title}>
        <p className="text-[13px] leading-relaxed text-ink/65">{s.paragraph}</p>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <Stat value={s.bigNumber} label={s.title} sub={s.paragraph} tone="ok" icon={<BookOpen size={18} />} />
          <Stat value={s.percent} label="Facts passing across every service, region, and team" sub="3 need review" tone="attention" icon={<ShieldCheck size={18} />} />
          <Stat value={s.bigNumber} label={s.name} sub="live" tone="info" icon={<Sparkles size={18} />} />
        </div>
        <div className="mt-4 space-y-3">
          {/* Progress renders `label` as a bare span with no ellipsis of its
              own, so the truncation is applied from the caller (§12). */}
          <div className="[&_span]:truncate">
            <Progress value={68} label={`Embedding · ${s.title}`} tone="info" />
          </div>
          <Alert tone="attention" title={<Truncate>{s.title}</Truncate>}>
            <Truncate lines={3}>{s.paragraph}</Truncate>
          </Alert>
        </div>
      </Card>
    </>
  );
}

/* `stress` — PATHOLOGICAL content: unbreakable tokens/URLs, a single long word,
   huge numbers, a 20+ chip row that will not wrap, a long avatar stack, and
   mixed scripts + emoji. Catches horizontal overflow, missing
   min-w-0 / break-words / truncate, and flex blowouts. */
function StressSection({ s }: { s: LookbookSamples }) {
  return (
    <>
      <Exhibit
        title="Chip-row overflow: 20+ tags, no wrap"
        rule="A single non-wrapping row of every tag: it must scroll inside its own container, never push the page body sideways."
        imp={s.url}
      >
        <Scrollable className="w-full pb-1" scrollerClassName="flex gap-1.5">
          {s.tags.map((t) => <Chip key={t} label={t} tone="neutral" className="shrink-0" />)}
        </Scrollable>
        <CountChip count={s.tags.length} />
      </Exhibit>

      <Card title="Unbreakable tokens, mixed scripts & huge numbers">
        <code className="mt-1 block break-all font-term text-[11.5px] text-biscay-2">{s.token}</code>
        <p className="mt-3 break-words text-[13px] text-ink/70">{s.mixedScript}</p>
        <p className="mt-2 break-words text-[13px] text-ink/70">{s.word}</p>
        <div className="mt-4">
          <AvatarGroup people={s.initials.map((i) => ({ initials: i }))} max={s.initials.length} />
        </div>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <Stat value={s.bigNumber} label={s.word} tone="ok" icon={<BookOpen size={18} />} />
          <Stat value={s.percent} label={s.token} tone="info" icon={<Sparkles size={18} />} />
          <Stat value={s.bigNumber} label={s.mixedScript} tone="attention" icon={<ShieldCheck size={18} />} />
        </div>
        <div className="mt-4 [&_span]:truncate"><Progress value={99} label={s.token} tone="info" /></div>
        <div className="mt-4">
          <Alert tone="blocked" title={<Truncate>{s.token}</Truncate>}>
            <Truncate>{s.url}</Truncate>
          </Alert>
        </div>
      </Card>
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

/* Sections with too few exhibits to flow: one card cannot fill two columns, and
   two cards in two columns are a row again — which is exactly the shape that
   left 600px under the shorter of the two long-text exhibits. They run one
   full-width column instead. */
const SINGLE_COLUMN = new Set(["buttons", "inputs", "icons", "overflow", "stress"]);

function Sections({ data }: { data: LookbookData | null }) {
  switch (data?.section) {
    case "foundations": return <Foundations />;
    case "buttons": return <Buttons />;
    case "inputs": return <FormsExhibit />;
    case "data-display": return <DataDisplay />;
    case "feedback": return <Feedback />;
    case "icons": return <IconsArt />;
    /* Reachable only when there IS data: the section came out of it. */
    case "overflow": return <OverflowSection s={data.samples} />;
    case "stress": return <StressSection s={data.samples} />;
    default:
      return (
        <>
          <Foundations />
          <Buttons />
          <FormsExhibit />
          <DataDisplay />
          <Feedback />
          <IconsArt />
        </>
      );
  }
}

function LookbookPage({ data, loading = false, chrome, mobile = false }: PageProps<LookbookData | null>) {
  /* This is the one page whose content is its own subject, so it is also the
     one page a host can render with nothing to give it: the exhibits document
     the catalog, and `data` only carries the sample strings the two long-text
     sections push through it. The console has no source for those — they are
     pathological truncation fixtures, not content — so it passes nothing, and
     dereferencing `data.section` was a crash on the one page nobody could
     then open. No data means the whole catalog and neither long-text section,
     which is the honest reading of having been handed no samples. */
  const section = data?.section ?? "all";
  if (loading) {
    return (
      <PageFrame chrome={chrome} active={navFor("lookbook")} title="Lookbook" mobile={mobile}>
        <SkeletonPage
          variant="gallery"
          eyebrow="Design system"
          title="Design lookbook"
          description="Every canonical primitive, exhibited live with its usage rule and import path. This page is built only from the components it documents."
          actions={0}
          mobile={mobile}
        />
      </PageFrame>
    );
  }
  return (
    <PageFrame chrome={chrome} active={navFor("lookbook")} title="Lookbook" mobile={mobile}>
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <PageHeader
          eyebrow="Design system"
          title="Design lookbook"
          description="Every canonical primitive, exhibited live with its usage rule and import path. This page is built only from the components it documents."
        />
        {/* One gallery, two columns, and the exhibits FLOW between them.

            It was a two-column grid, and the exhibits it lays out differ in
            height by more than an order of magnitude: "Empty state" is 220px,
            "Icons, marks & notebook art" beside it is over 2,000px, and a grid
            row is as tall as its tallest cell. That left about 1,800px of blank
            left column on the "all" view, with smaller holes in the buttons,
            chips and progress rows. CSS columns pack each exhibit under the one
            above it and balance the two columns instead, so there is no row to
            leave a hole in — every card still shares its column's left and
            right edge (§11) and never breaks across a column. Single-exhibit
            sections and mobile stay one full-width column. */}
        <div
          className={mobile || SINGLE_COLUMN.has(section)
            ? "mt-6 flex flex-col gap-5"
            : "mt-6 columns-2 gap-5 [&>*]:mb-5 [&>*]:break-inside-avoid-column"}
        >
          <Sections data={data} />
        </div>
      </div>
    </PageFrame>
  );
}

export const page: PageModule<LookbookData> = {
  id: "lookbook",
  title: "Lookbook",
  route: "/lookbook",
  component: LookbookPage,
  states: STATES.map((s) => ({ ...s })),
};
