import type { ReactNode } from "react";

/* Kbd — a single keyboard key or a short chord. The console renders
   shortcut hints in the mono (font-term) chrome voice with a hairline
   ink border, matching the ESC/⌘K affordances in the command palette
   and header search. Pass `keys` for a chord ("⌘ K", "Ctrl Shift P")
   or a single token; children override when you need custom content. */
export function Kbd({
  keys, children, className = "",
}: {
  keys?: string | string[];
  children?: ReactNode;
  className?: string;
}) {
  const key =
    "font-term text-[10px] leading-none text-ink/70 bg-flysch/60 border border-ink/20 rounded-[3px] px-1.5 py-1 inline-flex items-center justify-center min-w-[1.25rem]";

  if (children !== undefined) {
    return <kbd className={[key, className].filter(Boolean).join(" ")}>{children}</kbd>;
  }

  const tokens = keys === undefined ? [] : Array.isArray(keys) ? keys : keys.split(/\s+/).filter(Boolean);

  if (tokens.length <= 1) {
    return <kbd className={[key, className].filter(Boolean).join(" ")}>{tokens[0] ?? ""}</kbd>;
  }

  return (
    <span className={["inline-flex flex-wrap items-center gap-1", className].filter(Boolean).join(" ")}>
      {tokens.map((t, i) => (
        <kbd key={i} className={key}>{t}</kbd>
      ))}
    </span>
  );
}
