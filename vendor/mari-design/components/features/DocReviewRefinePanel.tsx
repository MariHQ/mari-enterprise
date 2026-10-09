// DocReview refine panel — the right rail: a grid of AI editing "skills", a scope
// selector, a findings tally, and a Run button. Running proposes edits that land
// in the change queue; nothing changes until the user accepts them. Ported from
// mari-cloud/web/src/pages/docreview/RefinePanel.tsx. Renders standalone; the
// refinement run is simulated locally with a realistic "last run" summary.

import { Fragment, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Menu, MenuRadioGroup, MenuRadioItem } from "../navigation/Menu";
import { fmtDateTime } from "../tokens/format";
import { Skeleton, SkeletonLine } from "../data-display/Skeleton";
import { WriteError } from "../feedback/WriteError";
import { why } from "../actions/useWrite";

type Skill = { name: string; sub: string; api: string };
type RefineScope = "Whole document" | "Current selection";

// Visual skill grid → API refinement skill keys (several visuals share a key).
const SKILLS: Skill[] = [
  { name: "Tighten", sub: "Remove fluff", api: "tighten" },
  { name: "Deslop", sub: "Reduce wordiness", api: "plain" },
  { name: "Clarify", sub: "Improve clarity", api: "plain" },
  { name: "Sharpen", sub: "Stronger verbs", api: "active" },
  { name: "Understate", sub: "Reduce hype", api: "inclusive" },
  { name: "Polish", sub: "Improve tone", api: "headings" },
  { name: "Critique", sub: "Overall feedback", api: "terminology" },
];

/* The decorative brand sprig that used to sit behind this panel is gone: at
   340px it ran straight through the skill grid and the scope row. */

/** Running a refinement is a write: it proposes edits into the change queue.
    Optional, as ever — with no handler the panel keeps its local run. */
export type RefineActions = {
  /** Run one editing skill over the document. Resolves to the number of edits
      it proposed, which is what the panel reports. */
  run?: (args: { skill: string }) => Promise<number>;
};

export function DocReviewRefinePanel({
  errorN = 1,
  warnN = 3,
  advisoryN = 2,
  actions,
  loading = false,
}: {
  errorN?: number;
  warnN?: number;
  advisoryN?: number;
  actions?: RefineActions;
  loading?: boolean;
}) {
  const [skill, setSkill] = useState("Tighten");
  const [scope, setScope] = useState<RefineScope>("Whole document");
  const [refining, setRefining] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [hasSel] = useState(false); // no live editor selection in the standalone panel

  const needsSelection = scope === "Current selection" && !hasSel;

  const report = (proposed: number) =>
    setLastRun(`Last run: ${fmtDateTime(new Date())} (${skill}) · ${proposed} change${proposed === 1 ? "" : "s"} proposed`);

  const run = async () => {
    if (refining || needsSelection) return;
    setRefining(true);
    setFailed(null);
    if (!actions?.run) {
      // No server behind the panel: the run is the local pass it always was.
      setTimeout(() => { setRefining(false); report(2 + Math.floor(Math.random() * 4)); }, 1600);
      return;
    }
    try {
      // The API key, not the button label: several buttons share one skill.
      report(await actions.run({ skill: SKILLS.find((s) => s.name === skill)?.api ?? "tighten" }));
    } catch (e) {
      setFailed(why(e, "That refinement could not be run."));
    } finally {
      setRefining(false);
    }
  };

  const tally: [number, string, string][] = [
    [errorN, "Error", "#B23A1E"],
    [warnN, "Warning", "#A05E1C"],
    [advisoryN, "Advisory", "#1E6FA8"],
  ];

  if (loading) {
    return (
      <Card title="Refine" className="w-full">
        <div className="flex items-center justify-between" aria-hidden="true">
          <SkeletonLine w={44} h={9} /><Skeleton width={130} height={28} rounded="rounded-[4px]" />
        </div>
        <div className="mt-4 space-y-1.5" aria-hidden="true">
          <SkeletonLine w={56} h={9} />
          <Skeleton height={52} rounded="rounded-[5px]" />
        </div>
        <div className="mt-4 space-y-1.5" aria-hidden="true">
          <SkeletonLine w={72} h={9} />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-1.5 rounded-[5px] border border-ink/15 px-2.5 py-2">
                <SkeletonLine w="55%" h={11} /><SkeletonLine w="80%" h={9} />
              </div>
            ))}
          </div>
        </div>
        <Skeleton height={38} rounded="rounded-[4px]" className="mt-4" />
        <SkeletonLine w="90%" h={9} className="mt-2" />
      </Card>
    );
  }

  return (
    /* Order: scope, then findings, then the refinement skills, then Run. You
       pick what you are working on before you pick what to do to it. */
    <Card title="Refine" className="w-full">
      {/* scope */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Scope</span>
        <Menu trigger={<Button compact>{scope} <ChevronDown size={11} /></Button>}>
          <MenuRadioGroup value={scope} onValueChange={(v) => setScope(v as RefineScope)}>
            <MenuRadioItem value="Whole document">Whole document</MenuRadioItem>
            <MenuRadioItem value="Current selection">Current selection</MenuRadioItem>
          </MenuRadioGroup>
        </Menu>
      </div>

      {/* findings tally, numbers centered over their label */}
      <div className="mt-4">
        <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Findings</span>
        <div className="mt-1.5 flex items-stretch rounded-[5px] border border-ink/12 bg-flysch/50 px-3 py-2.5">
          {tally.map(([n, label, color], i) => (
            <Fragment key={label}>
              {i > 0 && <span className="mx-3 w-px bg-ink/12" />}
              <span className="flex min-w-0 flex-1 flex-col items-center text-center">
                <b title={String(n)} className="block max-w-full truncate font-display text-[19px] leading-tight" style={{ color }}>{n}</b>
                <span className="truncate text-[11px] text-ink/70">{label}</span>
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* refinement skills */}
      <div className="mt-4">
        <span className="font-term text-[10.5px] uppercase tracking-[0.08em] text-ink/65">Refinements</span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {SKILLS.map((s) => {
            const on = skill === s.name;
            return (
              <button
                key={s.name}
                type="button"
                aria-pressed={on}
                onClick={() => setSkill(s.name)}
                className={`flex min-w-0 flex-col items-start rounded-[5px] border px-2.5 py-2 text-left transition-colors ${
                  on ? "border-biscay-2 bg-biscay-2/[0.08] ring-1 ring-biscay-2" : "border-ink/15 bg-paper hover:border-ink/35"
                }`}
              >
                <b className="max-w-full truncate text-[13px] text-ink">{s.name}</b>
                <span className="max-w-full truncate text-[11px] text-ink/70">{s.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Button variant="primary" block className="mt-4" onClick={run} disabled={refining || needsSelection}>
        <Sparkles size={15} /> {refining ? "Mari is editing…" : "Run refinement"}
      </Button>
      {/* A refinement the server refused accuses no input on this rail, so it
          gets the banner every other failed write gets (XA-02). */}
      <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
      <p className="mt-2 text-[11.5px] text-ink/70">
        {refining
          ? `Running ${skill.toLowerCase()} on ${scope.toLowerCase()}. This can take up to a minute.`
          : needsSelection
            ? "Select text in the document to refine a selection, or switch scope to the whole document."
            : lastRun ?? "Proposals land in the review queue below. Nothing changes until you accept."}
      </p>
    </Card>
  );
}
