import { useState } from "react";
import { CheckCircle2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Card } from "../layout/Card";
import { CardSection } from "../layout/CardShell";
import { Button } from "../actions/Button";
import { OpenDocumentButton } from "../actions/RepeatedActions";
import { why } from "../actions/useWrite";
import { useNavigate } from "../navigation/Link";
import { WriteError } from "../feedback/WriteError";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { SectionLabel } from "../forms/SectionLabel";
import { TagPicker } from "../forms/TagPicker";
import { Tabs } from "../navigation/Tabs";
import { Chip, CountChip } from "../data-display/Chip";
import { Pill } from "../data-display/Pill";
import { SourceMark } from "../icons/marks";
import { fmtDate } from "../tokens/format";
import { ConnectionRow, type RelKey } from "./LineageDataModel";
import { SkeletonLine, SkeletonText, SkeletonCircle, SkeletonChip } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";
import { useResync } from "../actions/useResync";

/* KnowledgeInspector — the sticky right-rail describing the selected search
   result: title/source, editable tags, a two-tab view (Document summary vs.
   raw Inspector metadata), verified facts, related results, a revision
   timeline, and an "open in lineage" mini-graph. Slack ("thread chunk")
   documents suppress tags. Standalone with baked demo document. */

type Fact = { text: string };
type Related = { source: string; title: string };
type Revision = { at: string; actor: string; verb: string };
/** One lineage edge off this document, drawn with the shared lineage styling. */
type Link = { rel: RelKey; dir: "out" | "in"; title: string; source: string };

/** The inspected document. Exported so pages and fixtures compose it. */
export type KnowledgeDoc = {
  id: string;
  title: string;
  source: string;
  kind: string;
  owner: string;
  updated: string;
  slack?: boolean;
  messageCount?: number;
  summary: string;
  tags: string[];
  /** Verified facts extracted from THIS document. Optional, and the difference
      matters: `[]` means the document has been mined and nothing was found,
      which the rail says out loud; `undefined` means this workspace has no
      per-document fact source at all, and the rail then draws no Verified
      facts section rather than a permanently empty one (§2). */
  facts?: Fact[];
  related: Related[];
  timeline: Revision[];
  /** Lineage edges off this doc. Optional: callers that predate the preview
      fall back to a derived list built from `related`. */
  lineage?: Link[];
  /** Whether the signed-in person already watches this document. Optional:
      absent means unknown, and the rail opens the toggle in the off state
      rather than claiming a subscription nobody made. */
  watched?: boolean;
};

/** What the inspector can DO to the document it is describing. Optional: with
    no actions the watch toggle is local, which is what the canvas renders. */
export type KnowledgeInspectorActions = {
  /** Watch or unwatch this document. Resolves to the new watched state, which
      is the server's answer rather than the rail's guess. */
  toggleWatch?: (args: { id: string }) => Promise<boolean>;
  /** Add (`on: true`) or remove (`on: false`) one tag on this document.
      Resolves to the document's full tag list after the change — the same
      "server's answer, not the rail's guess" pattern as `toggleWatch`.
      Optional: with no action wired, the picker only ever changes its own
      local state, which is indistinguishable from tagging that silently
      does not save. */
  setTag?: (args: { id: string; tag: string; on: boolean }) => Promise<string[]>;
};

const REL_CYCLE: RelKey[] = ["derived", "references", "discussed"];

/* The document's own address: the library's Doc Review route (its `route` in
   pages/DocReviewPage.tsx) with the document in the query string. Same link
   the result title in KnowledgeBrowser carries, so both ways in agree. */
const docHref = (id: string) => `/knowledge/doc?id=${encodeURIComponent(id)}`;

type InsTab = "document" | "inspector";

/* Volume. The rail is 360px wide and sits beside a page: every list in it
   renders a page of rows, says honestly how many of how many that is (§13),
   and scrolls inside a bounded region past BOUND_AT rows (§20). */
const FACTS_PAGE = 6;
const RELATED_PAGE = 4;
const REVISIONS_PAGE = 3;
const BOUND_AT = 8;

/* The rail's three count strips were a hand-rolled sentence plus a bespoke
   "Show all"/"Show fewer" link (XA-08). Both come from one place now: the
   strip is <ResultCount>, the toggle is <ShowRest>, and §13 keeps them above
   the list they describe. Kept as a local adapter only because the rail says
   the same thing three times. */
