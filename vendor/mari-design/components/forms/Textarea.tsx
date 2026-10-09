import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { short?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = "", short = false, rows, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows ?? (short ? 3 : 6)}
      className={`w-full px-3 py-2 rounded-[4px] border border-ink/20 bg-paper text-[13px] text-ink placeholder:text-ink/65 outline-none focus:border-biscay-2 focus:ring-1 focus:ring-biscay-2/40 disabled:opacity-100 disabled:bg-ink/[0.05] disabled:text-ink/70 disabled:cursor-not-allowed resize-y ${className}`.trim()}
      {...rest}
    />
  );
});
