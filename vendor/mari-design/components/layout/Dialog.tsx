import type { ReactNode } from "react";
import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { focusRing } from "../tokens/focusRing";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
};

/* Centered modal — for a short confirm/create flow. For a longer detail
   view that stays open alongside the list behind it, use Drawer instead. */
export function Dialog({ open, onOpenChange, title, description, footer, width = 440, children }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-[70] bg-ink/30" />
        <RD.Content
          className="fixed z-[70] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] bg-paper rounded-md border border-ink/15 outline-none"
          style={{ maxWidth: width }}
        >
          <header className="flex items-start gap-3 px-5 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <RD.Title className="text-[16px] font-semibold text-ink">{title}</RD.Title>
              {description && <RD.Description className="text-[13px] text-ink/60 mt-1">{description}</RD.Description>}
            </div>
            <RD.Close aria-label="Close" className={`grid place-items-center w-7 h-7 rounded-[4px] text-ink/65 hover:bg-flysch hover:text-ink shrink-0 ${focusRing}`}>
              <X size={15} />
            </RD.Close>
          </header>
          <div className="px-5 pb-5">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-ink/10">{footer}</footer>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
