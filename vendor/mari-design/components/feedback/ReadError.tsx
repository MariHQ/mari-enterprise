import type { ReactNode } from "react";
import { Alert } from "./Alert";
import { ErrorMessage } from "./ErrorMessage";

/* The failure surface for a page READ, and the twin of <WriteError>
   (pages/types.ts, CONVENTIONS §8).

   XA-01: the same `error: string | null` prop was rendered eight ways across
   ~20 pages — an EmptyState with an icon, an EmptyState without one, a
   Card-wrapped EmptyBox, an Alert titled with the catalog string, an Alert
   titled with the SERVER's text, a bare <div>, a bespoke inline <span>, and
   the one §8-correct <ErrorMessage id="server.unavailable" />. Seventeen of
   them hardcoded the literal "API offline", which §8 forbids and which is a
   second spelling of ERRORS["server.unavailable"].title.

   Two of those were wrong beyond the inconsistency:

   - An EmptyState is the "nothing here yet" surface. Using it for a failed
     read tells the reader their workspace is empty when the truth is that the
     request did not come back. A read failure is a blocked Alert, never an
     empty state.
   - The server's own text is a DETAIL, not a heading. As the Alert title it
     replaced the catalog's wording with whatever a stack trace happened to
     say, so the copy rules stopped applying at the one moment they matter.

   So: catalog title and body from ERRORS["server.unavailable"], the server's
   message underneath as detail. Renders nothing when there is nothing to
   report, so a section can drop it in unconditionally. */
export function ReadError({ children, onRetry, onDismiss }: {
  /** The message the API actually returned. Shown under the standard body. */
  children?: ReactNode;
  /** Wires the catalog's "Retry now" control. Omitted = no button. */
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  if (typeof children === "string" && children.startsWith("GRAPH_REQUIREMENTS:")) {
    return <Alert tone="attention" title="Graph mappings needed">
      <div className="whitespace-pre-line">{children.slice("GRAPH_REQUIREMENTS:".length)}</div>
    </Alert>;
  }
  return (
    <ErrorMessage id="server.unavailable" onAction={onRetry} onDismiss={onDismiss}>
      {children}
    </ErrorMessage>
  );
}
