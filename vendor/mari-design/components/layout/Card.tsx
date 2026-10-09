import type { HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { ChevronDown } from "lucide-react";
import { card } from "../tokens/card";
import { focusRing } from "../tokens/focusRing";

type CardVariant = "default" | "plain" | "flush";

const PAD: Record<CardVariant, string> = {
  default: "p-4",
  plain: "p-5",
  flush: "p-0",
};

/* Pages opt a subtree into collapsible cards (CONVENTIONS.md §17: mobile
   dashboards collapse instead of forever-scrolling). Inside a true scope,
   every titled card grows a chevron toggle and starts collapsed, so the page
   reads as a scannable list of section headers. Desktop pages leave this off. */
export const CardCollapseScope = createContext(false);

export type CardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  variant?: CardVariant;
  title?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
};

export function Card({ variant = "default", title, eyebrow, icon, actions, hint, className = "", children, ...rest }: CardProps) {
  const collapseScope = useContext(CardCollapseScope);
  const collapsible = collapseScope && Boolean(title);
  const [collapsed, setCollapsed] = useState(collapsible);
  const headed = Boolean(title || eyebrow || icon || actions || hint);
  return (
    <section className={`${card} ${className}`.trim()} {...rest}>
      {headed && (
        // flex-wrap + a min-width on the title block: at narrow widths the hint
        // and actions drop to their own line instead of crushing the title into
        // an ellipsis and overlapping the eyebrow.
        <header className={`flex flex-wrap items-start gap-x-3 gap-y-2 px-4 pt-4 pb-3${collapsible ? " relative pr-14" : ""}`}>
          {icon}
          <div className="min-w-[9rem] flex-1">
            {eyebrow && <span className="block font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-biscay-2 mb-0.5">{eyebrow}</span>}
            {/* Headers truncate with an ellipsis; they never wrap tall or run
                off screen (CONVENTIONS.md §12/§17). The full value rides the
                title attribute. */}
            {/* h2: one level under the page title, which is now the h1
                (ACC-01). Card headings used to be h3 — the same level as the
                page title they sit inside, so cards read as siblings of the
                page rather than sections of it. Size unchanged. */}
            {title && (
              <h2
                className="text-[15px] font-semibold leading-snug text-ink truncate"
                title={typeof title === "string" ? title : undefined}
              >
                {title}
              </h2>
            )}
          </div>
          {hint && <span className="min-w-0 max-w-full self-center font-term text-[11px] text-ink/65 [overflow-wrap:anywhere]">{hint}</span>}
          {actions && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
          {collapsible && (
            /* Pinned to the header's top right: in the wrapping header a
               chevron in flow dropped to its own line at the BOTTOM of the
               box on narrow screens. The toggle always sits on the title
               line (§13). */
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand section" : "Collapse section"}
              onClick={() => setCollapsed((v) => !v)}
              className={`absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-[4px] border border-ink/20 text-ink/70 hover:border-ink/45 hover:text-ink transition-colors ${focusRing}`}
            >
              <ChevronDown size={15} className={`transition-transform ${collapsed ? "" : "rotate-180"}`} />
            </button>
          )}
        </header>
      )}
      <div className={`${headed ? (variant === "flush" ? "" : `${PAD[variant]} pt-0`) : PAD[variant]} min-w-0 break-words${collapsible && collapsed ? " hidden" : ""}`}>{children}</div>
    </section>
  );
}
