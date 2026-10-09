import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck, Bell, Check, FileCheck, Ban, Pencil, Tag } from "lucide-react";
import { Chip, type ChipTone } from "./Chip";

/* Pill — an icon-leading verification/status pill. Distinct from Badge (no
   icon) and StatusChip (dot indicator): each kind carries a semantic glyph,
   which is what makes a "Verified" or "Fact check" state read at a glance.
   Ported from the console's components/shared.tsx Pill. Prop-driven: pass a
   known `kind` (or any string) and optionally override the `label`. */

export type PillKind =
  | "canonical" | "verified" | "approval" | "factcheck"
  | "needs-review" | "stale" | "deprecated" | "draft";

// Glyphs sit at 14px / stroke 2.2 so they read at the same weight as the
// caps label beside them (CONVENTIONS.md §6).
const GLYPH = { size: 14, strokeWidth: 2.2 } as const;

/* XA-25: this table is the third status vocabulary in the console, after
   StatusChip and TagChip, and it disagreed with both. `verified` was `info`
   (blue) here and `ok` (green) in TagChip, so the same word rendered in two
   colours depending on which chip a page happened to import. §4 is explicit:
   "verified is green". Every kind below now carries the tone StatusChip gives
   the same word; only the glyph is Pill's own. */
const PILL: Record<PillKind, { tone: ChipTone; label: string; icon: ReactNode }> = {
  canonical: { tone: "ok", label: "Canonical", icon: <CheckCircle2 {...GLYPH} /> },
  verified: { tone: "ok", label: "Verified", icon: <ShieldCheck {...GLYPH} /> },
  approval: { tone: "ok", label: "Approval", icon: <Check {...GLYPH} strokeWidth={2.8} /> },
  factcheck: { tone: "info", label: "Fact check", icon: <FileCheck {...GLYPH} /> },
  "needs-review": { tone: "attention", label: "Needs review", icon: <Bell {...GLYPH} /> },
  stale: { tone: "attention", label: "Stale", icon: <Bell {...GLYPH} /> },
  deprecated: { tone: "blocked", label: "Deprecated", icon: <Ban {...GLYPH} /> },
  draft: { tone: "neutral", label: "Draft", icon: <Pencil {...GLYPH} /> },
};

export type PillProps = {
  kind: string;
  /** Override the derived label. */
  text?: ReactNode;
  /** Override the derived tone. */
  tone?: string;
  className?: string;
};

export function Pill({ kind, text, tone, className }: PillProps) {
  const preset = PILL[kind as PillKind];
  return (
    <Chip
      // ALL CAPS, like every other chip (CONVENTIONS.md §4). Stated explicitly
      // rather than leaning on Chip's default so it survives a default change.
      caps
      label={text ?? preset?.label ?? kind}
      tone={tone ?? preset?.tone ?? "neutral"}
      // An unknown kind used to borrow the "approval" checkmark, which asserted
      // a state it had not earned. A neutral tag glyph is the honest fallback.
      icon={preset?.icon ?? <Tag {...GLYPH} />}
      className={className}
    />
  );
}
