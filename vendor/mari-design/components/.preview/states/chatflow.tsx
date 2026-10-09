import { Plus, X } from "lucide-react";
import type { ComponentSpec } from "./types";
import {
  ChatDock, ChatMessage, Sources, ToolCall, Composer, TypingIndicator,
  Button, type ChatMessageData, type ChatSourceData, type ToolCallData,
} from "../../index";

/* State matrix for the chatflow group. Author EVERY state worth reviewing:
   default, each variant, loading, empty, error, disabled, selected, and the
   overflow cases (very long text, unbreakable strings, too many items, a
   frame too narrow). Overflow states are where layout actually breaks. */

const LONG =
  "Quarterly revenue recognition policy for multi-year enterprise agreements with usage-based true-ups and mid-term amendments";
const BODY =
  "I searched every connected source, read the twelve documents that mention the trial length, and tagged the three that still quote the retired figure. Nothing was published.";
const HUGE =
  "Supercalifragilisticexpialidocious_configuration_parameter_value_that_never_wraps_00";

const dock = (node: React.ReactNode, h = 420) => <div style={{ height: h }} className="flex">{node}</div>;

const TRANSCRIPT: ChatMessageData[] = [
  { id: "1", role: "user", content: "Which docs still say trials are 14 days?" },
  {
    id: "2", role: "assistant",
    content: "Three documents still quote 14 days: the pricing sheet, the onboarding runbook, and one support macro.",
    tools: [
      { id: "t1", name: "search_docs", args: { query: "trial length 14 days", limit: 25 }, summary: "12 matches across 4 sources", ok: true },
      { id: "t2", name: "tag_documents", args: { tag: "stale", ids: ["d_881", "d_902", "d_915"] }, summary: "3 documents tagged Stale", ok: true },
    ],
  },
  { id: "3", role: "user", content: "Fix the pricing sheet." },
  { id: "4", role: "warning", content: "Editing published documents is off in this workspace. I can draft the change instead." },
];

const STREAMING: ChatMessageData[] = [
  ...TRANSCRIPT.slice(0, 1),
  {
    id: "s", role: "assistant", content: "Searching the connected sources", streaming: true,
    tools: [{ id: "t1", name: "search_docs", args: { query: "trial length" }, ok: null }],
  },
];

const OVERFLOW_TRANSCRIPT: ChatMessageData[] = [
  { id: "1", role: "user", content: `${LONG} ${HUGE}` },
  {
    id: "2", role: "assistant", content: `${BODY} ${HUGE}`,
    tools: [
      { id: "t1", name: "search_documents_across_every_connected_source", args: { query: LONG, filter: HUGE }, summary: `${BODY} ${HUGE}`, ok: true },
      { id: "t2", name: "fail_case", args: { id: HUGE }, summary: "The source rejected the request: token expired.", ok: false },
    ],
  },
  { id: "3", role: "warning", content: `${BODY} ${HUGE}` },
];


/* ————— the answer as the agent actually writes it —————
   Markdown, with `[n]` citations that resolve against SOURCES_3. Everything
   here is a block the reply renderer has to survive: a bold run, a demoted
   heading, a list, inline code, a fence, and a pipe table (which has to scroll
   inside the dock rather than widen it). */
const MD_ANSWER = [
  "Trials run **30 days** from first login, not 14 [1]. The 14 day figure was",
  "retired in the March pricing update [2] but three customer-facing documents",
  "still quote it [3].",
  "",
  "# What to fix",
  "",
  "1. The pricing page, which is the one customers read [3].",
  "2. The onboarding email, which repeats it [3].",
  "3. One support macro, which is internal [1].",
  "",
  "The value itself lives in `config/plans.yml`:",
  "",
  "```yaml",
  "plans:",
  "  team:",
  "    trial_days: 30",
  "```",
  "",
  "| Plan | Trial | Changed |",
  "| --- | --- | --- |",
  "| Team | 30 days | Mar 2026 |",
  "| Enterprise | 30 days | Mar 2026 |",
  "| Legacy | 14 days | never |",
].join("\n");

