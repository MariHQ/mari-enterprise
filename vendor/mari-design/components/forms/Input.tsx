import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`h-9 px-3 rounded-[4px] border border-ink/25 bg-paper text-[13px] text-ink placeholder:text-ink/65 outline-none focus:border-biscay-2 focus:ring-1 focus:ring-biscay-2/40 disabled:bg-ink/[0.05] disabled:opacity-100 disabled:text-ink/70 disabled:cursor-not-allowed ${className}`.trim()}
      {...rest}
    />
  );
});
