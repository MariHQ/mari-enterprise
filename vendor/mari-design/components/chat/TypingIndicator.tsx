import { Spinner } from "../data-display/Spinner";

/* The "Mari is working…" row shown while a turn is in flight but no
   assistant tokens have landed yet. Spinner + a soft caption. */
export function TypingIndicator({ label = "working…" }: { label?: string }) {
  return (
    /* text-ink/65 is the meta-text contrast floor (CONVENTIONS.md §6);
       items-start keeps the spinner on the first line of a wrapped label. */
    <div className="flex items-start gap-2 ml-[18px] text-[12.5px] text-ink/65">
      <span className="shrink-0 mt-[1px]"><Spinner size="sm" label="Assistant is working" /></span>
      <span className="min-w-0 break-words">{label}</span>
    </div>
  );
}
