import { useMemo, useState } from "react";
import * as RPop from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { focusRing } from "../tokens/focusRing";
import { Scrollable } from "../data-display/Scrollable";

export type ComboboxOption = { value: string; label: string };

/* Searchable select. Select is native-<select>-only; reach for this when the
   option list is long enough that scanning it isn't practical, and always for
   a member / owner / assignee picker (CONVENTIONS.md §7) — those are never a
   plain Select.

   No native Radix combobox primitive exists, so this composes Popover +
   a hand-rolled listbox (same pattern as GlobalSearch, smaller scope).

   Option labels are canonical strings, not hand-typed ones: for servers and
   regions pass `REGION_OPTIONS` from tokens/regions.ts so "US West
   (us-west-2)" reads the same here as it does in every table and chip. */
export function Combobox({
  value, onChange, options, placeholder = "Select…", searchPlaceholder = "Search…",
  search = true, emptyLabel = "No matches", ariaLabel,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Show the type-to-filter row. Leave on for member/owner pickers. */
  search?: boolean;
  emptyLabel?: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = search ? query.trim().toLowerCase() : "";
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, search]);

  return (
    <RPop.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <RPop.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={`w-full flex items-center justify-between gap-2 h-9 px-3 rounded-[4px] border border-ink/20 bg-paper text-[13px] text-left ${selected ? "text-ink" : "text-ink/70"} ${focusRing}`}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown size={18} className="text-ink/65 shrink-0" aria-hidden />
        </button>
      </RPop.Trigger>
      <RPop.Portal>
        <RPop.Content align="start" sideOffset={6} className="z-50 w-[var(--radix-popover-trigger-width)] bg-paper rounded-md border border-ink/15 overflow-hidden">
          {search && (
            <div className="flex items-center gap-2 px-3 h-9 border-b border-ink/10">
              <Search size={18} className="text-ink/70 shrink-0" aria-hidden />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink/65" />
            </div>
          )}
          <Scrollable axis="y" className="max-h-[220px]">
            <div role="listbox" className="p-1">
            {filtered.length === 0 && <div className="px-3 py-4 text-center text-[12.5px] text-ink/70">{emptyLabel}</div>}
            {filtered.map((opt) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => { onChange(opt.value); setOpen(false); setQuery(""); }}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[3px] text-[13px] cursor-pointer hover:bg-flysch ${opt.value === value ? "text-ink font-medium" : "text-ink/85"}`}
              >
                {opt.label}
                {opt.value === value && <Check size={16} className="text-biscay-2 shrink-0" aria-hidden />}
              </div>
            ))}
            </div>
          </Scrollable>
        </RPop.Content>
      </RPop.Portal>
    </RPop.Root>
  );
}
