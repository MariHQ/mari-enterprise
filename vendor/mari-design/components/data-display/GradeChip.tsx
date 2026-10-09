import { Chip, type ChipTone } from "./Chip";

/* GradeChip — a letter grade (A–F) rendered as a caps chip on the semantic
   tone scale. Ported from the console's Insights readability table, extended
   to the full A–F range. A "+"/"-" suffix and lowercase input are tolerated;
   an unrecognized grade renders a neutral "N/A" (CONVENTIONS.md §5 bans
   dashes in user-visible copy). */

const GRADE_TONE: Record<string, ChipTone> = {
  A: "ok",
  B: "ok",
  C: "attention",
  D: "attention",
  E: "blocked",
  F: "blocked",
};

export type GradeChipProps = {
  grade: string;
  className?: string;
};

export function GradeChip({ grade, className }: GradeChipProps) {
  const letter = grade.trim().charAt(0).toUpperCase();
  const tone = GRADE_TONE[letter];
  if (!tone) return <Chip label="N/A" tone="neutral" caps className={className} />;
  return <Chip label={grade.trim().toUpperCase()} tone={tone} caps className={className} />;
}
