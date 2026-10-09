import { type ReactNode, useState } from "react";
import { Plus } from "lucide-react";
import { IconPencil, IconTrash } from "../icons/ui";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Input } from "../forms/Input";
import { EmptyState } from "./EmptyState";
import { ResultCount } from "./Pagination";
import { ShowRest } from "./ShowRest";
import { Scrollable } from "./Scrollable";

/** Terms rendered before "Show all", and the row count past which the list
    scrolls inside a bounded region instead of growing the card (§20). */
const PAGE = 25;
const BOUND_AT = 6;

/* GlossaryPanel — an editable term → definition list. Ported from the
   console's library GlossaryPanel, decoupled from GraphQL: edit/add/delete
   are surfaced as callbacks. Inline-edit and add-row UI state is managed
   locally; the data itself is owned by the caller. Editing affordances only
   appear for the handlers you pass. */

export type GlossaryEntry = {
  id: string;
  term: string;
  definition: string;
  /** Optional trailing meta line (e.g. "Alex · updated Jul 9"). */
  meta?: ReactNode;
};

export type GlossaryPanelProps = {
  entries: GlossaryEntry[];
  onAdd?: (term: string, definition: string) => void;
  onEdit?: (id: string, term: string, definition: string) => void;
  onDelete?: (id: string) => void;
  title?: ReactNode;
  hint?: ReactNode;
  className?: string;
};

export function GlossaryPanel({
  entries, onAdd, onEdit, onDelete, title = "Glossary", hint, className,
}: GlossaryPanelProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editDef, setEditDef] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newDef, setNewDef] = useState("");
  const [showAll, setShowAll] = useState(false);

  const startEdit = (e: GlossaryEntry) => { setEditId(e.id); setEditTerm(e.term); setEditDef(e.definition); };
  const saveEdit = () => {
    if (editId && editTerm.trim() && editDef.trim()) onEdit?.(editId, editTerm.trim(), editDef.trim());
    setEditId(null);
  };
  const add = () => {
    if (newTerm.trim() && newDef.trim()) { onAdd?.(newTerm.trim(), newDef.trim()); setNewTerm(""); setNewDef(""); }
  };

  const capped = entries.length > PAGE;
  const shown = capped && !showAll ? entries.slice(0, PAGE) : entries;

  const rows = (
    <div className="divide-y divide-ink/10">
      {shown.map((e) =>
          editId === e.id ? (
            <div key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <Input className="w-40 shrink-0" value={editTerm} onChange={(ev) => setEditTerm(ev.target.value)} placeholder="Term" />
              <Input className="flex-1 min-w-[12rem]" value={editDef} onChange={(ev) => setEditDef(ev.target.value)} placeholder="Definition" />
              <Button variant="primary" compact onClick={saveEdit} disabled={!editTerm.trim() || !editDef.trim()}>Save</Button>
              <Button compact onClick={() => setEditId(null)}>Cancel</Button>
            </div>
          ) : (
            <div key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-3">
              <div className="w-40 shrink-0 break-words text-[13.5px] font-semibold text-ink">{e.term}</div>
              <div className="min-w-[12rem] flex-1">
                <div className="text-[13.5px] text-ink/80 break-words">{e.definition}</div>
                {e.meta && <div className="mt-0.5 font-term text-[11px] text-ink/65">{e.meta}</div>}
              </div>
              {/* Edit and delete are the SAME 36px icon button carrying the
                  SAME 18px glyph. They used to be 36px vs 28px, which read as
                  two unrelated controls. */}
              {(onEdit || onDelete) && (
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {onEdit && (
                    <Button icon aria-label={`Edit ${e.term}`} title="Edit term" onClick={() => startEdit(e)}>
                      <IconPencil size={18} />
                    </Button>
                  )}
                  {onDelete && (
                    <ConfirmButton icon aria-label={`Delete ${e.term}`} title="Delete term" confirmLabel="Yes" onConfirm={() => onDelete(e.id)}>
                      <IconTrash size={18} />
                    </ConfirmButton>
                  )}
                </div>
              )}
            </div>
          ),
        )}
    </div>
  );

  return (
    <Card variant="flush" title={title} hint={hint ?? `${entries.length} ${entries.length === 1 ? "term" : "terms"}`} className={className}>
      <div className="border-t border-ink/10">
        {entries.length === 0 ? (
          <div className="px-4 py-3">
            <EmptyState>No terms yet{onAdd ? ". Add the first one below." : "."}</EmptyState>
          </div>
        ) : (
          <>
            {/* Count strip above the list it describes (§13). XA-05/XA-08: the
                sentence and the toggle were hand-rolled, so this card said
                "Showing all 25 terms" where its neighbours said "25 terms". */}
            <ResultCount
              from={1}
              to={shown.length}
              total={entries.length}
              noun="terms"
              actions={capped ? <ShowRest expanded={showAll} total={entries.length} onToggle={() => setShowAll((v) => !v)} /> : undefined}
            />
            {/* A glossary runs to hundreds of terms: it scrolls in place with a
                visible scrollbar rather than growing the card forever (§20). */}
            {shown.length > BOUND_AT
              ? <Scrollable axis="y" style={{ maxHeight: 460 }}>{rows}</Scrollable>
              : rows}
          </>
        )}

        {onAdd && (
          <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 px-4 py-3 bg-ink/[0.015]">
            <Input className="w-40 shrink-0" placeholder="New term" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
            <Input className="flex-1 min-w-[12rem]" placeholder="What it means, in one sentence." value={newDef} onChange={(e) => setNewDef(e.target.value)} />
            <Button variant="primary" compact onClick={add} disabled={!newTerm.trim() || !newDef.trim()}>
              <Plus size={16} /> Add
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
