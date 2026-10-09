import { useState } from "react";
import { Feather, Pencil, CheckCircle2 } from "lucide-react";
import { Button } from "../actions/Button";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonLine, SkeletonCircle } from "../data-display/Skeleton";
import { focusRing } from "../tokens/focusRing";
import { card } from "../tokens/card";
import { useResync } from "../actions/useResync";

/* WelcomeGuideStep — the Welcome wizard's Step 2 style-guide picker: a
   radio-card list of built-in guide packs (mirroring the Library's GUIDES
   catalog) plus a "Start from scratch" option. Presentational — it emits
   onPick(id); the parent persists to the `onboarding` setting and the shared
   localStorage("mari.styleguide"). The pack ids are load-bearing and must match
   the Library's. Local RadioCardGroup is built here. Standalone. */

export const SCRATCH_ID = "scratch";

export type GuidePack = { id: string; name: string; description: string; rules?: number };

export const GUIDE_PACKS: GuidePack[] = [
  { id: "plain", name: "Plain language", description: "Short words, active voice, no jargon.", rules: 42 },
  { id: "microsoft", name: "Microsoft", description: "Microsoft Writing Style Guide conventions.", rules: 38 },
  { id: "google", name: "Google developer", description: "Google's developer documentation style.", rules: 35 },
  { id: "ap", name: "AP style", description: "Associated Press news style.", rules: 31 },
  { id: "chicago", name: "Chicago", description: "The Chicago Manual of Style.", rules: 29 },
];

export function guideName(id: string | null): string | null {
  if (id == null) return null;
  if (id === SCRATCH_ID) return "Start from scratch";
  return GUIDE_PACKS.find((p) => p.id === id)?.name ?? id;
}

export type WelcomeGuideStepProps = {
  guide?: string | null;
  saving?: boolean;
  loading?: boolean;
  onPick?: (id: string) => void;
  /** Leave onboarding for the Library, where style guides are authored. The
      empty state's whole point is that there is nothing to pick yet. */
  onOpenLibrary?: () => void;
  packs: GuidePack[];
  className?: string;
};

export function WelcomeGuideStep({
  guide, saving = false, loading = false, onPick, onOpenLibrary, packs, className = "",
}: WelcomeGuideStepProps) {
  const [selected, setSelected] = useState<string | null>(guide ?? "plain");

  /* The saved pick was read once, at mount, so the step rendered the "plain"
     default until a reload — including right after `onPick` saved a different
     one (C1). A string, so identity is its value. Nothing is held: the pick
     IS the write, so an arriving `guide` is either what the reader just chose
     or a correction worth showing. */
  useResync(guide, (g) => setSelected(g ?? "plain"));

  const pick = (id: string) => { setSelected(id); onPick?.(id); };

  if (loading) {
    return (
      <div className={`${card} grid grid-cols-1 gap-2 p-4 ${className}`.trim()} aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-md border border-ink/15 p-3">
            <SkeletonCircle size={16} />
            <SkeletonCircle size={32} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonLine w="38%" h={12} />
              <SkeletonLine w="66%" h={9} />
            </div>
            <SkeletonLine w={52} h={9} />
          </div>
        ))}
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className={`${card} ${className}`.trim()}>
        <EmptyState icon={<Feather size={26} />} title="No style guides yet" action={onOpenLibrary ? <Button compact onClick={onOpenLibrary}>Open Library</Button> : undefined}>
          Add a style guide in the Library to use it as your project default.
        </EmptyState>
      </div>
    );
  }

  const row = (id: string, name: string, description: string, icon: React.ReactNode, rules?: number) => {
    const active = selected === id;
    return (
      <label
        key={id}
        className={`flex min-w-0 flex-wrap items-start gap-3 p-3 rounded-md border transition-colors ${focusRing} ${
          saving ? "pointer-events-none bg-flysch" : "cursor-pointer"
        } ${active ? "border-biscay-2 ring-1 ring-biscay-2/40 bg-biscay/[0.04]" : "border-ink/15 hover:border-ink/35"}`}
      >
        <input type="radio" name="wc-guide" className="mt-1 accent-biscay shrink-0" disabled={saving} checked={active} onChange={() => pick(id)} />
        <span className="grid place-items-center w-8 h-8 rounded-full border border-ink/15 text-ink/65 shrink-0">{icon}</span>
        {/* The text track keeps a floor width so a fixed-width sibling ("42
            rules") can never squeeze it into a one-character column; the row
            wraps instead (CONVENTIONS.md §10: no breakpoint stacking here). */}
        <span className="min-w-0 flex-1 basis-[11rem]">
          <b className="block text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{name}</b>
          <span className="block text-[12px] text-ink/70 [overflow-wrap:anywhere]">{description}</span>
        </span>
        {rules != null && <span className="mt-0.5 font-term text-[11px] text-ink/65 shrink-0">{rules} rules</span>}
        {active && <CheckCircle2 size={16} className="mt-0.5 text-moss shrink-0" />}
      </label>
    );
  };

  /* Same paper card as "Fill glossary": these two steps sit side by side in
     the Welcome flow and used to render on two different backgrounds. */
  return (
    <div className={`${card} p-4 ${className}`.trim()}>
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-ink">Pick a style guide</h2>
        <p className="mt-0.5 text-[12.5px] text-ink/70">It becomes the default every document is reviewed against. You can change it later.</p>
      </div>
      <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Style guide">
        {packs.map((p) => row(p.id, p.name, p.description, <Feather size={16} />, p.rules))}
        <div className="mt-1 pt-2 border-t border-ink/10">
          {row(SCRATCH_ID, "Start from scratch", "Build your own rules as you go.", <Pencil size={16} />)}
        </div>
      </div>
    </div>
  );
}
