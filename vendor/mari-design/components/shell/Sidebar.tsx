import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Scrollable } from "../data-display/Scrollable";
import { Tooltip } from "../navigation/Tooltip";
import { focusRing } from "../tokens/focusRing";

/* Primary navigation, ported from the console shell's terracotta sidebar and
   re-skinned to the blueprint palette: a dark biscay rail, light labels, and
   a paper "card" for the active item (echoing the source's white-on-terracotta
   active state). Sections carry a mono heading; items take an icon, a label,
   an optional trailing count/badge, and optional nested children. Collapsed
   ("railed") mode drops to an icon-only column with tooltips.

   Config comes entirely from props — no hardcoded routes. Selection is driven
   by `activeId` + `onNavigate(id)`; there is no router dependency. */

export type NavItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Trailing numeric count (rendered mono, muted). */
  count?: number;
  /** Trailing badge slot — overrides `count` when set. */
  badge?: ReactNode;
  /** Nested sub-items — renders an expandable group. */
  children?: NavItem[];
  disabled?: boolean;
};

export type NavSection = {
  id?: string;
  /** Optional mono section heading. */
  heading?: string;
  /* Draw a horizontal rule above this section instead of labelling it. Utility
     groups (Settings, sign-out) read better as a ruled-off tail than as a
     section named "Admin", which named a permission level rather than a place. */
  divider?: boolean;
  items: NavItem[];
};

/* ---- shared item chrome ---- */

const ITEM_BASE = `group/item relative flex w-full items-center gap-3 rounded-[6px] text-[13px] transition-colors ${focusRing}`;
const ITEM_IDLE = "text-white/80 hover:bg-white/10 hover:text-white";
const ITEM_ACTIVE = "bg-paper text-biscay font-semibold hover:bg-paper";

function Trailing({ item, active }: { item: NavItem; active: boolean }) {
  /* A Chip/Badge dropped in here is styled for paper, so on the dark rail it
     rendered ink-on-navy and disappeared. Idle rows repaint any badge in rail
     colors; the active row is already paper, so it keeps the badge as authored. */
  if (item.badge) {
    return (
      <span className={`shrink-0 ${active ? "" : "[&_*]:!border-white/35 [&_*]:!bg-white/20 [&_*]:!text-white"}`.trim()}>
        {item.badge}
      </span>
    );
  }
  if (item.count != null) {
    return <span className="shrink-0 font-term text-[11px] tabular-nums opacity-80">{item.count}</span>;
  }
  return null;
}

export function SidebarItem({
  item, active, collapsed = false, depth = 0, onNavigate, trailingChevron,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  depth?: number;
  onNavigate?: (id: string) => void;
  /** Expand/collapse affordance for group parents. */
  trailingChevron?: ReactNode;
}) {
  const pad = collapsed ? "justify-center h-9 px-0" : "px-3 py-2";
  const indent = !collapsed && depth > 0 ? { paddingLeft: 12 + depth * 22 } : undefined;
  const btn = (
    <button
      type="button"
      disabled={item.disabled}
      /* SH3: the label is dropped from the DOM on the rail and the icon is
         aria-hidden, so a collapsed sidebar was a column of 13 unnamed
         buttons. The tooltip does not fix this — it contributes
         aria-describedby, and only while it is open; a description is not a
         name. Expanded rows are named by their visible label. */
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate?.(item.id)}
      style={indent}
      // Disabled stays legible: a flat, clearly-inert treatment, not a 40%
      // ghost you cannot read (CONVENTIONS.md §6).
      className={[ITEM_BASE, pad, active ? ITEM_ACTIVE : ITEM_IDLE, item.disabled && "!bg-white/[0.06] !text-white/55 cursor-not-allowed pointer-events-none"].filter(Boolean).join(" ")}
    >
      {item.icon && <span className="grid shrink-0 place-items-center [&_svg]:opacity-90" aria-hidden="true">{item.icon}</span>}
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
      {!collapsed && <Trailing item={item} active={active} />}
      {!collapsed && trailingChevron}
    </button>
  );
  // Collapsed rail: name the icon via a tooltip.
  if (collapsed) {
    return <Tooltip label={item.label} side="right">{btn}</Tooltip>;
  }
  return btn;
}

