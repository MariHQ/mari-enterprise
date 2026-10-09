import { useMemo, useState } from "react";
import { Search, Sparkles, Plus, Pencil, X } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Input } from "../forms/Input";
import { Select } from "../forms/Select";
import { SectionLabel } from "../forms/SectionLabel";
import { Stat } from "../data-display/Stat";
import { Chip, ChipList } from "../data-display/Chip";
import { Truncate } from "../data-display/Truncate";
import { PagerBar, ResultCount, usePaged } from "../data-display/Pagination";
import { TagChip } from "../data-display/TagChip";
import { Progress } from "../data-display/Progress";
import { EmptyState } from "../data-display/EmptyState";
import { SortHeader, useSort, tdPad } from "../data-display/sortable";
import { SkeletonLine, SkeletonChip, SkeletonButton, SkeletonStat } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";
import { useWrite } from "../actions/useWrite";
import { useResync, listSig } from "../actions/useResync";
import { WriteError } from "../feedback/WriteError";

/* LibraryTagsPanel — the Library › Tags tab (default tab).
   The single source of truth for the project's tag vocabulary: one
   vocabulary drives ranking (search weight), evidence policy, publishing,
   audits and workflows. Admins create / edit / delete tags, tune per-tag
   search weight inline, and run a live coverage analysis. Fully local +
   standalone here.

   The definitions used to be a headerless <article> grid whose four columns
   drifted apart as descriptions grew; they are now a real table with
   <SortHeader> columns, fixed widths and the shared tdPad spacing, and every
   chip comes from the shared chip family (TagChip for the tag, Chip for the
   behaviors) instead of bespoke spans (CONVENTIONS §3, §4). */

type Tone = "ok" | "attention" | "blocked" | "info" | "neutral";

export type TagDef = {
  id: string;
  name: string;
  description: string;
  tone: Tone;
  evidence: string;
  weight: number;
  usage: number;
  behaviors: string[];
  standard: boolean;
};

const COLORS: { id: Tone; label: string }[] = [
  { id: "info", label: "Dusty blue" },
  { id: "ok", label: "Moss" },
  { id: "attention", label: "Ochre" },
  { id: "blocked", label: "Brick" },
  { id: "neutral", label: "Ink" },
];

/** What the tag vocabulary can DO. All optional: with none, the composer, the
    inline weight editor and Delete keep the local behaviour below, which is
    what the design canvas renders.

    `behaviors` rides along on a save because the composer does not edit it and
    the upsert is a whole-row write: dropping it would erase what the row
    already says every time somebody renamed a tag. */
export type LibraryTagsActions = {
  saveTag?: (tag: {
    id: string; name: string; description: string; tone: Tone;
    weight: number; behaviors: string[]; isNew: boolean;
  }) => void | Promise<void>;
  deleteTag?: (id: string) => void | Promise<void>;
  setTagWeight?: (id: string, weight: number) => void | Promise<void>;
};

export type LibraryTagsPanelProps = {
  tags: TagDef[];
  actions?: LibraryTagsActions;
  /** Documents in the corpus, for the "used on N of M" coverage line. */
  totalDocs: number;
  loading?: boolean;
  /** Narrow-column composition: the filter field moves out of the card header
      onto its own row, so the action cluster still fits (CONVENTIONS.md §10 —
      pages own mobile, the panel just takes the instruction). */
  compact?: boolean;
  /** The caller already narrows `tags` with a search field of its own (the
      Library page does, above the tab strip). The panel then draws no second
      field: one table had a page-level "Search tags, rules, terms, guides,
      and templates" and a card-level "Filter tags" ~230px apart, filtering the
      same rows. */
  prefiltered?: boolean;
  className?: string;
};

