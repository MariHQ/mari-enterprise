import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";
import { focusRing } from "../tokens/focusRing";
import { btnDisabled } from "./buttons";

type ButtonVariant = "default" | "primary" | "success" | "danger" | "link";

// `min-h` (not a fixed `h`) plus `break-words`: a long label wraps inside the
// button instead of spilling out the top and bottom of a 36px box.
const BASE = `inline-flex items-center justify-center gap-1.5 rounded-[4px] font-medium transition-colors max-w-full overflow-hidden [overflow-wrap:anywhere] ${btnDisabled} ${focusRing}`;

const SIZE = {
  normal: "min-h-9 py-1.5 px-3.5 text-[13px]",
  compact: "min-h-7 py-1 px-2.5 text-[12.5px]",
  icon: "w-9 h-9 shrink-0 p-0",
};

const VARIANT: Record<ButtonVariant, string> = {
  default: "border border-ink/25 bg-paper text-ink/85 hover:border-ink/45 hover:text-ink active:bg-ink/[0.05]",
  primary: "bg-biscay text-white font-semibold hover:bg-biscay-2 active:bg-[#16334d]",
  success: "bg-moss text-white font-semibold hover:bg-[#235939] active:bg-[#1d4a30]",
  danger: "border border-espelette/50 bg-paper text-espelette hover:bg-espelette/[0.08] hover:border-espelette active:bg-espelette/[0.14]",
  link: "h-auto px-0 text-biscay-2 hover:text-ink hover:underline underline-offset-[3px] bg-transparent",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  compact?: boolean;
  icon?: boolean;
  block?: boolean;
};

/* The button's own class string, for the few controls that must render an <a>
   and still look like a button. "Open document" is the case that forced this
   out: it points at a URL, so it has to stay an anchor — cmd-click, middle
   click, "copy link address" and the status-bar preview are all things a
   <button onClick={navigate}> silently takes away — but §13 requires it to be
   exactly as tall as the button beside it. Use this, never a hand-copied
   class list. */
export function buttonClasses({ variant = "default", compact = false, icon = false, block = false, className = "" }: {
  variant?: ButtonVariant;
  compact?: boolean;
  icon?: boolean;
  block?: boolean;
  className?: string;
} = {}): string {
  const size = variant === "link" ? "" : icon ? SIZE.icon : compact ? SIZE.compact : SIZE.normal;
  return [BASE, size, VARIANT[variant], block && "w-full", className].filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", compact = false, icon = false, block = false, className = "", type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, compact, icon, block, className })} {...rest} />;
});
