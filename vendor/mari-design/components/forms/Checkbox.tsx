import type { ReactNode } from "react";
import * as RC from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { focusRing } from "../tokens/focusRing";

export type CheckboxProps = {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
};

export function Checkbox({ checked, onCheckedChange, label, disabled = false, "aria-label": ariaLabel }: CheckboxProps) {
  const control = (
    <RC.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`grid place-items-center w-[16px] h-[16px] shrink-0 rounded-[3px] border border-ink/25 bg-paper data-[state=checked]:bg-biscay data-[state=checked]:border-biscay data-[state=indeterminate]:bg-biscay data-[state=indeterminate]:border-biscay disabled:opacity-100 disabled:cursor-not-allowed disabled:border-ink/30 disabled:bg-ink/[0.10] disabled:data-[state=checked]:border-ink/45 disabled:data-[state=checked]:bg-ink/45 ${focusRing}`}
    >
      <RC.Indicator className="text-white">
        {checked === "indeterminate" ? <Minus size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
      </RC.Indicator>
    </RC.Root>
  );
  if (!label) return control;
  return (
    <label className={`inline-flex items-center gap-2.5 text-[13px] ${disabled ? "cursor-not-allowed text-ink/70" : "cursor-pointer text-ink/90"}`}>
      {control}
      <span>{label}</span>
    </label>
  );
}
