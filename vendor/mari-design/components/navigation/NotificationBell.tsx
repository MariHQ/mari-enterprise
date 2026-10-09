import type { ReactNode } from "react";
import * as RPop from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { card } from "../tokens/card";
import { Scrollable } from "../data-display/Scrollable";
import { focusRing } from "../tokens/focusRing";
import { SkeletonCircle, SkeletonLine } from "../data-display/Skeleton";

export type NotificationItem = { id: string; title: string; body?: string; time: string; unread?: boolean; icon?: ReactNode };

/* Topbar bell + panel — grounded in the real product (NotificationsBell.tsx
   / NotificationsPanel.tsx exist in mari/web/web/src/saas). */
export function NotificationBell({ items, onItemClick, loading = false }: { items: NotificationItem[]; onItemClick?: (item: NotificationItem) => void; loading?: boolean }) {
  const unread = loading ? 0 : items.filter((i) => i.unread).length;
  return (
    <RPop.Root>
      <RPop.Trigger asChild>
        <button aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className={`relative grid place-items-center w-9 h-9 rounded-[4px] text-ink/70 hover:bg-flysch hover:text-ink ${focusRing}`}>
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-espelette px-[3px] font-term text-[9px] font-semibold text-white ring-2 ring-paper">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </RPop.Trigger>
      <RPop.Portal>
        <RPop.Content align="end" sideOffset={7} className={`${card} w-[340px] z-50 p-0`}>
          <Scrollable axis="y" className="max-h-[420px]">
          <div className="px-4 py-3 border-b border-ink/10 text-[13px] font-semibold text-ink">Notifications</div>
          {loading ? (
            <div aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-ink/[0.06] last:border-0">
                  <SkeletonCircle size={16} className="mt-0.5" />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <SkeletonLine w="70%" h={11} />
                    <SkeletonLine w="90%" h={9} />
                    <SkeletonLine w={48} h={8} />
                  </span>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-ink/65">You're all caught up.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => onItemClick?.(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-ink/[0.06] last:border-0 hover:bg-flysch/60 ${focusRing}`}
              >
                <span className={`mt-1.5 w-[6px] h-[6px] rounded-full shrink-0 ${n.unread ? "bg-biscay-2" : ""}`} aria-hidden="true" />
                {n.icon && <span className="shrink-0 text-ink/65 mt-0.5">{n.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink">{n.title}</span>
                  {n.body && <span className="block text-[12.5px] text-ink/65 mt-0.5">{n.body}</span>}
                  <span className="block font-term text-[10.5px] text-ink/65 mt-1">{n.time}</span>
                </span>
              </button>
            ))
          )}
          </Scrollable>
        </RPop.Content>
      </RPop.Portal>
    </RPop.Root>
  );
}
