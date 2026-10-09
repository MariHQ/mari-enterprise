import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Alert } from "./Alert";
import { Button } from "../actions/Button";
import { ERRORS, type ErrorId, type ErrorSpec } from "./errors";

/* The one way to show a failure.
   Banner form for page/section level, `<FieldError>` for inline form errors. */
export function ErrorMessage({
  id, onAction, onDismiss, children,
}: {
  id: ErrorId;
  /** Wires the catalog's recovery action. Omitted = no button. */
  onAction?: () => void;
  onDismiss?: () => void;
  /** Extra detail appended under the standard body (e.g. a file name). */
  children?: ReactNode;
}) {
  const e: ErrorSpec = ERRORS[id];
  return (
    <Alert
      tone={e.tone}
      title={e.title}
      onDismiss={onDismiss}
      action={e.action && onAction ? (
        <Button compact onClick={onAction}>{e.action}</Button>
      ) : undefined}
    >
      {e.body}
      {children ? <div className="mt-1 font-term text-[12px] text-ink/65">{children}</div> : null}
    </Alert>
  );
}

/* Inline, field-level error. Sits directly under the input it accuses.

   XA-02: this was doing duty as the failure surface for page ACTIONS in 24
   files, where there is no input under which to sit and 12px of red text next
   to a button reads as a caption rather than a refused save. Use <WriteError>
   for those; this stays for validation on a named field. */
export function FieldError({ id, children }: { id?: ErrorId; children?: ReactNode }) {
  const text = children ?? (id ? ERRORS[id].title : null);
  if (!text) return null;
  return (
    /* items-start + min-w-0 + wrapping text: the message is whatever the
       server said, so it is arbitrary length. Centred, non-shrinking flex
       children pushed a long one 174px out through the form. */
    <p role="alert" className="mt-1 flex min-w-0 items-start gap-1.5 text-[12px] font-medium text-espelette">
      <AlertCircle size={13} aria-hidden className="mt-[2px] shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
    </p>
  );
}
