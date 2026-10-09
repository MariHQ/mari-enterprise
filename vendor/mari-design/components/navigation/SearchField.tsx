import { Search } from "lucide-react";
import { Kbd } from "./Kbd";

/* SearchField — the header search affordance. In the real console the
   topbar search reads as a button that launches the global search
   overlay (⌘K), not a live-typing input. This renders as a real text
   input so it can carry a controlled value, but any focus/click is
   meant to open GlobalSearch; keep it compact so it fits the header
   bar. Wire `onOpen` to the same setter that ⌘K toggles. */
export function SearchField({
  value = "",
  onChange,
  onOpen,
  placeholder = "Search knowledge, people, sources…",
  shortcut = "⌘ K",
  className = "",
}: {
  value?: string;
  onChange?: (value: string) => void;
  onOpen?: () => void;
  placeholder?: string;
  /** Trailing hint; pass "" to hide. */
  shortcut?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2.5 h-9 w-full max-w-[560px] px-3 rounded-md",
        "bg-paper border border-ink/15 text-ink/70",
        "hover:border-ink/25 transition-colors cursor-text",
        "focus-within:ring-2 focus-within:ring-biscay-2/70 focus-within:border-biscay-2/40",
        className,
      ].filter(Boolean).join(" ")}
      onClick={onOpen}
    >
      <Search size={18} className="text-ink/65 shrink-0" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onOpen}
        placeholder={placeholder}
        aria-label="Search"
        className="flex-1 min-w-0 bg-transparent text-[13px] text-ink placeholder:text-ink/65 outline-none"
      />
      {shortcut ? <Kbd keys={shortcut} className="shrink-0" /> : null}
    </div>
  );
}
