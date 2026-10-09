import type { CSSProperties, ReactNode } from "react";
import { SortHeader } from "./sortable";

/* Loading placeholder that mirrors the shape of content about to appear — a
   skeleton screen, not a spinner. A soft grey block with a shimmer sweep; the
   sweep is frozen (off-screen) when animations are disabled, so it degrades to
   a clean flat placeholder. `Skeleton` is the primitive bar; the composed
   pieces below (SkeletonText, SkeletonCard, SkeletonTable, …) build realistic
   layouts. See also Skeletons.tsx / SkeletonPage for full-page loading.

   THE RULE these primitives exist to serve: a bar stands in for a VALUE the
   response has not returned yet. Everything the app already holds at first
   paint — section headings, column headers, field labels, tab names, the page
   title, units, static helper text — renders as its real self. A grey
   rectangle where a known label goes throws away information the reader could
   already be using, makes every loading screen look alike, and relayouts when
   the real text swaps in at a different width. So the composed blocks below
   take real strings where the caller has them, and only fall back to bars
   where it genuinely does not.

   Consequently a loading region is NOT `aria-hidden` wholesale any more: the
   labels inside it are genuine content. `aria-hidden` sits on the individual
   decorative bars (Skeleton sets its own), and the region carries
   `aria-busy="true"` — see `SkeletonRegion`. */

export function Skeleton({
  className = "", width, height, rounded = "rounded-[5px]", tone = "bg-ink/[0.06]", shimmer = true,
}: {
  className?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  rounded?: string;
  tone?: string;
  shimmer?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden ${rounded} ${tone} ${className}`.trim()}
      style={{ width, height }}
    >
      {shimmer && (
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-shimmer" />
      )}
    </span>
  );
}

/* ── Primitive shapes ─────────────────────────────────────────────────────── */

export function SkeletonLine({ w = "100%", h = 12, className = "" }: { w?: CSSProperties["width"]; h?: number; className?: string }) {
  return <Skeleton width={w} height={h} rounded="rounded-full" className={className} />;
}

export function SkeletonText({ lines = 3, className = "", lastWidth = "60%" }: { lines?: number; className?: string; lastWidth?: string }) {
  return (
    <div className={`space-y-2 ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} w={i === lines - 1 ? lastWidth : "100%"} h={11} />
      ))}
    </div>
  );
}

export function SkeletonCircle({ size = 32, className = "" }: { size?: number; className?: string }) {
  return <Skeleton width={size} height={size} rounded="rounded-full" className={className} />;
}

/* 22px and rounded-[3px] are `Chip`'s own box (px-2 py-[3px] around 11px
   text, hairline border), not a guess. A 20px chip skeleton jumped 2px on
   every swap and shifted the row it sat in. */
export function SkeletonChip({ w = 64, className = "" }: { w?: number; className?: string }) {
  return <Skeleton width={w} height={22} rounded="rounded-[3px]" className={className} />;
}

export function SkeletonButton({ w = 84, className = "" }: { w?: number; className?: string }) {
  return <Skeleton width={w} height={34} rounded="rounded-[4px]" className={className} />;
}

/** Cell-width cycle, so a loading table reads as ragged content rather than a
    grid of identical bars. Shared by every table so they all wait alike. */
export const CELL_WIDTHS = ["40%", "70%", "55%", "60%", "50%", "65%"];

/** A loading region that now contains REAL text (headings, column headers,
    labels) alongside decorative bars.

    The bars are `aria-hidden` individually, so what is left for a screen
    reader is exactly the structure the app already knows. `aria-busy` says
    the values are still arriving, and the polite live message names what is
    loading so the announcement is placeable rather than a bare "loading". */
export function SkeletonRegion({
  label, as: Tag = "div", className = "", children, ...rest
}: {
  /** What is loading, e.g. "Facts". Announced once, politely. */
  label: string;
  as?: "div" | "section";
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag aria-busy="true" className={className} {...rest}>
      <span role="status" className="sr-only">Loading {label}</span>
      {children}
    </Tag>
  );
}

/* ── Composed blocks ──────────────────────────────────────────────────────── */

/** A titled card skeleton: header row (title + action), body text, and an
    optional footer chip row. Matches the console Card silhouette.

    `title` is the card's real heading when the caller has it — a card's title
    is structure, not data, and greying it out was what made every loading
    card in the console indistinguishable. It renders at `Card`'s own
    `text-[15px] font-semibold` in `Card`'s own header box, so the swap to the
    loaded card moves nothing. Only a title that comes from the response falls
    back to a bar. */
