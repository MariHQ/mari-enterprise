import { useState } from "react";
import { Check, X, ChevronRight, KeyRound } from "lucide-react";
import { buttonClasses } from "../actions/Button";
import { Scrollable } from "../data-display/Scrollable";
import { Spinner } from "../data-display/Spinner";
import { SourceMark } from "../icons/marks";
import { focusRing } from "../tokens/focusRing";
import type { ToolCallData } from "./types";

/** "slack" reads as a key, "Slack" reads as the thing the reader connects. */
const providerLabel = (p: string) =>
  p ? p.charAt(0).toUpperCase() + p.slice(1) : "the source";

function shortArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => {
      if (typeof v === "string") {
        const s = v.length > 42 ? v.slice(0, 42) + "…" : v;
        return `${k}: ${JSON.stringify(s)}`;
      }
      return `${k}: ${String(v)}`;
    })
    .join(", ");
}

/* ToolCall — the ⏺ idiom from Claude Code, ported to notebook paper. A
   collapsible row: status glyph (spinner → check/cross), monospace tool
   name, truncated args, and a chevron. Expands to a raw JSON detail block.
   Running rows (ok == null) show a spinner and a "Running…" summary. */
export function ToolCall({ tool }: { tool: ToolCallData }) {
  const [expanded, setExpanded] = useState(false);
  const running = tool.ok == null;
  const failed = tool.ok === false;
  const proposed = tool.state === "proposed";
  const authRequired = tool.state === "auth_required";
  const args = tool.args ?? {};

  return (
    <div
      /* 16px of padding behind a 2px rule lands the trace text on the same
         18px indent as the assistant's reply text (CHAT_INDENT). */
      className={[
        "pl-4 border-l-2",
        authRequired ? "border-clay/45" : failed ? "border-espelette/45" : "border-ink/10",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className={`flex items-center gap-1.5 w-full min-w-0 py-0.5 text-left text-[12.5px] group ${focusRing}`}
      >
        <span
          className={[
            "inline-flex items-center justify-center w-4 h-4 shrink-0",
            authRequired ? "text-clay" : failed ? "text-espelette" : "text-moss",
          ].join(" ")}
          aria-hidden="true"
        >
          {/* Waiting on an authorization is not a failure — nothing went
              wrong, the reader has something to do. A red cross says the
              opposite and sends them looking for a bug. */}
          {authRequired ? (
            <KeyRound size={13} />
          ) : running ? (
            <Spinner size="sm" label={`Running ${tool.name}`} />
          ) : failed ? (
            <X size={13} />
          ) : (
            <Check size={13} />
          )}
        </span>
        <span className="shrink-0 font-term font-semibold text-ink group-hover:underline decoration-wavy">
          {tool.name}
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-term text-ink/65">
          ({shortArgs(args)})
        </span>
        <span
          className={`ml-auto shrink-0 inline-flex text-ink/65 transition-transform ${expanded ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <ChevronRight size={12} />
        </span>
      </button>

      {authRequired ? (
        /* The one row that carries an action instead of a result. It gets a
           block of its own because the summary line is a single clipped line
           (§12) and a call to action that ellipsises is not one. The button is
           BOTTOM LEFT (§2), and it is an <a> because it goes to a URL: a
           <button onClick> would take away cmd-click and copy link address. */
        <div className="ml-[22px] mb-1.5 px-2.5 py-2 rounded-[4px] border border-clay/35 bg-clay/[0.07]">
          <p className="text-[12.5px] leading-snug text-clay">
            {providerLabel(tool.auth?.provider ?? "")} is not connected, so this step did not run.
          </p>
          {tool.auth?.scopes && tool.auth.scopes.length > 0 && (
            <p className="mt-1 font-term text-[11px] leading-snug text-ink/70 [overflow-wrap:anywhere]">
              Needs {tool.auth.scopes.join(", ")}
            </p>
          )}
          {tool.auth?.setupUrl && (
            <a
              href={tool.auth.setupUrl}
              className={`${buttonClasses({ variant: "primary", compact: true, className: "mt-2" })}`}
            >
              <SourceMark provider={tool.auth.provider} size={13} />
              Connect {providerLabel(tool.auth.provider)}
            </a>
          )}
        </div>
      ) : (
        <div className="pb-0.5 pl-[22px] text-[12.5px] text-ink/70 overflow-hidden text-ellipsis whitespace-nowrap">
          {proposed ? "Proposed speculatively" : running ? "Running…" : tool.summary}
        </div>
      )}

      {expanded && (
        <Scrollable fade="flysch" className="ml-[22px] mb-1.5 rounded-[4px] border border-ink/10 bg-flysch">
          <pre className="px-2.5 py-2 font-term text-[11.5px] leading-relaxed text-ink/70">
            {JSON.stringify({ args, result: tool.summary, ok: tool.ok }, null, 2)}
          </pre>
        </Scrollable>
      )}
    </div>
  );
}
