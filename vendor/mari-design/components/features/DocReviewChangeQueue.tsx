// DocReview change queue — the review-before-apply panel. Proposed edits render
// as a word-level diff (original struck, proposed bolded, shared context between);
// accepting rewrites the document body, rejecting dismisses. Ported from
// mari-cloud/web/src/pages/docreview/ChangeQueue.tsx + the accept/reject/apply
// logic in index.tsx. The word diff is hand-rolled (no library has a change view).
//
// Renders standalone: baked-in body text + proposed changes, fully interactive.

import { useMemo, useState } from "react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { Tabs } from "../navigation/Tabs";
import { SkeletonLine } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";
import { PagerBar, ResultCount, usePaged } from "../data-display/Pagination";
import { WriteError } from "../feedback/WriteError";
import { why } from "../actions/useWrite";
import { useResync } from "../actions/useResync";

/* ————— ported diff helpers ————— */

const cleanText = (s: string) => s.replace(/^[…\s]+/, "").replace(/[…\s]+$/, "").trim();

function diffChange(orig: string, repl: string) {
  const a = orig.split(" ");
  const b = repl.split(" ");
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  return {
    pre: a.slice(0, pre).join(" "),
    delA: a.slice(pre, a.length - suf).join(" "),
    delB: b.slice(pre, b.length - suf).join(" "),
    suf: suf ? a.slice(a.length - suf).join(" ") : "",
  };
}

export type ChangeState = "pending" | "accepted" | "rejected";
/** One proposed edit in the review-before-apply queue. */
export type DocChange = { id: number; original: string; proposed: string; rule: string; state: ChangeState };
type ChangeTab = "review" | "all";

/* ————— demo data ————— */


/** The writes the queue offers. Optional: with none of them accept and reject
    stay local, which is what the design canvas renders. */
export type ChangeQueueActions = {
  /** Accept one proposal. The server rewrites the body with it. */
  acceptChange?: (args: { id: number }) => void | Promise<void>;
  /** Dismiss one proposal without applying it. */
  rejectChange?: (args: { id: number }) => void | Promise<void>;
  /** Apply every pending proposal in one pass. */
  acceptAll?: () => void | Promise<void>;
};

