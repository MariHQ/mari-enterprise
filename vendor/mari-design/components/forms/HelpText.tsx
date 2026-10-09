import { Fragment } from "react";

/* Help copy may name a URL ("Create one at https://…"). A URL nobody can
 * click is a chore to transcribe, so it renders as a real link — opening in
 * a new tab, because the half-filled form underneath must not be lost. The
 * scheme is dropped from the visible text; trailing punctuation stays text.
 */
const URL_RE = /(https?:\/\/[^\s]+)/g;

export function HelpText({ children }: { children: string }) {
  const parts = String(children).split(URL_RE);
  return (
    <>
      {parts.map((part, index) => {
        if (!/^https?:\/\//.test(part)) return <Fragment key={index}>{part}</Fragment>;
        const trailing = /[.,)]+$/.exec(part)?.[0] ?? "";
        const href = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <Fragment key={index}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-biscay-2 underline underline-offset-2 hover:text-biscay"
            >
              {href.replace(/^https?:\/\//, "")}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
}
