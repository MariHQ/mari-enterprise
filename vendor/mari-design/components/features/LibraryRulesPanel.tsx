import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Select } from "../forms/Select";
import { Textarea } from "../forms/Textarea";
import { Checkbox } from "../forms/Checkbox";
import { SectionLabel } from "../forms/SectionLabel";
import { Chip, ChipList } from "../data-display/Chip";
import { Truncate } from "../data-display/Truncate";
import { PagerBar, ResultCount, usePaged } from "../data-display/Pagination";
import { Stat } from "../data-display/Stat";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonCard, SkeletonStat, SkeletonTable } from "../data-display/Skeleton";
import { type RuleRow, type RuleStatus, type RuleSeverity } from "../data-display/RulesPanel";
import { SortHeader, useSort, thPad, tdPad } from "../data-display/sortable";
import { Scrollable } from "../data-display/Scrollable";
import { WriteError } from "../feedback/WriteError";
import { useWrite } from "../actions/useWrite";
import { useResync } from "../actions/useResync";

/* LibraryRulesPanel — the Library › Rules tab.
   Configures the deterministic prose engine: rules across four families
   (AI slop, Clarity, Style guide, Inclusive), each set to Active / Zero
   tolerance / Ignore, plus a live client-side document checker that runs a
   subset of the rules as regexes over sample docs. Composes the library's
   RulesPanel registry with a project-config strip and a checker card, and
   renders standalone.

   WHAT THIS PANEL CANNOT DO, AND WHY IT SAYS SO. The registry below is
   compiled into this file as live RegExps: there is no rule row on a server,
   so a workspace cannot add a rule, edit one, or change its severity. That is
   a backend gap, not a design choice, and the panel now states it rather than
   drawing controls that would only look like they worked.

   What a workspace CAN change is which of the shipped rules apply to it — the
   style pack, grammar, and each rule's Active / Zero / Ignore status. Those
   are real settings, and they persist only when `actions.saveRuleConfig` is
   wired. Without a handler they are session-only, the Save button is not drawn
   at all, and a line says so — the button used to flash "Saved" over nothing
   (§2: no control that cannot do anything). */

type Rule = RuleRow & { re?: RegExp; suggestion?: string };

