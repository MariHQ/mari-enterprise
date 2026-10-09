import { useMemo, useState } from "react";
import { ChevronsUpDown, Layers, Ungroup, Combine } from "lucide-react";
import { Button } from "../actions/Button";
import { CreateReviewTaskButton, ExportButton } from "../actions/RepeatedActions";
import { CardActions, CardBody, CardMeta, CardSection, CardTitleBlock } from "../layout/CardShell";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { ResultCount } from "../data-display/Pagination";
import { Scrollable } from "../data-display/Scrollable";
import { GithubMark } from "../icons";
import { fmtDate } from "../tokens/format";
import { SkeletonCircle, SkeletonLine, SkeletonChip, SkeletonText, SkeletonList } from "../data-display/Skeleton";
import {
  LgDrawerShell, LgResultPanel, LG_DRAWER_W, lgToggleOn, ConnectionRow, groupParts, groupKindWord,
  LgAuthor, LgOwners, LgSourceChip, GROUP_PAGE_SIZE,
  nodeById, downloadText, NodeGlyph, type LNode, type LEdge,
} from "./LineageDataModel";

/** Rows shown before the list becomes its own bounded, scrolling region. */
const MEMBER_PREVIEW = 5;
/** References rows shown before that list gets its own bounded scroll box. */
const REF_PREVIEW = 4;

/* ─────────────────────────────────────────────────────────────────────────
   Lineage group (roll-up) drawer (feature: lineage-group-drawer)

   The macro-node counterpart to the node drawer. When a roll-up macro node
   (one card standing in for a whole gh:<repo>:<kind> bucket, e.g. "89 commits ·
   MariHQ/web") is tapped, this drawer summarizes the group and offers the
   expand/collapse affordance plus a jump list of the members (ranked by
   degree).

   Same shell and the same content order as the other three drawers
   (CONVENTIONS §1): title, summary, source + status left with date and author
   right, then References, Members, Owners, then the actions.
   ──────────────────────────────────────────────────────────────────────── */

export type LineageGroupDrawerProps = {
  /** The roll-up bucket id, e.g. "gh:MariHQ/web:commits". */
  groupId: string;
  /** Total members in the bucket (may exceed what is listed). */
  totalMembers: number;
  members: LNode[];
  /** The whole graph, so member degree can be counted against it. */
  nodes: LNode[];
  edges: LEdge[];
  onSelectMember?: (id: string) => void;
  /** Whether this bucket is already unfolded on the canvas. */
  expandedInPlace?: boolean;
  /** Unfold the roll-up on the canvas: the one macro card is replaced by its
      members, and the links between them, which the roll-up has to hide,
      become drawable. Omitted = no such control, because nothing would
      receive it (§2). */
  onExpandInPlace?: (groupId: string) => void;
  /** Fold it back into one card. */
  onCollapseInPlace?: (groupId: string) => void;
  onClose?: () => void;
  /** Render a content-shaped skeleton silhouette instead of the drawer body. */
  loading?: boolean;
  className?: string;
};

