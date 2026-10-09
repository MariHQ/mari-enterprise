import type { ReactNode } from "react";
import { SectionLabel } from "./SectionLabel";
import { HelpText } from "./HelpText";

/* An editable form row: label + control + optional hint. Not to be confused
   with Field (this repo), which is a read-only key/value display row —
   the two are visually similar but serve different contexts (a form you
   fill in vs. a detail panel you read). */
export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
      {hint && <span className="text-[12px] text-ink/70"><HelpText>{hint}</HelpText></span>}
    </label>
  );
}
