import { useEffect, useRef, useState } from "react";
import { Copy, Check, XCircle } from "lucide-react";
import { Button, type ButtonProps } from "./Button";

/* CopyButton — copies `value` to the clipboard and flips to a "Copied" check
   for ~1.4s. Wraps Button, so all its variants/sizes apply. Icon-only by
   default; pass a `label` for a labeled button. Composes with CodeBlock and
   TokenReveal.

   ACT-08: this used to swallow the failure — `navigator.clipboard?.writeText`
   resolves to `undefined` without throwing when the API is missing (plain
   HTTP, an old browser, a sandboxed frame), and the catch flipped the UI to a
   green "Copied" anyway. The user then pasted whatever was on the clipboard
   before, which for an API key or a token is a silent, expensive lie. So the
   copy is now confirmed before anything claims success:

     * the API is called only if it actually exists, and its promise is awaited;
     * on failure the button says so and reveals the value in a selectable
       field, which is the fallback that works everywhere;
     * both outcomes go through a live region, because before this only an
       `aria-label` changed and a screen-reader user was told nothing at all. */

export type CopyButtonProps = Omit<ButtonProps, "onClick" | "children"> & {
  value: string;
  /** Text label; omit for an icon-only button. */
  label?: string;
  copiedLabel?: string;
  onCopy?: (value: string) => void;
  /** Fired when the clipboard write did not happen, so a host can toast or log.
      The fallback field is shown either way. */
  onCopyFailed?: (value: string) => void;
};

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({
  value, label, copiedLabel = "Copied", icon, compact, variant = "default",
  onCopy, onCopyFailed, ...rest
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number>();
  const fallbackRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // The value changing means the old "Copied" no longer describes what is in
  // the clipboard, and the old fallback field no longer holds the right text.
  useEffect(() => { window.clearTimeout(timer.current); setState("idle"); }, [value]);

  // Put the cursor in the fallback the moment it appears, with the text already
  // selected: the recovery is then one keystroke, not a hunt with the mouse.
  useEffect(() => {
    if (state !== "failed") return;
    const el = fallbackRef.current;
    el?.focus();
    el?.select();
  }, [state]);

  const copy = async () => {
    window.clearTimeout(timer.current);
    let wrote = false;
    try {
      // Not `clipboard?.writeText(…)`: that returns undefined and awaits to
      // undefined when the API is absent, which is exactly how the failure got
      // reported as a success.
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        wrote = true;
      }
    } catch {
      wrote = false;
    }

    if (!wrote) {
      setState("failed");
      onCopyFailed?.(value);
      return;
    }
    // onCopy means "this value is now on the clipboard", so it only fires when
    // that is true.
    onCopy?.(value);
    setState("copied");
    timer.current = window.setTimeout(() => setState("idle"), 1400);
  };

  const copied = state === "copied";
  const failed = state === "failed";
  const iconOnly = icon ?? label === undefined;
  /* A labelled copy button ("Copy install") sits in a row with ordinary
     buttons, so it takes the ordinary h-9 height. Only the icon-only form
     stays compact, where it tucks into code blocks and dense rows. */
  const isCompact = compact ?? iconOnly;

  /* A Fragment, not a wrapper element: call sites style and position the button
     itself (`className="ml-auto shrink-0"` in PublishMcpServers, the absolute
     overlay in CodeBlock), and a box around it would swallow that. */
  return (
    <>
      <Button
        {...rest}
        variant={variant}
        compact={isCompact}
        icon={iconOnly}
        onClick={copy}
        aria-label={iconOnly ? (failed ? "Copy failed, select the value instead" : copied ? copiedLabel : "Copy") : undefined}
      >
        {failed ? <XCircle size={14} className="text-espelette" />
          : copied ? <Check size={14} className="text-moss" />
            : <Copy size={14} />}
        {!iconOnly && (failed ? "Copy failed" : copied ? copiedLabel : label)}
      </Button>

      {failed && (
        <input
          ref={fallbackRef}
          readOnly
          value={value}
          aria-label="Value to copy manually"
          onFocus={(e) => e.currentTarget.select()}
          className="ml-2 min-w-0 max-w-full rounded-[4px] border border-espelette/40 bg-paper px-2 py-1 font-term text-[12px] text-ink/90 outline-none"
        />
      )}

      {/* One live region for both outcomes. `alert` because the only message it
          ever carries is the failure one, and a failure that is announced
          politely can queue behind other chatter and be missed. */}
      <span role="alert" className="sr-only">
        {failed ? "Copy failed. The value is selected in the field beside the button; copy it with your keyboard." : ""}
      </span>
      <span role="status" className="sr-only">{copied ? `${copiedLabel} to clipboard` : ""}</span>
    </>
  );
}
