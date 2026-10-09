import { Cpu } from "lucide-react";

export const Logo = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="relative h-7 w-7 rounded-md bg-gradient-to-br from-primary to-purple2 grid place-items-center shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)]">
      <Cpu className="h-4 w-4 text-primary-foreground" strokeWidth={2.4} />
      <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-emerald2 pulse-dot ring-2 ring-background" />
    </div>
    <span className="font-semibold tracking-tight text-foreground">Mari</span>
  </div>
);