const SOURCES_3: ChatSourceData[] = [
  {
    n: 1, source: "confluence", kind: "page", title: "Pricing and packaging, 2026",
    snippet: "## Trial length\n\nEvery new workspace gets **30 days** from first login. The clock does not start at signup.",
    author: "Dana Reyes", updated: "2026-08-19T09:12:00Z", tags: ["Canonical", "Customer facing"],
    document_id: "d_881", href: "/knowledge/d_881",
    source_url: "https://mari-hq.atlassian.net/wiki/spaces/FERN/pages/881", score: 0.94,
  },
  {
    n: 2, source: "slack", kind: "message", title: "#pricing, trial length decision",
    snippet: "Confirmed with finance: we go to 30 days on the 3rd. Someone please sweep the docs.",
    author: "Priya Raman", updated: "2026-03-03T16:40:00Z", tags: ["Decision"],
    document_id: "d_902", href: "/knowledge/d_902", source_url: null, score: 0.81,
  },
  {
    n: 3, source: "github", kind: "pull request", title: "Retire the 14 day trial copy",
    snippet: "Sweeps the marketing site and the onboarding email. Does not touch the support macros.",
    author: "Sam Okafor", updated: "2026-08-21T11:05:00Z", tags: ["Needs review"],
    document_id: "d_915", href: "/knowledge/d_915",
    source_url: "https://github.com/mari-hq/site/pull/4120", score: 0.77,
  },
];

/* Nine rows: past six the list stops grouping by provider, keeps citation
   order, and hides the tail behind "Show all". */
const SOURCES_9: ChatSourceData[] = [
  ...SOURCES_3,
  { n: 4, source: "gdocs", kind: "document", title: "Q3 launch brief", snippet: "Trial: 30 days, no card required.", author: "Dana Reyes", updated: "2026-07-02T08:00:00Z", document_id: "d_920", href: "/knowledge/d_920", source_url: "https://docs.google.com/document/d/920", score: 0.71 },
  { n: 5, source: "zendesk", kind: "macro", title: "Macro: trial extension request", snippet: "Offer one 14 day extension on top of the trial.", author: "Support ops", updated: "2025-11-18T14:20:00Z", tags: ["Stale"], document_id: "d_931", href: "/knowledge/d_931", source_url: null, score: 0.64 },
  { n: 6, source: "linear", kind: "issue", title: "MARI-412, sweep trial copy", snippet: "Blocked on the pricing page rewrite.", author: "Sam Okafor", updated: "2026-08-11T09:30:00Z", document_id: "d_944", href: "/knowledge/d_944", source_url: "https://linear.app/mari/issue/MARI-412", score: 0.58 },
  { n: 7, source: "notion", kind: "page", title: LONG, snippet: `${BODY} ${HUGE}`, author: "Finance", updated: "2026-06-01T00:00:00Z", tags: ["Internal", "Canonical", "Decision chunk", "Needs review", "Archived"], document_id: "d_950", href: "/knowledge/d_950", source_url: "https://notion.so/950", score: 0.52 },
  { n: 8, source: "zendesk", kind: "ticket", title: "Ticket 88214, customer quoted 14 days", snippet: "Customer read the old figure on the pricing page and asked for a credit.", author: "Renee Kim", updated: "2026-08-20T17:45:00Z", document_id: "d_961", href: "/knowledge/d_961", source_url: null, score: 0.44 },
  { n: 9, source: "confluence", kind: "page", title: "Pricing page copy", snippet: "Start a free 14 day trial. No card required.", updated: "2026-08-22T06:00:00Z", tags: ["Customer facing"], document_id: "d_970", href: "/knowledge/d_970", source_url: null, score: 0.41 },
];

/* The payload before snippets, kinds, authors, tags and canonical URLs
   existed. Everything optional is absent, and `meta` is where the snippet is.
   The block still has to render, and the public variant still has to refuse to
   link a console-only href. */
const SOURCES_OLD: ChatSourceData[] = [
  { n: 1, source: "confluence", title: "Pricing and packaging, 2026", meta: "Every new workspace gets 30 days from first login.", document_id: "d_881", href: "/knowledge/d_881" },
  { n: 2, source: "slack", title: "#pricing, trial length decision", meta: "Confirmed with finance: we go to 30 days on the 3rd.", document_id: "d_902", href: "/knowledge/d_902" },
];

/* Two citation numbers, one document: the list must show one row and both
   numbers must still find it. */
const SOURCES_DUPED: ChatSourceData[] = [
  ...SOURCES_3,
  { ...SOURCES_3[0], n: 4 },
  { ...SOURCES_3[1], n: 5 },
];

const AUTH_TOOL: ToolCallData = {
  id: "t-auth", name: "search_slack", args: { query: "trial length", limit: 25 },
  ok: false, state: "auth_required",
  auth: { provider: "slack", kind: "oauth", scopes: ["channels:read", "search:read"], setupUrl: "/settings/sources/slack" },
};

const CITED: ChatMessageData[] = [
  { id: "c1", role: "user", content: "How long is the trial, and what still says 14 days?" },
  {
    id: "c2", role: "assistant", content: MD_ANSWER, sources: SOURCES_3,
    tools: [{ id: "t1", name: "search_knowledge", args: { query: "trial length" }, summary: "3 documents, 9 passages", ok: true }],
  },
];

