import { useState } from "react";
import { Eye, Columns2, Pencil } from "lucide-react";
import { Button } from "../actions/Button";
import { focusRing } from "../tokens/focusRing";
import { MarkdownView } from "./MarkdownView";
import { Scrollable } from "./Scrollable";

// A self-contained markdown editor: a monospace source pane and a live
// blueprint preview, controlled by value + onChange.
//
// This is also Doc Review's Source mode. It used to be exported and used
// nowhere, which was the odd part: it is the one editing surface here that
// cannot lose data, because it never re-serializes — the markdown the user
// typed is the markdown that is saved. The block editor is the rich view over
// the same body; this is the escape hatch for everything the block editor
// shows read-only (tables, front matter, raw HTML).

type Mode = "split" | "write" | "preview";

const SOURCE = `w-full h-full min-h-[240px] resize-none px-3.5 py-3 font-term text-[13px] leading-[1.6] text-ink bg-paper placeholder:text-ink/35 outline-none ${focusRing}`;

export type MarkdownEditorProps = {
  /** Controlled markdown source. */
  value: string;
  onChange: (value: string) => void;
  /** Initial layout; user can switch with the toolbar. */
  defaultMode?: Mode;
  placeholder?: string;
  className?: string;
};

const MODES: { mode: Mode; label: string; icon: typeof Eye }[] = [
  { mode: "write", label: "Write", icon: Pencil },
  { mode: "split", label: "Split", icon: Columns2 },
  { mode: "preview", label: "Preview", icon: Eye },
];

/** Controlled markdown editor: monospace source + live styled preview. */
export function MarkdownEditor({
  value,
  onChange,
  defaultMode = "split",
  placeholder = "Write markdown…",
  className = "",
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const showSource = mode !== "preview";
  const showPreview = mode !== "write";

  return (
    <div className={`flex flex-col rounded-md border border-ink/15 bg-paper overflow-hidden ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-ink/12 bg-flysch/60">
        <span className="font-term text-[11px] uppercase tracking-wide text-ink/65">Markdown</span>
        <div className="flex items-center gap-1">
          {MODES.map(({ mode: m, label, icon: Icon }) => (
            <Button
              key={m}
              compact
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={mode === m ? "border-biscay-2/50 text-ink bg-biscay-2/[0.06]" : ""}
              title={label}
            >
              <Icon size={13} /> {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Fixed columns, no breakpoint: components here are desktop-first and a
          page decides how narrow they ever get (CONVENTIONS.md §10). The
          `md:` split made this render single-column inside a desktop drawer. */}
      <div className={`grid ${showSource && showPreview ? "grid-cols-2 divide-x" : "grid-cols-1"} h-[360px] divide-ink/12`}>
        {/* h-full on the source scroll box so the h-full textarea fills the
            pane (a percentage height needs a sized parent, not max-h). */}
        {showSource && (
          <Scrollable axis="both" className="min-h-0" scrollerClassName="h-full">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              /* Prose, not code: this is where a writer edits the body of a
                 document, so the browser's spell checker belongs on it. */
              spellCheck
              className={SOURCE}
            />
          </Scrollable>
        )}
        {showPreview && (
          <Scrollable axis="both" className="min-h-0" scrollerClassName="px-4 py-3">
            {value.trim()
              ? <MarkdownView>{value}</MarkdownView>
              : <p className="font-term text-[13px] text-ink/35">Nothing to preview yet.</p>}
          </Scrollable>
        )}
      </div>
    </div>
  );
}
