/* The console's error/warning catalog.
 *
 * Every user-visible failure message lives here so wording, tone, and the
 * "what do I do now" line stay consistent. Render with <ErrorMessage id="…" />
 * (banner) or pull `.title` / `.body` for inline field errors.
 *
 * Rules: sentence case, no em dashes, name the thing that failed, and always
 * end with an action the user can take. */

export type ErrorTone = "blocked" | "attention" | "info";

export type ErrorSpec = {
  /** Stable id used by <ErrorMessage id> and by tests. */
  id: string;
  tone: ErrorTone;
  title: string;
  body: string;
  /** Label for the recovery control, when one applies. */
  action?: string;
};

export const ERRORS = {
  /* ── connectivity ──────────────────────────────────────────────── */
  "network.offline": {
    id: "network.offline", tone: "blocked",
    title: "You are offline",
    body: "Mari cannot reach the server. Changes made now are not saved.",
    action: "Retry",
  },
  "network.timeout": {
    id: "network.timeout", tone: "blocked",
    title: "Request timed out",
    body: "The server did not respond in time. Nothing was changed.",
    action: "Try again",
  },
  "server.unavailable": {
    id: "server.unavailable", tone: "blocked",
    title: "Service unavailable",
    body: "Mari is temporarily unreachable. We are retrying automatically.",
    action: "Retry now",
  },

  /* ── auth & access ─────────────────────────────────────────────── */
  "auth.expired": {
    id: "auth.expired", tone: "attention",
    title: "Your session expired",
    body: "Sign in again to continue where you left off.",
    action: "Sign in",
  },
  "auth.invalid": {
    id: "auth.invalid", tone: "blocked",
    title: "Incorrect email or password",
    body: "Check the address and try again, or reset your password.",
    action: "Reset password",
  },
  "auth.forbidden": {
    id: "auth.forbidden", tone: "blocked",
    title: "You do not have access",
    body: "Ask a workspace owner to grant you the Editor role for this space.",
    action: "Request access",
  },

  /* ── validation ────────────────────────────────────────────────── */
  "field.required": {
    id: "field.required", tone: "blocked",
    title: "This field is required",
    body: "Fill it in before saving.",
  },
  "field.invalidEmail": {
    id: "field.invalidEmail", tone: "blocked",
    title: "That is not a valid email address",
    body: "Use the form name@company.com.",
  },
  "field.tooLong": {
    id: "field.tooLong", tone: "attention",
    title: "That is too long",
    body: "Shorten the text to fit the limit shown under the field.",
  },
  "form.unsaved": {
    id: "form.unsaved", tone: "attention",
    title: "You have unsaved changes",
    body: "Save or discard them before leaving this page.",
    action: "Save changes",
  },

  /* ── sources & sync ────────────────────────────────────────────── */
  "connector.authFailed": {
    id: "connector.authFailed", tone: "blocked",
    title: "Could not connect the source",
    body: "The provider rejected the credentials. Reconnect and grant the requested scopes.",
    action: "Reconnect",
  },
  "connector.rateLimited": {
    id: "connector.rateLimited", tone: "attention",
    title: "The provider is rate limiting us",
    body: "Sync is paused and will resume on its own. Existing content is unaffected.",
    action: "Pause sync",
  },
  "sync.partial": {
    id: "sync.partial", tone: "attention",
    title: "Sync finished with skipped items",
    body: "Some documents could not be read. Open the run to see which ones and why.",
    action: "View run",
  },
  "sync.stuck": {
    id: "sync.stuck", tone: "attention",
    title: "This sync is not making progress",
    body: "It has been retrying the same page for several minutes. Pause it and start a fresh run.",
    action: "Pause sync",
  },

  /* ── upload ────────────────────────────────────────────────────── */
  "upload.unsupportedType": {
    id: "upload.unsupportedType", tone: "blocked",
    title: "That file type is not supported",
    body: "Upload PDF, Markdown, plain text, HTML, DOCX, or CSV files.",
  },
  "upload.tooLarge": {
    id: "upload.tooLarge", tone: "blocked",
    title: "That file is too large",
    body: "Each file must be 25 MB or smaller. Split it and upload the parts.",
  },
  "upload.failed": {
    id: "upload.failed", tone: "blocked",
    title: "Upload failed",
    body: "The file did not finish uploading. Nothing was added to the library.",
    action: "Try again",
  },

  /* ── documents & workflow ──────────────────────────────────────── */
  "doc.conflict": {
    id: "doc.conflict", tone: "attention",
    title: "Someone else edited this document",
    body: "Review their changes before saving yours so nothing is overwritten.",
    action: "Review changes",
  },
  "doc.notFound": {
    id: "doc.notFound", tone: "blocked",
    title: "This document no longer exists",
    body: "It was deleted or moved out of a synced folder.",
    action: "Back to library",
  },
  "run.failed": {
    id: "run.failed", tone: "blocked",
    title: "The run failed",
    body: "A step returned an error and the flow stopped. Open the run log for the failing step.",
    action: "Open run log",
  },
  "run.needsApproval": {
    id: "run.needsApproval", tone: "info",
    title: "This run is waiting on you",
    body: "It is paused at an approval step and will not continue until you approve it.",
    action: "Approve and resume",
  },

  /* ── models & keys ─────────────────────────────────────────────── */
  "model.testFailed": {
    id: "model.testFailed", tone: "blocked",
    title: "Could not reach the model provider",
    body: "The endpoint or API key was rejected. Check both and test again.",
    action: "Test connection",
  },
  "apiKey.revoked": {
    id: "apiKey.revoked", tone: "attention",
    title: "This key was revoked",
    body: "Anything using it will start failing. Create a replacement key.",
    action: "Create key",
  },

  /* ── first-run setup ───────────────────────────────────────────── */
  "setup.tokenRejected": {
    id: "setup.tokenRejected", tone: "blocked",
    title: "That setup token was not accepted",
    body: "The token is wrong or has already been used. Copy a fresh one from the server console output.",
    action: "Try again",
  },

  /* ── generic ───────────────────────────────────────────────────── */
  "generic.saveFailed": {
    id: "generic.saveFailed", tone: "blocked",
    title: "Could not save",
    body: "Your changes are still here. Try saving again.",
    action: "Retry",
  },
  "generic.unknown": {
    id: "generic.unknown", tone: "blocked",
    title: "Something went wrong",
    body: "The action did not complete. If it keeps happening, contact support.",
    action: "Retry",
  },
} satisfies Record<string, ErrorSpec>;

export type ErrorId = keyof typeof ERRORS;

export const ERROR_LIST: ErrorSpec[] = Object.values(ERRORS);
