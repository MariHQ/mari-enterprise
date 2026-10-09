import type { ReactNode } from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { card } from "../tokens/card";

export type MenuProps = {
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  minWidth?: number;
  children: ReactNode;
};

const ITEM = "flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-[13px] text-ink/85 outline-none cursor-pointer data-[highlighted]:bg-flysch data-[highlighted]:text-ink data-[disabled]:opacity-40 data-[disabled]:pointer-events-none";
const ITEM_DANGER = "text-espelette data-[highlighted]:bg-espelette/[0.08] data-[highlighted]:text-espelette";

/* The one dropdown menu — Radix DropdownMenu, console-skinned. Outside
   click, Escape, and keyboard nav come from Radix.

     <Menu trigger={<Button icon aria-label="More"><MoreVertical size={15}/></Button>}>
       <MenuItem icon={<Pencil size={14}/>} onSelect={rename}>Rename</MenuItem>
       <MenuSeparator />
       <MenuItem danger onSelect={remove}>Delete</MenuItem>
     </Menu> */
export function Menu({ trigger, align = "end", side = "bottom", minWidth, children }: MenuProps) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content className={`${card} p-1 z-50`} align={align} side={side} sideOffset={7} style={minWidth ? { minWidth } : undefined}>
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function MenuItem({
  icon, end, danger = false, disabled = false, onSelect, children,
}: {
  icon?: ReactNode;
  end?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  return (
    <DM.Item className={`${ITEM} ${danger ? ITEM_DANGER : ""}`.trim()} disabled={disabled} onSelect={onSelect}>
      {icon && <span className="shrink-0 text-ink/70" aria-hidden="true">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {end && <span className="shrink-0 text-ink/65" aria-hidden="true">{end}</span>}
    </DM.Item>
  );
}

/** Checkbox row. */
export function MenuCheckboxItem({
  checked, onCheckedChange, children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DM.CheckboxItem className={ITEM} checked={checked} onCheckedChange={onCheckedChange} onSelect={(e) => e.preventDefault()}>
      <span className="grid place-items-center w-4 shrink-0" aria-hidden="true">
        <DM.ItemIndicator><Check size={16} strokeWidth={2.4} /></DM.ItemIndicator>
      </span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
    </DM.CheckboxItem>
  );
}

/** Radio group. */
export function MenuRadioGroup({
  value, onValueChange, children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return <DM.RadioGroup value={value} onValueChange={onValueChange}>{children}</DM.RadioGroup>;
}

export function MenuRadioItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <DM.RadioItem className={ITEM} value={value}>
      <span className="grid place-items-center w-4 shrink-0" aria-hidden="true">
        <DM.ItemIndicator><Check size={16} strokeWidth={2.4} /></DM.ItemIndicator>
      </span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
    </DM.RadioItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DM.Label className="px-2.5 pt-1.5 pb-1 font-term text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink/65">{children}</DM.Label>;
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-ink/10" />;
}
