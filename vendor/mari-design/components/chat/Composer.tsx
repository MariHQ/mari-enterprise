import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "../actions/Button";

export type ComposerProps = {
  onSend: (text: string) => void;
  /** When true, the send button becomes a Stop button wired to `onStop`. */
  isStreaming?: boolean;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
};

/* Composer: the input row. A single auto-growing textarea plus a send
   affordance, framed as one bordered field (the source's pill composer).
   Enter sends; Shift+Enter inserts a newline. While streaming, the send
   button swaps for a danger-tone Stop. */
export function Composer({
  onSend,
  isStreaming = false,
  onStop,
  placeholder = "Ask the agent to do something…",
  disabled = false,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 132) + "px";
  }

  function submit() {
    const text = value.trim();
    if (!text || isStreaming || disabled) return;
    onSend(text);
    setValue("");
    if (ref.current) ref.current.style.height = "auto";
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 mx-3.5 mb-1 pl-2.5 pr-2 py-1.5 rounded-md border border-ink/15 bg-flysch focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          grow(e.target);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Message the agent"
        name="agent-message"
        disabled={disabled}
        /* Disabled stays legible: opacity-100 plus the explicit disabled
           palette, never a washed-out ghost (CONVENTIONS.md §6). */
        className="flex-1 min-w-0 resize-none self-center max-h-[132px] py-1 bg-transparent border-none outline-none text-[13.5px] leading-snug text-ink placeholder:text-ink/60 disabled:opacity-100 disabled:cursor-not-allowed disabled:text-ink/60"
      />
      {isStreaming ? (
        <Button compact variant="danger" onClick={onStop} className="mb-0.5">
          Stop
        </Button>
      ) : (
        <Button
          compact
          icon
          onClick={submit}
          disabled={!value.trim() || disabled}
          aria-label="Send"
          className="mb-0.5 w-7 h-7"
        >
          <Send size={14} />
        </Button>
      )}
    </div>
  );
}