const RULES: Rule[] = [
  { id: "ai-slop.hedging", family: "AI slop", severity: "warn", description: "Hedging filler like “it's worth noting” adds no information.", pack: "slop-01", re: /\bit'?s worth noting\b/gi, suggestion: "Delete the hedge and state the point." },
  { id: "ai-slop.delve", family: "AI slop", severity: "warn", description: "“Delve into” is an AI tell; prefer a plain verb.", pack: "slop-04", re: /\bdelve into\b/gi, suggestion: "Use “look at” or “examine”." },
  { id: "ai-slop.seamless", family: "AI slop", severity: "advisory", description: "Marketing adjective with no measurable meaning.", pack: "slop-09", re: /\bseamless(ly)?\b/gi, suggestion: "Describe what actually happens." },
  { id: "ai-slop.leverage", family: "AI slop", severity: "advisory", description: "“Leverage” as a verb; prefer “use”.", pack: "slop-12", re: /\bleverage\b/gi, suggestion: "Use “use”." },
  { id: "clarity.passive", family: "Clarity", severity: "advisory", description: "Passive construction hides the actor.", pack: "clarity-02", re: /\b(is|are|was|were|be|been)\s+\w+ed\b/gi, suggestion: "Name who does the action." },
  { id: "clarity.long-sentence", family: "Clarity", severity: "warn", description: "Sentences over 24 words are hard to scan.", pack: "clarity-05", suggestion: "Split into two sentences." },
  { id: "clarity.very", family: "Clarity", severity: "advisory", description: "Intensifiers like “very” weaken the claim.", pack: "clarity-08", re: /\bvery\b/gi, suggestion: "Pick a stronger word." },
  { id: "clarity.in-order-to", family: "Clarity", severity: "advisory", description: "“In order to” is wordy.", pack: "clarity-11", re: /\bin order to\b/gi, suggestion: "Use “to”." },
  { id: "style.sentence-case", family: "Style guide", severity: "warn", description: "Headings should be sentence case, not Title Case.", pack: "style-03", re: /^#+\s+(?:[A-Z][a-z]+\s+){2,}[A-Z][a-z]+/gm, suggestion: "Lowercase all but the first word." },
  { id: "style.oxford", family: "Style guide", severity: "advisory", description: "Missing serial comma before “and”.", pack: "style-06", re: /\w+\s+\w+\s+and\s+\w+/gi, suggestion: "Add the serial comma." },
  { id: "style.login", family: "Style guide", severity: "warn", description: "Prefer “sign in” (verb) over “login”.", pack: "style-09", re: /\blogin\b/gi, suggestion: "Use “sign in”." },
  { id: "inclusive.guys", family: "Inclusive", severity: "error", description: "“You guys” excludes; use a neutral address.", pack: "incl-01", re: /\byou guys\b/gi, suggestion: "Use “everyone” or “you all”." },
  { id: "inclusive.whitelist", family: "Inclusive", severity: "error", description: "“Whitelist/blacklist” carry bias; prefer allow/deny.", pack: "incl-03", re: /\b(whitelist|blacklist)\b/gi, suggestion: "Use “allowlist” / “denylist”." },
  { id: "inclusive.sanity", family: "Inclusive", severity: "warn", description: "“Sanity check” is ableist; prefer a neutral term.", pack: "incl-06", re: /\bsanity check\b/gi, suggestion: "Use “quick check” or “confidence check”." },
];

const FAMILIES = ["AI slop", "Clarity", "Style guide", "Inclusive"] as const;
const FAMILY_HELP: Record<string, string> = {
  "AI slop": "Machine-writing tells and empty marketing words",
  Clarity: "Passive voice, long sentences, wordiness",
  "Style guide": "Casing, punctuation, and terminology",
  Inclusive: "Biased or exclusionary language",
};

const PACKS = [
  { id: "plain", label: "Plain language" },
  { id: "microsoft", label: "Microsoft" },
  { id: "google", label: "Google developer" },
  { id: "ap", label: "AP style" },
  { id: "chicago", label: "Chicago" },
];

/** A sample document the checker can run over. Supplied by the caller: the
    panel ships no documents of its own. */
/** How many prose rules this build of the checker ships.
    The registry is product logic (it holds live RegExps), so it stays in the
    component — but the Library tab strip has to badge a count, and asking the
    consuming app for a number only this module knows guaranteed a wrong one.
    It rendered 0 beside a panel listing every rule. */
export const RULE_COUNT = RULES.length;

/** How many shipped rules match a free-text query. The Library's cross-tab
    search needs a count for the Rules tab, and only this module can produce
    one: the registry is not data the page was handed. */
export function rulesMatching(query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return RULES.length;
  return RULES.filter((r) =>
    r.id.toLowerCase().includes(q)
    || r.family.toLowerCase().includes(q)
    || r.description.toLowerCase().includes(q)
    || (r.pack ?? "").toLowerCase().includes(q),
  ).length;
}

export type CheckerDoc = { id: string; label: string; source: string; text: string };

const SEV_WEIGHT: Record<RuleSeverity, number> = { error: 9, warn: 6, advisory: 3 };

type Finding = { ruleId: string; severity: RuleSeverity; start: number; end: number; excerpt: string; markStart: number; markEnd: number; suggestion?: string };

function runDetector(text: string, ignore: Set<string>, zero: Set<string>): Finding[] {
  const out: Finding[] = [];
  for (const rule of RULES) {
    if (ignore.has(rule.id)) continue;
    if (rule.id === "clarity.long-sentence") {
      let idx = 0;
      for (const s of text.split(/(?<=[.!?])\s+/)) {
        const words = s.trim().split(/\s+/).filter(Boolean).length;
        const start = text.indexOf(s, idx);
        idx = start + s.length;
        if (words > 24 && start >= 0) out.push(mk(rule, text, start, start + Math.min(s.length, 40)));
      }
      continue;
    }
    if (!rule.re) continue;
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text))) {
      out.push(mk(rule, text, m.index, m.index + m[0].length));
      if (m.index === rule.re.lastIndex) rule.re.lastIndex++;
    }
  }
  void zero;
  return out.sort((a, b) => a.start - b.start);
}

