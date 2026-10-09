import type { ReactNode } from "react";

/* The uppercase mono label on its own — list headers, filter groups.
   Same treatment as Field's label; extracted so FormField and Field
   both build on it instead of duplicating the class string. */
export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`block font-term text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink/65 ${className}`.trim()}>{children}</span>;
}
