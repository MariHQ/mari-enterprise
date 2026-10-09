import { useMemo, useState } from "react";
import { docHref } from "../tokens/routes";
import { Unlink } from "lucide-react";
import { EmptyState } from "../data-display/EmptyState";
import { CreateReviewTaskButton, ExportButton, OpenDocumentButton } from "../actions/RepeatedActions";
import { useResync } from "../actions/useResync";
import { CardActions, CardBody, CardMeta, CardSection, CardTitleBlock } from "../layout/CardShell";
import { Chip } from "../data-display/Chip";
import { fmtDate } from "../tokens/format";
import { GithubMark } from "../icons";
import { SkeletonCircle, SkeletonLine, SkeletonChip, SkeletonText, SkeletonList } from "../data-display/Skeleton";
import {
  REL, EdgeSwatch, LgDrawerShell, LgResultPanel, LG_DRAWER_W, lgToggleOn, ConnectionRow,
  LgAuthor, LgOwners, LgSourceChip,
  nodeById, downloadText,
  type LNode, type LEdge,
} from "./LineageDataModel";

/* ─────────────────────────────────────────────────────────────────────────
   Lineage edge drawer (feature: lineage-edge-drawer)

   The relationship (edge) detail panel — the same non-modal `.lg-drawer` shell
   as the node drawer, in an "edge flavor." Opens when a passthrough (non-
   aggregated) edge is tapped. Describes one typed link between two documents,
   its provenance status, evidence, and both endpoints (each jumps to the node
   drawer).

   Built from the same CardShell primitives as the other three drawers, in the
   same order (CONVENTIONS §1): title, summary, source + status left with date
   and author right, then Endpoints, then Owners, then the actions.
   ──────────────────────────────────────────────────────────────────────── */

export type LineageEdgeDrawerProps = {
  nodes: LNode[];
  edges: LEdge[];
  /** Which edge to open. */
  edgeId: string;
  onSelectNode?: (id: string) => void;
  /** Follow through to a document this edge connects. */
  onOpenDocument?: (docId: number | string) => void;
  onClose?: () => void;
  /** Render a content-shaped skeleton silhouette instead of the drawer body. */
  loading?: boolean;
  className?: string;
};

