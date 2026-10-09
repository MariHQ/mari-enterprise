import { Tag, Check } from "lucide-react";
import * as RPop from "@radix-ui/react-popover";
import { Popover } from "../navigation/Popover";
import { Button } from "../actions/Button";
import { focusRing } from "../tokens/focusRing";
import { Scrollable } from "../data-display/Scrollable";
import { TagChip, TAG_OPTIONS } from "../data-display/TagChip";
import { Skeleton, SkeletonChip } from "../data-display/Skeleton";

/* TagPicker — a popover checklist for applying knowledge tags to a document.
   Ported from components/TagPicker.tsx; the react-router "Manage definitions"
   link is replaced by an optional `onManage` callback. Built on our <Popover>
   (the Done button uses Radix's Close). */

export type TagPickerProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Icon-only trigger for dense rows. */
  compact?: boolean;
  options?: string[];
  /** "Manage definitions" affordance in the footer. */
  onManage?: () => void;
  /** Show skeleton rows while the tag vocabulary loads. */
  loading?: boolean;
  className?: string;
};

export function TagPicker({
  tags, onChange, compact = false, options = TAG_OPTIONS, onManage, loading = false, className = "",
}: TagPickerProps) {
  const toggle = (tag: string) =>
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);

  return (
    <Popover
      align={compact ? "end" : "start"}
      className={`w-64 p-0 ${className}`.trim()}
      trigger={(
        <Button compact={!compact} icon={compact} aria-label={compact ? "Edit tags" : undefined}>
          <Tag size={18} />{!compact && "Edit tags"}
        </Button>
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-ink/10">
        <span className="text-[13px] font-semibold text-ink">Document tags</span>
        <small className="font-term text-[11px] text-ink/65">{tags.length} applied</small>
      </div>
      <Scrollable axis="y" className="max-h-64" scrollerClassName="p-1.5 flex flex-col gap-0.5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5" aria-hidden="true">
              <Skeleton width={16} height={16} rounded="rounded-[3px]" />
              <SkeletonChip w={92} />
            </div>
          ))
        ) : options.map((tag) => {
          const checked = tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              onClick={() => toggle(tag)}
              className={`flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left hover:bg-ink/[0.04] ${focusRing}`}
            >
              <span className={`grid place-items-center w-[18px] h-[18px] rounded-[3px] border ${checked ? "border-biscay bg-biscay text-white" : "border-ink/25 text-transparent"}`}>
                <Check size={13} strokeWidth={3} />
              </span>
              <TagChip tag={tag} />
            </button>
          );
        })}
      </Scrollable>
      <div className="flex items-center justify-between px-3 py-2 border-t border-ink/10">
        {onManage
          ? <button type="button" onClick={onManage} className={`font-term text-[11.5px] text-biscay-2 hover:text-ink hover:underline underline-offset-[3px] ${focusRing}`}>Manage definitions</button>
          : <span />}
        <RPop.Close asChild>
          <button type="button" className={`font-term text-[11.5px] text-ink/70 hover:text-ink ${focusRing}`}>Done</button>
        </RPop.Close>
      </div>
    </Popover>
  );
}