function CountLine({
  shown, total, noun, expanded, onToggle,
}: { shown: number; total: number; noun: string; expanded?: boolean; onToggle?: () => void }) {
  if (total <= shown && !expanded) return null;
  return (
    <ResultCount
      className="mb-1.5"
      from={total === 0 ? 0 : 1}
      to={shown}
      total={total}
      noun={noun}
      actions={onToggle && (
        <ShowRest expanded={Boolean(expanded)} total={total} onToggle={onToggle} />
      )}
    />
  );
}

function BoundedList({ bounded, children }: { bounded: boolean; children: React.ReactNode }) {
  if (!bounded) return <>{children}</>;
  return <Scrollable axis="y" style={{ maxHeight: 260 }} scrollerClassName="pr-2">{children}</Scrollable>;
}

export type KnowledgeInspectorProps = {
  doc: KnowledgeDoc;
  loading?: boolean;
  actions?: KnowledgeInspectorActions;
  className?: string;
};

export function KnowledgeInspector({ doc, loading = false, actions, className = "" }: KnowledgeInspectorProps) {
  const navigate = useNavigate();
  const [insTab, setInsTab] = useState<InsTab>("document");
  const [tags, setTags] = useState<string[]>(doc.tags);
  // Both rail links used to be inert. They now drive real state: the history
  // link expands the full revision list, the lineage link opens the connection
  // preview inline (CONVENTIONS.md §2).
  const [fullHistory, setFullHistory] = useState(false);
  const [lineageOpen, setLineageOpen] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [allFacts, setAllFacts] = useState(false);
  const [allRelated, setAllRelated] = useState(false);
  /* "Watched" used to be the literal string "Yes" in the metadata table, which
     was true of no document in particular. It is a real subscription now. */
  const [watched, setWatched] = useState(doc.watched ?? false);
  const [watching, setWatching] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* Tags and the watch flag were copied out of `doc` once, at mount. Selecting
     a different document in the browser re-renders this inspector with a new
     `doc` and it kept showing the FIRST document's tags — attributing one
     document's labels to another (C1). Keyed on `doc.id` rather than on `doc`
     itself: a refetch of the same document must not silently discard a tag
     the reader has just picked but not yet saved, whereas moving to another
     document always has to reload. `web/src/data/knowledge.ts` returns
     `docQ.data` straight through, so `doc` is referentially stable anyway. */
  useResync(doc, (d) => { setTags(d.tags); setWatched(d.watched ?? false); }, { key: doc.id });

  const toggleWatch = async () => {
    if (watching) return;
    if (!actions?.toggleWatch) { setWatched((v) => !v); return; }
    setWatching(true);
    setFailed(null);
    try {
      setWatched(await actions.toggleWatch({ id: doc.id }));
    } catch (e) {
      setFailed(why(e, "That subscription could not be changed."));
    } finally {
      setWatching(false);
    }
  };

  const watchButton = (
    <Button compact disabled={watching} onClick={toggleWatch}>
      {watched ? <><EyeOff size={13} /> Unwatch</> : <><Eye size={13} /> Watch</>}
    </Button>
  );

  // TagPicker hands back the WHOLE next list; it only ever toggles one tag at
  // a time, so the changed tag is whichever entry differs from current state.
  const [tagsBusy, setTagsBusy] = useState(false);
  const changeTags = async (next: string[]) => {
    if (!actions?.setTag) { setTags(next); return; }
    const added = next.find((t) => !tags.includes(t));
    const removed = tags.find((t) => !next.includes(t));
    const tag = added ?? removed;
    if (!tag || tagsBusy) return;
    const prev = tags;
    setTags(next);
    setTagsBusy(true);
    setFailed(null);
    try {
      setTags(await actions.setTag({ id: doc.id, tag, on: Boolean(added) }));
    } catch (e) {
      setTags(prev);
      setFailed(why(e, "That tag could not be changed."));
    } finally {
      setTagsBusy(false);
    }
  };

  const facts = doc.facts;
  const factList = facts ? (allFacts ? facts : facts.slice(0, FACTS_PAGE)) : [];
  const relatedList = allRelated ? doc.related : doc.related.slice(0, RELATED_PAGE);
  const revisions = fullHistory ? doc.timeline : doc.timeline.slice(0, REVISIONS_PAGE);

  const lineage: Link[] = doc.lineage ?? doc.related.map((r, i) => ({
    rel: REL_CYCLE[i % REL_CYCLE.length],
    dir: i === 0 ? "in" : "out",
    title: r.title,
    source: r.source,
  }));

  if (loading) {
    return (
      <Card variant="flush" className={`sticky top-4 ${className}`.trim()}>
        <div className="flex gap-4 border-b border-ink/10 px-4 pb-2.5 pt-3" aria-hidden="true">
          <SkeletonLine w={70} h={11} /><SkeletonLine w={64} h={11} />
        </div>
        <div className="space-y-4 p-4" aria-hidden="true">
          <div className="flex items-start gap-2.5"><SkeletonCircle size={20} /><SkeletonLine w="75%" h={15} /></div>
          <div className="flex gap-2"><SkeletonChip w={72} /><SkeletonChip w={54} /></div>
          <div className="space-y-2"><SkeletonLine w="40%" h={9} /><SkeletonText lines={3} /></div>
          <div className="space-y-2"><SkeletonLine w="40%" h={9} /><SkeletonText lines={4} /></div>
          <div className="space-y-2"><SkeletonLine w="40%" h={9} /><SkeletonText lines={3} /></div>
        </div>
      </Card>
    );
  }

  const metaRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-ink/10 last:border-0">
      <SectionLabel>{label}</SectionLabel>
      <span className="text-[13px] text-ink/85 text-right min-w-0 break-words">{value}</span>
    </div>
  );

  return (
    <Card variant="flush" className={`sticky top-4 ${className}`.trim()}>
      <div className="px-4 pt-3 border-b border-ink/10">
        <Tabs
          ariaLabel="Inspector view"
          variant="underline"
          value={insTab}
          onChange={setInsTab}
          options={[{ id: "document", label: "Document" }, { id: "inspector", label: "Inspector" }]}
        />
      </div>

      <div className="p-4">
        {/* Title (order slot 4) */}
        <div className="flex items-start gap-2.5">
          <SourceMark provider={doc.source} size={20} />
          <h3 className="text-[15px] font-semibold text-ink leading-snug min-w-0 break-words">{doc.title}</h3>
        </div>

        {insTab === "inspector" ? (
          <div className="mt-4">
            {metaRow("ID", <code className="font-term text-[12px]">{doc.id}</code>)}
            {metaRow("Kind", doc.kind)}
            {metaRow("Source", doc.source)}
            {metaRow("Owner", doc.owner)}
            {metaRow("Updated", fmtDate(doc.updated))}
            {metaRow("Tags", tags.length ? tags.join(", ") : "")}
            {metaRow("Watched", watched ? "Yes" : "No")}
            <div className="mt-4 flex flex-col items-start gap-2">
              {watchButton}
              <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
              {/* XA-23: this said "Open document" with an ArrowRight at h-9
                  beside an h-7 Watch button. One component owns the label, the
                  ExternalLink glyph and the size now; `compact` matches its
                  sibling so the group keeps one height (§13). */}
              <OpenDocumentButton compact block href={docHref(doc.id)} onOpen={navigate ? () => navigate(docHref(doc.id)) : undefined} />
            </div>
          </div>
        ) : (
          /* Rail order is fixed by the client note and CONVENTIONS.md §1:
             summary → verified facts → related docs → source badge → status
             badge (tags) → owner → last updated → revision timeline. */
          <div className="mt-4 flex flex-col gap-5">
            {/* Summary (order slot 5) */}
            <p className="text-[13px] leading-relaxed text-ink/80">{doc.summary}</p>

            {/* Drawn only when the caller has a per-document fact source. A
                section that can never fill is a promise the rail cannot keep. */}
            {facts && (
              <CardSection label="Verified facts" count={facts.length}>
                {/* Honest count above the list it describes (§13): a well-mined
                    document carries dozens of facts, and the rail shows a page of
                    them instead of silently dropping the rest. */}
                <CountLine
                  shown={factList.length}
                  total={facts.length}
                  noun="facts"
                  expanded={allFacts}
                  onToggle={() => setAllFacts((v) => !v)}
                />
                <BoundedList bounded={factList.length > BOUND_AT}>
                  <ul className="flex min-w-0 flex-col gap-1.5">
                    {factList.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink/80">
                        <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-moss" />
                        <span className="min-w-0 break-words">{f.text}</span>
                      </li>
                    ))}
                    {facts.length === 0 && (
                      <li className="text-[12.5px] text-ink/70">No verified facts extracted from this document yet.</li>
                    )}
                  </ul>
                </BoundedList>
              </CardSection>
            )}

            <CardSection label="Related docs" count={doc.related.length}>
              <CountLine
                shown={relatedList.length}
                total={doc.related.length}
                noun="documents"
                expanded={allRelated}
                onToggle={() => setAllRelated((v) => !v)}
              />
              <BoundedList bounded={relatedList.length > BOUND_AT}>
                <ul className="flex min-w-0 flex-col gap-1.5">
                  {relatedList.map((r, i) => (
                    <li key={i} className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink/80">
                      <SourceMark provider={r.source} size={15} />
                      <span className="min-w-0 truncate hover:text-biscay-2 cursor-pointer" title={r.title}>{r.title}</span>
                    </li>
                  ))}
                  {doc.related.length === 0 && (
                    <li className="text-[12.5px] text-ink/70">Nothing links to this document yet.</li>
                  )}
                </ul>
              </BoundedList>
            </CardSection>

            {/* Source badge (slot 6) + status badge / tags (slot 7) */}
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                label={doc.source}
                tone="neutral"
                icon={<SourceMark provider={doc.source} size={13} />}
              />
              {doc.slack ? (
                <Chip label="Decision excerpt" tone="info" />
              ) : (
                <>
                  {tags.map((t) => <Pill key={t} kind={t} />)}
                  <TagPicker compact tags={tags} onChange={changeTags} onManage={() => undefined} />
                </>
              )}
            </div>
            {doc.slack && (
              <p className="-mt-3 text-[12px] text-ink/70">
                A decision excerpt is the passage of a thread where the call was made,
                {" "}{doc.messageCount ?? 18} messages long. Tags apply to the excerpt, not to single messages.
              </p>
            )}

            {/* Owner + last updated (slots 8 to 10) */}
            <div className="grid grid-cols-2 gap-2 rounded-[5px] border border-ink/12 p-3">
              <div><SectionLabel>Owner</SectionLabel><div className="text-[12.5px] text-ink/85 mt-0.5">{doc.owner}</div></div>
              <div><SectionLabel>Last updated</SectionLabel><div className="text-[12.5px] text-ink/85 mt-0.5">{fmtDate(doc.updated)}</div></div>
            </div>

            {/* Revision timeline, last */}
            <CardSection label="Revision timeline" count={doc.timeline.length}>
              <CountLine shown={revisions.length} total={doc.timeline.length} noun="revisions" />
              <BoundedList bounded={revisions.length > BOUND_AT}>
                <ul className="flex min-w-0 flex-col gap-2">
                  {revisions.map((r, i) => (
                    <li key={i} className="break-words text-[12px] text-ink/75">
                      {/* No date line at all when `at` is not a date: an empty
                          bold row left a gap that read as a missing entry. */}
                      {fmtDate(r.at) && <b className="font-term text-[11px] text-ink/65 block">{fmtDate(r.at)}</b>}
                      {r.verb}, {r.actor}
                    </li>
                  ))}
                  {doc.timeline.length === 0 && (
                    <li className="text-[12.5px] text-ink/70">No revisions recorded for this document.</li>
                  )}
                </ul>
              </BoundedList>

              {lineageOpen && (
                <div className="mt-3 rounded-[5px] border border-ink/12 bg-flysch/50 p-2.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h5 className="font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink/65">Lineage connections</h5>
                    <CountChip count={lineage.length} tone="info" />
                  </div>
                  {/* Same ConnectionRow / EdgeSwatch the lineage drawers use, so
                      the preview reads as one component family. */}
                  <BoundedList bounded={lineage.length > BOUND_AT}>
                  {lineage.map((l) => (
                    <ConnectionRow
                      key={l.title}
                      rel={l.rel}
                      dir={l.dir}
                      title={l.title}
                      subline={focused === l.title ? "Focused on the canvas" : l.source}
                      onSelect={() => setFocused((f) => (f === l.title ? null : l.title))}
                      onFocus={() => setFocused(l.title)}
                    />
                  ))}
                  </BoundedList>
                </div>
              )}

              {/* Repeated actions keep one location on every pane: Open in
                  lineage sits directly below View full history, with no
                  leading icon (CONVENTIONS.md §16). */}
              <div className="mt-2 flex flex-col items-start gap-1.5">
                {watchButton}
                <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
                <Button variant="link" onClick={() => setFullHistory((v) => !v)}>
                  {fullHistory ? "Show recent revisions" : `View full history (${doc.timeline.length})`} <ArrowRight size={12} />
                </Button>
                <Button variant="link" onClick={() => setLineageOpen((v) => !v)}>
                  {lineageOpen ? "Hide lineage" : "Open in lineage"} <ArrowRight size={12} />
                </Button>
              </div>
            </CardSection>
          </div>
        )}
      </div>
    </Card>
  );
}

export default KnowledgeInspector;
