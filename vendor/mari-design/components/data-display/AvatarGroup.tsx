import { Avatar } from "./Avatar";

/* AvatarGroup — overlapping avatars with an overflow "+N" bubble. Wraps the
   flat Avatar; each avatar gets a paper ring so the stack reads cleanly.
   Prop-driven: pass people (initials) and a `max` before the group collapses
   into a count. */

export type AvatarGroupProps = {
  people: { initials: string }[];
  /** Max avatars shown before an overflow bubble (default 4). */
  max?: number;
  className?: string;
};

/* A stack of 60 avatars is a 900px-wide row that escapes whatever cell it sits
   in, so the shown count is capped no matter what a caller asks for: past this
   many faces the "+N" bubble carries the real number (CONVENTIONS §12). */
const HARD_MAX = 8;

export function AvatarGroup({ people, max = 4, className = "" }: AvatarGroupProps) {
  const cap = Math.max(1, Math.min(max, HARD_MAX));
  const shown = people.slice(0, cap);
  const overflow = people.length - shown.length;

  return (
    <div className={`flex min-w-0 shrink-0 items-center ${className}`.trim()}>
      {shown.map((p, i) => (
        <span key={i} className="shrink-0 rounded-full ring-2 ring-paper -ml-1.5 first:ml-0" title={p.initials}>
          <Avatar initials={p.initials} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="-ml-1.5 grid shrink-0 place-items-center min-w-[26px] px-1 h-[26px] rounded-full ring-2 ring-paper bg-ink/[0.08] border border-ink/15 font-term text-[10px] font-semibold text-ink/80"
          title={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
