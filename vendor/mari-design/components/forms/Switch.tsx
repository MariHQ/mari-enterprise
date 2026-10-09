import type { ReactNode } from "react";
import * as RS from "@radix-ui/react-switch";
import { focusRing } from "../tokens/focusRing";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
};

export function Switch({ checked, onCheckedChange, label, disabled = false, "aria-label": ariaLabel }: SwitchProps) {
  const control = (
    <RS.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`relative inline-flex w-9 h-5 shrink-0 rounded-full border border-ink/20 bg-ink/10 data-[state=checked]:bg-biscay data-[state=checked]:border-biscay transition-colors disabled:opacity-100 disabled:cursor-not-allowed disabled:border-ink/30 disabled:bg-ink/20 disabled:data-[state=checked]:border-ink/45 disabled:data-[state=checked]:bg-ink/45 ${focusRing}`}
    >
      <RS.Thumb className="block w-3.5 h-3.5 my-[3px] ml-[3px] rounded-full bg-paper transition-transform data-[state=checked]:translate-x-[15px]" />
    </RS.Root>
  );
  if (!label) return control;
  return (
    <label className={`inline-flex items-center gap-2.5 text-[13px] ${disabled ? "cursor-not-allowed text-ink/70" : "cursor-pointer text-ink/90"}`}>
      {control}
      <span>{label}</span>
    </label>
  );
}
