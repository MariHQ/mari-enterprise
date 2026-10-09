import { useEffect, useMemo, useRef, useState } from "react";
import { docHref } from "../tokens/routes";
import { Eye, Target, Pin, Link2 } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { Button } from "../actions/Button";
import { CreateReviewTaskButton, ExportButton, OpenDocumentButton } from "../actions/RepeatedActions";
import { useWrite, why } from "../actions/useWrite";
import { useResync } from "../actions/useResync";
import { CardActions, CardBody, CardMeta, CardSection, CardTitleBlock } from "../layout/CardShell";
import { Tabs } from "../navigation/Tabs";
import { Pill } from "../data-display/Pill";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { SectionLabel } from "../forms/SectionLabel";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "../data-display/EmptyState";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { Truncate } from "../data-display/Truncate";
import { Timeline } from "../data-display/Timeline";
import { SkeletonCircle, SkeletonLine, SkeletonChip, SkeletonText, SkeletonList } from "../data-display/Skeleton";
import { fmtDate } from "../tokens/format";
import {
  REL, staleColor, NodeGlyph, LgDrawerShell, LgResultPanel, LG_DRAWER_W, lgToggleOn, ConnectionRow,
  LgSourceChip, LgNodeStatusChip, LgAuthor, LgOwners,
  nodeById, downloadText,
  type LNode, type LEdge, type DocHistoryRow,
} from "./LineageDataModel";

/* ─────────────────────────────────────────────────────────────────────────
   Lineage node drawer (feature: lineage-node-drawer)

   The document-node detail panel — a non-modal right drawer (no backdrop, no
   focus trap; the canvas stays live) with four tabs (Overview / Connections /
   History / Impact), a meta pill row, and a footer of node actions. Standalone
   with a baked-in demo document; renders open so it shows in the gallery.
   ──────────────────────────────────────────────────────────────────────── */

type Tab = "overview" | "connections" | "history" | "impact";

/** Connection rows drawn per page on the Connections tab. */
const CONN_PAGE = 20;
/** Reference rows previewed on Overview before the Connections tab takes over. */
const REF_PREVIEW = 4;
/** Tags shown before the rest collapse into a "+N more" chip. */
const TAG_PREVIEW = 8;

export type LineageNodeDrawerProps = {
  nodes: LNode[];
  edges: LEdge[];
  /** Which node to open. */
  nodeId: string;
  /** `nodeId`'s revision history, newest first. `null` = not loaded, which is
      not the same thing as "no revisions" and must not be drawn as one. The
      drawer also walks to other nodes, and their history is `onLoadHistory`'s
      job, not this prop's. */
  history: DocHistoryRow[] | null;
  /** Fetch one document's revision history. Without it the History tab says
      plainly that history has not been loaded, rather than showing an empty
      timeline that reads as "nothing ever happened to this document". */
  onLoadHistory?: (docId: number | string) => DocHistoryRow[] | Promise<DocHistoryRow[]>;
  /** Persist this node's current graph position. */
  onPin?: (args: { docId: number | string; x: number; y: number }) => void | Promise<void>;
  /** Let the auto-layout place this node again. */
  onUnpin?: (docId: number | string) => void | Promise<void>;
  /** Follow or unfollow the document. The server toggles; the button reflects
      what it returns nothing about, so the label follows local state. */
  onWatch?: (docId: number | string) => void | Promise<void>;
  /** Follow through to the document itself. */
  onOpenDocument?: (docId: number | string) => void;
  /** Make this node the graph's focal neighborhood. */
  onSetFocal?: (nodeId: string) => void;
  /** Whether this node is already the graph's focal node. */
  isFocal?: boolean;
  /** Open a review task on this document. */
  onCreateReviewTask?: (args: { title: string; assignee: string }) => void | Promise<void>;
  onClose?: () => void;
  /** Render a content-shaped skeleton silhouette instead of the drawer body. */
  loading?: boolean;
  className?: string;
};