const CITED_LONG: ChatMessageData[] = [
  { id: "l1", role: "user", content: "Everything we have on trial length, please." },
  { id: "l2", role: "assistant", content: MD_ANSWER, sources: SOURCES_9 },
];

const AUTH_TRANSCRIPT: ChatMessageData[] = [
  { id: "a1", role: "user", content: "What did #pricing say about the trial?" },
  {
    id: "a2", role: "assistant",
    content: "I could not read Slack, so this answer is from Confluence only [1].",
    sources: [SOURCES_3[0]],
    tools: [
      { id: "t1", name: "search_knowledge", args: { query: "trial length" }, summary: "1 document", ok: true },
      AUTH_TOOL,
    ],
  },
];

export const CHATFLOW: ComponentSpec[] = [
  {
    id: "ChatDock", title: "ChatDock", width: 460,
    states: [
      { id: "default", label: "Transcript (indent plumb line)", node: dock(
        <ChatDock className="flex-1" messages={TRANSCRIPT} onSend={() => {}} hint="Shift + Enter for a new line." />) },
      { id: "empty", label: "Empty with suggestions", node: dock(
        <ChatDock className="flex-1" messages={[]} onSend={() => {}}
          suggestions={["What changed this week?", "Find stale docs", "Sync Slack"]} />) },
      { id: "streaming", label: "Streaming (stop button)", node: dock(
        <ChatDock className="flex-1" messages={STREAMING} isStreaming onSend={() => {}} onStop={() => {}} />) },
      { id: "working", label: "Working, no tokens yet", node: dock(
        <ChatDock className="flex-1" messages={TRANSCRIPT.slice(0, 1)} isStreaming onSend={() => {}} onStop={() => {}} />) },
      { id: "header-actions", label: "Header actions and long title", node: dock(
        <ChatDock className="flex-1" title={LONG} messages={TRANSCRIPT.slice(0, 2)} onSend={() => {}}
          headerActions={<><Button icon compact aria-label="New conversation"><Plus size={14} /></Button><Button icon compact aria-label="Close"><X size={14} /></Button></>} />) },
      { id: "overflow", label: "Overflow: long content, unbreakable string", node: dock(
        <ChatDock className="flex-1" messages={OVERFLOW_TRANSCRIPT} onSend={() => {}} hint={HUGE} />, 520) },
      { id: "cited", label: "Markdown answer with 3 sources", node: dock(
        <ChatDock className="flex-1" title="Mari agent" messages={CITED} onSend={() => {}} />, 560) },
      { id: "cited-long", label: "Long answer, 9 sources, collapsed", node: dock(
        <ChatDock className="flex-1" title="Mari agent" messages={CITED_LONG} onSend={() => {}} />, 560) },
      { id: "auth", label: "Tool blocked on authorization", node: dock(
        <ChatDock className="flex-1" title="Mari agent" messages={AUTH_TRANSCRIPT} onSend={() => {}} />, 460) },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: dock(
        <ChatDock className="flex-1" messages={OVERFLOW_TRANSCRIPT} onSend={() => {}} />, 520) },
    ],
  },
  {
    id: "ChatMessage", title: "ChatMessage", width: 460,
    states: [
      { id: "roles", label: "User, assistant, warning", node: (
        <div className="flex flex-col gap-2">
          {TRANSCRIPT.map((m) => <ChatMessage key={m.id} message={m} />)}
        </div>) },
      { id: "streaming", label: "Streaming caret", node: (
        <ChatMessage message={{ id: "s", role: "assistant", content: "Reading the pricing sheet", streaming: true }} />) },
      { id: "tools-only", label: "Tool trace, no reply yet", node: (
        <ChatMessage message={{ id: "t", role: "assistant", content: "", tools: [
          { name: "search_docs", args: { query: "trial length" }, ok: null },
        ] }} />) },
      { id: "multiline", label: "Multi-line user turn", node: (
        <ChatMessage message={{ id: "u", role: "user", content: "Do two things:\n1. Find stale docs\n2. Tag them" }} />) },
      { id: "overflow", label: "Overflow: long content", node: (
        <div className="flex flex-col gap-2">
          {OVERFLOW_TRANSCRIPT.map((m) => <ChatMessage key={m.id} message={m} />)}
        </div>) },
      { id: "markdown", label: "Markdown reply with 3 sources", node: (
        <ChatMessage message={CITED[1]} />) },
      { id: "markdown-long", label: "9 sources, collapsed", node: (
        <ChatMessage message={CITED_LONG[1]} />) },
      { id: "sources-public", label: "Public variant (no console links)", node: (
        <ChatMessage message={CITED[1]} sourceVariant="public" />) },
      { id: "sources-old", label: "Old payload shape (meta, no snippet)", node: (
        <ChatMessage message={{ id: "old", role: "assistant", content: "Trials run 30 days from first login [1], confirmed in #pricing [2].", sources: SOURCES_OLD }} />) },
      { id: "streaming-markdown", label: "Streaming caret at the end of markdown", node: (
        <ChatMessage message={{ id: "sm", role: "assistant", streaming: true, content: "## What I found\n\n- The trial is **30 days**\n- Three docs still say 14" }} />) },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: (
        <div className="flex flex-col gap-2">
          {OVERFLOW_TRANSCRIPT.map((m) => <ChatMessage key={m.id} message={m} />)}
        </div>) },
    ],
  },
  {
    id: "Sources", title: "Sources", width: 460,
    states: [
      { id: "default", label: "Three sources, grouped by provider", node: (
        <Sources sources={SOURCES_3} />) },
      { id: "collapsed", label: "Nine sources, shut by default", node: (
        <Sources sources={SOURCES_9} />) },
      { id: "open-truncated", label: "Nine sources, open, six shown", node: (
        <Sources sources={SOURCES_9} defaultOpen />) },
      { id: "public", label: "Public variant: only canonical URLs link", node: (
        <Sources sources={SOURCES_9} variant="public" defaultOpen />) },
      { id: "old-shape", label: "Old payload shape (meta, no snippet)", node: (
        <Sources sources={SOURCES_OLD} />) },
      { id: "duped", label: "Duplicate document_id folds into one row", node: (
        <Sources sources={SOURCES_DUPED} />) },
      { id: "single", label: "One source", node: <Sources sources={[SOURCES_3[1]]} /> },
      { id: "narrow", label: "Overflow: long title, many tags, narrow frame", width: 320, node: (
        <Sources sources={SOURCES_9} defaultOpen />) },
    ],
  },
  {
    id: "ToolCall", title: "ToolCall", width: 460,
    states: [
      { id: "states", label: "Running, done, failed", node: (
        <div className="flex flex-col gap-1">
          <ToolCall tool={{ name: "search_docs", args: { query: "trial length" }, ok: null }} />
          <ToolCall tool={{ name: "tag_documents", args: { tag: "stale", count: 3 }, summary: "3 documents tagged Stale", ok: true }} />
          <ToolCall tool={{ name: "publish_document", args: { id: "d_881" }, summary: "Refused: publishing is off in this workspace.", ok: false }} />
        </div>) },
      { id: "no-args", label: "No args, no summary", node: <ToolCall tool={{ name: "list_sources", ok: true }} /> },
      { id: "auth-required", label: "Blocked on authorization (Connect call to action)", node: (
        <ToolCall tool={AUTH_TOOL} />) },
      { id: "auth-no-url", label: "Authorization needed, nowhere to send them", node: (
        <ToolCall tool={{ name: "search_gdocs", args: { query: "trial" }, ok: false, state: "auth_required", auth: { provider: "gdocs" } }} />) },
      { id: "proposed", label: "Proposed speculatively", node: (
        <ToolCall tool={{ name: "tag_documents", args: { tag: "stale" }, ok: null, state: "proposed" }} />) },
      { id: "overflow", label: "Overflow: long name, args, summary", node: (
        <ToolCall tool={{ name: "search_documents_across_every_connected_source_and_rank", args: { query: LONG, cursor: HUGE }, summary: `${BODY} ${HUGE}`, ok: true }} />) },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: (
        <div className="flex flex-col gap-1">
          <ToolCall tool={{ name: HUGE, args: { query: LONG }, summary: BODY, ok: false }} />
          <ToolCall tool={{ name: "search_docs", args: { query: LONG }, ok: null }} />
        </div>) },
    ],
  },
  {
    id: "Composer", title: "Composer", width: 460,
    states: [
      { id: "default", label: "Resting", node: <Composer onSend={() => {}} /> },
      { id: "streaming", label: "Streaming (Stop)", node: <Composer onSend={() => {}} isStreaming onStop={() => {}} /> },
      { id: "disabled", label: "Disabled", node: <Composer onSend={() => {}} disabled /> },
      { id: "overflow", label: "Overflow: long placeholder", node: <Composer onSend={() => {}} placeholder={`${LONG} ${HUGE}`} /> },
      { id: "narrow", label: "Overflow: narrow frame", width: 320, node: <Composer onSend={() => {}} placeholder={LONG} /> },
    ],
  },
  {
    id: "TypingIndicator", title: "TypingIndicator", width: 460,
    states: [
      { id: "default", label: "Default", node: <TypingIndicator /> },
      { id: "custom", label: "Custom label", node: <TypingIndicator label="reading 12 documents…" /> },
      { id: "narrow", label: "Overflow: long label, narrow frame", width: 320, node: <TypingIndicator label={LONG} /> },
    ],
  },
];