export function LineageGroupDrawer({
  groupId, totalMembers, members, nodes, edges,
  onSelectMember, expandedInPlace = false, onExpandInPlace, onCollapseInPlace,
  onClose, loading = false, className = "",
}: LineageGroupDrawerProps) {
  const { repo, kind } = groupParts(groupId);
  const [isOpen, setIsOpen] = useState(false);
  const [taskMade, setTaskMade] = useState(false);
  const [exported, setExported] = useState(false);

  const degreeOf = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) {
      d.set(e.from, (d.get(e.from) ?? 0) + 1);
      d.set(e.to, (d.get(e.to) ?? 0) + 1);
    }
    return d;
  }, [edges]);

  const ranked = useMemo(
    () => [...members].sort((a, b) => (b.inbound ?? 0) - (a.inbound ?? 0) || (b.date ?? "").localeCompare(a.date ?? "")),
    [members],
  );

  /* Edges that leave the bucket: the group's References / Endpoints. The
     edges handed in are the RAW member edges, so filtering for the macro id
     alone counted zero forever while the canvas drew a REF into this very
     group. An edge leaves the bucket when exactly one endpoint is inside. */
  const graphById = useMemo(() => nodeById(nodes), [nodes]);
  const macroId = `grp:${groupId}`;
  const references = useMemo(() => {
    const inside = new Set(members.map((m) => m.id));
    return edges.filter((e) => {
      const from = inside.has(e.from) || e.from === macroId;
      const to = inside.has(e.to) || e.to === macroId;
      return (from || to) && !(inside.has(e.from) && inside.has(e.to));
    });
  }, [edges, macroId, members]);

  const owners = useMemo(() => {
    const tally = new Map<string, number>();
    for (const m of members) if (m.owner) tally.set(m.owner, (tally.get(m.owner) ?? 0) + 1);
    return [...tally]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, n]) => ({ name, role: `${n} ${groupKindWord(kind, n)}` }));
  }, [members, kind]);

  const latest = useMemo(
    () => members.map((m) => m.date).filter(Boolean).sort().slice(-1)[0] as string | undefined,
    [members],
  );
  const kindWord = groupKindWord(kind, totalMembers);

  /* A 500-member bucket must not become 500 rows in the drawer body: the
     Members list is its own bounded scroll region (§20) and pages in
     GROUP_PAGE_SIZE at a time, so References and Owners stay reachable. */
  const [page, setPage] = useState(1);
  const budget = isOpen ? GROUP_PAGE_SIZE * page : MEMBER_PREVIEW;
  const shown = ranked.slice(0, budget);
  const more = ranked.length - shown.length;
  const scrolls = shown.length > MEMBER_PREVIEW;

  if (loading) {
    return (
      <LgDrawerShell
        className={className}
        onClose={onClose}
        icon={<SkeletonCircle size={19} />}
        title={<SkeletonLine w="60%" h={14} />}
        pills={<><SkeletonChip w={90} /><SkeletonChip w={72} /></>}
      >
        <div className="mb-3"><SkeletonLine w="45%" h={12} /></div>
        <SkeletonText lines={3} />
        <div className="mt-4"><SkeletonList rows={5} /></div>
      </LgDrawerShell>
    );
  }

  return (
    <LgDrawerShell
      className={className}
      onClose={onClose}
      width={LG_DRAWER_W}
      icon={members[0] ? <NodeGlyph node={members[0]} size={19} /> : <GithubMark size={19} />}
      title="Rolled-up group"
      summary="One card standing in for a whole bucket of nodes."
      footer={
        <div className="flex w-full flex-col gap-2">
          {/* Two different expansions, so neither is called "Expand group":
              one lists every member in this panel, the other unfolds the
              roll-up on the canvas. The old single "Expand group" latched the
              list and readers went looking for a change on the graph that
              never came. */}
          <div className="flex flex-wrap gap-2">
            <Button compact onClick={() => { setIsOpen((o) => !o); setPage(1); }} className={isOpen ? lgToggleOn : ""}>
              <ChevronsUpDown size={13} /> {isOpen ? "List fewer members" : "List every member"}
            </Button>
            {(expandedInPlace ? onCollapseInPlace : onExpandInPlace) && (
              <Button
                compact
                onClick={() => (expandedInPlace ? onCollapseInPlace?.(groupId) : onExpandInPlace?.(groupId))}
                className={expandedInPlace ? lgToggleOn : ""}
              >
                {expandedInPlace ? <><Combine size={13} /> Roll up on the graph</> : <><Ungroup size={13} /> Expand on the graph</>}
              </Button>
            )}
          </div>
          {/* CONVENTIONS §2: primary bottom LEFT, export to its right. */}
          <CardActions
            className="pt-0"
            primary={<CreateReviewTaskButton state={taskMade ? "done" : "idle"} onClick={() => setTaskMade(true)} />}
            secondary={
              // Writes the file. "Exported" used to be a label change and
              // nothing else.
              <ExportButton
                format="CSV"
                state={exported ? "done" : "idle"}
                onClick={() => {
                  const csv = [
                    "document,owner,date,links",
                    ...ranked.map((m) => [m.title, m.owner ?? "", m.date ?? "", degreeOf.get(m.id) ?? m.inbound ?? 0]
                      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
                  ].join("\n");
                  downloadText(`${repo.replace(/[^\w.-]+/g, "-")}-${kind || "group"}.csv`, csv, "text/csv");
                  setExported(true);
                }}
                className={exported ? lgToggleOn : ""}
              />
            }
          />
        </div>
      }
    >
      <CardBody>
        <CardTitleBlock
          className="[overflow-wrap:anywhere]"
          title={`${totalMembers} ${kindWord}`}
          summary={`Rolled up from ${repo}. ${members.length} of ${totalMembers} listed here.`}
        />
        <CardMeta
          source={<LgSourceChip source={members[0]?.source ?? "docs"} />}
          status={<Chip label={expandedInPlace ? "On the graph" : "Rolled up"} tone={expandedInPlace ? "info" : "neutral"} icon={<Layers size={11} />} />}
          date={latest ? fmtDate(latest) : "No date recorded"}
          author={<LgAuthor name={owners[0]?.name} />}
        />

        {/* Each panel says what its own control did, and nothing about the
            other one. */}
        {expandedInPlace && (
          <LgResultPanel title="Unfolded on the graph">
            The graph draws these {totalMembers} members instead of one card,
            along with the links between them. Roll it back up below, or from
            the graph's own Expanded row.
          </LgResultPanel>
        )}
        {isOpen && (
          <LgResultPanel title="Members listed in full">
            All {totalMembers} members are listed below, {GROUP_PAGE_SIZE} at a
            time rather than every row at once.
          </LgResultPanel>
        )}

        <CardSection label="References" count={references.length}>
          {references.length === 0 ? (
            <p className="text-[12.5px] text-ink/70">This bucket links to nothing outside itself.</p>
          ) : (
            <Scrollable axis="y" className={references.length > REF_PREVIEW ? "max-h-[188px]" : ""} scrollerClassName={references.length > REF_PREVIEW ? "pr-1" : ""}>
              {references.map((e) => (
                <ConnectionRow
                  key={e.id}
                  rel={e.rel}
                  dir={e.from === macroId ? "out" : "in"}
                  dashed={e.dashed}
                  title={graphById[e.from === macroId ? e.to : e.from]?.title ?? (e.from === macroId ? e.to : e.from)}
                  subline={e.count && e.count > 1 ? `${e.count} rolled-up links` : "1 link"}
                />
              ))}
            </Scrollable>
          )}
        </CardSection>

        <CardSection label="Members" count={totalMembers}>
          {shown.length === 0 ? (
            <EmptyState title="No members">Nothing in this bucket matches the current filters.</EmptyState>
          ) : (
            <>
              {/* One count strip, above the list it describes (§13). It used to
                  be a bespoke span in the section header saying "Showing N of M
                  listed", which is a fourth spelling of the same sentence. */}
              <ResultCount
                from={1}
                to={shown.length}
                total={ranked.length}
                noun="members"
                className="mb-2 rounded-[4px] border border-ink/10"
              />
              {/* Bounded region, always with a visible bar once it scrolls. */}
              <Scrollable axis="y" className={scrolls ? "max-h-[236px]" : ""} scrollerClassName={scrolls ? "pr-1" : ""}>
                {shown.map((m) => (
                  <ConnectionRow
                    key={m.id}
                    rel="references"
                    dir="out"
                    title={m.title}
                    subline={[m.owner, m.date ? fmtDate(m.date) : null, `${degreeOf.get(m.id) ?? m.inbound ?? 0} link${(m.inbound ?? 0) === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                    onSelect={() => onSelectMember?.(m.id)}
                  />
                ))}
              </Scrollable>
              {more > 0 && (
                <div className="mt-2">
                  <Button compact onClick={() => { setIsOpen(true); setPage((p) => p + 1); }}>
                    Show {Math.min(more, GROUP_PAGE_SIZE)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardSection>

        <CardSection label="Owners">
          <LgOwners owners={owners} />
        </CardSection>
      </CardBody>
    </LgDrawerShell>
  );
}
