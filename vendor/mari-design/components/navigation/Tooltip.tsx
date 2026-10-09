import type { ReactNode } from "react";
import * as RT from "@radix-ui/react-tooltip";

/* Hover/focus hint (Radix Tooltip). The child must accept a ref (native
   element or a forwardRef component, e.g. Button). Inverted ink-on-paper
   so it reads clearly floating over any surface. */
export function Tooltip({
  label, side = "top", children,
}: {
  label: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  return (
    <RT.Provider delayDuration={250}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content className="z-50 max-w-[220px] rounded-[4px] bg-ink px-2.5 py-1.5 text-[12px] font-medium text-paper" side={side} sideOffset={6}>
            {label}
            <RT.Arrow className="fill-ink" />
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}
