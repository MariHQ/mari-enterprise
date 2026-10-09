import { useMemo, useState } from "react";
import { Search, Plus, MoreVertical, Eye, FilePlus2, Trash2, Clipboard, GitFork, ShieldCheck, FileText, Sprout, BookOpen, Megaphone, X } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Input } from "../forms/Input";
import { Select } from "../forms/Select";
import { SectionLabel } from "../forms/SectionLabel";
import { Truncate } from "../data-display/Truncate";
import { Badge } from "../data-display/Badge";
import { EmptyState } from "../data-display/EmptyState";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { Scrollable } from "../data-display/Scrollable";
import { SkeletonCard } from "../data-display/Skeleton";
import { Tabs } from "../navigation/Tabs";
import { Menu, MenuItem } from "../navigation/Menu";
import { useWrite } from "../actions/useWrite";
import { useResync, listSig } from "../actions/useResync";
import { WriteError } from "../feedback/WriteError";

/* LibraryTemplatesPanel — the Library › Templates tab.
   A gallery of document scaffolds (Runbook, ADR, Postmortem, RFC…) plus
   user-created custom templates. Filter by category or search, preview a
   template's section list, create custom templates, delete custom ones, and
   "Use template" to spin up a draft task. Fully local + standalone.

   Every hook is declared before the `loading` early return: they used to sit
   after it, which is a conditional-hook bug that crashes the panel the moment
   it flips from loading to loaded. */

/** Which glyph a template shows. A plain string, not a component: a template
    comes back from an API, and an API cannot return React. The panel owns the
    mapping to an actual icon. */
export type TemplateIcon =
  | "clipboard" | "git-fork" | "shield-check" | "file-text"
  | "sprout" | "book-open" | "megaphone";

export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  sections: string[];
  standard: boolean;
  icon: TemplateIcon;
};

const TEMPLATE_ICONS = {
  clipboard: Clipboard, "git-fork": GitFork, "shield-check": ShieldCheck,
  "file-text": FileText, sprout: Sprout, "book-open": BookOpen, megaphone: Megaphone,
} as const;

const GENERIC_SECTIONS = ["Overview", "Context", "Details", "Process", "Risks", "Review", "References", "Appendix", "Next steps", "Owners", "Changelog", "Links"];
const CATEGORIES = ["All", "Engineering", "Operations", "Product", "Team", "Governance"] as const;

/** What the template gallery can DO.

    "Use template" has no handler: it starts a draft in the editor, which is a
    navigation this panel does not own, so it keeps its local confirmation. */
export type LibraryTemplatesActions = {
  saveTemplate?: (t: {
    id: string; name: string; category: string; description: string;
    sections: string[]; icon: TemplateIcon;
  }) => void | Promise<void>;
  deleteTemplate?: (id: string) => void | Promise<void>;
};

export type LibraryTemplatesPanelProps = {
  templates: Template[];
  actions?: LibraryTemplatesActions;
  loading?: boolean;
  /** Narrow-column composition: the find field moves out of the card header
      onto its own row (CONVENTIONS.md §10 — the page owns mobile). */
  compact?: boolean;
  className?: string;
};

