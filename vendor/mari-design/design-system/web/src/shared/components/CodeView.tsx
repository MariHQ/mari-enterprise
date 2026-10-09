import { useMemo } from "react";

/** Minimal syntax highlighter for json / diff / markdown. */
export const CodeView = ({ kind, value }: { kind: "json" | "diff" | "markdown" | "table"; value: string }) => {
  const lines = useMemo(() => value.split("\n"), [value]);

  return (
    <pre className="font-mono text-[12.5px] leading-[1.65] text-foreground/90 px-0 overflow-x-auto">
      {lines.map((line, i) => {
        let cls = "";
        let content: React.ReactNode = line;

        if (kind === "diff") {
          if (line.startsWith("+++") || line.startsWith("---")) cls = "text-muted-foreground";
          else if (line.startsWith("@@")) cls = "text-purple2";
          else if (line.startsWith("+")) cls = "bg-emerald2/10 text-emerald2";
          else if (line.startsWith("-")) cls = "bg-rose2/10 text-rose2";
          else if (line.startsWith("diff ")) cls = "text-amber2";
        } else if (kind === "json") {
          content = highlightJson(line);
        } else if (kind === "markdown") {
          if (line.startsWith("# ")) cls = "text-foreground font-semibold";
          else if (line.startsWith("## ")) cls = "text-primary-glow font-semibold";
          else if (line.startsWith(">")) cls = "text-muted-foreground italic";
          else if (/^\d+\./.test(line)) cls = "text-amber2";
          else if (line.startsWith("- ")) cls = "text-emerald2";
        } else if (kind === "table") {
          if (i === 0) cls = "text-muted-foreground border-b border-border pb-1";
        }

        return (
          <div key={i} className={`flex items-start gap-4 px-5 ${cls}`}>
            <span className="select-none w-8 shrink-0 text-right text-muted-foreground/50 tabular-nums">
              {i + 1}
            </span>
            <span className="whitespace-pre">{content}</span>
          </div>
        );
      })}
    </pre>
  );
};

function highlightJson(line: string): React.ReactNode {
  // Tokenize: keys, strings, numbers, booleans, punctuation
  const parts: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(\b\d+(?:\.\d+)?\b)|(\btrue|false|null\b)|([{}\[\],])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <span key={key++} className={m[2] ? "text-primary-glow" : "text-emerald2"}>{m[1]}</span>
      );
      if (m[2]) parts.push(<span key={key++} className="text-muted-foreground">{m[2]}</span>);
    } else if (m[3]) {
      parts.push(<span key={key++} className="text-amber2">{m[3]}</span>);
    } else if (m[4]) {
      parts.push(<span key={key++} className="text-purple2">{m[4]}</span>);
    } else if (m[5]) {
      parts.push(<span key={key++} className="text-muted-foreground">{m[5]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <>{parts}</>;
}