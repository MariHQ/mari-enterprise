import { useState } from "react";
import { Sparkles, Layers } from "lucide-react";
import { DecisionCard as DecisionCardUI, type DecisionStatus } from "../data-display/DecisionCard";
import { ImpactPanel as ImpactPanelUI, type ImpactDoc } from "../data-display/ImpactPanel";
import { EmptyState } from "../data-display/EmptyState";
import { SourceMark } from "../icons/marks";
import { Button } from "../actions/Button";
import { WriteError } from "../feedback/WriteError";
import { why } from "../actions/useWrite";
import { Skeleton, SkeletonLine } from "../data-display/Skeleton";

/* DecisionCardFeature — the Decisions ledger column: a timeline of decision
   cards, each composing the data-display <DecisionCard> (aliased DecisionCardUI)
   plus, for ratified rows, the shared <ImpactPanel> (ImpactPanelUI) as the
   inline "blast radius" strip with a Create-N-tasks footer.

   It renders the decisions it is given and does not filter them: the page owns
   the ledger filter (DecisionsPage's tab strip). This column used to carry a
   second row of facet chips with private state, which is why the page's own
   strip appeared dead — two filters, one of them unreachable. */

/** The impact readout carried on a ledger entry. */
export type ImpactState = {
  open: boolean;
  loading: boolean;
  docs: ImpactDoc[] | null;
  tasksCreated: boolean;
  /** Server-persisted readout shown before this session runs impact. */
  count: number;
  summary: string;
};

/** One ledger entry. Exported so pages and fixtures compose this shape
    rather than redeclaring it. */
export type Decision = {
  id: string | number;
  statement: string;
  context?: string;
  status: DecisionStatus;
  fresh?: boolean;
  source: string;
  provider: string;
  owners: string[];
  decidedOn?: string;
  /** The decision this one was set aside for. */
  ignoredFor?: string;
  /** @deprecated Use `ignoredFor`. Kept so existing pages keep compiling. */
  supersededBy?: string;
  impact: ImpactState;
};

/** A decision with no impact run against it yet. Zero values, not content. */
export const NO_IMPACT: ImpactState = { open: false, loading: false, docs: null, tasksCreated: false, count: 0, summary: "" };

/** What a run of `decisionImpact` came back with. */
export type ImpactRun = { summary: string; docs: ImpactDoc[] };

/** The writes the ledger column offers. Optional: with none of them every
    control below keeps the local behaviour it already had, which is what the
    design canvas renders. */
export type DecisionLedgerActions = {
  /** Sign one proposal off. */
  ratify?: (args: { id: string | number }) => void | Promise<void>;
  /** Trace the blast radius. Resolves to the documents it found.

      Without it no card draws "Run impact analysis": the strip used to answer
      an unwired click with three hardcoded documents ("Auth architecture",
      "Security review", "SDK quickstart") after a 1.1s sleep, which is a
      fabricated analysis presented as a real one. */
  runImpact?: (args: { id: string | number }) => Promise<ImpactRun>;
  /** Open a review task on each affected document. Without it the impact
      strip's footer is not drawn: the button used to flip a label to "N tasks
      created" without creating anything (§2). */
  createImpactTasks?: (args: { id: string | number; docs: ImpactDoc[] }) => void | Promise<void>;
};

export type DecisionCardFeatureProps = {
  decisions: Decision[];
  /** Render a content-shaped skeleton timeline while the ledger loads. */
  loading?: boolean;
  actions?: DecisionLedgerActions;
  className?: string;
};

