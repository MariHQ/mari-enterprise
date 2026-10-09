import { useWrite } from "../actions/useWrite";
import { WriteError } from "../feedback/WriteError";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ImpactPanel as ImpactPanelUI, type ImpactDoc } from "../data-display/ImpactPanel";
import { StatusChip, Chip } from "../data-display/Chip";
import { CardBody, CardTitleBlock, CardMeta, CardSection, CardActions } from "../layout/CardShell";
import { Button } from "../actions/Button";
import { SkeletonLine, SkeletonCircle, SkeletonChip, SkeletonButton } from "../data-display/Skeleton";
import { card } from "../tokens/card";
import { fmtAgo } from "../tokens/format";
import { useResync } from "../actions/useResync";

/* ImpactPanelFeature — the Facts-page context around the shared <ImpactPanel>.
   A verified fact row, expanded, offering "Run impact analysis": Mari traces
   the documents that depend on the claim and lists them with severity chips.
   Composes the data-display <ImpactPanel> (aliased to ImpactPanelUI) inside
   the fact card's chrome.
   Source: web/src/pages/facts.tsx (expanded fact row → ImpactPanel). */

export type ImpactPanelFeatureProps = {
  claim: string;
  source: string;
  /** ISO timestamp of the last verification, rendered as an age. */
  verifiedAt: string;
  summary: string;
  docs: ImpactDoc[];
  /** Start with the impact strip already resolved (skip the run affordance). */
  analyzed?: boolean;
  /** Open a review task on each affected document, in one go. */
  onCreateTasks?: (docs: ImpactDoc[]) => void | Promise<void>;
  /** Render a content-shaped skeleton while the fact context loads. */
  loading?: boolean;
  className?: string;
};

export function ImpactPanelFeature({
  claim, source, verifiedAt, summary, docs,
  analyzed = false, onCreateTasks,
  loading = false,
  className = "",
}: ImpactPanelFeatureProps) {
  type Phase = "idle" | "loading" | "done";
  const [phase, setPhase] = useState<Phase>(analyzed ? "done" : "idle");
  /* `analyzed` was read once, at mount. A panel that opens before the impact
     query answers therefore stayed on "idle" — offering to run an analysis
     the server had already finished — for as long as it was on screen (C1).
     A boolean, so identity is its value; nothing is held because there is no
     edit to lose, only a phase to correct. */
  useResync(analyzed, (a) => setPhase(a ? "done" : "idle"));
  const [made, setMade] = useState(false);
  const { busy, failed, run: write } = useWrite();
  const make = () => write(onCreateTasks && (() => onCreateTasks(docs)), () => setMade(true));

  const run = () => {
    setPhase("loading");
    setTimeout(() => setPhase("done"), 1100);
  };

  if (loading) {
    return (
      <div className={`max-w-[720px] ${className}`.trim()}>
        <article className={`${card} p-4`} aria-hidden="true">
          <div className="flex items-start gap-3">
            <SkeletonCircle size={18} />
            <div className="min-w-0 flex-1 space-y-2.5">
              <SkeletonLine w="82%" h={14} />
              <div className="flex flex-wrap items-center gap-3">
                <SkeletonChip w={70} />
                <SkeletonLine w={130} h={10} />
                <SkeletonLine w={90} h={10} />
              </div>
            </div>
          </div>
          <div className="mt-3.5 border-t border-ink/10 pt-3.5">
            <SkeletonButton w={150} />
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className={`max-w-[720px] ${className}`.trim()}>
      <article className={`${card} p-4`}>
        <CardBody>
          {/* 1 + 2 — header and header summary, like every other card. */}
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-moss" />
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-ink">Impact analysis</h2>
              <p className="mt-0.5 text-[12.5px] text-ink/70">
                Mari traces every document that depends on this claim, so you can see what a change would break.
              </p>
            </div>
          </div>

          {/* 4 + 5 — the claim and what it means */}
          <CardTitleBlock
            title={<q className="not-italic">{claim}</q>}
            summary={summary}
          />

          {/* 6 + 7 — source and status left, date right */}
          <CardMeta
            source={<Chip label="Fact" tone="neutral" />}
            status={<StatusChip status="verified" />}
            date={<span className="break-all">{source}</span>}
            author={<span>Verified {fmtAgo(verifiedAt)}</span>}
          />

          {/* 8 — references */}
          {/* `title={null}`: this card's own header two blocks up already says
              "Impact analysis", and the panel printed it again inside itself.
              The References label drops its `count` for the same reason — the
              panel's count strip is the one place that list is counted (§13
              count rule). */}
          {phase === "loading" ? (
            <ImpactPanelUI loading title={null} />
          ) : phase === "done" ? (
            <CardSection label="References">
              {/* No `onClose` either: it collapsed the analysis to `idle`, which
                  is exactly what "Reset" in the action row below does. With the
                  heading gone the ✕ was also the only thing left in the panel's
                  header, floating in an empty band. */}
              <ImpactPanelUI boxed title={null} docs={docs} />
            </CardSection>
          ) : null}

          <WriteError>{failed}</WriteError>
          {/* 11 + 12 — buttons, biggest action last */}
          <CardActions
            primary={phase === "idle"
              ? <Button variant="primary" compact onClick={run}>Run</Button>
              : <Button compact onClick={() => setPhase("idle")}>Reset</Button>}
            secondary={phase === "done" && docs.length > 0 ? (
              <>
                <Button
                  variant="primary"
                  compact
                  disabled={made || busy}
                  onClick={() => void make()}
                >
                  {made ? `Created ${docs.length} tasks` : busy ? "Creating…" : `Create ${docs.length} tasks`}
                </Button>
                <span className="font-term text-[11px] text-ink/65">one per affected document</span>
              </>
            ) : undefined}
          />
        </CardBody>
      </article>
    </div>
  );
}
