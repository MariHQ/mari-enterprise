import { focusRing } from "../tokens/focusRing";

/* Disabled must stay legible: a 45%-opacity ghost fails contrast. Instead we
   swap to a flat, clearly-inert grey that still reads at a glance. */
export const btnDisabled =
  "disabled:opacity-100 disabled:cursor-not-allowed disabled:bg-ink/[0.07] disabled:text-ink/55 disabled:border-ink/20 disabled:shadow-none";

export const btn = `inline-flex items-center justify-center gap-1.5 max-w-full overflow-hidden [overflow-wrap:anywhere] min-h-9 py-1.5 px-3 rounded-[4px] border border-ink/20 bg-paper text-[13px] font-medium text-ink/85 hover:border-ink/45 hover:text-ink transition-colors ${focusRing} ${btnDisabled}`;
export const btnPrimary = `inline-flex items-center justify-center gap-1.5 max-w-full overflow-hidden [overflow-wrap:anywhere] min-h-9 py-1.5 px-3.5 rounded-[4px] bg-biscay text-white text-[13px] font-semibold hover:bg-biscay-2 transition-colors ${focusRing} ${btnDisabled}`;
export const btnDanger = `inline-flex items-center justify-center gap-1.5 max-w-full overflow-hidden [overflow-wrap:anywhere] min-h-9 py-1.5 px-3 rounded-[4px] border border-espelette/40 bg-paper text-[13px] font-medium text-espelette hover:bg-espelette/[0.06] hover:border-espelette transition-colors ${focusRing} ${btnDisabled}`;