export function DecisionCardFeature({ decisions, loading = false, actions, className = "" }: DecisionCardFeatureProps) {
  const [ratifying, setRatifying] = useState<string | number | null>(null);
  /* A failed write is as visible as a failed read: the server's own message
     sits above the timeline the write was meant to change. */
  const [failed, setFailed] = useState<string | null>(null);

  /* What this session has changed, laid over the ledger it was given rather
     than copied out of it: a state copy froze the timeline at its first render,
     so filtering the ledger — or reading it again — never reached the cards. */
  const [echo, setEcho] = useState<Record<string | number, Partial<Decision>>>({});
  const shown = decisions.map((d) => (echo[d.id] ? { ...d, ...echo[d.id] } : d));

  const patch = (id: string | number, next: Partial<Decision>) =>
    setEcho((cur) => ({ ...cur, [id]: { ...cur[id], ...next } }));
  const patchImpact = (id: string | number, next: Partial<ImpactState>) =>
    setEcho((cur) => {
      const base = cur[id]?.impact ?? decisions.find((d) => d.id === id)?.impact ?? NO_IMPACT;
      return { ...cur, [id]: { ...cur[id], impact: { ...base, ...next } } };
    });

  const ratify = async (id: string | number) => {
    if (ratifying !== null) return;
    setRatifying(id);
    setFailed(null);
    if (!actions?.ratify) {
      // No server behind the ledger: the sign-off is the local move alone.
      setTimeout(() => {
        patch(id, { status: "ratified", decidedOn: new Date().toISOString() });
        setRatifying(null);
      }, 800);
      return;
    }
    try {
      await actions.ratify({ id });
      patch(id, { status: "ratified", decidedOn: new Date().toISOString() });
    } catch (e) {
      setFailed(why(e, "That decision could not be ratified."));
    } finally {
      setRatifying(null);
    }
  };

  const runImpact = async (d: Decision) => {
    if (d.impact.docs) {
      patchImpact(d.id, { open: !d.impact.open });
      return;
    }
    if (!actions?.runImpact) return;
    patchImpact(d.id, { open: true, loading: true });
    setFailed(null);
    try {
      const run = await actions.runImpact({ id: d.id });
      patchImpact(d.id, {
        loading: false, docs: run.docs,
        count: run.docs.length, summary: run.summary,
      });
    } catch (e) {
      patchImpact(d.id, { loading: false, open: false });
      setFailed(why(e, "The impact analysis could not be run."));
    }
  };

  /* Only ever called with a handler behind it (the footer is not drawn
     otherwise): the label used to read "N tasks created" over nothing. */
  const createTasks = async (d: Decision) => {
    if (!d.impact.docs || d.impact.tasksCreated || !actions?.createImpactTasks) return;
    setFailed(null);
    try {
      await actions.createImpactTasks({ id: d.id, docs: d.impact.docs });
      patchImpact(d.id, { tasksCreated: true });
    } catch (e) {
      setFailed(why(e, "Those tasks could not be created."));
    }
  };

  if (loading) {
    return (
      <div className={`max-w-[720px] ${className}`.trim()} aria-hidden="true">
        <div className="mb-4 space-y-2">
          <Skeleton width={170} height={19} />
          <SkeletonLine w={420} h={11} />
        </div>
        {[0, 1, 2].map((i) => (
          <DecisionCardUI key={i} loading spine={i < 2} statement="" status="proposed" />
        ))}
      </div>
    );
  }

  return (
    <div className={`max-w-[720px] ${className}`.trim()}>
      <div className="mb-4">
        <h2 className="font-display text-[19px] text-ink">Decision ledger</h2>
        <p className="mt-0.5 text-[13px] text-ink/70">
          Proposals awaiting sign-off, ratified decisions, the ones the team set aside, and their downstream impact.
        </p>
      </div>

      {/* Ratify, impact and task creation all report here. None of them accuses
          an input, so the failure gets a banner, not a field caption (XA-02). */}
      <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>

      {shown.length === 0 && (
        <EmptyState title="Nothing in this filter">No decisions match the selected filter yet.</EmptyState>
      )}

      {shown.map((d, i) => {
        const im = d.impact;
        const impactStrip =
          d.status !== "ratified" ? undefined : im.loading ? (
            <ImpactPanelUI loading loadingText="Mari is tracing the blast radius…" />
          ) : im.open && im.docs ? (
            <ImpactPanelUI
              summary={im.summary || undefined}
              docs={im.docs}
              onClose={() => patchImpact(d.id, { open: false })}
              footer={
                im.tasksCreated ? (
                  <span className="font-term text-[11.5px] text-moss">{im.docs.length} tasks created</span>
                ) : actions?.createImpactTasks ? (
                  <Button variant="primary" compact onClick={() => void createTasks(d)}>
                    Create {im.docs.length} tasks
                  </Button>
                ) : undefined
              }
            />
          ) : im.docs ? (
            <Button variant="link" onClick={() => patchImpact(d.id, { open: true })}>
              Show impact analysis
            </Button>
          ) : im.count > 0 ? (
            /* flex-wrap + shrink-0: in a narrow card the summary squeezed the
               "Re-run" link to one character per line. */
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink/70">
              <Layers size={14} className="shrink-0 text-biscay-2" />
              <span className="min-w-0 flex-1">
                <b className="text-ink">{im.count} documents affected</b> · {im.summary}
              </span>
              {actions?.runImpact && (
                <Button variant="link" className="shrink-0" onClick={() => void runImpact(d)}>
                  Re-run
                </Button>
              )}
            </div>
          ) : actions?.runImpact ? (
            <Button compact onClick={() => void runImpact(d)}>
              <Sparkles size={13} /> Run impact analysis
            </Button>
          ) : undefined;

        return (
          <DecisionCardUI
            key={d.id}
            /* Every nowrap box in the card (the source chip, the date/owner
               group) has to be allowed to shrink, or one long source label
               pins the meta row at its full width and the card spills past
               its own border. Chips shrink on their own now; CardMeta keeps
               its own min-width floor on the tag block, so no child override. */
            className="[&_.whitespace-nowrap]:min-w-0 [&_.whitespace-nowrap]:overflow-hidden"
            statement={d.statement}
            context={d.context}
            status={d.status}
            fresh={d.fresh}
            sourceLabel={d.source}
            sourceIcon={<SourceMark provider={d.provider} size={13} />}
            owners={d.owners}
            decidedOn={d.decidedOn}
            ignoredForStatement={d.ignoredFor ?? d.supersededBy}
            ratifying={ratifying === d.id}
            onRatify={() => ratify(d.id)}
            onIgnore={() => patch(d.id, { status: "ignored", ignoredFor: "(pending replacement)" })}
            impact={impactStrip}
            spine={i < shown.length - 1}
          />
        );
      })}
    </div>
  );
}
