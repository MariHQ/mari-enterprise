import type { DateInput } from "../tokens/format";

/* The three speakers in an agent transcript. `warning` is the agent's own
   out-of-band notice (rate limits, degraded mode) — rendered inline, not
   as a bubble. */
export type ChatRole = "user" | "assistant" | "warning";

/* What the agent needs before a tool can run: an authorization the workspace
   has not granted yet. `setupUrl` is where the reader goes to grant it, so the
   tool row can render a real call to action instead of a dead end. */
export type ToolAuthData = {
  provider: string;
  kind?: string;
  scopes?: string[];
  setupUrl?: string;
};

/* One agent tool call / step.
   `ok` follows the source's three-state idiom:
     null (or undefined) — still running, shows a spinner
     true               — finished, `summary` is the result line
     false              — failed, rendered in the error tone
   `state` is the richer lifecycle the server streams (a proposal the model has
   not committed to yet, a run in flight, a finished call, or a call blocked on
   authorization). `ok` and `state` are both kept because `ok` is what the
   glyph reads and older payloads carry only `ok`.
   `args` are shown inline (truncated) and in full when the row is expanded. */
export type ToolCallData = {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
  summary?: string;
  ok?: boolean | null;
  state?: "proposed" | "running" | "complete" | "auth_required";
  /** Set when `state` is "auth_required". Drives the Connect call to action. */
  auth?: ToolAuthData;
};

/* One document the agent cited, as the server sends it on the `meta` event
   before any tokens arrive.
   `n` is the citation number the answer text refers to as `[n]`.
   `snippet` is the passage the retriever matched; `meta` is the older name for
   the same field and is read as a fallback so a pre-snippet server still
   renders.
   `href` is a console route and is useless to an anonymous reader, so the
   public variant of <Sources> links `source_url` or nothing at all. */
export type ChatSourceData = {
  n: number;
  /** Provider key: slack, github, confluence, gdocs… Drives <SourceMark>. */
  source: string;
  /** What kind of thing it is inside that provider: message, issue, page… */
  kind?: string;
  title: string;
  snippet?: string;
  /** Legacy alias of `snippet`. */
  meta?: string;
  author?: string;
  updated?: DateInput;
  tags?: string[];
  /** Server-assigned document id. Numeric on some deployments, so both. */
  document_id?: string | number;
  /** In-console route to the document. */
  href?: string;
  /** Canonical URL at the provider, when the document has one. */
  source_url?: string | null;
  /** Retrieval score, 0 to 1. Not rendered; kept so callers can sort. */
  score?: number;
};

/* Where a <Sources> block is being read.
     console — an authenticated reader, so `href` (a console route) wins.
     public  — an anonymous reader, so only `source_url` is linkable and a
               document without one renders as plain text. */
export type SourceVariant = "console" | "public";

/* One transcript entry. Assistant messages may carry a `tools` trace that
   renders above the reply text (the ⏺ tool rows), a `sources` list that
   renders under it, and may be `streaming` while tokens are still arriving. */
export type ChatMessageData = {
  id: string;
  role: ChatRole;
  content: string;
  tools?: ToolCallData[];
  /** Documents the reply cites. Rendered by <Sources> under the reply. */
  sources?: ChatSourceData[];
  streaming?: boolean;
  at?: DateInput;
};
