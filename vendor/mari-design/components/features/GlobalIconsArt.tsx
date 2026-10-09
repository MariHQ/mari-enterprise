import type { ReactNode } from "react";
import { ICONS, type IconName } from "../icons/ui";
import { SourceMark, PROVIDERS, PROVIDER_NAME } from "../icons/marks";
import { TagChip, TAG_OPTIONS } from "../data-display/TagChip";
import { Skeleton, SkeletonLine } from "../data-display/Skeleton";
import { Scrollable } from "../data-display/Scrollable";

/* GlobalIconsArt — the shared visual-primitive showcase: the full bespoke
   line-art icon set (from the icons/ module's ICONS registry), the brand-
   colored provider marks (SourceMark over every PROVIDER), the knowledge-tag
   vocabulary (TagChip), and the hand-drawn "notebook" art that has no lucide
   equivalent, rebuilt here as local SVG sub-components (cloud logo, sprigs,
   mountains, pulseline, ruler ticks, pencil hatching, sparkbars, texture
   placeholder), all hung off a once-mounted <SketchDefs> wobble-filter host.
   Pure presentational, renders standalone.
   Source: web/src/components/{icons,art,shared}.tsx. */

/* ── Notebook art — bespoke SVG with no lucide equivalent ─────────────── */

const MOSS = "#2C6E49";
const CLAY = "#A05E1C";
const BISCAY = "#1C3F60";
const ESPELETTE = "#B23A1E";

/** Invisible <defs> hosting the hand-drawn wobble filters. Mount once. */
function SketchDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <filter id="sketch" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
        </filter>
        <filter id="sketch-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves={2} seed={3} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" />
        </filter>
        <filter id="sketch-cloud" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={3} seed={11} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
        </filter>
      </defs>
    </svg>
  );
}

/** The woven-cloud brand logo. */
function CloudLogo({ size = 48, color = BISCAY }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <g filter="url(#sketch-cloud)" stroke={color} strokeWidth="1.6" strokeLinecap="round">
        <path d="M13 31 a7 7 0 0 1 1 -13.8 a9 9 0 0 1 17.4 -1.4 a6.5 6.5 0 0 1 1.6 12.8 z" fill={color} fillOpacity="0.07" />
        <path d="M15 25 c3 -2 6 -2 9 0 M17 29 c3 -2 6 -2 9 0 M20 21 c2.5 -1.6 5 -1.6 7.5 0" strokeWidth="1.2" opacity="0.65" />
      </g>
    </svg>
  );
}

/** A botanical leaf sprig. */
function Sprig({ size = 40, color = MOSS, flip = false }: { size?: number; color?: string; flip?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <g filter="url(#sketch-soft)" stroke={color} strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 34 C 14 22 20 14 34 8" />
        <path d="M14 24 C 12 20 12 17 14 15 C 17 16 18 19 16 23 Z" fill={color} fillOpacity="0.1" />
        <path d="M20 18 C 19 14 20 11 23 10 C 25 13 24 16 21 18 Z" fill={color} fillOpacity="0.1" />
        <path d="M26 14 C 27 11 30 9 33 9 C 32 13 30 15 27 15 Z" fill={color} fillOpacity="0.1" />
      </g>
    </svg>
  );
}

/** Large faded decorative sprig. */
function FadedSprigLarge({ size = 120, color = MOSS }: { size?: number; color?: string }) {
  return (
    <span aria-hidden style={{ opacity: 0.18 }}>
      <Sprig size={size} color={color} />
    </span>
  );
}