function mk(rule: Rule, text: string, start: number, end: number): Finding {
  const ctxStart = Math.max(0, start - 34);
  const ctxEnd = Math.min(text.length, end + 34);
  return {
    ruleId: rule.id,
    severity: rule.severity,
    start,
    end,
    excerpt: text.slice(ctxStart, ctxEnd).replace(/\n/g, " "),
    markStart: start - ctxStart,
    markEnd: end - ctxStart,
    suggestion: rule.suggestion,
  };
}

const SEV_TONE: Record<RuleSeverity, string> = { error: "blocked", warn: "attention", advisory: "neutral" };

/** The part of the rules tab a workspace really can curate: which shipped
    rules apply to it, and how strictly. Adding or editing a rule is not here
    because there is nothing on the server to write it to. */
export type LibraryRulesActions = {
  /** Persist the project's rule configuration. Omitted = session-only, and
      the panel says so instead of drawing a Save that saves nothing. */
  saveRuleConfig?: (config: {
    pack: string;
    grammar: boolean;
    /** Rule id → status, for every rule the workspace has moved off Active. */
    statuses: Record<string, RuleStatus>;
  }) => void | Promise<void>;
};

export type LibraryRulesPanelProps = {
  workspace: string;
  /** Documents the live checker can be pointed at. */
  docs: CheckerDoc[];
  /** Free-text filter from the Library's cross-tab search. Empty = show all. */
  query?: string;
  /** Side effects this panel offers. Omitted = session-only configuration. */
  actions?: LibraryRulesActions;
  loading?: boolean;
  className?: string;
};

