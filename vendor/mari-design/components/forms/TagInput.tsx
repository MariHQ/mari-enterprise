import { useState, type KeyboardEvent } from "react";
import { Chip } from "../data-display/Chip";

/* An editable, multi-value chip list bound to a form field — Chip itself
   is display-only; this is the input control that produces a list of them
   (tags, allow-listed domains, recipient lists). */
export function TagInput({
  value, onChange, placeholder = "Add and press Enter…",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
    else if (e.key === "Backspace" && draft === "" && value.length > 0) { onChange(value.slice(0, -1)); }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-9 px-2.5 py-1.5 rounded-[4px] border border-ink/20 bg-paper focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
      {value.map((tag) => (
        <Chip key={tag} label={tag} onRemove={() => onChange(value.filter((t) => t !== tag))} />
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[80px] bg-transparent text-[13px] text-ink placeholder:text-ink/65 outline-none py-0.5"
      />
    </div>
  );
}
