import { useEffect, useId, useRef, type ReactNode } from "react";
import { SectionLabel } from "./SectionLabel";

/* Anything that takes a name from a label. Radix's Select trigger is a button
   with role="combobox", so it is named the same way a native <select> is. */
const CONTROL = [
  'input:not([type="hidden"])',
  "select",
  "textarea",
  '[role="combobox"]',
  '[role="textbox"]',
  '[contenteditable="true"]',
].join(",");

/* Field is a DISPLAY row — label above a value — and the console renders 66 of
   its form controls inside it anyway (every input on Login and Setup, 18 in the
   pipeline editor, every credential field in both connect flows). A <span>
   sitting beside a control names nothing, so all of those were unnamed to
   assistive tech (ACC-02).

   The association cannot be authored at the call site: the control can sit at
   any depth under `children`, is frequently not a control at all, and none of
   the 66 sites can be reached from here. So it is wired after paint instead —
   the first labelable control in the value slot that has no name of its own
   takes this row's label, by htmlFor (which also makes the label clickable) and
   by aria-labelledby. A row holding plain text finds nothing and is left
   exactly as it was.

   The effect runs on every render with no dependency list: `children` here are
   dynamic (credential fields appear per connector, pipeline steps swap their
   whole config block) and a dependency array cannot see inside them. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  const labelRef = useRef<HTMLLabelElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const labelEl = labelRef.current;
    if (!labelEl) return;
    const control = valueRef.current?.querySelector<HTMLElement>(CONTROL) ?? null;
    // Ours already: re-apply, and do not read our own wiring as "it has a name".
    const mine = control?.getAttribute("aria-labelledby") === labelId;
    const named = !!control && !mine && (
      control.hasAttribute("aria-label") ||
      control.hasAttribute("aria-labelledby") ||
      ((control as HTMLInputElement).labels?.length ?? 0) > 0
    );
    if (!control || named) { labelEl.removeAttribute("for"); return; }
    if (!control.id) control.id = `${labelId}control`;
    labelEl.htmlFor = control.id;
    control.setAttribute("aria-labelledby", labelId);
  });

  return (
    <div className="py-2.5 border-b border-ink/10 last:border-0">
      {/* A <label> rather than a bare span so the association is a real one; it
          is display:block and wraps only the label text, so the row looks and
          measures exactly as before. */}
      <label ref={labelRef} id={labelId} className="block">
        <SectionLabel>{label}</SectionLabel>
      </label>
      <div ref={valueRef} className="mt-1 min-w-0 break-words text-[13px] text-ink/90">{children}</div>
    </div>
  );
}
