import { useState } from "react";
import { Plus, Key } from "lucide-react";
import { TokenReveal as TokenRevealUI, TOKEN_REVEAL_WARNING } from "../data-display/TokenReveal";
import { EmptyState } from "../data-display/EmptyState";
import { Button } from "../actions/Button";
import { card } from "../tokens/card";
import { fmtAgo } from "../tokens/format";
import { useResync } from "../actions/useResync";

/* TokenRevealFeature — the Settings → API keys context that mints a secret and
   shows it exactly once through the shared <TokenReveal> (aliased TokenRevealUI).
   "Create key" generates a fresh token, drops the one-time reveal card at the
   top, and adds a masked row to the key list once dismissed. Standalone with
   baked-in demo keys. Source: web/src/pages/settings/ApiKeys + TokenReveal. */

export type KeyRow = { id: string; label: string; prefix: string; createdAt: string; lastUsed: string | null };

function mintToken(): string {
  const rand = (n: number) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  return `mari_sk_live_${rand(6)}${rand(6)}${rand(6)}${rand(6)}`;
}

export type TokenRevealFeatureProps = {
  keys: KeyRow[];
  className?: string;
};

export function TokenRevealFeature({ keys, className = "" }: TokenRevealFeatureProps) {
  const [rows, setRows] = useState<KeyRow[]>(keys);
  const [fresh, setFresh] = useState<string | null>(null);

  /* The list was read once, at mount, so a refetched key set never landed
     (C1). Held while a freshly minted token is still on screen: adopting then
     would drop the row the reader is about to keep. */
  useResync(keys, setRows, { hold: fresh !== null });

  const create = () => setFresh(mintToken());

  const dismiss = () => {
    if (fresh) {
      setRows((cur) => [
        { id: `k_${Date.now()}`, label: "New key", prefix: fresh.slice(0, 16), createdAt: new Date().toISOString(), lastUsed: null },
        ...cur,
      ]);
    }
    setFresh(null);
  };

  return (
    <div className={`max-w-[640px] ${className}`.trim()}>
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[19px] text-ink">API keys</h2>
          <p className="mt-0.5 text-[13px] text-ink/70">
            Keys authenticate programmatic access. {TOKEN_REVEAL_WARNING}
          </p>
        </div>
        <Button variant="primary" compact onClick={create} disabled={fresh !== null}>
          <Plus size={14} /> Create key
        </Button>
      </div>

      {fresh && (
        <div className="mb-4">
          <TokenRevealUI token={fresh} title="Your new key" onDismiss={dismiss} />
        </div>
      )}

      <div className={`${card} overflow-hidden`}>
        {rows.length === 0 && (
          <EmptyState icon={<Key size={24} />} title="No keys yet">
            Create the first one to give CI or an agent programmatic access.
          </EmptyState>
        )}
        {rows.map((k, i) => (
          <div
            key={k.id}
            className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-ink/10" : ""}`}
          >
            <Key size={15} className="shrink-0 text-ink/65" />
            <div className="min-w-0 flex-1">
              <div className="break-all text-[13.5px] font-medium text-ink">{k.label}</div>
              <code className="block break-all font-term text-[11.5px] text-ink/70">{k.prefix}••••••••</code>
            </div>
            <span className="font-term text-[11px] text-ink/65 whitespace-nowrap">
              {k.lastUsed ? `used ${fmtAgo(k.lastUsed)}` : "never used"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
