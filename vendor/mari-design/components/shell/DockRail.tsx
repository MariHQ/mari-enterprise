import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

/* Where the agent dock sits. At `lg` and up the rail is handed to the frame as
   ShellChrome.aside, so it is a flex sibling of the content column: opening
   it narrows the page instead of covering half of it, and the wheel over it
   never fights the page for scroll. Below `lg` the mobile frame takes over and
   there is no room for a rail, so it floats over the page as a card. The
   breakpoint is the app's own mobile switch (1024px). */

export type DockRailProps = { children: ReactNode; className?: string };

export function DockRail({ children, className = "" }: DockRailProps) {
  return (
    <div
      className={[
        "flex shrink-0 flex-col",
        "lg:h-full lg:w-[min(400px,40vw)] lg:border-l lg:border-ink/10 lg:bg-flysch/40 lg:p-3",
        "max-lg:fixed max-lg:bottom-5 max-lg:right-5 max-lg:z-40",
        "max-lg:h-[min(600px,calc(100dvh-2.5rem))] max-lg:w-[min(400px,calc(100vw-2.5rem))]",
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}

/** The dock's closed state: one floating sparkle button, bottom right. */
export type DockLauncherProps = { onClick: () => void; label: string; title?: string };

export function DockLauncher({ onClick, label, title }: DockLauncherProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title}
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper shadow-lg hover:opacity-90"
    >
      <Sparkles size={20} />
    </button>
  );
}
