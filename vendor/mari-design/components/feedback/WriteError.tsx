import { Alert } from "./Alert";
import { ERRORS } from "./errors";

/* The failure surface for a page ACTION, and the twin of <ReadError>
   (pages/types.ts, CONVENTIONS §8).

   The catalog owns the heading and the tone; the body is the message the server
   actually sent, so a rejected write says why instead of "something went
   wrong". Renders nothing when there is nothing to report, so a control can
   drop it in unconditionally.

   XA-02 — WHICH SURFACE, AND WHEN. This banner was used in 15 files and
   <FieldError> was used for page-action failures in 24 more, so the same event
   had two renderings that look nothing alike. The line between them is not
   which file you are in, it is what the reader has to do next:

     <FieldError>   The value in ONE named input is wrong, and fixing it means
                    editing that input. It sits directly under the input it
                    accuses, 12px, because it has to point at something. A
                    failure with no input to point at has nowhere to sit.

     <WriteError>   The write itself failed: the server refused it, the network
                    dropped it, the record moved. Nothing the reader can retype
                    fixes it, and the failure belongs to the whole action, so
                    it is a banner beside the control that fired — at the same
                    weight a failed READ gets, because losing a save matters at
                    least as much as failing to load.

   The tell is: if you cannot name the input, it is a WriteError. */
export function WriteError({ children, onDismiss }: {
  children: string | null | undefined;
  onDismiss?: () => void;
}) {
  if (!children) return null;
  return (
    <Alert tone="blocked" title={ERRORS["generic.saveFailed"].title} onDismiss={onDismiss}>
      {children}
    </Alert>
  );
}
