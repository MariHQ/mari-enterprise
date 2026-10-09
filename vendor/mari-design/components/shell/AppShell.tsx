import { useState, type ReactNode } from "react";
import { focusRing } from "../tokens/focusRing";

/* App layout — composes the Sidebar, the HeaderBar, and a scrollable content
   region, mirroring the console shell's `grid: sidebar 1fr` + sticky topbar +
   scrolling main. AppShell owns the collapse ("railed") state and hands a
   `{ collapsed, toggle }` context to the sidebar/header render props, so the
   toggle can live in either one.

   Fills its parent (h-full): give it the viewport (`h-screen`) in a real app,
   or a bounded box in a gallery. */

export type ShellContext = { collapsed: boolean; toggle: () => void };

export type AppShellProps = {
  /** Sidebar render prop — receives the collapse context. */
  sidebar: (ctx: ShellContext) => ReactNode;
  /** Header render prop — receives the collapse context. */
  header: (ctx: ShellContext) => ReactNode;
  children: ReactNode;
  /** Controlled collapse state. */
  collapsed?: boolean;
  /** Uncontrolled initial collapse state. */
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  /** Extra classes for the scrolling content region. */
  contentClassName?: string;
  /** A rail docked beside the content column (the agent, say). It is a flex
      sibling of the column, so opening it narrows the page instead of
      covering half of it, and the wheel over it never has to fight the page
      for scroll. The node owns its own width, border and background. */
  aside?: ReactNode;
};

export function AppShell({
  sidebar, header, children,
  collapsed: collapsedProp, defaultCollapsed = false, onCollapsedChange,
  className = "", contentClassName = "", aside,
}: AppShellProps) {
  const [internal, setInternal] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? internal;
  const toggle = () => {
    const next = !collapsed;
    if (collapsedProp === undefined) setInternal(next);
    onCollapsedChange?.(next);
  };
  const ctx: ShellContext = { collapsed, toggle };

  return (
    <div className={["relative flex h-full min-h-0 w-full overflow-hidden bg-paper text-ink", className].filter(Boolean).join(" ")}>
      {/* SH5: without this a keyboard user crossed the collapse toggle, the
          brand, 13 nav items, the help card, search, the bell and the account
          menu before reaching the page — on every page, every time. Invisible
          until focused, and the first thing Tab reaches. */}
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[4px] focus:border focus:border-ink/25 focus:bg-paper focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-ink ${focusRing}`}
      >
        Skip to main content
      </a>
      <div className="shrink-0 border-r border-ink/10 transition-[width] duration-150 ease-out">
        {sidebar(ctx)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {header(ctx)}
        {/* Named, and focusable as a skip target: an unlabelled <main> gives
            the landmark list nothing to distinguish it by (SH5). */}
        <main
          id="main-content"
          tabIndex={0}
          aria-label="Main content"
          className={["min-h-0 flex-1 overflow-y-auto bg-flysch/40 outline-none", contentClassName].filter(Boolean).join(" ")}
        >
          {children}
        </main>
      </div>
      {aside}
    </div>
  );
}