export function DocReviewChangeQueue({
  changes: initialChanges,
  body,
  actions,
  defaultTab = "review",
  loading = false,
  compact = false,
}: {
  changes: DocChange[];
  body: string;
  actions?: ChangeQueueActions;
  /** Which tab opens first, so each tab can be reviewed on its own. */
  defaultTab?: ChangeTab;
  loading?: boolean;
  /** Narrow-column composition: original and proposed stack instead of sitting
      in two side-by-side columns that would each be a few characters wide.
      Pages own this (CONVENTIONS.md §10). */
  compact?: boolean;
}) {
  const [tab, setTab] = useState<ChangeTab>(defaultTab);
  const [changes, setChanges] = useState<DocChange[]>(initialChanges);
  const [bodyText, setBodyText] = useState(body);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* Both copies were taken once, at mount, so re-running the refinement pass —
     or opening a different document — left the queue showing the previous
     document's proposed edits against the previous document's body (C1).
     `bodyText` is mutated locally by Accept, and `isApplied` reads it to
     decide which rows are already folded in, so the two have to move
     together: adopting a new `changes` without its matching `body` would
     mislabel every row. Held while a write is in flight. `web/src/data/
     doc-review.ts` maps inside `useQuery`, whose result is held in state, so
     both props are referentially stable. */
  useResync(initialChanges, (c) => { setChanges(c); setBodyText(body); }, { hold: busy });

  const pending = changes.filter((c) => c.state === "pending");
  const visible = tab === "review" ? pending : changes;
  /* A full refinement pass proposes hundreds of edits. The queue pages so the
     Accept-all control stays reachable instead of sitting below a mile of
     diffs (CONVENTIONS §13, §17). */
  const pager = usePaged(visible, 15);

  const isApplied = (c: DocChange) => c.state === "pending" && !bodyText.includes(cleanText(c.original));

  const applyLocal = (orig: string, repl: string) => {
    const o = cleanText(orig);
    if (!o) return;
    setBodyText((t) => t.split(o).join(cleanText(repl)));
  };

  /* Each control moves the row FIRST and then writes, so the queue reads the
     same with and without a server; a rejected write puts the row back where
     it was and says why. */
  const settle = async (
    c: DocChange, state: ChangeState, write: (() => void | Promise<void>) | undefined, fallback: string,
  ) => {
    setChanges((cs) => cs.map((x) => (x.id === c.id ? { ...x, state } : x)));
    if (state === "accepted") applyLocal(c.original, c.proposed);
    if (!write) return;
    setFailed(null);
    try {
      await write();
    } catch (e) {
      setChanges((cs) => cs.map((x) => (x.id === c.id ? { ...x, state: c.state } : x)));
      if (state === "accepted") setBodyText(body);
      setFailed(why(e, fallback));
    }
  };

  const accept = (c: DocChange) =>
    settle(c, "accepted", actions?.acceptChange && (() => actions.acceptChange!({ id: c.id })),
      "That change could not be accepted.");
  const reject = (c: DocChange) =>
    settle(c, "rejected", actions?.rejectChange && (() => actions.rejectChange!({ id: c.id })),
      "That change could not be rejected.");

  const acceptAll = async () => {
    const before = changes;
    pending.forEach((c) => applyLocal(c.original, c.proposed));
    setChanges((cs) => cs.map((c) => (c.state === "pending" ? { ...c, state: "accepted" } : c)));
    if (!actions?.acceptAll) return;
    setBusy(true);
    setFailed(null);
    try {
      await actions.acceptAll();
    } catch (e) {
      setChanges(before);
      setBodyText(body);
      setFailed(why(e, "Those changes could not be applied."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card variant="flush" className="w-full">
        <div className="flex gap-4 px-4 pt-4" aria-hidden="true">
          <SkeletonLine w={120} h={11} /><SkeletonLine w={90} h={11} />
        </div>
        <div className="grid grid-cols-[1fr_1fr_150px] gap-3 border-b border-ink/10 px-4 pb-1.5 pt-3" aria-hidden="true">
          <SkeletonLine w={60} h={9} /><SkeletonLine w={68} h={9} /><span />
        </div>
        <div aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_150px] gap-3 border-b border-ink/8 px-4 py-3">
              <div className="space-y-1.5"><SkeletonLine w="90%" h={10} /><SkeletonLine w="70%" h={10} /></div>
              <div className="space-y-1.5"><SkeletonLine w="80%" h={10} /><SkeletonLine w="60%" h={10} /></div>
              <div className="space-y-2"><SkeletonLine w="85%" h={9} /><SkeletonLine w={90} h={22} /></div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3" aria-hidden="true">
          <SkeletonLine w={160} h={10} /><SkeletonLine w={130} h={28} />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="flush" className="w-full">
      <div className="px-4 pt-4">
        <Tabs<ChangeTab>
          value={tab}
          onChange={setTab}
          ariaLabel="Proposed changes"
          variant="underline"
          options={[
            { id: "review", label: "Review before apply" },
            { id: "all", label: "All changes", count: changes.length },
          ]}
        />
      </div>

      {/* Result count above the rows, never under them (CONVENTIONS §13). */}
      {visible.length > 0 && (
        <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="changes"
          className="mt-3 border-t" note={`${pending.length} pending`} />
      )}

      {/* Two diff columns plus an action rail need real width. In a narrow
          frame the row SCROLLS sideways inside the card; it never crushes each
          column to one word per line (CONVENTIONS §20). `compact` stacks
          instead, for pages that ask for it (§10). */}
      <Scrollable>
      <div className={compact ? "" : "min-w-[660px]"}>
      {visible.length > 0 && !compact && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_168px] gap-3 px-4 pt-3 pb-1.5 border-b border-ink/10">
          <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Original</span>
          <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Proposed</span>
          <span />
        </div>
      )}

      <div>
        {pager.pageRows.map((c) => {
          const d = diffChange(cleanText(c.original), cleanText(c.proposed));
          const applied = isApplied(c);
          return (
            <div
              key={c.id}
              className={`grid gap-3 px-4 py-3 border-b border-ink/8 ${compact ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_168px]"} ${c.state === "rejected" ? "opacity-50" : ""}`}
            >
              {compact && <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Original</span>}
              <div className="min-w-0 break-words font-term text-[12.5px] leading-[1.55] text-ink/70">
                {d.pre && <>{d.pre} </>}
                {d.delA && <s className="text-espelette/80 decoration-espelette/60">{d.delA}</s>}
                {d.suf && <> {d.suf}</>}
              </div>
              {compact && <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Proposed</span>}
              <div className={`font-term text-[12.5px] leading-[1.55] ${c.state === "accepted" ? "text-moss" : "text-ink/70"} min-w-0 break-words`}>
                {d.pre && <>{d.pre} </>}
                {d.delB && <b className="text-moss">{d.delB}</b>}
                {d.suf && <> {d.suf}</>}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <span className="text-[11px] leading-tight text-ink/65">
                  Suggestion:<br /><b className="text-ink/80">{c.rule}</b>
                </span>
                {c.state === "pending" ? (
                  applied ? (
                    /* Stacked, so "Dismiss" keeps its own line and never
                       wraps to "Dismis / s" in the action rail. */
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[11px] text-ink/65">already applied</span>
                      <Button compact onClick={() => reject(c)}>Dismiss</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <Button compact variant="success" onClick={() => accept(c)}>Accept</Button>
                      <Button compact variant="danger" onClick={() => reject(c)}>Reject</Button>
                    </div>
                  )
                ) : (
                  <Chip
                    label={c.state === "accepted" ? "Accepted" : "Rejected"}
                    tone={c.state === "accepted" ? "ok" : "blocked"}
                    dot
                  />
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <EmptyState>No pending changes. Run a refinement, or switch to “All changes”.</EmptyState>
        )}
      </div>
      </div>
      </Scrollable>

      {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}

      {/* Primary action bottom LEFT (CONVENTIONS.md §2). The count reads from
          the strip above the list, not from under it (§13). */}
      <div className="flex flex-col items-start gap-2 px-4 py-3">
        <Button variant="primary" onClick={acceptAll} disabled={busy || pending.length === 0}>
          {busy ? "Applying…" : `Accept all ${pending.length || ""} changes`.replace(/\s+/g, " ")}
        </Button>
        {/* Accept, Reject and Accept-all all report here; none of them accuses
            an input, so a refused write is a banner (XA-02). */}
        <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
      </div>
    </Card>
  );
}
