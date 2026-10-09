import { useEffect, useState } from "react";
import { Eye, Share2 } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor } from "./PageFrame";
import { DocReviewOutlinePanel, type DocRevision } from "../features/DocReviewOutlinePanel";
import { DocReviewFindingsPanel, type DocClaim, type DocFinding, type FindingsActions } from "../features/DocReviewFindingsPanel";
import type { EditorFinding } from "../features/DocReviewEditor";
import type { DocChange } from "../features/DocReviewChangeQueue";
import { MarkdownView } from "../data-display/MarkdownView";
import { PageHeader, Card, Button, EmptyState, TagChip } from "../index";
import { SkeletonPage } from "../data-display/Skeletons";
import { Truncate } from "../data-display/Truncate";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite } from "../actions/useWrite";

/* Synced documents are evidence, not a second authoring system. This page is
   deliberately read-only: edits belong in the source system and arrive on the
   next connector poll. Mari owns review findings, watches, and review tasks. */

const STATES = [
  { id: "default", label: "Default" },
  { id: "outline", label: "Outline + revisions" },
  { id: "findings", label: "Fact check · findings" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Empty document" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

export type ReviewDoc = {
  outlineBody: string;
  revisions: DocRevision[];
  editorBody: string;
  editorFindings: EditorFinding[];
  findings: DocFinding[];
  claims: DocClaim[];
  /* Compatibility-only ingestion output. Proposed source changes are reviewed
     in the unified Review queue; they are never applied from this page. */
  refine: { errorN: number; warnN: number; advisoryN: number };
  changes: DocChange[];
  changeBody: string;
};

/** Deprecated compatibility type. Document detail never enters a save state. */
export type SaveState = "saved" | "dirty" | "saving" | "applied" | "offline-dirty";
export type ReviewPane = "workspace" | "outline" | "editor" | "changes" | "findings" | "refine";

export type DocReviewActions = FindingsActions & {
  saveRecord?: (record: { title: string; text: string; kind: string; properties: Record<string, unknown>; revision?: string }) => Promise<void>;
  retractRecord?: () => Promise<void>;
  toggleWatch?: () => Promise<boolean>;
  share?: () => void | Promise<void>;
  openLibrary?: () => void;
};

export type DocReviewData = {
  editable?: boolean;
  recordKey?: string;
  recordKind?: string;
  recordProperties?: Record<string, unknown>;
  revision?: string;
  pending?: boolean;
  title: string;
  subtitle: string;
  /** @deprecated retained so older adapters remain source-compatible. */
  save: SaveState;
  pane: ReviewPane;
  doc: ReviewDoc;
  tags?: string[];
  watched?: boolean;
  /** @deprecated findings are the only review surface on document detail. */
  bottomTab?: "changes" | "findings";
};

function isEmpty(data: DocReviewData): boolean {
  return !data.doc.editorBody && !data.doc.outlineBody && !data.doc.revisions.length
    && !data.doc.findings.length && !data.doc.claims.length;
}

function Body({ data, error, actions, mobile }: {
  data: DocReviewData; error: string | null; actions?: DocReviewActions; mobile: boolean;
}) {
  if (error) return <Card><ReadError>{error}</ReadError></Card>;
  if (isEmpty(data) && !data.editable) {
    return <Card><EmptyState title="Empty document">The source contains no readable content yet.</EmptyState></Card>;
  }
  if (data.pane === "outline") {
    return <DocReviewOutlinePanel body={data.doc.outlineBody} revisions={data.doc.revisions} />;
  }
  if (data.pane === "findings") {
    return <DocReviewFindingsPanel findings={data.doc.findings} claims={data.doc.claims} actions={actions} />;
  }
  return (
    <div className={mobile ? "flex flex-col gap-5" : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"}>
      {data.editable && actions?.saveRecord ? <RecordEditor key={data.recordKey} data={data} actions={actions} /> : <Card title="Source content" className="min-w-0">
        <MarkdownView>{data.doc.editorBody || data.doc.outlineBody}</MarkdownView>
      </Card>}
      <div className="flex min-w-0 flex-col gap-5">
        <DocReviewOutlinePanel body={data.doc.outlineBody} revisions={data.doc.revisions} />
        <DocReviewFindingsPanel findings={data.doc.findings} claims={data.doc.claims} actions={actions} />
      </div>
    </div>
  );
}

function RecordEditor({ data, actions }: { data: DocReviewData; actions: DocReviewActions }) {
  const [title, setTitle] = useState(data.title);
  const [text, setText] = useState(data.doc.editorBody);
  const [kind, setKind] = useState(data.recordKind || 'document');
  const [properties, setProperties] = useState(JSON.stringify(data.recordProperties || {}, null, 2));
  const [revision, setRevision] = useState(data.revision);
  const [queued, setQueued] = useState(false);
  useEffect(() => { if (queued && !data.pending && data.revision !== revision) { setQueued(false); setRevision(data.revision); } }, [queued, data.pending, data.revision, revision]);
  const [busy, setBusy] = useState(false);
  const write = useWrite();
  return <Card title="Knowledge content">
    <div className="flex flex-col gap-4">
      <label className="text-sm">Title<input aria-label="Record title" className="mt-2 w-full rounded border border-ink/20 bg-paper p-3" value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="text-sm">Content<textarea aria-label="Record content" className="mt-2 min-h-[360px] w-full rounded border border-ink/20 bg-paper p-3 font-mono" value={text} onChange={event => setText(event.target.value)} /></label>
      <details><summary className="cursor-pointer text-sm">Record type and properties</summary>
        <label className="mt-3 block text-sm">Type<input aria-label="Record type" className="mt-2 w-full rounded border border-ink/20 p-3" value={kind} onChange={event => setKind(event.target.value)} /></label>
        <label className="mt-3 block text-sm">Properties (JSON)<textarea aria-label="Record properties" className="mt-2 min-h-[150px] w-full rounded border border-ink/20 p-3 font-mono" value={properties} onChange={event => setProperties(event.target.value)} /></label>
      </details>
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      {(queued || data.pending) && <p role="status" className="text-sm text-ink/70">Change accepted. Waiting for the knowledge store to apply it.</p>}
      <div className="flex gap-3">
        <Button disabled={busy || queued || data.pending} onClick={async () => { setBusy(true); try { const parsed = JSON.parse(properties); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Properties must be a JSON object"); await actions.saveRecord?.({title,text,kind,properties:parsed,revision}); setQueued(true); } catch(error) { write.setFailed(error instanceof Error ? error.message : 'Could not save'); } finally { setBusy(false); } }}>Save changes</Button>
        {data.recordKey !== 'new' && actions.retractRecord && <Button disabled={busy} onClick={async () => { setBusy(true); try { await actions.retractRecord?.(); } catch(error) { write.setFailed(error instanceof Error ? error.message : 'Could not retract'); } finally { setBusy(false); } }}>Retract record</Button>}
      </div>
    </div>
  </Card>;
}

function DocReviewPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<DocReviewData, DocReviewActions>) {
  const [watch, setWatch] = useState<boolean | null>(null);
  const write = useWrite();
  const watched = watch ?? data.watched;
  const onWatch = async () => {
    if (!actions?.toggleWatch) { setWatch((v) => !(v ?? data.watched ?? false)); return; }
    const next = await write.runFor(actions.toggleWatch);
    if (next !== undefined) setWatch(next);
  };
  const headerActions = (
    <>
      {(data.tags ?? []).map((tag) => <TagChip key={tag} tag={tag} />)}
      {watched !== undefined && <Button compact variant="default" onClick={onWatch}><Eye size={15} /> {watched ? "Watching" : "Watch"}</Button>}
      {actions?.share && <Button compact variant="default" onClick={actions.share}><Share2 size={15} /> Share</Button>}
    </>
  );
  return (
    <PageFrame chrome={chrome} active={navFor("doc-review")} title="Document detail" mobile={mobile}>
      {loading ? <SkeletonPage variant="detail" label="Document detail" rail={["Document outline", "Revision history", "Fact check"]} mobile={mobile} /> : (
        <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
          <PageHeader title={data.title} backLink={{ href: "/knowledge", label: "Knowledge" }} actions={mobile ? undefined : headerActions} />
          <Truncate className="mt-1 max-w-[680px] text-[13px] text-ink/70">{data.subtitle}</Truncate>
          <p className="mt-2 text-[12.5px] text-ink/70">{data.editable ? "Edits and retractions update the knowledge store; connected sources are unchanged." : "Read-only source record · make content changes in the connected source."}</p>
          {mobile && <div className="mt-4 flex flex-wrap items-center gap-2">{headerActions}</div>}
          <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
          <div className="mt-6"><Body data={data} error={error} actions={actions} mobile={mobile} /></div>
        </div>
      )}
    </PageFrame>
  );
}

export const page: PageModule<DocReviewData, DocReviewActions> = {
  id: "doc-review",
  title: "Document detail",
  route: "/knowledge/doc",
  component: DocReviewPage,
  states: STATES.map((state) => ({ ...state })),
};
