import { Check } from "lucide-react";
import { Chip } from "./Chip";
import { SkeletonChip } from "./Skeleton";

/* TagChip: a knowledge-tag preset over <Chip>. Each tag maps to a label, a
   tone (from our 5-tone scale) and a status dot. Selectable and removable.
   Ported from components/TagChip.tsx; the console's extra palette colors
   (terra/violet) collapse onto our semantic tones.

   This must render identically to the chips inside <TagPicker> (CONVENTIONS.md
   §4): same shape, ALL CAPS, always a coloured dot, and a check glyph when
   selected — the same explicit affordance the picker's checkbox gives. A tag
   should never read as plain text, so an unknown tag still gets a chip with
   the neutral tone and its raw name title-cased. */

export type TagKind =
  | "canonical" | "draft" | "stale" | "deprecated"
  | "internal" | "customer-facing" | "needs-review" | "verified";

export const TAG_OPTIONS: TagKind[] = [
  "canonical", "draft", "stale", "deprecated", "internal", "customer-facing", "needs-review",
];

const TAG_TONE: Record<string, string> = {
  canonical: "ok",
  draft: "neutral",
  stale: "attention",
  deprecated: "blocked",
  internal: "neutral",
  "customer-facing": "info",
  "needs-review": "attention",
  // "verified" is green everywhere in the system (CONVENTIONS.md §4).
  verified: "ok",
};

const TAG_LABEL: Record<string, string> = {
  canonical: "Canonical",
  draft: "Draft",
  stale: "Stale",
  deprecated: "Deprecated",
  internal: "Internal",
  "customer-facing": "Customer-facing",
  "needs-review": "Needs review",
  verified: "Verified",
};

export type TagChipProps = {
  tag: string;
  /** Override the derived label. */
  label?: string;
  /** Override the derived tone. */
  tone?: string;
  removable?: boolean;
  onRemove?: () => void;
  selected?: boolean;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
};

/** Title-case an unregistered tag id so it still reads as a named tag. */
function fallbackLabel(tag: string): string {
  const words = tag.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function TagChip({
  tag, label, tone, removable = false, onRemove, selected = false, onClick, loading = false, className,
}: TagChipProps) {
  if (loading) return <SkeletonChip className={className} />;
  const text = label ?? TAG_LABEL[tag] ?? fallbackLabel(tag);
  return (
    <Chip
      /* Chips never wrap, so a long tag name used to run straight out of its
         container. Cap the chip at the row width and ellipsize the name. */
      label={<span className="block min-w-0 truncate" title={text}>{text}</span>}
      tone={tone ?? TAG_TONE[tag] ?? "neutral"}
      dot
      icon={selected ? <Check size={11} strokeWidth={2.6} aria-hidden /> : undefined}
      selected={selected}
      onClick={onClick}
      onRemove={removable ? onRemove : undefined}
      removeLabel={`Remove ${text}`}
      className={`max-w-full ${className ?? ""}`.trim()}
    />
  );
}