export function SkeletonCard({
  title, eyebrow, lines = 3, media = false, footer = false, className = "",
}: { title?: string; eyebrow?: string; lines?: number; media?: boolean; footer?: boolean; className?: string }) {
  return (
    <div className={`rounded-md border border-ink/12 bg-paper ${className}`.trim()}>
      <div className="flex items-start gap-x-3 gap-y-2 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          {eyebrow != null
            ? <span className="block font-term text-[10.5px] font-medium uppercase tracking-[0.1em] text-biscay-2 mb-0.5">{eyebrow}</span>
            : null}
          {title != null
            ? <h2 className="truncate text-[15px] font-semibold leading-snug text-ink">{title}</h2>
            : <SkeletonLine w="42%" h={15} />}
        </div>
        <SkeletonChip w={52} className="mt-0.5 shrink-0" />
      </div>
      <div className="px-4 pb-4">
        {media && <Skeleton height={120} className="mb-3" />}
        <SkeletonText lines={lines} />
        {footer && (
          <div className="mt-3 flex gap-2">
            <SkeletonChip w={60} /><SkeletonChip w={44} />
          </div>
        )}
      </div>
    </div>
  );
}

/** A big-number stat tile skeleton.

    `label` is the tile's real caption ("Documents", "Open tasks") when the
    caller has it; only the number and its delta note are unknown. A tile that
    greys its own caption tells the reader nothing about what is arriving.
    Geometry follows `Stat`: p-3, 24px value, 12.5px label (§17 compact). */
export function SkeletonStat({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-1 basis-[200px] min-w-[200px] items-start justify-between gap-3 rounded-md border border-ink/12 bg-paper p-3 ${className}`.trim()}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <Skeleton width={72} height={24} />
        {label != null
          ? <span className="truncate text-[12.5px] text-ink/65">{label}</span>
          : <SkeletonLine w={90} h={12} className="mt-1" />}
        <SkeletonLine w={60} h={11} className="mt-1" />
      </span>
      <SkeletonCircle size={26} className="shrink-0" />
    </div>
  );
}

/** A single list row: avatar + two text lines + trailing meta. */
export function SkeletonListRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${className}`.trim()} aria-hidden="true">
      <SkeletonCircle size={30} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <SkeletonLine w="45%" h={11} />
        <SkeletonLine w="72%" h={9} />
      </div>
      <SkeletonChip w={56} />
    </div>
  );
}

export function SkeletonList({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`divide-y divide-ink/[0.08] rounded-md border border-ink/12 bg-paper px-4 ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => <SkeletonListRow key={i} />)}
    </div>
  );
}

/** Skeleton body cells under a header row that is already real. Callers that
    own their own `<table>` (Table, DataTable, SelectableTable, …) render their
    true `<SortHeader>`s and then this, so nothing about the grid changes when
    the rows arrive. `lead` is a leading checkbox/chevron gutter column. */
export function SkeletonRows({ rows = 8, cols, lead = false }: { rows?: number; cols: number; lead?: boolean }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-ink/10 last:border-0">
          {lead && <td className="px-4 py-3 w-9"><Skeleton width={14} height={14} rounded="rounded-[3px]" /></td>}
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <SkeletonLine w={CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]} h={11} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A standalone table skeleton.

    `columns` are the REAL column headers when the caller has them, rendered
    through the same `<SortHeader>` chrome the loaded table uses (§3): a
    column header is known before the query returns, so greying it out both
    hid what was coming and relaid the grid out when the words appeared. The
    sort affordance is suppressed while loading — there is nothing to sort. */
export function SkeletonTable({
  rows = 6, cols = 4, columns, className = "",
}: { rows?: number; cols?: number; columns?: string[]; className?: string }) {
  const heads = columns ?? Array.from({ length: cols }, () => null);
  return (
    <div className={`overflow-hidden rounded-md border border-ink/12 bg-paper ${className}`.trim()}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {heads.map((label, c) => (
              <SortHeader key={c} label={label ?? <SkeletonLine w={70} h={9} />} sortable={false} />
            ))}
          </tr>
        </thead>
        <tbody>
          <SkeletonRows rows={rows} cols={heads.length} />
        </tbody>
      </table>
    </div>
  );
}

/** Wrap real content or a skeleton depending on `loading`. */
export function SkeletonSwitch({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  return <>{loading ? skeleton : children}</>;
}
