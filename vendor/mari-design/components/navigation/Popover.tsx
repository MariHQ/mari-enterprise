import type { ReactNode } from "react";
import * as RPop from "@radix-ui/react-popover";
import { card } from "../tokens/card";

export type PopoverProps = {
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  /** Controlled open state. Omit for uncontrolled click-to-toggle. */
  open?: boolean;
  /** Fires on every open/close request. Pair with `open` to drive the popover
      from the outside, e.g. an "Apply" button that closes its own panel. */
  onOpenChange?: (open: boolean) => void;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /* Portal the panel to <body> (the default). Turn it off when the popover has
     to stay inside its own DOM subtree, e.g. an isolated preview frame or a
     shadow-root embed. */
  portal?: boolean;
  className?: string;
  children: ReactNode;
};

/* Click-open card popover (Radix). For hover hints use Tooltip; for
   action lists use Menu. */
export function Popover({
  trigger, align = "end", side = "bottom", open, onOpenChange, defaultOpen,
  portal = true, className = "", children,
}: PopoverProps) {
  const content = (
    <RPop.Content className={`${card} z-50 max-w-[20rem] overflow-hidden p-4 ${className}`.trim()} align={align} side={side} sideOffset={7}>
      {children}
    </RPop.Content>
  );
  return (
    <RPop.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <RPop.Trigger asChild>{trigger}</RPop.Trigger>
      {portal ? <RPop.Portal>{content}</RPop.Portal> : content}
    </RPop.Root>
  );
}
