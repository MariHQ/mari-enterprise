import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = "", children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`h-9 px-3 rounded-[4px] border border-ink/20 bg-paper text-[13px] text-ink outline-none focus:border-biscay-2 focus:ring-1 focus:ring-biscay-2/40 disabled:opacity-100 disabled:bg-ink/[0.05] disabled:text-ink/70 disabled:cursor-not-allowed ${className}`.trim()}
      {...rest}
    >
      {children}
    </select>
  );
});
