import { useState } from "react";
import { FileText } from "lucide-react";
import { EmptyState } from "../data-display/EmptyState";
import { TagPicker as TagPickerUI } from "../forms/TagPicker";
import { TagChip } from "../data-display/TagChip";
import { SourceMark } from "../icons/marks";
import { card } from "../tokens/card";
import { fmtAgo } from "../tokens/format";
import { useResync } from "../actions/useResync";

/* TagPickerFeature — the document-surface context where the shared <TagPicker>
   (aliased TagPickerUI) is used: a knowledge-document header showing its
   applied tags as chips, with the popover picker to toggle the standard tag
   vocabulary on and off. Fully controlled — the doc rows own their tag arrays.
   Renders standalone with baked-in demo documents.
   Source: web/src/components/TagPicker.tsx across document surfaces. */

export type Doc = { id: string; title: string; provider: string; source: string; updatedAt: string; tags: string[] };

export type TagPickerFeatureProps = {
  docs: Doc[];
  className?: string;
};

export function TagPickerFeature({ docs, className = "" }: TagPickerFeatureProps) {
  const [rows, setRows] = useState<Doc[]>(docs);

  /* The table was copied once, at mount, so a document list that refetched
     never reached it (C1). The tag edits live in `rows` themselves and this
     feature has no action props to save them through, so `touched` stops a
     later answer from silently reverting a tag the reader just picked. */
  const [touched, setTouched] = useState(false);
  useResync(docs, setRows, { hold: touched });

  const setTags = (id: string, tags: string[]) => {
    setTouched(true);
    setRows((cur) => cur.map((d) => (d.id === id ? { ...d, tags } : d)));
  };

  return (
    <div className={`max-w-[680px] ${className}`.trim()}>
      <div className="mb-4">
        <h2 className="font-display text-[19px] text-ink">Knowledge documents</h2>
        <p className="mt-0.5 text-[13px] text-ink/70">
          Tags drive freshness, access, and review workflows. Edit a document's tags from its row.
        </p>
      </div>

      <div className={`${card} overflow-hidden`}>
        {rows.length === 0 && (
          <EmptyState icon={<FileText size={24} />} title="No documents yet">
            Connect a source and its documents show up here, ready to tag.
          </EmptyState>
        )}
        {rows.map((d, i) => (
          <div key={d.id} className={`flex items-start gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-ink/10" : ""}`}>
            <span className="mt-0.5 shrink-0 text-ink/65"><FileText size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="break-all text-[14px] font-medium text-ink">{d.title}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <SourceMark provider={d.provider} size={13} />
                <span className="min-w-0 break-all font-term text-[11px] text-ink/65">{d.source}</span>
                <span className="shrink-0 font-term text-[11px] text-ink/65">· updated {fmtAgo(d.updatedAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {d.tags.length > 0 ? (
                  d.tags.map((t) => <TagChip key={t} tag={t} />)
                ) : (
                  <span className="font-term text-[11px] text-ink/65">No tags</span>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <TagPickerUI tags={d.tags} onChange={(next) => setTags(d.id, next)} compact onManage={() => {}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