export function LibraryTemplatesPanel({ templates, actions, loading = false, compact = false, className = "" }: LibraryTemplatesPanelProps) {
  // Every hook runs on every render: these used to sit AFTER the `loading`
  // early return, so a panel that started life loading and then resolved
  // mounted a different number of hooks and React threw.
  const [rows, setRows] = useState<Template[]>(templates);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [usedId, setUsedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("Engineering");
  const [desc, setDesc] = useState("");
  const [count, setCount] = useState("5");

  /* The gallery was seeded once, at mount, so a template added elsewhere —
     or this panel's own refetch after a save — never showed up (C1).
     Signature, not identity: `LibraryPage` narrows `templates` with an inline
     `.filter()` on every render, so identity churns on every keystroke in the
     library search box. `hold` is the open composer, whose draft fields are
     separate state and would otherwise be orphaned by a list swapping under
     the reader mid-compose. */
  useResync(templates, setRows, {
    hold: composerOpen,
    key: listSig(templates, (t: Template) => `${t.id}:${t.name}:${t.category}:${t.description}:${t.standard}:${t.icon}:${t.sections.join()}`),
  });
  /* A gallery of 300 scaffolds is 100 rows of cards. Show a screenful, then
     let the reader ask for the rest, with the real total on screen the whole
     time (CONVENTIONS §13, §15). */
  const [showAll, setShowAll] = useState(false);
  const PAGE = 12;
  /* Create and delete go through `write`: with no actions they are the
     local-state changes this panel has always made (actions/useWrite.ts). */
  const write = useWrite();

  const visible = useMemo(
    () => rows.filter((t) => (category === "All" || t.category === category) && `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase())),
    [rows, category, query],
  );

  /* "Templates", the six category tabs and the sentence saying what a
     template is are all fixed here: the panel's whole frame is known and only
     the template CARDS wait. Greying the tabs was the worst of it — six
     identical grey pills where six named categories were about to appear, in
     six different widths. The counts in the summary line are the response's,
     so that half of the sentence waits. */
  if (loading) {
    return (
      <Card variant="flush" title="Templates" className={className} aria-busy="true">
        <div className="px-4 pt-3 text-[12.5px] text-ink/70">
          Shared scaffolds for the editor, chat, workflows, and the GitHub bot.
        </div>
        <div className="px-4 pt-3">
          <div className="inline-flex max-w-full items-center gap-1 rounded-md border border-ink/15 bg-flysch p-1">
            {CATEGORIES.map((c) => (
              <span
                key={c}
                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[13px] font-medium ${
                  c === "All" ? "border border-ink/15 bg-paper text-ink" : "text-ink/70"
                }`}
              >{c}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-[280px] flex-1 basis-[300px]"><SkeletonCard lines={2} footer /></div>
          ))}
        </div>
      </Card>
    );
  }

  const add = async () => {
    const templateName = name.trim();
    if (!templateName) return;
    const n = Math.max(1, Math.min(Number(count) || 5, GENERIC_SECTIONS.length));
    // The key is the template's identity on the server, so it is derived from
    // the name here and sent, rather than being a local row number.
    const id = templateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      || `custom-${Date.now().toString(36)}`;
    const row: Template = {
      id, name: templateName, category: cat, description: desc.trim() || "Custom scaffold.",
      sections: GENERIC_SECTIONS.slice(0, n), standard: false, icon: "file-text",
    };
    const ok = await write.run(
      actions?.saveTemplate && (() => actions.saveTemplate!({
        id, name: row.name, category: row.category, description: row.description,
        sections: row.sections, icon: row.icon,
      })),
      () => setRows((prev) => [...prev, row]),
    );
    if (ok) { setName(""); setDesc(""); setCount("5"); setComposerOpen(false); }
  };

  const use = (id: string) => { setUsedId(id); window.setTimeout(() => setUsedId((cur) => (cur === id ? null : cur)), 2400); };
  /* Destructive: the caller is <ConfirmButton>, so this is the second click. */
  const del = (id: string) => write.run(
    actions?.deleteTemplate && (() => actions.deleteTemplate!(id)),
    () => setRows((prev) => prev.filter((t) => t.id !== id)),
  );

  const findField = (
    <label className="flex min-w-0 items-center gap-2 h-8 px-2.5 rounded-[4px] border border-ink/20 text-ink/70 focus-within:border-biscay-2">
      <Search size={14} className="shrink-0" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a template" className={`${compact ? "w-full" : "w-32"} min-w-0 bg-transparent outline-none text-[12.5px] text-ink placeholder:text-ink/65`} />
    </label>
  );

  return (
    <Card
      variant="flush"
      title="Templates"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!compact && findField}
          <Button variant="primary" compact onClick={() => setComposerOpen((v) => !v)}><Plus size={13} /> New template</Button>
        </div>
      }
      className={className}
    >
      <div className="border-t border-ink/10">
        {write.failed && (
          <div className="px-4 pt-3"><WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError></div>
        )}
        {/* Header summary sits on its own line under the header + search +
            new-template row, not squeezed between them. */}
        {compact && <div className="px-4 pt-3">{findField}</div>}
        <div className="px-4 pt-3 text-[12.5px] text-ink/70">
          Shared scaffolds for the editor, chat, workflows, and the GitHub bot. {rows.length} available, {rows.filter((t) => !t.standard).length} custom.
        </div>

        {composerOpen && (
          <div className="px-4 py-3.5 bg-biscay-2/[0.03] border-b border-ink/10">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-semibold text-ink">New template</span>
              <button type="button" aria-label="Cancel" onClick={() => setComposerOpen(false)} className="text-ink/70 hover:text-ink"><X size={14} /></button>
            </div>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
              <div><SectionLabel>Name</SectionLabel><Input autoFocus className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Design doc" /></div>
              <div><SectionLabel>Category</SectionLabel><Select className="mt-1 w-full block" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
              <div><SectionLabel>Description</SectionLabel><Input className="mt-1 w-full" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What it's for" /></div>
              <div><SectionLabel>Sections</SectionLabel><Input type="number" min={1} max={12} className="mt-1 w-full" value={count} onChange={(e) => setCount(e.target.value)} /></div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button compact onClick={() => setComposerOpen(false)}>Cancel</Button>
              <Button variant="primary" compact disabled={write.busy || !name.trim()} onClick={() => void add()}>Create</Button>
            </div>
          </div>
        )}

        <div className="px-4 pt-3">
          <Tabs
            ariaLabel="Template category"
            variant="seg"
            value={category}
            onChange={(id) => setCategory(id as (typeof CATEGORIES)[number])}
            options={CATEGORIES.map((c) => ({ id: c, label: c }))}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={<FileText size={20} />}>No templates match these filters.</EmptyState>
        ) : (
          /* flex-wrap + growing cards, not a fixed column grid: every row,
             including a short last row, runs edge to edge with no dead corner
             (CONVENTIONS §11). Intrinsic basis also replaces the sm:/xl:
             breakpoints (§10). */
          <>
          <ResultCount
            from={1}
            to={showAll ? visible.length : Math.min(PAGE, visible.length)}
            total={visible.length}
            noun="templates"
            note={category === "All" ? undefined : `category: ${category}`}
            className="mt-3 border-t"
            actions={visible.length > PAGE && (
              <ShowRest expanded={showAll} total={visible.length} onToggle={() => setShowAll((v) => !v)} />
            )}
          />
          <div className="flex flex-wrap gap-3 p-4">
            {(showAll ? visible : visible.slice(0, PAGE)).map((t) => {
              const Icon = TEMPLATE_ICONS[t.icon] ?? FileText;
              const open = previewId === t.id;
              const used = usedId === t.id;
              return (
                <article key={t.id} className="flex min-w-[280px] flex-1 basis-[300px] flex-col rounded-[6px] border border-ink/12 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="grid place-items-center w-8 h-8 rounded-[5px] bg-flysch border border-ink/12 text-ink/70"><Icon size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <Truncate className="font-term text-[10.5px] uppercase tracking-[0.08em] text-biscay-2">{t.category}</Truncate>
                      <Truncate as="h4" className="text-[14px] font-semibold text-ink">{t.name}</Truncate>
                    </div>
                    <Menu trigger={<Button icon compact aria-label="More"><MoreVertical size={15} /></Button>}>
                      <MenuItem icon={<Eye size={14} />} onSelect={() => setPreviewId(open ? null : t.id)}>{open ? "Hide sections" : "Preview sections"}</MenuItem>
                      <MenuItem icon={<FilePlus2 size={14} />} onSelect={() => use(t.id)}>Use template</MenuItem>
                    </Menu>
                  </div>

                  <Truncate as="p" lines={3} className="mt-2 text-[12.5px] text-ink/70 flex-1">{t.description}</Truncate>

                  {open && (
                    /* A 40-section scaffold must not make one card three
                        times the height of its siblings (CONVENTIONS §15). */
                    <Scrollable axis="y" className="mt-2.5 max-h-[150px]" scrollerClassName="pr-1">
                      <ol className="flex list-inside list-decimal flex-col gap-1">
                        {t.sections.map((s) => <li key={s} title={s} className="truncate text-[12px] text-ink/70 marker:text-ink/65 marker:font-term">{s}</li>)}
                      </ol>
                    </Scrollable>
                  )}

                  <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-ink/10">
                    <span className="font-term text-[11px] text-ink/70">{t.sections.length} sections · {t.standard ? "Standard" : "Custom"}</span>
                    <Badge label={t.standard ? "Standard" : "Custom"} tone={t.standard ? "info" : "neutral"} />
                  </div>
                  {/* Same size and shape as "Use template" so the pair reads
                      as one control row (CONVENTIONS §2). */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Button variant={used ? "success" : "primary"} compact onClick={() => use(t.id)}>{used ? "Draft task created" : "Use template"}</Button>
                    <Button compact onClick={() => setPreviewId(open ? null : t.id)}>{open ? "Hide sections" : "Preview"}</Button>
                    {!t.standard && (
                      <ConfirmButton compact aria-label={`Delete ${t.name}`} confirmLabel="Delete?" onConfirm={() => del(t.id)}>
                        <Trash2 size={13} /> Delete
                      </ConfirmButton>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          </>
        )}
      </div>
    </Card>
  );
}

export default LibraryTemplatesPanel;
