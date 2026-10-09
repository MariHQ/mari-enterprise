import type { ReactNode } from "react";
import * as CM from "@radix-ui/react-context-menu";
import { Check } from "lucide-react";
import { card } from "../tokens/card";

const ITEM = "flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-[13px] text-ink/85 outline-none cursor-pointer data-[highlighted]:bg-flysch data-[highlighted]:text-ink data-[disabled]:opacity-40 data-[disabled]:pointer-events-none";
const ITEM_DANGER = "text-espelette data-[highlighted]:bg-espelette/[0.08] data-[highlighted]:text-espelette";

/* Right-click menu — same visual language as Menu (click-trigger dropdown),
   different trigger mechanism. Wrap the right-clickable element in
   ContextMenu; don't use this for a normal click-triggered menu, use Menu. */
export function ContextMenu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <CM.Root>
      <CM.Trigger asChild>{trigger}</CM.Trigger>
      <CM.Portal>
        <CM.Content className={`${card} p-1 z-50`}>{children}</CM.Content>
      </CM.Portal>
    </CM.Root>
  );
}

export function ContextMenuItem({
  icon, danger = false, disabled = false, onSelect, children,
}: {
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  return (
    <CM.Item className={`${ITEM} ${danger ? ITEM_DANGER : ""}`.trim()} disabled={disabled} onSelect={onSelect}>
      {icon && <span className="shrink-0 text-ink/65" aria-hidden="true">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{children}</span>
    </CM.Item>
  );
}

export function ContextMenuCheckboxItem({
  checked, onCheckedChange, children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <CM.CheckboxItem className={ITEM} checked={checked} onCheckedChange={onCheckedChange} onSelect={(e) => e.preventDefault()}>
      <span className="grid place-items-center w-3.5 shrink-0" aria-hidden="true">
        <CM.ItemIndicator><Check size={13} strokeWidth={2.4} /></CM.ItemIndicator>
      </span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
    </CM.CheckboxItem>
  );
}

export function ContextMenuSeparator() {
  return <CM.Separator className="my-1 h-px bg-ink/10" />;
}