export function LineageEdgeDrawer({
  nodes, edges, edgeId, onSelectNode, onOpenDocument, onClose, loading = false, className = "",
}: LineageEdgeDrawerProps) {
  const byId = useMemo(() => nodeById(nodes), [nodes]);
  const [openId, setOpenId] = useState(edgeId);
  /* C1: this was `const [openId] = useState(edgeId)` — seeded once, with no
     setter at all — so tapping a different edge kept the first one on screen.
     Identity mode: `edgeId` is a string (`drawerFor` in web/src/data/lineage.ts
     passes `edge.id`, itself `String(e.id)`), so `Object.is` compares its value
     and the sentinel fires exactly when the reader picks another edge. No
     `hold`: this drawer holds no unsaved edit, only an export latch. */
  useResync(edgeId, setOpenId);
  const [taskMade, setTaskMade] = useState(false);
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);

  /* Nullable: `edges[0]` is undefined while a query is in flight, and this was
     dereferenced as `edge.from` ABOVE the `if (loading)` return, so the normal
     first render of an empty graph threw and blanked the drawer. */
  const edge: LEdge | null = edges.find((e) => e.id === openId) ?? edges[0] ?? null;
  const from = edge ? byId[edge.from] : undefined;
  const to = edge ? byId[edge.to] : undefined;
  const fromDocId = from?.docId ?? null;
  const s = edge ? REL[edge.rel] : null;
  const confirmed = edge?.meta?.status === "confirmed";
  const statusLabel = confirmed ? "Confirmed" : edge?.llm ? "Derived by Mari" : "Observed";

  const owners = useMemo(() => {
    const rows: { name: string; role: string }[] = [];
    if (from?.owner) rows.push({ name: from.owner, role: "Source owner" });
    if (to?.owner && to.owner !== from?.owner) rows.push({ name: to.owner, role: "Target owner" });
    if (edge?.llm) rows.push({ name: "Mari", role: "Derived by" });
    return rows;
  }, [from?.owner, to?.owner, edge?.llm]);

  if (loading) {
    return (
      <LgDrawerShell
        className={className}
        onClose={onClose}
        icon={<SkeletonCircle size={19} />}
        title={<SkeletonLine w="75%" h={14} />}
        pills={<><SkeletonChip w={80} /><SkeletonChip w={64} /></>}
      >
        <div className="mb-3"><SkeletonLine w="40%" h={12} /></div>
        <SkeletonText lines={3} />
        <div className="mt-4"><SkeletonList rows={2} /></div>
      </LgDrawerShell>
    );
  }

  /* Loaded, but there is no relationship to describe. */
  if (!edge || !s) {
    return (
      <LgDrawerShell className={className} onClose={onClose} width={LG_DRAWER_W} title="Relationship" icon={<Unlink size={19} />}>
        <EmptyState title="No relationship selected">
          This graph has no links yet. Relationships appear once Mari connects documents across your sources.
        </EmptyState>
      </LgDrawerShell>
    );
  }

  return (
    <LgDrawerShell
      className={className}
      onClose={onClose}
      width={LG_DRAWER_W}
      icon={<EdgeSwatch rel={edge.rel} width={24} dashed={edge.dashed} />}
      title="Relationship"
      summary="One typed link between two documents."
      footer={
        <div className="flex w-full flex-col gap-2">
          {/* CONVENTIONS §2: primary bottom LEFT, secondary to its right. */}
          <CardActions
            className="pt-0"
            primary={<CreateReviewTaskButton compact state={taskMade ? "done" : "idle"} onClick={() => setTaskMade(true)} />}
            secondary={
              <>
                {/* An edge joins two documents, so "the" document is ambiguous:
                    this opens the SOURCE end, which is the one the relationship
                    is stated about. Hidden when that node carries no document
                    id, rather than linking to "#". Compact like the primary
                    beside it, so the group is one height (§13). */}
                {fromDocId != null && (
                  <OpenDocumentButton
                    compact
                    href={docHref(fromDocId)}
                    onOpen={onOpenDocument && (() => onOpenDocument(fromDocId))}
                  />
                )}
                <ExportButton
                  compact
                  format="CSV"
                  state={result ? "done" : "idle"}
                  className={result ? lgToggleOn : ""}
                  /* The file is written now. The button used to announce a CSV
                     that was "ready to download" and never produce one. */
                  onClick={() => {
                    const name = `${s.code.toLowerCase()}-${edge.id}.csv`;
                    const csv = [
                      "relation,from,to,date,status",
                      [s.code, from?.title ?? edge.from, to?.title ?? edge.to, edge.date ?? "", statusLabel]
                        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
                    ].join("\n");
                    downloadText(name, csv, "text/csv");
                    setResult({ title: "Exported 1 relationship", body: `Downloaded as ${name}.` });
                  }}
                />
              </>
            }
          />
        </div>
      }
    >
      <CardBody>
        <CardTitleBlock
          className="[overflow-wrap:anywhere]"
          title={
            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
              <span>{from?.title}</span>
              <span className="text-ink/65" aria-label="to">→</span>
              <span>{to?.title}</span>
            </span>
          }
          summary={edge.meta?.note ?? `${from?.title ?? "Source"} ${s.out.toLowerCase()} ${to?.title ?? "target"}.`}
        />
        <CardMeta
          source={<Chip label={s.label} tone="neutral" icon={<EdgeSwatch rel={edge.rel} width={16} dashed={edge.dashed} />} />}
          status={<Chip label={statusLabel} tone={confirmed ? "ok" : edge.llm ? "info" : "neutral"} dot />}
          date={edge.date ? fmtDate(edge.date) : "No date recorded"}
          author={<LgAuthor name={edge.llm ? "Mari" : from?.owner} />}
        />

        {edge.meta?.evidence && (
          <CardSection label="Evidence">
            <span className="flex items-start gap-1.5 [overflow-wrap:anywhere]">
              <span className="mt-0.5 shrink-0 text-ink/70"><GithubMark size={14} /></span>
              <span className="min-w-0 font-term text-[12px] text-ink/85">{edge.meta.evidence}</span>
            </span>
          </CardSection>
        )}

        <CardSection label="Endpoints" count={2}>
          {from && (
            <ConnectionRow
              rel={edge.rel}
              dir="out"
              dashed={edge.dashed}
              title={from.title}
              subline={`${s.out} · ${from.owner ?? "Unowned"}`}
              onSelect={() => onSelectNode?.(from.id)}
            />
          )}
          {to && (
            <ConnectionRow
              rel={edge.rel}
              dir="in"
              dashed={edge.dashed}
              title={to.title}
              subline={`${s.in} · ${to.owner ?? "Unowned"}`}
              onSelect={() => onSelectNode?.(to.id)}
            />
          )}
        </CardSection>

        <CardSection label="Sources">
          <div className="flex flex-wrap gap-1.5">
            {from && <LgSourceChip source={from.source} />}
            {to && to.source !== from?.source && <LgSourceChip source={to.source} />}
          </div>
        </CardSection>

        <CardSection label="Owners">
          <LgOwners owners={owners} />
        </CardSection>

        {result && <LgResultPanel title={result.title}>{result.body}</LgResultPanel>}
      </CardBody>
    </LgDrawerShell>
  );
}
