import { useState } from "react";
import type { ReactNode } from "react";
import { Key, X, Eye, EyeOff } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { CopyButton } from "../actions/CopyButton";
import { Skeleton, SkeletonLine, SkeletonButton } from "./Skeleton";

/* TokenReveal: one-time secret reveal (API keys, MCP tokens). A clay dashed
   card that keeps the secret masked until you reveal it, a copy button, and a
   "you won't see this again" warning. Ported from components/TokenReveal.tsx,
   with the reveal-toggle added. */

/* The standardized one-time-secret warning. One sentence per idea, no dashes,
   and it ends with the action the reader must take (feedback/errors.ts house
   style). "closing" is deliberate: the card can be closed by dismissing it or
   by navigating away, and both lose the token. */
export const TOKEN_REVEAL_WARNING =
  "You will not see this token again. Copy and store it somewhere safe before closing.";

function mask(token: string): string {
  // Keep a short tail visible for recognition; dot out the rest.
  const tail = token.slice(-4);
  const dots = "•".repeat(Math.max(4, Math.min(32, token.length - 4)));
  return token.length > 8 ? `${dots}${tail}` : "•".repeat(token.length);
}

export type TokenRevealProps = {
  token: string;
  title?: string;
  /** Start masked (default true). */
  masked?: boolean;
  warning?: ReactNode;
  onDismiss?: () => void;
  /** Render a content-shaped skeleton while the token is being minted. */
  loading?: boolean;
  className?: string;
};

export function TokenReveal({
  token, title = "Your new token", masked = true,
  warning = TOKEN_REVEAL_WARNING,
  onDismiss, loading = false, className = "",
}: TokenRevealProps) {
  const [revealed, setRevealed] = useState(!masked);

  if (loading) {
    return (
      <Card
        className={`border-clay/50 border-dashed bg-clay/[0.06] ${className}`.trim()}
        icon={<Key size={16} className="text-clay" />}
        title={title}
      >
        <div className="flex items-center gap-2.5">
          <Skeleton height={32} className="flex-1" rounded="rounded-[3px]" />
          <SkeletonButton w={84} />
        </div>
        <SkeletonLine w="72%" h={11} className="mt-2.5" />
      </Card>
    );
  }

  return (
    <Card
      className={`border-clay/50 border-dashed bg-clay/[0.06] ${className}`.trim()}
      icon={<Key size={16} className="text-clay" />}
      title={title}
      actions={(
        <>
          <Button icon compact aria-label={revealed ? "Hide token" : "Reveal token"} onClick={() => setRevealed((v) => !v)}>
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
          {onDismiss && (
            <Button icon compact aria-label="Dismiss" title="Dismiss" onClick={onDismiss}>
              <X size={13} />
            </Button>
          )}
        </>
      )}
    >
      <div className="flex items-center gap-2.5">
        <code className="min-w-0 flex-1 rounded-[3px] bg-ink/[0.05] px-2.5 py-1.5 font-term text-[12.5px] text-ink break-all select-all">
          {revealed ? token : mask(token)}
        </code>
        <CopyButton value={token} label="Copy" />
      </div>
      {warning && <div className="mt-2.5 text-[12px] leading-relaxed text-clay">{warning}</div>}
    </Card>
  );
}