export function LibraryRulesPanel({ workspace, docs, query = "", actions, loading = false, className = "" }: LibraryRulesPanelProps) {
  const [pack, setPack] = useState("plain");
  const [grammar, setGrammar] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  /* Saving the rule config goes through the one write hook: `busy` disables
     Save so a slow write cannot be double-submitted, and `failed` carries the
     server's own message (actions/useWrite.ts). */
  const write = useWrite();
  const [status, setStatus] = useState<Record<string, RuleStatus>>({});
  const [ignore, setIgnore] = useState<Set<string>>(new Set());
  const [zero, setZero] = useState<Set<string>>(new Set(["inclusive.guys", "inclusive.whitelist"]));

  const [docId, setDocId] = useState(docs.length ? docs[0].id : "");
  const doc = docs.find((d) => d.id === docId) ?? docs[0];
  const [text, setText] = useState(doc ? doc.text : "");
  const [checked, setChecked] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);

  /* The check-a-document box picked its document once, at mount. The panel
     mounts while `docs` is still loading, so `docId` and `text` were pinned to
     "" for the life of the page and the checker had nothing to run against
     (C1). Keyed on the ids rather than the array: `LibraryPage` re-derives the
     collections inline on every render, so identity churns as soon as the
     reader types in the library search box. `text` is an editable textarea, so
     this only reseeds while it is untouched — once a check has run or the
     reader has edited the sample, the panel keeps what is on screen. */
  useResync(docs, (d) => {
    const first = d[0];
    setDocId(first ? first.id : "");
    setText(first ? first.text : "");
  }, { hold: docId !== "" || checked || dirty, key: docs.map((d) => d.id).join() });

  const onStatusChange = (id: string, s: RuleStatus) => {
    setStatus((prev) => ({ ...prev, [id]: s }));
    setIgnore((prev) => { const n = new Set(prev); s === "ignored" ? n.add(id) : n.delete(id); return n; });
    setZero((prev) => { const n = new Set(prev); s === "zero" ? n.add(id) : n.delete(id); return n; });
    setDirty(true);
  };

  const rulesForRegistry: RuleRow[] = RULES.map((r) => ({
    id: r.id, family: r.family, severity: r.severity, description: r.description, pack: r.pack,
    status: status[r.id] ?? (zero.has(r.id) ? "zero" : ignore.has(r.id) ? "ignored" : "active"),
  }));

  const familyCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of RULES) c[r.family] = (c[r.family] ?? 0) + 1;
    return c;
  }, []);

  const selectDoc = (id: string) => { const d = docs.find((x) => x.id === id) ?? docs[0]; setDocId(id); setText(d ? d.text : ""); setChecked(false); setFindings([]); };
  const check = () => { setFindings(runDetector(text, ignore, zero)); setChecked(true); };

  /* Only ever called where `saveRuleConfig` exists — the button is not drawn
     otherwise, so "Saved" is never shown over a write that did not happen. */
  const save = () => write.run(
    actions?.saveRuleConfig && (() => actions.saveRuleConfig!({ pack, grammar, statuses: status })),
    () => {
      setDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    },
  );

  const score = Math.min(100, findings.reduce((s, f) => s + SEV_WEIGHT[f.severity], 0));
  const band = score < 12 ? "clean" : score < 30 ? "light" : score < 60 ? "moderate" : "heavy";
  const bandTone = score < 12 ? "text-moss" : score < 30 ? "text-clay" : "text-espelette" ;

  const ruleName = (id: string) => RULES.find((r) => r.id === id)?.id ?? id;

  if (loading) {
    return (
      <div className={`flex flex-col gap-4 ${className}`.trim()} aria-hidden="true">
        <SkeletonCard lines={1} />
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
        </div>
        <SkeletonTable rows={6} cols={4} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`.trim()}>
      {/* Project config strip */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[10rem]">
            <SectionLabel>Project</SectionLabel>
            <div className="mt-1 truncate text-[14px] font-semibold text-ink">{workspace}</div>
          </div>
          <div>
            <SectionLabel>Style pack</SectionLabel>
            <Select className="mt-1 block" value={pack} onChange={(e) => { setPack(e.target.value); setDirty(true); }}>
              {PACKS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </div>
          {/* Its own labelled column, on the same baseline as Style pack, so
              toggling it no longer nudges the row around. */}
          <div>
            <SectionLabel>Grammar</SectionLabel>
            <div className="mt-1 flex h-9 items-center">
              <Checkbox checked={grammar} onCheckedChange={(v) => { setGrammar(v); setDirty(true); }} label="Check grammar" />
            </div>
          </div>
          {/* Primary bottom left of its group; "Saved" keeps a reserved slot.
              With no handler there is nothing to press: the panel states the
              scope of the settings instead of offering a Save that lies. */}
          <div className="ml-auto flex items-center gap-3">
            {actions?.saveRuleConfig ? (
              <>
                <Button variant="primary" compact disabled={!dirty || write.busy} onClick={() => void save()}>Save</Button>
                <span className="w-[3.5rem] font-term text-[11.5px] text-moss">{saved ? "Saved" : ""}</span>
              </>
            ) : (
              <span className="font-term text-[11.5px] text-ink/65">
                Applies to checks in this session only.
              </span>
            )}
          </div>
        </div>
        {/* A refused save has no single input to accuse: it is the banner (§8),
            not a caption under a field that did nothing wrong. */}
        {write.failed && (
          <div className="mt-2"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>
        )}
      </Card>

      {/* Family grid */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
        {FAMILIES.map((f) => (
          <Stat key={f} value={familyCounts[f] ?? 0} label={f} sub={FAMILY_HELP[f]} tone="info" />
        ))}
      </div>

      {/* Rule registry — a local table so the columns keep one plumb line.
          The hint used to read "170+ rules" beside a table of 14: a catalog
          size this build has no evidence for. It counts what it ships. */}
      <RuleTable
        rules={rulesForRegistry}
        query={query}
        onStatusChange={onStatusChange}
        hint={`${RULES.length} rules in this build · every finding has an ID and span`}
        editable={Boolean(actions?.saveRuleConfig)}
      />

      {/* Document checker */}
      <Card variant="flush" eyebrow="Document check" title="Live document checker">
        <div className="px-4 pb-4 border-t border-ink/10 pt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <SectionLabel>Document</SectionLabel>
              <Select className="mt-1 block" value={docId} onChange={(e) => selectDoc(e.target.value)}>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </div>
            <div className="font-term text-[11px] text-ink/65 pb-2">{doc.source}</div>
            <Button variant="primary" compact className="ml-auto" onClick={check}>Run deterministic check</Button>
          </div>

          <Textarea className="font-term text-[12.5px]" rows={7} value={text} onChange={(e) => { setText(e.target.value); setChecked(false); }} />

          {checked && (
            <div aria-live="polite" className="flex flex-col gap-2.5">
              <div className="flex items-baseline gap-3">
                <span className={`text-[26px] font-bold leading-none ${bandTone}`}>{score}</span>
                <span className="text-[12.5px] text-ink/65">slop score · <span className="capitalize">{band}</span> · {findings.length} finding{findings.length === 1 ? "" : "s"}</span>
              </div>

              {findings.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={22} />} title="No configured rules fired">
                  This content passes the current project configuration.
                </EmptyState>
              ) : (
                <div className="overflow-hidden rounded-[5px] border border-ink/12">
                <ResultCount from={1} to={findings.length} total={findings.length} noun="findings" />
                {/* A slop-heavy document produces hundreds of findings: they
                    scroll in a bounded box, never a mile of card (§20). */}
                <Scrollable axis="y" className="max-h-[320px]" scrollerClassName="flex flex-col gap-2 p-2">
                  {findings.map((f, i) => (
                    <div key={i} className="rounded-[4px] border border-ink/12 px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Chip label={f.severity} tone={SEV_TONE[f.severity]} caps />
                        <code className="font-term text-[11.5px] text-ink/70">{ruleName(f.ruleId)}</code>
                        {zero.has(f.ruleId) && <Chip label="zero tolerance" tone="blocked" />}
                      </div>
                      <p className="font-term text-[12px] text-ink/70">
                        …{f.excerpt.slice(0, f.markStart)}
                        <mark className="bg-espelette/20 text-espelette rounded-[2px] px-0.5">{f.excerpt.slice(f.markStart, f.markEnd)}</mark>
                        {f.excerpt.slice(f.markEnd)}…
                      </p>
                      {f.suggestion && <div className="mt-1 text-[12px] text-ink/60">→ {f.suggestion}</div>}
                    </div>
                  ))}
                </Scrollable>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ── Rule registry table ───────────────────────────────────────────────
   Local, so the family filter, the fixed column widths and the status
   control all belong to this panel. Fixed-width columns are what keep the
   rule / family / severity / status edges on one plumb line no matter how
   long a description runs; every header goes through <SortHeader> so all
   four columns sort (CONVENTIONS §3). */

const SEVERITY_TONE: Record<RuleSeverity, string> = { error: "blocked", warn: "attention", advisory: "neutral" };
const SEVERITY_RANK: Record<RuleSeverity, number> = { error: 0, warn: 1, advisory: 2 };
const STATUS_STEPS: { id: RuleStatus; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "zero", label: "Zero" },
  { id: "ignored", label: "Ignore" },
];
const STATUS_RANK: Record<RuleStatus, number> = { active: 0, zero: 1, ignored: 2 };

function RuleTable({
  rules, query, onStatusChange, hint, editable,
}: {
  rules: RuleRow[]; query: string; hint: string; editable: boolean;
  onStatusChange: (id: string, status: RuleStatus) => void;
}) {
  const [family, setFamily] = useState<string | "All">("All");
  const families = useMemo(() => Array.from(new Set(rules.map((r) => r.family))), [rules]);
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => rules.filter((r) =>
      (family === "All" || r.family === family)
      && (!q
        || r.id.toLowerCase().includes(q)
        || r.family.toLowerCase().includes(q)
        || r.description.toLowerCase().includes(q)
        || (r.pack ?? "").toLowerCase().includes(q)),
    ),
    [rules, family, q],
  );

  const { sort, onSort, sorted } = useSort(visible, {
    rule: (r) => r.id,
    family: (r) => r.family,
    severity: (r) => SEVERITY_RANK[r.severity],
    status: (r) => STATUS_RANK[r.status ?? "active"],
  });

  /* The real catalog is 170+ rules; the registry pages instead of rendering
     every rule into one very tall card (CONVENTIONS §13). */
  const pager = usePaged(sorted, 12);

  return (
    <Card variant="flush" title="Rule registry" hint={hint}>
      <div className="border-t border-ink/10 px-4 pb-4 pt-3">
        {/* A workspace can register dozens of families; the filter row folds
            the tail behind "+N more" rather than becoming a chip wall. */}
        <ChipList max={8} className="mb-3">
          {[
            <Chip key="__all" label="All families" tone={family === "All" ? "info" : "neutral"} selected={family === "All"} onClick={() => setFamily("All")} />,
            ...families.map((f) => (
              <Chip key={f} label={f} tone={family === f ? "info" : "neutral"} selected={family === f} onClick={() => setFamily(f)} />
            )),
          ]}
        </ChipList>

        <div className="overflow-hidden rounded-[5px] border border-ink/12">
        <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="rules"
          note={[family === "All" ? null : `family: ${family}`, q ? `matching "${query.trim()}"` : null]
            .filter(Boolean).join(", ") || undefined} />
        <Scrollable>
          <table className="w-full min-w-[620px] table-fixed border-collapse text-left">
            <colgroup>
              <col />
              <col style={{ width: "9.5rem" }} />
              <col style={{ width: "7.5rem" }} />
              <col style={{ width: "14.5rem" }} />
            </colgroup>
            <thead>
              <tr>
                <SortHeader label="Rule" sortKey="rule" sort={sort} onSort={onSort} />
                <SortHeader label="Family" sortKey="family" sort={sort} onSort={onSort} />
                <SortHeader label="Severity" sortKey="severity" sort={sort} onSort={onSort} />
                <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((r) => {
                const current = r.status ?? "active";
                return (
                  <tr key={r.id} className="border-b border-ink/10 align-top last:border-0">
                    <td className={tdPad}>
                      <Truncate className="font-term text-[12px] font-medium text-ink">{r.id}</Truncate>
                      <Truncate lines={2} className="mt-0.5 text-[12.5px] text-ink/70">{r.description}</Truncate>
                    </td>
                    <td className={tdPad}>
                      <Truncate className="text-[12.5px] font-medium text-ink/80">{r.family}</Truncate>
                      {r.pack && <Truncate className="font-term text-[11px] text-ink/65">{r.pack}</Truncate>}
                    </td>
                    <td className={tdPad}><Chip label={r.severity} tone={SEVERITY_TONE[r.severity]} /></td>
                    <td className={tdPad}>
                      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${r.id} status`}>
                        {STATUS_STEPS.map((st) => (
                          <Chip
                            key={st.id}
                            label={st.label}
                            tone={current === st.id ? "info" : "neutral"}
                            selected={current === st.id}
                            onClick={() => onStatusChange(r.id, st.id)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className={thPad}>
                    <EmptyState icon={<CheckCircle2 size={22} />}>
                      {q ? `No rules match "${query.trim()}".` : "No rules match this family."}
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Scrollable>
        {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}
        </div>

        {/* The one Library tab that cannot be curated, said out loud. The rule
            texts and their regexes ship with this build; only their status is
            a workspace setting, and even that is session-only until there is
            somewhere to save it. Naming the limit beats a disabled "Add rule"
            the reader has to click to discover. */}
        <p className="mt-3 text-[12px] text-ink/70">
          Rule texts and their patterns ship with Mari and cannot be edited here.
          You can set how strictly each one applies{editable ? "" : ", for this session"}.
        </p>
      </div>
    </Card>
  );
}

export default LibraryRulesPanel;
