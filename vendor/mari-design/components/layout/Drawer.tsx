import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Scrollable } from "../data-display/Scrollable";
import { focusRing } from "../tokens/focusRing";

/* ── Drawer: right-side detail panel ───────────────────────────────────────
   variant="overlay" (default) — modal slide-over: fixed, backdrop, focus-trapped.
   variant="inline"            — docked side panel that lives in the layout flow:
                                 no backdrop, no focus trap, no page cover. Use it
                                 as a master–detail pane that sits beside content
                                 instead of over it. */

type DrawerVariant = "overlay" | "inline";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  variant?: DrawerVariant;
  /** Hide the close button (handy for an always-docked inline pane). */
  closable?: boolean;
  className?: string;
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function DrawerBody({
  title, subtitle, icon, footer, children, onClose, closable, modal, panelRef, className,
}: {
  title: string; subtitle?: string; icon?: ReactNode; footer?: ReactNode; children: ReactNode;
  onClose: () => void; closable: boolean; modal: boolean;
  panelRef?: React.Ref<HTMLElement>; className: string;
}) {
  return (
    <aside
      ref={panelRef}
      role={modal ? "dialog" : "complementary"}
      aria-modal={modal || undefined}
      aria-label={title}
      tabIndex={modal ? -1 : undefined}
      className={className}
    >
      <header className="shrink-0 h-14 px-5 flex items-center gap-3 border-b border-ink/10">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink truncate">{title}</div>
          {subtitle && <div className="font-term text-[11px] uppercase tracking-[0.08em] text-ink/65 truncate">{subtitle}</div>}
        </div>
        {closable && (
          <button onClick={onClose} className={`grid place-items-center w-8 h-8 rounded-[4px] text-ink/60 hover:bg-flysch hover:text-ink ${focusRing}`} aria-label="Close"><X size={16} /></button>
        )}
      </header>
      {/* min-h-0 grow, NOT flex-1: flex-1's 0% basis collapses this wrapper
          when the drawer has no bounded height (inline drawers on mobile),
          and the body content then painted straight over the footer buttons.
          basis:auto sizes to content when unbounded and still shrinks and
          scrolls inside the fixed-height overlay. */}
      <Scrollable axis="y" className="min-h-0 grow" scrollerClassName="p-5">{children}</Scrollable>
      {footer && <footer className="shrink-0 p-4 border-t border-ink/10 flex gap-2">{footer}</footer>}
    </aside>
  );
}

export function Drawer({
  open, onClose, title, subtitle, icon, footer, children,
  variant = "overlay", closable = true, className = "",
}: DrawerProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  /* LAY-07: `onClose` cannot be an effect dependency. Every documented call
     site passes an inline arrow, so it is a new function on every parent
     render; with it in the deps the effect tore down and re-ran on each of
     those renders, and the teardown moves focus back to the trigger OUTSIDE
     the drawer before the re-run calls `panel.focus()`. The visible symptom
     was that typing in a drawer input lost the caret on any keystroke that
     re-rendered the parent. A ref gives the handler the current `onClose`
     without making the effect depend on its identity. */
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (variant !== "overlay" || !open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const els = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (els.length === 0) { e.preventDefault(); return; }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      // LAY-11: the panel itself is `tabIndex={-1}` and is what holds focus on
      // open, so a plain Tab from there was not `active === last` and not
      // `active === first` — it fell through and moved focus to whatever came
      // after the drawer in the document, straight out of a modal trap. Tabbing
      // off the panel now enters the panel at its first control.
      if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || active === panel)) { e.preventDefault(); first.focus(); }
      // Focus that is outside the panel entirely (a stray click on the page
      // behind, a browser-chrome round trip) is pulled back in as well.
      else if (!panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [open, variant]);

  if (!open) return null;

  if (variant === "inline") {
    return (
      <DrawerBody
        title={title} subtitle={subtitle} icon={icon} footer={footer}
        onClose={onClose} closable={closable} modal={false}
        className={`w-full max-w-[460px] max-h-full bg-paper border border-ink/15 rounded-md flex flex-col text-ink overflow-hidden ${className}`.trim()}
      >
        {children}
      </DrawerBody>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] font-display">
      <div className="absolute inset-0 bg-ink/30 drawer-overlay" onClick={onClose} />
      <DrawerBody
        title={title} subtitle={subtitle} icon={icon} footer={footer}
        onClose={onClose} closable={closable} modal
        panelRef={panelRef}
        className={`absolute right-0 top-0 h-full w-full max-w-[460px] bg-paper border-l border-ink/15 shadow-2xl flex flex-col text-ink drawer-panel outline-none ${className}`.trim()}
      >
        {children}
      </DrawerBody>
    </div>
  );
}