export function LibraryTagsPanel({ tags, actions, totalDocs, loading = false, compact = false, prefiltered = false, className = "" }: LibraryTagsPanelProps) {
  const [rows, setRows] = useState<TagDef[]>(tags);
  const [query, setQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftTone, setDraftTone] = useState<Tone>("info");
  const [draftWeight, setDraftWeight] = useState("1");
  const [weightEditId, setWeightEditId] = useState<string | null>(null);
  const [weightVal, setWeightVal] = useState("");

  /* `rows` was taken once, at mount, so a tag another person added — or the
     panel's own refetch after a save — never reached the table (C1).
     Signature, not identity: `LibraryPage` narrows the collections with an
     inline `.filter()` on every render, so the array the panel receives is a
     new object each time the reader touches the library search box. Comparing
     identity there would resync on every keystroke and wipe the open row
     editor. `hold` keeps a row being edited, or a tag being composed, out of
     the way of an answer that lands underneath it. */
  useResync(tags, setRows, {
    hold: editId !== null || weightEditId !== null || composerOpen,
    key: listSig(tags, (t: TagDef) => `${t.id}:${t.name}:${t.description}:${t.tone}:${t.weight}:${t.usage}:${t.behaviors.join()}`),
  });

  const visible = useMemo(
    () => rows.filter((t) => `${t.name} ${t.description} ${t.behaviors.join(" ")}`.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );

  const { sort, onSort, sorted } = useSort(visible, {
    name: (t) => t.name,
    behaviors: (t) => t.behaviors.join(", "),
    evidence: (t) => t.evidence,
    weight: (t) => t.weight,
    usage: (t) => t.usage,
  });

  /* A mature vocabulary runs to hundreds of tags. The definition table pages
     rather than growing the card to the height of the whole vocabulary. */
  const pager = usePaged(sorted, 12);

  const tagged = rows.reduce((s, t) => s + t.usage, 0);
  const coverage = Math.min(100, Math.round((tagged / (totalDocs * 1.4)) * 100));
  const needCuration = rows.filter((t) => t.id === "needs-review" || t.id === "stale").reduce((s, t) => s + t.usage, 0);
  const rankingRules = rows.filter((t) => t.weight !== 1).length;

  const openComposer = (t?: TagDef) => {
    if (t) { setEditId(t.id); setDraftName(t.name); setDraftDesc(t.description); setDraftTone(t.tone); setDraftWeight(String(t.weight)); }
    else { setEditId(null); setDraftName(""); setDraftDesc(""); setDraftTone("info"); setDraftWeight("1"); }
    setComposerOpen(true);
  };

  /* Every mutator goes through `write`: no actions means the local-state
     change this panel has always made, actions means that change applied only
     once the server took it (actions/useWrite.ts). */
  const write = useWrite();

  const saveTag = async () => {
    const name = draftName.trim();
    if (!name) return;
    const weight = Number(draftWeight) || 1;
    const description = draftDesc.trim() || "Custom team label.";
    const existing = editId ? rows.find((t) => t.id === editId) : undefined;
    const id = editId
      ?? (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `tag-${Date.now().toString(36)}`);
    const behaviors = existing?.behaviors ?? ["Custom label"];
    const ok = await write.run(
      actions?.saveTag && (() => actions.saveTag!({ id, name, description, tone: draftTone, weight, behaviors, isNew: !editId })),
      () => setRows((prev) => (editId
        ? prev.map((t) => (t.id === editId ? { ...t, name, description, tone: draftTone, weight } : t))
        : [...prev, { id, name, description, tone: draftTone, evidence: "Normal evidence", weight, usage: 0, behaviors, standard: false }])),
    );
    if (ok) setComposerOpen(false);
  };

  const commitWeight = (id: string) => {
    const v = Number(weightVal);
    setWeightEditId(null);
    if (!Number.isFinite(v) || v < 0) return;
    return write.run(
      actions?.setTagWeight && (() => actions.setTagWeight!(id, v)),
      () => setRows((prev) => prev.map((t) => (t.id === id ? { ...t, weight: v } : t))),
    );
  };

  /* Destructive: the caller is <ConfirmButton>, so this is the second click. */
  const del = (id: string) => write.run(
    actions?.deleteTag && (() => actions.deleteTag!(id)),
    () => setRows((prev) => prev.filter((t) => t.id !== id)),
  );

  const maxUsage = Math.max(1, ...rows.map((t) => t.usage));
  const untagged = Math.max(0, totalDocs - Math.round(tagged / 1.4));

  if (loading) {
    return (
      <div className={`flex flex-col gap-4 ${className}`.trim()} aria-hidden="true">
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
        </div>
        <div className="rounded-md border border-ink/12 bg-paper">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <SkeletonLine w={120} h={13} />
            <div className="flex gap-2"><SkeletonButton w={120} /><SkeletonButton w={88} /></div>
          </div>
          <div className="divide-y divide-ink/10">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid items-start gap-3 px-4 py-3.5 md:grid-cols-[1.4fr_1.2fr_1fr_auto]">
                <div className="space-y-2">
                  <SkeletonChip w={92} />
                  <SkeletonLine w="80%" h={9} />
                </div>
                <div className="flex flex-wrap gap-1.5"><SkeletonChip w={64} /><SkeletonChip w={52} /></div>
                <div className="space-y-2">
                  <SkeletonLine w="55%" h={9} />
                  <SkeletonChip w={72} />
                </div>
                <div className="flex justify-end gap-1.5"><SkeletonButton w={30} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filterField = (
    <label className="flex min-w-0 items-center gap-2 h-8 px-2.5 rounded-[4px] border border-ink/20 text-ink/70 focus-within:border-biscay-2">
      <Search size={14} className="shrink-0" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter tags" className={`${compact ? "w-full" : "w-32"} min-w-0 bg-transparent outline-none text-[12.5px] text-ink placeholder:text-ink/65`} />
    </label>
  );

  return (
    <div className={`flex flex-col gap-4 ${className}`.trim()}>
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>

      {/* Stats strip */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]" aria-label="Tag health">
        <Stat value={rows.length} label="Active definitions" />
        <Stat value={`${coverage}%`} label="Documents tagged" tone="ok" sub={`${tagged.toLocaleString()} tags applied`} />
        <Stat value={needCuration} label="Need curation" tone="attention" />
        <Stat value={rankingRules} label="Ranking rules" tone="info" sub="weight ≠ 1.0" />
      </div>

      {/* No `hint` count: "7 tags" in this header sat 46px above a "7 tags"
          strip. The strip owns the number (§13 count rule). */}
      <Card
        variant="flush"
        title="Tag definitions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!prefiltered && !compact && filterField}
            <Button compact onClick={() => setAnalyzing((v) => !v)}><Sparkles size={13} /> Analyze documents</Button>
            <Button variant="primary" compact onClick={() => openComposer()}><Plus size={13} /> New tag</Button>
          </div>
        }
      >
        <div className="border-t border-ink/10">
          {!prefiltered && compact && <div className="px-4 pt-3">{filterField}</div>}
          {/* Analyze panel */}
          {analyzing && (
            <div className="px-4 py-3.5 bg-ink/[0.015] border-b border-ink/10">
              <div className="flex items-center justify-between mb-3">
                <span className="font-term text-[11px] uppercase tracking-[0.08em] text-ink/70">Corpus coverage · {totalDocs} documents indexed</span>
                <Button variant="link" onClick={() => setAnalyzing(false)}>Close</Button>
              </div>
              {/* One row per tag: with a 200-tag vocabulary this panel alone
                  ran 4,000px. It scrolls in a bounded box with a visible bar
                  instead (CONVENTIONS §20). */}
              <Scrollable axis="y" fade="flysch" className="max-h-[280px]" scrollerClassName="flex flex-col gap-2.5 pr-1">
                {[...rows].sort((a, b) => b.usage - a.usage).map((t) => (
                  <div key={t.id} className="grid grid-cols-[10rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                    <TagChip tag={t.id} label={t.name} tone={t.tone} />
                    <Progress value={Math.round((t.usage / maxUsage) * 100)} tone={t.tone === "neutral" ? "info" : t.tone} />
                    <span className="font-term text-[11px] text-ink/70 text-right">{t.usage} docs · {Math.round((t.usage / totalDocs) * 100)}%</span>
                  </div>
                ))}
                <div className="grid grid-cols-[10rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                  <span className="text-[12.5px] text-ink/70">Untagged</span>
                  <Progress value={Math.round((untagged / totalDocs) * 100)} tone="attention" />
                  <span className="font-term text-[11px] text-ink/70 text-right">{untagged} docs</span>
                </div>
              </Scrollable>
              <div className="mt-3 font-term text-[11px] text-moss">{coverage}% of the corpus carries at least one project tag.</div>
            </div>
          )}

          {/* Composer */}
          {composerOpen && (
            <div className="px-4 py-3.5 bg-biscay-2/[0.03] border-b border-ink/10">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[13px] font-semibold text-ink">{editId ? "Edit tag" : "New tag"}</span>
                <button type="button" aria-label="Cancel" onClick={() => setComposerOpen(false)} className="text-ink/70 hover:text-ink"><X size={14} /></button>
              </div>
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
                <div><SectionLabel>Tag name</SectionLabel><Input autoFocus className="mt-1 w-full" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Runbook" /></div>
                <div><SectionLabel>Description</SectionLabel><Input className="mt-1 w-full" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="What it means" /></div>
                <div><SectionLabel>Color</SectionLabel><Select className="mt-1 w-full block" value={draftTone} onChange={(e) => setDraftTone(e.target.value as Tone)}>{COLORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></div>
                <div><SectionLabel>Search weight</SectionLabel><Input type="number" step={0.05} min={0} className="mt-1 w-full" value={draftWeight} onChange={(e) => setDraftWeight(e.target.value)} /></div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button compact onClick={() => setComposerOpen(false)}>Cancel</Button>
                <Button variant="primary" compact disabled={write.busy || !draftName.trim()} onClick={() => void saveTag()}>{editId ? "Save" : "Create"}</Button>
              </div>
            </div>
          )}

          {/* Definition table — headers, one plumb line per column */}
          {visible.length === 0 ? (
            <EmptyState icon={<Search size={20} />}>No tags match this search.</EmptyState>
          ) : (
            <>
            <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="tags"
              note={query.trim() ? `filtered from ${rows.length.toLocaleString("en-US")}` : undefined} />
            <Scrollable>
              <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
                <colgroup>
                  <col style={{ width: "16rem" }} />
                  <col style={{ width: "14rem" }} />
                  <col style={{ width: "10rem" }} />
                  <col style={{ width: "6.5rem" }} />
                  <col style={{ width: "6rem" }} />
                  <col style={{ width: "11rem" }} />
                </colgroup>
                <thead>
                  <tr>
                    <SortHeader label="Tag" sortKey="name" sort={sort} onSort={onSort} />
                    <SortHeader label="Behaviors" sortKey="behaviors" sort={sort} onSort={onSort} />
                    <SortHeader label="Evidence" sortKey="evidence" sort={sort} onSort={onSort} />
                    <SortHeader label="Weight" sortKey="weight" sort={sort} onSort={onSort} align="center" />
                    <SortHeader label="Docs" sortKey="usage" sort={sort} onSort={onSort} align="center" />
                    <SortHeader label="Actions" sortable={false} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {pager.pageRows.map((t) => (
                    <tr key={t.id} className="border-b border-ink/10 align-top last:border-0">
                      <td className={tdPad}>
                        <TagChip tag={t.id} label={t.name} tone={t.tone} />
                        {/* Two lines, then an ellipsis: a paragraph-length
                            description must not set the row height (§12). */}
                        <Truncate as="p" lines={2} className="mt-1 text-[12.5px] text-ink/70">{t.description}</Truncate>
                      </td>
                      <td className={tdPad}>
                        {/* A tag with 30 behaviors used to wrap into a block
                            taller than the rest of the row. */}
                        <ChipList max={3}>
                          {t.behaviors.map((b) => <Chip key={b} label={b} tone="neutral" />)}
                        </ChipList>
                      </td>
                      <td className={`${tdPad} font-term text-[11px] text-ink/70`}><Truncate lines={2}>{t.evidence}</Truncate></td>
                      <td className={`${tdPad} text-center`}>
                        {weightEditId === t.id ? (
                          <Input
                            type="number" step={0.05} min={0} autoFocus className="h-7 w-20"
                            value={weightVal}
                            onChange={(e) => setWeightVal(e.target.value)}
                            onBlur={() => commitWeight(t.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitWeight(t.id); if (e.key === "Escape") setWeightEditId(null); }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setWeightEditId(t.id); setWeightVal(String(t.weight)); }}
                            className="max-w-full truncate rounded-[3px] border border-ink/15 px-1.5 py-0.5 font-term text-[12px] text-ink/80 hover:border-ink/40"
                          >
                            ×{t.weight.toFixed(2)}
                          </button>
                        )}
                      </td>
                      <td className={`${tdPad} text-center font-term text-[12px] tabular-nums text-ink/70`}>{t.usage.toLocaleString("en-US")}</td>
                      <td className={`${tdPad} text-right`}>
                        <span className="inline-flex items-center gap-1.5">
                          <Button compact aria-label={`Edit ${t.name}`} onClick={() => openComposer(t)}><Pencil size={13} /> Edit</Button>
                          {!t.standard && (
                            <ConfirmButton compact aria-label={`Delete ${t.name}`} confirmLabel="Delete?" onConfirm={() => del(t.id)} title="Documents keep the raw tag but lose its behaviors.">
                              Delete
                            </ConfirmButton>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scrollable>
            {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default LibraryTagsPanel;
