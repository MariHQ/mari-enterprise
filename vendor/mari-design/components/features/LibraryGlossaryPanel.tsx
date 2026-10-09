import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Input } from "../forms/Input";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonLine, SkeletonText, SkeletonButton } from "../data-display/Skeleton";
import { PagerBar, ResultCount, usePaged } from "../data-display/Pagination";
import { Truncate } from "../data-display/Truncate";
import { fmtDate } from "../tokens/format";
import { useWrite } from "../actions/useWrite";
import { useResync, listSig } from "../actions/useResync";
import { WriteError } from "../feedback/WriteError";

/* LibraryGlossaryPanel — the Library › Glossary tab.
   A shared glossary of term → definition pairs Mari uses when writing and
   reviewing, with inline add / edit / delete wired to local state, so it
   renders standalone with no props.

   The list is local rather than data-display/GlossaryPanel: there, Edit was a
   36px icon button sitting next to a 28px compact Delete, so two controls that
   do the same kind of thing were visibly different heights. Both are
   `<Button compact>` here, labelled, on one baseline, with Delete going
   through <ConfirmButton> (CONVENTIONS §2). */

export type Term = {
  id: string;
  term: string;
  definition: string;
  owner: string;
  updated: string;
};

/** What the glossary can DO. `id` is null for a term being added and the row's
    own id for one being edited, because the server upserts on it. */
export type LibraryGlossaryActions = {
  saveTerm?: (t: { id: string | null; term: string; definition: string }) => void | Promise<void>;
  deleteTerm?: (id: string) => void | Promise<void>;
};

export type LibraryGlossaryPanelProps = {
  terms: Term[];
  actions?: LibraryGlossaryActions;
  loading?: boolean;
  className?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function LibraryGlossaryPanel({ terms, actions, loading = false, className }: LibraryGlossaryPanelProps) {
  const [rows, setRows] = useState<Term[]>(terms);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editDef, setEditDef] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newDef, setNewDef] = useState("");

  /* The working copy was taken once, at mount: a term someone else defined,
     or this panel's own refetch after a save, never appeared (C1). Compared
     by signature rather than identity because `LibraryPage` re-filters the
     collection inline on every render, so the prop is a fresh array whenever
     the reader is typing in the library search box. `hold` protects a row
     being edited and a term being added. */
  useResync(terms, setRows, {
    hold: editId !== null || newTerm.trim() !== "" || newDef.trim() !== "",
    key: listSig(terms, (t: Term) => `${t.id}:${t.term}:${t.definition}:${t.owner}:${t.updated}`),
  });

  /* A shared glossary grows to hundreds of terms. It pages, so the card stays
     a card instead of a scroll of the whole vocabulary (CONVENTIONS §13).
     Declared before the `loading` return: a conditional hook crashes the
     panel the moment it flips from loading to loaded. */
  const pager = usePaged(rows, 10);

  if (loading) {
    return (
      <div className={className}>
        <div className="rounded-md border border-ink/12 bg-paper" aria-hidden="true">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <div className="space-y-2">
              <SkeletonLine w={100} h={13} />
              <SkeletonLine w={220} h={9} />
            </div>
            <SkeletonButton w={96} />
          </div>
          <div className="divide-y divide-ink/[0.08] px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2 py-3.5">
                <SkeletonLine w="28%" h={12} />
                <SkeletonText lines={2} lastWidth="70%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const startEdit = (t: Term) => { setEditId(t.id); setEditTerm(t.term); setEditDef(t.definition); };

  /* Add / edit / delete go through `write`: with no actions they are the
     local-state changes this panel has always made (actions/useWrite.ts). */
  const write = useWrite();

  const saveEdit = async () => {
    const term = editTerm.trim();
    const definition = editDef.trim();
    if (!editId || !term || !definition) { setEditId(null); return; }
    const ok = await write.run(
      actions?.saveTerm && (() => actions.saveTerm!({ id: editId, term, definition })),
      () => setRows((prev) => prev.map((r) => (r.id === editId
        ? { ...r, term, definition, owner: "You", updated: today() }
        : r))),
    );
    if (ok) setEditId(null);
  };

  const add = async () => {
    const term = newTerm.trim();
    const definition = newDef.trim();
    if (!term || !definition) return;
    const ok = await write.run(
      actions?.saveTerm && (() => actions.saveTerm!({ id: null, term, definition })),
      () => setRows((prev) => [
        ...prev,
        { id: `t${Date.now().toString(36)}`, term, definition, owner: "You", updated: today() },
      ]),
    );
    if (ok) { setNewTerm(""); setNewDef(""); }
  };

  /* Destructive: the caller is <ConfirmButton>, so this is the second click. */
  const remove = (id: string) => write.run(
    actions?.deleteTerm && (() => actions.deleteTerm!(id)),
    () => setRows((prev) => prev.filter((r) => r.id !== id)),
  );

  return (
    <Card
      variant="flush"
      title="Glossary"
      hint="Shared definitions Mari uses when writing and reviewing"
      className={className}
    >
      {write.failed && (
        <div className="border-t border-ink/10 px-4 py-3">
          <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
        </div>
      )}
      <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="terms" className="border-t" />
      <div className="divide-y divide-ink/10">
        {rows.length === 0 && (
          <div className="px-4 py-3">
            <EmptyState>No terms yet. Add the first one below.</EmptyState>
          </div>
        )}

        {pager.pageRows.map((t) =>
          editId === t.id ? (
            <div key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <Input className="w-40 shrink-0" value={editTerm} onChange={(e) => setEditTerm(e.target.value)} placeholder="Term" />
              <Input className="min-w-[12rem] flex-1" value={editDef} onChange={(e) => setEditDef(e.target.value)} placeholder="Definition" />
              <Button variant="primary" compact onClick={() => void saveEdit()} disabled={write.busy || !editTerm.trim() || !editDef.trim()}>Save</Button>
              <Button compact onClick={() => setEditId(null)}>Cancel</Button>
            </div>
          ) : (
            <div key={t.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
              {/* A term is one line, ellipsised: a long term used to wrap and
                  set the height of every row beside it (CONVENTIONS §12). */}
              <Truncate className="w-40 shrink-0 text-[13.5px] font-semibold text-ink">{t.term}</Truncate>
              <div className="min-w-[16rem] flex-1">
                <Truncate lines={2} className="text-[13.5px] text-ink/80">{t.definition}</Truncate>
                <div className="mt-0.5 truncate font-term text-[11px] text-ink/65">
                  {t.owner} · updated {fmtDate(t.updated)}
                </div>
              </div>
              {/* Same size, same shape, same baseline. */}
              <div className="flex shrink-0 items-center gap-1.5">
                <Button compact aria-label={`Edit ${t.term}`} onClick={() => startEdit(t)}>
                  <Pencil size={13} /> Edit
                </Button>
                <ConfirmButton compact aria-label={`Delete ${t.term}`} confirmLabel="Delete?" onConfirm={() => remove(t.id)}>
                  <Trash2 size={13} /> Delete
                </ConfirmButton>
              </div>
            </div>
          ),
        )}

        {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} className="border-t-0" />}

        <div className="flex flex-wrap items-center gap-2 bg-ink/[0.015] px-4 py-3">
          <Input className="w-40 shrink-0" placeholder="New term" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
          <Input className="min-w-[12rem] flex-1" placeholder="What it means, in one sentence." value={newDef} onChange={(e) => setNewDef(e.target.value)} />
          <Button variant="primary" compact onClick={() => void add()} disabled={write.busy || !newTerm.trim() || !newDef.trim()}>
            <Plus size={13} /> Add
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default LibraryGlossaryPanel;