export function LineageNodeDrawer({
  nodes, edges, nodeId, history, onLoadHistory, onPin, onUnpin, onWatch, onOpenDocument,
  onSetFocal, isFocal = false, onCreateReviewTask, onClose, loading = false, className = "",
}: LineageNodeDrawerProps) {
  const byId = useMemo(() => nodeById(nodes), [nodes]);
  const [openId, setOpenId] = useState(nodeId);
  /* C1: `openId` was seeded from `nodeId` at mount and never followed it, so
     selecting a DIFFERENT node on the canvas left the drawer describing the
     previously opened one. Identity mode is right here: `nodeId` is a string
     (`drawerFor` in web/src/data/lineage.ts hands over `node.id` off the URL),
     so `Object.is` compares its VALUE and cannot mis-fire on a rebuilt object.
     No `hold`: the drawer's local state is walk position and latches, not an
     unsaved edit, and a new node arriving means the reader asked for it. */
  useResync(nodeId, setOpenId);
  const [tab, setTab] = useState<Tab>("overview");
  const [watched, setWatched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [taskMade, setTaskMade] = useState(false);
  /** Tags past the preview cap need somewhere to go: a bare "+N more" span
      named a number the reader had no way of opening (§16, D6). */
  const [showAllTags, setShowAllTags] = useState(false);
  /* Pin / watch / create-task all go through one `write`: with no handler they
     are the local latches this drawer has always made, and with one they only
     latch once the server accepts (actions/useWrite.ts). */
  const write = useWrite();
  /** Inline result for the otherwise-inert trace/export buttons. */
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);

  /* Nullable, and every derivation below tolerates it. This used to be
     `byId[openId] ?? nodes[0]`, dereferenced immediately as `node.id` — above
     the `if (loading)` return — so an in-flight query, which by definition has
     no rows yet, threw a TypeError and blanked the drawer. `loading` with an
     empty graph is the normal first render, not an edge case. */
  const node: LNode | null = byId[openId] ?? nodes[0] ?? null;

  /* Revision history for whichever node is open. `rows === null` means nobody
     has told us, and the tab says so; an empty array is a real answer. The
     page used to hand `history: []` to every node it did not have history for,
     so opening any node showed a timeline that was permanently, silently
     empty. */
  const [histRows, setHistRows] = useState<DocHistoryRow[] | null>(openId === nodeId ? history : null);
  const [histBusy, setHistBusy] = useState(false);
  const [histErr, setHistErr] = useState<string | null>(null);

  /* Held in a ref, not a dependency: a page that rebuilds its `actions` object
     each render would otherwise re-fetch on every render, forever. */
  const loadRef = useRef(onLoadHistory);
  loadRef.current = onLoadHistory;
  const openDocId = byId[openId]?.docId ?? null;

  useEffect(() => {
    if (openId === nodeId) { setHistRows(history); setHistErr(null); return; }
    const load = loadRef.current;
    if (!load || openDocId == null) { setHistRows(null); setHistErr(null); return; }
    let live = true;
    setHistBusy(true);
    setHistErr(null);
    void (async () => {
      try {
        const next = await load(openDocId);
        if (live) setHistRows(next);
      } catch (err) {
        if (live) setHistErr(why(err, "That history could not be loaded."));
      } finally {
        if (live) setHistBusy(false);
      }
    })();
    return () => { live = false; };
  }, [openId, nodeId, history, openDocId]);

  const connections = useMemo(() => {
    const rows: { rel: keyof typeof REL; dir: "out" | "in"; other: LNode; edge: LEdge }[] = [];
    if (!node) return rows;
    for (const e of edges) {
      if (e.from === node.id && byId[e.to]) rows.push({ rel: e.rel, dir: "out", other: byId[e.to], edge: e });
      if (e.to === node.id && byId[e.from]) rows.push({ rel: e.rel, dir: "in", other: byId[e.from], edge: e });
    }
    return rows;
  }, [edges, node?.id, byId]);

  const [connPage, setConnPage] = useState(1);
  const shownConnections = connections.slice(0, CONN_PAGE * connPage);
  const hiddenConnections = connections.length - shownConnections.length;

  const downstream = connections.filter((c) => c.dir === "out").length;
  const upstream = connections.filter((c) => c.dir === "in").length;
  const showReferences = !!node && ["pr", "issue", "commit"].includes(node.docKind);
  const references = connections.filter((c) => c.rel === "references");

  /* Owners block: the document owner plus whoever last approved it. Derived,
     never invented — an unowned document says so. */
  const owners = useMemo(() => {
    const out: { name: string; role: string }[] = [];
    if (!node) return out;
    if (node.owner) out.push({ name: node.owner, role: "Owner" });
    const approver = histRows?.find((h) => h.verb === "reviewed")?.actor;
    if (approver && approver !== node.owner) out.push({ name: approver, role: "Approver" });
    return out;
  }, [node?.owner, histRows]);

  const metaParts = node ? node.meta.split("·").map((s) => s.trim()).filter(Boolean) : [];

  const copyLink = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };

  /* Each footer control latches once the write lands, and says what the server
     said when it does not (§8). With no handler wired the latch is the whole
     behaviour, which is what the design canvas renders. This used to be a
     bespoke settle/revert copy of `useWrite` living in this one file. */
  const togglePin = () => {
    if (!node) return;
    const next = !pinned;
    void write.run(
      node.docId == null
        ? undefined
        : next
          ? onPin && (() => onPin({ docId: node.docId as number, x: node.x, y: node.y }))
          : onUnpin && (() => onUnpin(node.docId as number)),
      () => setPinned(next),
    );
  };

  const toggleWatch = () => {
    if (!node) return;
    const next = !watched;
    void write.run(
      node.docId != null && onWatch ? () => onWatch(node.docId as number) : undefined,
      () => setWatched(next),
    );
  };

  const createTask = () => {
    if (!node) return;
    void write.run(
      // Assignee is the document's owner, or empty for the server to route:
      // this used to fall back to a person's name that was simply made up.
      onCreateReviewTask
        ? () => onCreateReviewTask({ title: `Review: ${node.title}`, assignee: node.owner ?? "" })
        : undefined,
      () => setTaskMade(true),
    );
  };

  if (loading) {
    return (
      <LgDrawerShell
        className={className}
        onClose={onClose}
        icon={<SkeletonCircle size={19} />}
        title={<SkeletonLine w="70%" h={14} />}
        pills={<><SkeletonChip w={72} /><SkeletonChip w={56} /></>}
      >
        <div className="mb-3"><SkeletonLine w="55%" h={12} /></div>
        <SkeletonText lines={4} />
        <div className="mt-4"><SkeletonList rows={4} /></div>
      </LgDrawerShell>
    );
  }

  /* Loaded, but the graph has no node to show: say so rather than render a
     drawer describing nothing. */
  if (!node) {
    return (
      <LgDrawerShell className={className} onClose={onClose} width={LG_DRAWER_W} title="Document" icon={<FileQuestion size={19} />}>
        <EmptyState title="No node selected">
          This graph has no nodes to inspect. Connect a source to build the lineage graph.
        </EmptyState>
      </LgDrawerShell>
    );
  }

  return (
    <LgDrawerShell
      className={className}
      onClose={onClose}
      width={LG_DRAWER_W}
      icon={<NodeGlyph node={node} size={19} />}
      title="Document"
      summary="One node in the lineage graph."
      footer={
        <div className="flex w-full flex-col gap-2">
          {/* Secondary controls first; each latches visibly when it is on. */}
          <div className="flex flex-wrap gap-2">
            <Button
              compact
              onClick={() => onSetFocal?.(node.id)}
              className={isFocal ? lgToggleOn : ""}
            >
              <Target size={13} /> {isFocal ? "Focal" : "Set focal"}
            </Button>
            <Button compact disabled={write.busy} onClick={togglePin} className={pinned ? lgToggleOn : ""}>
              <Pin size={13} /> {pinned ? "Pinned" : "Pin"}
            </Button>
            <Button compact onClick={copyLink} className={copied ? lgToggleOn : ""}>
              <Link2 size={13} /> {copied ? "Copied" : "Copy link"}
            </Button>
            <Button compact disabled={write.busy} onClick={toggleWatch} className={watched ? lgToggleOn : ""}>
              <Eye size={13} /> {watched ? "Watching" : "Watch"}
            </Button>
          </div>
          {/* A refused pin, watch or task is a failed WRITE, with no input to
              point at, so it gets the banner and not a field caption (§8). */}
          <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
          {/* CONVENTIONS §2: primary bottom LEFT, secondary to its right, both
              at the same height (§13). */}
          <CardActions
            primary={
              <CreateReviewTaskButton
                state={taskMade ? "done" : write.busy ? "busy" : "idle"}
                onClick={createTask}
              />
            }
            secondary={node.docId != null ? (
              <OpenDocumentButton
                href={docHref(node.docId)}
                onOpen={onOpenDocument && (() => onOpenDocument(node.docId as number))}
              />
            ) : undefined}
          />
        </div>
      }
    >
      <div className="mb-3">
        <Tabs
          ariaLabel="Node detail tabs"
          variant="underline"
          value={tab}
          onChange={setTab}
          options={[
            { id: "overview", label: "Overview" },
            { id: "connections", label: "Connections", count: connections.length },
            { id: "history", label: "History" },
            { id: "impact", label: "Impact" },
          ]}
        />
      </div>

      {tab === "overview" && (
        /* CONVENTIONS §1: title, summary, source + status left with date and
           author right on one line, then References, Connections, Owners. */
        <CardBody>
          <CardTitleBlock
            className="[overflow-wrap:anywhere]"
            title={node.title}
            summary={metaParts.join(" · ")}
          />
          <CardMeta
            source={<LgSourceChip source={node.source} />}
            status={<LgNodeStatusChip node={node} />}
            date={node.date ? fmtDate(node.date) : "No date recorded"}
            author={<LgAuthor name={node.owner} />}
          />

          {node.tags && node.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(showAllTags ? node.tags : node.tags.slice(0, TAG_PREVIEW)).map((t) => <Pill key={t} kind="canonical" text={t} tone="neutral" />)}
              {node.tags.length > TAG_PREVIEW && (
                <ShowRest expanded={showAllTags} total={node.tags.length} onToggle={() => setShowAllTags((v) => !v)} />
              )}
            </div>
          )}

          {!!node.parameters?.length && (
            <CardSection label="Properties">
              <dl className="flex min-w-0 flex-col gap-2">
                {node.parameters.map(parameter => (
                  <div key={parameter.name} className="grid min-w-0 grid-cols-2 gap-3">
                    <dt className="min-w-0 text-[12px] text-ink/70"><Truncate>{parameter.name}</Truncate></dt>
                    <dd className="min-w-0 font-term text-[11px] text-ink" title={parameter.type}><Truncate>{parameter.value}</Truncate></dd>
                  </div>
                ))}
              </dl>
            </CardSection>
          )}

          {showReferences && (
            <CardSection
              label="References"
              count={references.length}
              action={references.length > REF_PREVIEW
                ? <button type="button" onClick={() => setTab("connections")} className={`font-term text-[11px] text-biscay-2 hover:underline ${focusRing}`}>See in Connections</button>
                : undefined}
            >
              {references.length === 0 ? (
                <p className="text-[12.5px] text-ink/70">No extracted references yet.</p>
              ) : references.slice(0, REF_PREVIEW).map((c, i) => (
                <ConnectionRow
                  key={i}
                  rel={c.rel}
                  dir={c.dir}
                  dashed={c.edge.dashed}
                  title={c.other.title}
                  subline={c.edge.meta?.evidence}
                  onSelect={() => setOpenId(c.other.id)}
                  onFocus={() => setOpenId(c.other.id)}
                />
              ))}
            </CardSection>
          )}

          <CardSection
            label="Connections"
            count={connections.length}
            action={connections.length > 3
              ? <button type="button" onClick={() => setTab("connections")} className={`font-term text-[11px] text-biscay-2 hover:underline ${focusRing}`}>See in Connections</button>
              : undefined}
          >
            {connections.length === 0 ? (
              <p className="text-[12.5px] text-ink/70">No links recorded for this document.</p>
            ) : connections.slice(0, 3).map((c, i) => (
              <ConnectionRow
                key={i}
                rel={c.rel}
                dir={c.dir}
                dashed={c.edge.dashed}
                title={c.other.title}
                subline={c.dir === "out" ? REL[c.rel].out : REL[c.rel].in}
                onSelect={() => setOpenId(c.other.id)}
              />
            ))}
          </CardSection>

          <CardSection label="Owners">
            <LgOwners owners={owners} />
          </CardSection>

          {/* No "Verified facts" section: the one that stood here printed a
              hardcoded claim about free-tier limits on every document in every
              workspace. Nothing in the lineage graph carries facts, so there
              is nothing honest to render until something does. */}

          <CardSection label="Staleness">
            <span className="inline-flex items-center gap-2 text-[13px] text-ink">
              <span className="h-3 w-[3px] rounded-[1px]" style={{ backgroundColor: staleColor(node.staleDays ?? 0) }} aria-hidden />
              {node.staleDays ?? 0} days since the last update
            </span>
          </CardSection>
        </CardBody>
      )}

      {tab === "connections" && (
        <div>
          {connections.length === 0 ? (
            <EmptyState title="No links">No links recorded for this node.</EmptyState>
          ) : (
            <>
            {/* The count strip belongs above the rows it counts (§13); it used
                to sit under them, in its own spelling of the sentence. */}
            <ResultCount
              from={1}
              to={shownConnections.length}
              total={connections.length}
              noun="links"
              className="mb-2 rounded-[4px] border border-ink/10"
            />
            {shownConnections.map((c, i) => (
              <div key={i}>
                {(i === 0 || shownConnections[i - 1].rel !== c.rel || shownConnections[i - 1].dir !== c.dir) && (
                  <div className="mb-1 mt-3 flex items-center gap-2 first:mt-0">
                    <SectionLabel>{c.dir === "out" ? REL[c.rel].out : REL[c.rel].in}</SectionLabel>
                    <span className="font-term text-[11px] text-ink/65">
                      {connections.filter((x) => x.rel === c.rel && x.dir === c.dir).length}
                    </span>
                  </div>
                )}
                <ConnectionRow
                  rel={c.rel}
                  dir={c.dir}
                  dashed={c.edge.dashed}
                  title={c.other.title}
                  subline={c.edge.meta?.note ?? c.edge.meta?.evidence}
                  onSelect={() => setOpenId(c.other.id)}
                  onFocus={() => setOpenId(c.other.id)}
                />
              </div>
            ))}
            </>
          )}
          {/* A well-connected node has hundreds of links. Page them rather than
              paying for hundreds of rows and an endless drawer scroll. */}
          {hiddenConnections > 0 && (
            <div className="mt-3 border-t border-ink/10 pt-3">
              <Button compact onClick={() => setConnPage((p) => p + 1)}>
                Show {Math.min(hiddenConnections, CONN_PAGE)} more
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        histBusy ? (
          <SkeletonList rows={4} />
        ) : histErr ? (
          /* A history that did not come back is a failed READ, so it gets the
             same surface every other failed read gets, not a field caption. */
          <ReadError>{histErr}</ReadError>
        ) : histRows === null ? (
          /* Not loaded is not the same as nothing happened, and saying the
             wrong one of those is a claim about the document. */
          <EmptyState title="History not loaded">
            This graph does not carry revisions for {node.title}. Open the document to read its full history.
          </EmptyState>
        ) : histRows.length === 0 ? (
          <EmptyState title="No revisions recorded">
            Nothing has been recorded against this document since it was indexed.
          </EmptyState>
        ) : (
          <Timeline
            items={histRows.map((h) => ({
              title: <span><span className="font-semibold text-ink">{h.actor}</span> {h.verb}</span>,
              description: h.detail,
              time: fmtDate(h.at),
              tone: "neutral" as const,
            }))}
          />
        )
      )}

      {tab === "impact" && (
        <div>
          <SectionLabel>Closure</SectionLabel>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <div className="rounded-[4px] border border-ink/12 p-2.5">
              <div className="text-[20px] font-bold text-ink">{downstream}</div>
              <div className="font-term text-[11px] text-ink/65">Downstream, depends on this</div>
            </div>
            <div className="rounded-[4px] border border-ink/12 p-2.5">
              <div className="text-[20px] font-bold text-ink">{upstream}</div>
              <div className="font-term text-[11px] text-ink/65">Upstream, this rests on</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              compact
              disabled={downstream === 0}
              className={result?.title.startsWith("Impact") ? lgToggleOn : ""}
              onClick={() => setResult({
                title: `Impact traced: ${downstream} downstream documents`,
                body: connections.filter((c) => c.dir === "out").map((c) => c.other.title).join(", "),
              })}
            >
              Trace impact
            </Button>
            <Button
              compact
              disabled={upstream === 0}
              className={result?.title.startsWith("Provenance") ? lgToggleOn : ""}
              onClick={() => setResult({
                title: `Provenance traced: ${upstream} upstream documents`,
                body: connections.filter((c) => c.dir === "in").map((c) => c.other.title).join(", "),
              })}
            >
              Trace provenance
            </Button>
            {/* <Plus> read as "add something"; this writes a file out (§16). */}
            <ExportButton
              compact
              format="CSV"
              state={result?.title.startsWith("Exported") ? "done" : "idle"}
              disabled={downstream + upstream === 0}
              className={result?.title.startsWith("Exported") ? lgToggleOn : ""}
              /* The file is actually written now. It used to announce a CSV
                 that was "ready to download" and never produce one. */
              onClick={() => {
                const name = `${node.title.replace(/[^\w.-]+/g, "-").slice(0, 60)}-closure.csv`;
                const csv = [
                  "relation,direction,document,owner",
                  ...connections.map((c) => [REL[c.rel].code, c.dir, c.other.title, c.other.owner ?? ""]
                    .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
                ].join("\n");
                downloadText(name, csv, "text/csv");
                setResult({ title: `Exported ${connections.length} rows`, body: `Downloaded as ${name}.` });
              }}
            />
          </div>
          {result ? (
            <div className="mt-3">
              <LgResultPanel title={result.title}>{result.body}</LgResultPanel>
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-ink/70">
              Tracing highlights the closure on the canvas and lists it here.
            </p>
          )}
        </div>
      )}
    </LgDrawerShell>
  );
}
