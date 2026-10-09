import * as RG from "@radix-ui/react-radio-group";
import { focusRing } from "../tokens/focusRing";

export type RadioOption = { value: string; label: string; hint?: string };

export function RadioGroup({
  value, onValueChange, options, ariaLabel, disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioOption[];
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <RG.Root value={value} onValueChange={onValueChange} aria-label={ariaLabel} disabled={disabled} className="flex flex-col gap-2.5">
      {options.map((opt) => (
        <label key={opt.value} className={`inline-flex items-start gap-2.5 text-[13px] ${disabled ? "cursor-not-allowed text-ink/70" : "cursor-pointer text-ink/90"}`}>
          <RG.Item
            value={opt.value}
            className={`mt-0.5 grid place-items-center w-[16px] h-[16px] shrink-0 rounded-full border border-ink/25 bg-paper data-[state=checked]:border-biscay disabled:opacity-100 disabled:cursor-not-allowed disabled:border-ink/30 disabled:bg-ink/[0.10] disabled:data-[state=checked]:border-ink/45 ${focusRing}`}
          >
            <RG.Indicator className={`h-[8px] w-[8px] rounded-full ${disabled ? "bg-ink/55" : "bg-biscay"}`} />
          </RG.Item>
          <span>
            {opt.label}
            {opt.hint && <span className="block text-[12px] text-ink/70 mt-0.5">{opt.hint}</span>}
          </span>
        </label>
      ))}
    </RG.Root>
  );
}