/* ---- expandable group ---- */

function containsId(item: NavItem, id: string | undefined): boolean {
  if (!id) return false;
  if (item.id === id) return true;
  return (item.children ?? []).some((c) => containsId(c, id));
}

function SidebarGroup({
  item, activeId, collapsed, depth, onNavigate,
}: {
  item: NavItem;
  activeId?: string;
  collapsed: boolean;
  depth: number;
  onNavigate?: (id: string) => void;
}) {
  const hasActiveChild = (item.children ?? []).some((c) => containsId(c, activeId));
  const [open, setOpen] = useState(hasActiveChild);
  const expanded = open || hasActiveChild;

  // Collapsed rail can't expand inline — surface the parent as a tooltip'd icon.
  if (collapsed) {
    return <SidebarItem item={item} active={containsId(item, activeId)} collapsed onNavigate={onNavigate} />;
  }

  return (
    <div>
      <SidebarItem
        item={{ ...item, count: undefined, badge: undefined }}
        active={item.id === activeId}
        depth={depth}
        onNavigate={() => setOpen((o) => !o)}
        trailingChevron={
          <span className="shrink-0 opacity-80" aria-hidden="true">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>
        }
      />
      {expanded && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {(item.children ?? []).map((c) =>
            c.children?.length ? (
              <SidebarGroup key={c.id} item={c} activeId={activeId} collapsed={collapsed} depth={depth + 1} onNavigate={onNavigate} />
            ) : (
              <SidebarItem key={c.id} item={c} active={c.id === activeId} depth={depth + 1} onNavigate={onNavigate} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ---- section ---- */

export function SidebarSection({
  heading, divider = false, items, activeId, collapsed = false, onNavigate,
}: {
  heading?: string;
  /** Rule above the section instead of a heading. */
  divider?: boolean;
  items: NavItem[];
  activeId?: string;
  collapsed?: boolean;
  onNavigate?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {divider && (
        <hr className={`my-1 h-px border-0 bg-white/20 ${collapsed ? "mx-auto w-6" : ""}`.trim()} aria-hidden="true" />
      )}
      {heading && !divider && !collapsed && (
        <div className="px-3 pb-1 pt-1 font-term text-[10px] font-medium uppercase tracking-[0.14em] text-white/70">{heading}</div>
      )}
      {heading && !divider && collapsed && <div className="mx-auto my-1 h-px w-6 bg-white/20" aria-hidden="true" />}
      {items.map((item) =>
        item.children?.length ? (
          <SidebarGroup key={item.id} item={item} activeId={activeId} collapsed={collapsed} depth={0} onNavigate={onNavigate} />
        ) : (
          <SidebarItem key={item.id} item={item} active={item.id === activeId} collapsed={collapsed} onNavigate={onNavigate} />
        ),
      )}
    </div>
  );
}

/* ---- sidebar shell ---- */

export type SidebarProps = {
  sections: NavSection[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  collapsed?: boolean;
  /** Brand/logo slot, pinned to the top. */
  brand?: ReactNode;
  /** Pinned footer slot (e.g. a "Need help?" card or a settings link). */
  footer?: ReactNode;
  className?: string;
};

export function Sidebar({ sections, activeId, onNavigate, collapsed = false, brand, footer, className = "" }: SidebarProps) {
  return (
    <aside
      className={[
        "flex h-full flex-col bg-biscay text-white",
        collapsed ? "w-[64px] px-2 py-4" : "w-[218px] px-3 py-4",
        className,
      ].filter(Boolean).join(" ")}
    >
      {brand && (
        <div className={["flex shrink-0 items-center pb-3", collapsed ? "justify-center" : "px-2"].join(" ")}>{brand}</div>
      )}
      <Scrollable axis="y" fade="biscay" className="min-h-0 flex-1">
        <nav className="flex flex-col gap-3" aria-label="Primary">
          {sections.map((s, i) => (
            <SidebarSection
              key={s.id ?? s.heading ?? i}
              heading={s.heading}
              divider={s.divider}
              items={s.items}
              activeId={activeId}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </Scrollable>
      {footer && <div className="shrink-0 pt-3">{footer}</div>}
    </aside>
  );
}
