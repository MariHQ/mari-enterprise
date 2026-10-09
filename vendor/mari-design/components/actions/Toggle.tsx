import type { ReactNode } from "react";
import * as RT from "@radix-ui/react-toggle";
import * as RTG from "@radix-ui/react-toggle-group";
import { focusRing } from "../tokens/focusRing";
import { btnDisabled } from "./buttons";

/* Label text sits at ink/75, not ink/60: an off-state toggle is still a
   readable control, not a hint (CONVENTIONS.md §6). Disabled uses the shared
   `btnDisabled` palette so an inert toggle reads the same as an inert button. */
const TOGGLE_CLASS = `inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] text-[12.5px] font-medium text-ink/75 border border-transparent hover:bg-flysch data-[state=on]:bg-biscay data-[state=on]:text-white transition-colors ${focusRing} ${btnDisabled}`;

/** A single press-button with on/off state, e.g. "Show archived" next to a filter bar. */
export function Toggle({ pressed, onPressedChange, children, disabled = false, "aria-label": ariaLabel }: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <RT.Root
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={TOGGLE_CLASS}
    >
      {children}
    </RT.Root>
  );
}

export type ToggleGroupOption = { value: string; label: ReactNode; disabled?: boolean; "aria-label"?: string };

const GROUP_ITEM_CLASS = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-[12.5px] font-medium text-ink/75 hover:text-ink data-[state=on]:bg-paper data-[state=on]:text-ink data-[state=on]:border data-[state=on]:border-ink/15 ${focusRing} ${btnDisabled}`;
const GROUP_ROOT_CLASS = "inline-flex items-center gap-1 p-1 rounded-md border border-ink/15 bg-flysch";

/* A group of mutually-visible toggle buttons — visually similar to Tabs'
   "seg" variant, but semantically a filter/view toggle, not navigation
   between separate content panels. Use Tabs when switching content;
   ToggleGroup when narrowing/filtering what's already shown. */
export type ToggleGroupProps =
  | { type: "single"; value: string; onValueChange: (value: string) => void; options: ToggleGroupOption[]; ariaLabel: string }
  | { type: "multiple"; value: string[]; onValueChange: (value: string[]) => void; options: ToggleGroupOption[]; ariaLabel: string };

export function ToggleGroup(props: ToggleGroupProps) {
  const { options, ariaLabel } = props;
  const items = options.map((opt) => (
    <RTG.Item key={opt.value} value={opt.value} disabled={opt.disabled} aria-label={opt["aria-label"]} className={GROUP_ITEM_CLASS}>
      {opt.label}
    </RTG.Item>
  ));
  if (props.type === "multiple") {
    return (
      <RTG.Root type="multiple" value={props.value} onValueChange={props.onValueChange} aria-label={ariaLabel} className={GROUP_ROOT_CLASS}>
        {items}
      </RTG.Root>
    );
  }
  return (
    <RTG.Root type="single" value={props.value} onValueChange={props.onValueChange} aria-label={ariaLabel} className={GROUP_ROOT_CLASS}>
      {items}
    </RTG.Root>
  );
}
