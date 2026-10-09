import { useState } from "react";
import { Check } from "lucide-react";
import { Button, type ButtonProps } from "./Button";

export type ConfirmButtonProps = Omit<ButtonProps, "onClick" | "variant"> & {
  confirmLabel?: string;
  onConfirm: () => void;
  /** How the UNARMED button renders. Default is the quiet weight every
      destructive confirm wears; a confirm guarding a PRIMARY action (save
      that re-indexes) passes "primary" so the button carries the same
      weight as its unguarded siblings instead of turning white exactly
      where the action matters most. */
  variant?: "default" | "primary";
  /* Which confirm step to show once armed (CONVENTIONS.md §2):
       "danger"  — destructive yes (delete, revoke). The default.
       "success" — affirmative yes (approve, ratify, publish). Green, with a
                   check glyph so the affirmative path is unmistakable.
       "primary" — neutral next step. */
  confirmVariant?: "danger" | "success" | "primary";
  /* Start already armed. Only the design canvas should pass this: it is how
     the confirm step gets captured as a state without a click, which is what
     the Settings pages used to fake by drawing a second, static copy of the
     whole table beside the real one. */
  defaultArmed?: boolean;
};

/* Two-step confirm, the one pattern for deletes/revokes and for any yes/no
   that must not fire on first click. First press arms ("Really delete?"), the
   next press fires; leaving the button, or Escape, disarms. Replaces
   window.confirm and unguarded deletes.

   Wherever this sits inline on a card or panel it belongs BOTTOM LEFT, ahead
   of any secondary action (CONVENTIONS.md §2). */
export function ConfirmButton({
  confirmLabel = "Confirm?", onConfirm, confirmVariant = "danger", defaultArmed = false,
  variant = "default", children, onBlur, onKeyDown, ...rest
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(defaultArmed);

  const click = () => {
    if (armed) {
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
    }
  };

  return (
    <>
      <Button
        {...rest}
        variant={armed ? confirmVariant : variant}
        onClick={click}
        /* WCAG 2.2.1: arming used to expire after 4s, an unadjustable time
           limit on the console's only destructive-action pattern — long enough
           for a mouse, nowhere near enough for someone reading the new label
           with a screen reader or a switch. The timer is gone. Disarming is
           now under the user's control: move off the button, or press Escape.
           Nothing can fire without a second, deliberate press on the button
           whose label says what it will do. */
        onKeyDown={(e) => {
          if (e.key === "Escape" && armed) { e.stopPropagation(); setArmed(false); }
          onKeyDown?.(e);
        }}
        onBlur={(e) => { setArmed(false); onBlur?.(e); }}
      >
        {armed
          ? <>{confirmVariant === "success" && <Check size={13} />}{confirmLabel}</>
          : children}
      </Button>
      {/* A visible way out. Escape and blur both disarm, but neither is an
          affordance anyone can see — an armed destructive button with no
          stated alternative reads as a dare. Text, not a button: the pair
          must not look like two live choices of equal weight. Muted to
          ink/70, the floor that still clears 4.5:1 on a white card. */}
      {armed && (
        <button
          type="button"
          className="ml-2 text-[12px] text-ink/70 underline-offset-2 hover:underline"
          /* Keep focus where it is: without this, mousedown blurs the armed
             button, blur disarms it, and this link vanishes under the click. */
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setArmed(false)}
        >
          Cancel
        </button>
      )}
      {/* ACC-07: arming was silent. The label swapped to "Really delete?" with
          nothing announced, so a screen-reader user heard the ORIGINAL label,
          pressed again to retry what looked like a dead button, and destroyed
          the record. The armed step now says so, and says how to back out. */}
      {armed && (
        <span role="alert" className="sr-only">
          {confirmLabel} Press again to confirm, or Escape to cancel.
        </span>
      )}
    </>
  );
}
