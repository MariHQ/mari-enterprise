import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { resolveToneKey } from "../data-display/Badge";
import { focusRing } from "../tokens/focusRing";

export type AlertTone = "ok" | "attention" | "blocked" | "info" | "neutral";

const STYLE: Record<AlertTone, { border: string; bg: string; icon: ReactNode }> = {
  ok: { border: "border-moss/30", bg: "bg-moss/[0.05]", icon: <CheckCircle2 size={16} className="text-moss" /> },
  attention: { border: "border-clay/35", bg: "bg-clay/[0.06]", icon: <AlertTriangle size={16} className="text-clay" /> },
  blocked: { border: "border-espelette/30", bg: "bg-espelette/[0.05]", icon: <XCircle size={16} className="text-espelette" /> },
  info: { border: "border-biscay-2/35", bg: "bg-biscay-2/[0.05]", icon: <Info size={16} className="text-biscay-2" /> },
  neutral: { border: "border-ink/15", bg: "bg-ink/[0.03]", icon: <Info size={16} className="text-ink/65" /> },
};

/* A persistent inline banner — Toast's non-transient sibling. Same 5-tone
   scale as Badge/Chip/Stat. */
export function Alert({
  tone = "neutral", title, action, onDismiss, children,
}: {
  tone?: string;
  title?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const key = resolveToneKey(tone) as AlertTone;
  const t = STYLE[key];
  /* FDB-01: every tone used to be `role="status"`, i.e. aria-live="polite", and
     both <ErrorMessage> and <WriteError> render through here. A failed save was
     therefore queued behind whatever else was being announced and could be
     dropped entirely. A failure and a warning are assertive; ok/info/neutral
     stay polite so a page full of banners does not interrupt on every render. */
  const assertive = key === "blocked" || key === "attention";
  return (
    <div role={assertive ? "alert" : "status"} className={`flex gap-3 rounded-md border px-4 py-3 ${t.border} ${t.bg}`}>
      <span className="shrink-0 mt-0.5" aria-hidden="true">{t.icon}</span>
      <div className="min-w-0 flex-1 break-words">
        {title && <div className="text-[13px] font-semibold text-ink">{title}</div>}
        <div className="text-[13px] text-ink/70 mt-0.5">{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className={`shrink-0 grid place-items-center w-6 h-6 rounded-[4px] text-ink/65 hover:bg-ink/5 hover:text-ink/70 ${focusRing}`}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}
