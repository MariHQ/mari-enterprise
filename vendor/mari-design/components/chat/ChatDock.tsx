import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { IconRing } from "../data-display/IconRing";
import { Scrollable } from "../data-display/Scrollable";
import { Chip } from "../data-display/Chip";
import { ChatMessage } from "./ChatMessage";
import { Composer } from "./Composer";
import { TypingIndicator } from "./TypingIndicator";
import type { ChatMessageData, SourceVariant } from "./types";

export type ChatDockProps = {
  /** The full transcript, oldest first. Streaming is expressed by marking
   *  the last assistant message `streaming: true` — no network here. */
  messages: ChatMessageData[];
  /** A turn is in flight: disables send, shows the working indicator, and
   *  turns the composer's send button into Stop. */
  isStreaming?: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
  title?: string;
  /** Right-aligned header affordances (new conversation, close, history…). */
  headerActions?: ReactNode;
  /** Shown when the transcript is empty; falls back to a stock blurb. */
  emptyState?: ReactNode;
  /** Click-to-send prompts, rendered as chips under the empty-state blurb. */
  suggestions?: string[];
  /** Passed to every assistant message's <Sources> block: "public" links only
   *  a document's own URL, because a console route means nothing to an
   *  anonymous reader. */
  sourceVariant?: SourceVariant;
  /** Monospace footnote under the composer. */
  hint?: string;
  placeholder?: string;
  className?: string;
};

/* ChatDock: the overall agent surface: a header, a scrollable transcript,
   and a composer. A faithful port of the source dock's structure and
   density, but abstracted away from routing and the network: it is driven
   entirely by `messages` / `isStreaming` props and an `onSend` callback.

   The transcript pins to the bottom as messages arrive, matching a live
   agent pane. Render it inside any sized container (a fixed side panel, a
   card, a dialog). */
export function ChatDock({
  messages,
  isStreaming = false,
  onSend,
  onStop,
  title = "Agent",
  headerActions,
  emptyState,
  suggestions,
  sourceVariant = "console",
  hint,
  placeholder,
  className = "",
}: ChatDockProps) {
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const last = messages[messages.length - 1];
  const showWorking = isStreaming && !(last?.role === "assistant" && last.streaming);

  return (
    <aside
      aria-label={title}
      className={`flex flex-col min-h-0 bg-paper border border-ink/15 rounded-md overflow-hidden ${className}`.trim()}
    >
      <header className="flex items-center gap-2 px-3.5 py-2.5 border-b border-dashed border-ink/15">
        <IconRing size={30} tone="info">
          <Sparkles size={14} />
        </IconRing>
        <span className="flex-1 min-w-0 font-display text-[16px] text-ink truncate">{title}</span>
        {headerActions}
      </header>

      {/* h-full on the scroll box so a short transcript still fills the pane
          and the empty state's my-auto keeps centering. */}
      <Scrollable
        axis="y"
        scrollerRef={streamRef}
        className="flex-1 min-h-0"
        scrollerClassName="h-full px-3.5 py-3 flex flex-col gap-2 text-[13.5px] leading-normal"
      >
        {messages.length === 0 ? (
          <div className="my-auto text-center text-ink/70 px-1.5 py-2">
            {emptyState ?? (
              <p>
                I can search and read knowledge, explain product workflows, and
                take you to the right screen. Governed changes happen in Review
                and Automations.
              </p>
            )}
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-2.5">
                {suggestions.map((s) => (
                  <Chip key={s} label={s} onClick={() => onSend(s)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} sourceVariant={sourceVariant} />)
        )}
        {showWorking && <TypingIndicator />}
      </Scrollable>

      <Composer
        onSend={onSend}
        isStreaming={isStreaming}
        onStop={onStop}
        placeholder={placeholder}
      />

      {hint && (
        <div className="px-3.5 pt-1.5 pb-2.5 font-term text-[10.5px] text-ink/65">
          {hint}
        </div>
      )}
    </aside>
  );
}
