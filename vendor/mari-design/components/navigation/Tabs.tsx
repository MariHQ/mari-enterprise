import type { ReactNode } from "react";
import { Scrollable } from "../data-display/Scrollable";
import { focusRing } from "../tokens/focusRing";

export type TabOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
};

export type TabsVariant = "seg" | "underline";

export type TabsProps<T extends string> = {
  ariaLabel: string;
  options: TabOption<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: TabsVariant;
  className?: string;
};

/* Tabs: the console's one-of-N view switcher, styled Brutalist Blueprint
   console-mode (hairline borders, no shadows).

   ACC-08 — this used to wrap Radix's Tabs primitive, which made every trigger
   a `role="tab"` emitting `aria-controls="<contentId>"`. `RTabs.Content` is
   rendered nowhere in the library, and cannot be: all 19 call sites switch
   what the PAGE renders below, outside this component, and the component is
   never given that content. So every trigger pointed `aria-controls` at an
   element that does not exist, no `role="tabpanel"` was ever exposed, and a
   screen-reader user following the tab relationship arrived nowhere.

   The honest semantics for "a labelled group of buttons, one of which is on"
   is exactly that: a named group of toggle buttons carrying `aria-pressed`.
   It promises only what the DOM contains. Each button is individually
   Tab-reachable, which is what the surrounding page behaves like anyway; the
   trade against Radix is losing arrow-key roving, which the tab idiom owed the
   user only because it made every tab but one unreachable by Tab.

   Nothing about the rendering changed — the same classes are applied on
   `selected` that Radix applied on `data-[state=active]`.

   A tab row too wide for its container scrolls INSIDE the row (labels never
   wrap); the page itself never scrolls sideways (CONVENTIONS.md §10). */
export function Tabs<T extends string>({ ariaLabel, options, value, onChange, variant = "seg", className = "" }: TabsProps<T>) {
  return (
    // The seg frame (border/bg/padding) lives on the Scrollable wrapper so
    // it stays put while the tab row scrolls inside it; inline-block keeps
    // the control hugging its tabs like the old inline-flex List did.
    <Scrollable
      fade={variant === "seg" ? "flysch" : "paper"}
      className={
        variant === "seg"
          ? `inline-block max-w-full rounded-md border border-ink/15 bg-flysch p-1 ${className}`
          : `max-w-full ${className}`
      }
    >
      <div
        role="group"
        aria-label={ariaLabel}
        className={
          variant === "seg"
            ? "inline-flex items-center gap-1"
            : "flex items-center gap-5 border-b border-ink/15"
        }
      >
        {options.map((opt) => {
          const selected = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.id)}
              className={
                variant === "seg"
                  ? `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[13px] font-medium transition-colors hover:text-ink ${selected ? "border border-ink/15 bg-paper text-ink" : "text-ink/70"} ${focusRing}`
                  : `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-2 text-[13px] font-medium transition-colors hover:text-ink ${selected ? "border-biscay-2 text-ink" : "border-transparent text-ink/70"} ${focusRing}`
              }
            >
              {opt.icon}
              {opt.label}
              {opt.count != null && (
                <span className="font-term text-[10.5px] font-medium text-ink/70 bg-ink/[0.06] rounded-[3px] px-1.5 py-0.5">
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Scrollable>
  );
}