/** Colored-pencil hatching swatch. */
function Hatch({ color = CLAY, height = 64, width = 48 }: { color?: string; height?: number; width?: number }) {
  const lines: ReactNode[] = [];
  for (let i = -6; i < 26; i++) {
    const x = i * 7 + ((i * 13) % 4) - 2;
    const w = 3.2 + ((i * 7) % 3) * 0.5;
    lines.push(
      <line key={i} x1={x} y1={-8} x2={x - height * 0.55} y2={height + 8} stroke={color} strokeWidth={w} strokeLinecap="round" opacity={0.5 + ((i * 11) % 4) * 0.11} />,
    );
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 46 ${height}`} preserveAspectRatio="none" aria-hidden>
      <rect width="46" height={height} fill={color} opacity="0.08" />
      <g filter="url(#sketch-soft)">{lines}</g>
    </svg>
  );
}

/** Mini bar sparkline (source-pulse tiles). */
function Bars({ values = [3, 7, 4, 9, 6, 8, 5], color = BISCAY, width = 90, height = 34 }: { values?: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const bw = width / values.length;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 2));
        return <rect key={i} x={i * bw + 1} y={height - h} width={bw - 2} height={h} rx="1" fill={color} opacity={0.35 + (v / max) * 0.6} />;
      })}
    </svg>
  );
}

/** Heartbeat/EKG pulseline (topbar decoration). */
function Pulseline({ color = ESPELETTE, width = 120, height = 24 }: { color?: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
      <path
        d={`M0 ${height / 2} H${width * 0.32} l6 -${height / 2 - 3} l7 ${height - 6} l6 -${height / 2 - 3} H${width}`}
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#sketch-soft)"
      />
    </svg>
  );
}

/** Faint pencil mountain range (lineage backdrop). */
function Mountains({ width = 200, height = 60, color = BISCAY }: { width?: number; height?: number; color?: string }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden style={{ opacity: 0.22 }}>
      <g filter="url(#sketch)" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${height} L40 20 L70 ${height} Z`} />
        <path d={`M55 ${height} L110 8 L165 ${height} Z`} />
        <path d={`M140 ${height} L180 26 L${width} ${height} Z`} />
        <path d="M96 20 l8 8 M104 18 l8 8" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

/** Ruler ticks (time scrubber). */
function Ticks({ n = 12, width = 200, color = BISCAY }: { n?: number; width?: number; color?: string }) {
  const gap = width / n;
  return (
    <svg width={width} height={18} viewBox={`0 0 ${width} 18`} aria-hidden>
      <g filter="url(#sketch-soft)" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.6">
        {Array.from({ length: n + 1 }, (_, i) => (
          <line key={i} x1={i * gap} y1={i % 4 === 0 ? 2 : 8} x2={i * gap} y2={16} />
        ))}
      </g>
    </svg>
  );
}

/** Cross-hatch placeholder for generated imagery.
 *  The old version was a 0.8px web at 35% opacity, so it read as dirt on the
 *  screen rather than as artwork. It now uses the same weight and density as
 *  <Hatch>: a solid tinted ground, colored-pencil strokes at full sketch
 *  weight, and a visible frame. */
function TexturePlaceholder({ hue = CLAY, width = 96, height = 64 }: { hue?: string; width?: number; height?: number }) {
  const step = 9;
  const n = Math.ceil((width + height) / step) + 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="rounded-[4px]">
      <rect width={width} height={height} fill={hue} opacity="0.14" />
      <g filter="url(#sketch-soft)" stroke={hue} strokeLinecap="round">
        {Array.from({ length: n }, (_, i) => (
          <line key={`a${i}`} x1={-height + i * step} y1={height} x2={i * step} y2={0}
            strokeWidth={2.4 + ((i * 7) % 3) * 0.5} opacity={0.5 + ((i * 11) % 4) * 0.1} />
        ))}
        {Array.from({ length: Math.round(n / 2) }, (_, i) => (
          <line key={`b${i}`} x1={i * step * 2} y1={height} x2={height + i * step * 2} y2={0}
            strokeWidth={1.4} opacity={0.3} />
        ))}
      </g>
      <rect x="0.75" y="0.75" width={width - 1.5} height={height - 1.5} rx="4" fill="none" stroke={hue} strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

/* ── Showcase scaffolding ─────────────────────────────────────────────── */

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2 border-b border-ink/10 pb-1.5">
        <h3 className="font-display text-[15px] text-ink">{title}</h3>
        {note && <span className="font-term text-[11px] text-ink/65">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[6px] border border-ink/10 bg-paper px-2 py-3 text-ink/80">
      <div className="grid h-9 place-items-center">{children}</div>
      <span className="font-term text-[10px] text-ink/65">{label}</span>
    </div>
  );
}

const ICON_NAMES = Object.keys(ICONS) as IconName[];

export type GlobalIconsArtProps = { loading?: boolean; className?: string };

/* Loading silhouette mirroring the showcase: a title block over sectioned
   grids of icon/mark cells. */
function IconsArtSkeleton({ className = "" }: { className?: string }) {
  const cell = (key: string | number) => (
    <div key={key} className="flex flex-col items-center gap-1.5 rounded-[6px] border border-ink/10 bg-paper px-2 py-3">
      <Skeleton width={22} height={22} />
      <SkeletonLine w={40} h={8} />
    </div>
  );
  return (
    <div className={`max-w-[880px] ${className}`.trim()} aria-hidden="true">
      <div className="mb-5 space-y-2">
        <SkeletonLine w={260} h={18} />
        <SkeletonLine w="70%" h={10} />
      </div>
      <div className="flex flex-col gap-7">
        {[0, 1].map((s) => (
          <section key={s}>
            <div className="mb-3 border-b border-ink/10 pb-1.5"><SkeletonLine w={180} h={13} /></div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1.5">
              {Array.from({ length: 12 }).map((_, i) => cell(i))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function GlobalIconsArt({ loading = false, className = "" }: GlobalIconsArtProps) {
  if (loading) return <IconsArtSkeleton className={className} />;
  return (
    <div className={`max-w-[880px] ${className}`.trim()}>
      <SketchDefs />

      <div className="mb-5">
        <h2 className="font-display text-[19px] text-ink">Icons, marks & notebook art</h2>
        <p className="mt-0.5 text-[13px] text-ink/70">
          The console ships its iconography and decoration as inline SVG: a line-art icon set,
          brand-colored source marks, the tag vocabulary, and hand-drawn "Editorial Notebook" art.
        </p>
      </div>

      <div className="flex flex-col gap-7">
        <Section title="Line-art icon set" note={`${ICON_NAMES.length} icons · currentColor · 1.6px`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1.5">
            {ICON_NAMES.map((name) => {
              const Cmp = ICONS[name];
              return (
                <Cell key={name} label={name}>
                  <Cmp size={22} />
                </Cell>
              );
            })}
          </div>
        </Section>

        <Section title="Provider marks" note="brand-colored glyphs">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5">
            {PROVIDERS.map((p) => (
              <Cell key={p} label={PROVIDER_NAME[p] ?? p}>
                <SourceMark provider={p} size={24} />
              </Cell>
            ))}
          </div>
        </Section>

        <Section title="Tag vocabulary" note="knowledge tags → tone">
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((t) => <TagChip key={t} tag={t} />)}
            <TagChip tag="verified" />
          </div>
        </Section>

        <Section title="Notebook art" note="bespoke SVG · wobble filters">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            <Cell label="CloudLogo"><CloudLogo size={44} /></Cell>
            <Cell label="Sprig"><Sprig size={40} /></Cell>
            <Cell label="Sprig (flip)"><Sprig size={40} color={CLAY} flip /></Cell>
            <Cell label="Hatch"><Hatch color={CLAY} height={40} width={30} /></Cell>
            <Cell label="Sparkbars"><Bars /></Cell>
            <Cell label="Pulseline"><Pulseline /></Cell>
            <Cell label="Ticks"><Ticks n={10} width={120} /></Cell>
            <Cell label="TexturePlaceholder"><TexturePlaceholder width={80} height={44} /></Cell>
          </div>
          <Scrollable className="mt-2 rounded-[6px] border border-ink/10 bg-flysch/50" scrollerClassName="flex items-end gap-4 px-4 py-3" fade="flysch">
            <Mountains />
            <FadedSprigLarge size={90} />
          </Scrollable>
        </Section>
      </div>
    </div>
  );
}
