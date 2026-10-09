/* One brand treatment for every avatar — a per-owner color rainbow adds
   noise to a table without carrying meaning, so this is deliberately flat.
   `color` is accepted for call-site compatibility but intentionally unused. */
export function Avatar({ initials }: { initials: string; color?: string }) {
  return (
    <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-full bg-flysch border border-ink/15 font-term text-[10px] font-semibold text-ink/80">
      {initials}
    </span>
  );
}
