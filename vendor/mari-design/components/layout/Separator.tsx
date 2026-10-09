import * as RSep from "@radix-ui/react-separator";

/* A hairline divider — replaces the ad-hoc border-t/bg-ink/10 divs used
   inline everywhere else in this library. */
export function Separator({ orientation = "horizontal", className = "" }: { orientation?: "horizontal" | "vertical"; className?: string }) {
  return (
    <RSep.Root
      orientation={orientation}
      className={`shrink-0 bg-ink/10 ${orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch"} ${className}`.trim()}
    />
  );
}
