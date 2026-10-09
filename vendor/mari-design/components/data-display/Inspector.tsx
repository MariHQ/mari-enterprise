import type { ReactNode } from "react";
import { Card } from "../layout/Card";
import { PropertyList, type PropertyItem } from "./PropertyList";
import { CountChip } from "./Chip";

/* Inspector — a sticky right-rail detail panel: header (icon + title + tag
   row), an optional key–value block, any number of titled sections, and a
   footer actions bar. Ported from the console's knowledge Inspector, made
   generic and router-free — callers pass content + handlers. Composes Card,
   PropertyList and CountChip. */

export type InspectorSection = {
  title?: ReactNode;
  /** Numeric badge beside the section title. */
  count?: number;
  content: ReactNode;
};

export type InspectorProps = {
  title: ReactNode;
  icon?: ReactNode;
  eyebrow?: string;
  /** Chip/pill row rendered under the title. */
  tags?: ReactNode;
  /** Key–value rows rendered as a borderless PropertyList. */
  properties?: PropertyItem[];
  sections?: InspectorSection[];
  /** Footer buttons; laid out in a row at the bottom. */
  actions?: ReactNode;
  /** Stick to the top of the scroll container (default true). */
  sticky?: boolean;
  className?: string;
};

export function Inspector({
  title, icon, eyebrow, tags, properties, sections, actions, sticky = true, className = "",
}: InspectorProps) {
  return (
    <Card variant="flush" className={`${sticky ? "sticky top-4" : ""} ${className}`.trim()}>
      {/* min-w-0 all the way down: the rail is a grid child, and without it a
          long value sets the column's min-content width and the whole rail
          grows instead of the value truncating (§12). */}
      <div className="min-w-0 p-5">
        {eyebrow && (
          <span className="block font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-biscay-2 mb-1">{eyebrow}</span>
        )}
        <div className="flex items-start gap-2.5">
          {icon && <span className="shrink-0 mt-0.5 text-ink/80">{icon}</span>}
          <h3 className="text-[16px] font-semibold text-ink leading-snug min-w-0 break-words">{title}</h3>
        </div>

        {tags && <div className="mt-3 flex flex-wrap items-center gap-2">{tags}</div>}

        {properties && properties.length > 0 && (
          <div className="mt-4">
            <PropertyList items={properties} boxed={false} />
          </div>
        )}

        {sections?.map((s, i) => (
          <div key={i} className="mt-5 min-w-0 first:mt-4">
            {s.title && (
              <h4 className="flex items-center gap-1.5 mb-2 font-term text-[11px] font-medium uppercase tracking-[0.08em] text-ink/65">
                {s.title}
                {s.count != null && <CountChip count={s.count} />}
              </h4>
            )}
            <div className="min-w-0 text-[13.5px] text-ink/80">{s.content}</div>
          </div>
        ))}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-t border-ink/10 bg-ink/[0.015]">{actions}</div>
      )}
    </Card>
  );
}
