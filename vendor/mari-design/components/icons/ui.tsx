// Bespoke line-art UI icon set — one named component each, plus a keyed
// registry and an <Icon name=… /> convenience for data-driven lookups.
// All icons are pure inline SVG, stroke = currentColor, sized by the `size`
// prop. Faithful to the source console's 1.6px round-cap hand-drawn style.

import { IconBase, type IconProps } from "./IconBase";

export const IconHome = (p: IconProps) => (
  <IconBase {...p}><path d="M4 11 L12 4 L20 11" /><path d="M6 10 V20 H18 V10" /></IconBase>
);
export const IconChat = (p: IconProps) => (
  <IconBase {...p}><path d="M4 6 h16 v10 h-9 l-4 4 v-4 h-3 z" /></IconBase>
);
export const IconBook = (p: IconProps) => (
  <IconBase {...p}><path d="M12 6 C 10 4.5 7 4 4 4.5 V 19 C 7 18.5 10 19 12 20.5 C 14 19 17 18.5 20 19 V 4.5 C 17 4 14 4.5 12 6 Z" /><path d="M12 6 V 20.5" /></IconBase>
);
export const IconLineage = (p: IconProps) => (
  <IconBase {...p}><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="9" r="2.4" /><circle cx="10" cy="18" r="2.4" /><path d="M8 7.2 L 15.7 8.6 M16.6 11 L 11.5 16.2 M7 8.3 L 9.3 15.8" /></IconBase>
);
export const IconShieldCheck = (p: IconProps) => (
  <IconBase {...p}><path d="M12 3.5 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z" /><path d="M9 11.5 l2 2 4 -4.5" /></IconBase>
);
export const IconFlow = (p: IconProps) => (
  <IconBase {...p}><circle cx="5" cy="7" r="2.2" /><circle cx="19" cy="7" r="2.2" /><circle cx="12" cy="17" r="2.2" /><path d="M7 8 C 9 10 10 12 11 15 M17 8 C 15 10 14 12 13 15" /></IconBase>
);
export const IconSend = (p: IconProps) => (
  <IconBase {...p}><path d="M4 12 L20 4 L14 20 L11.5 13.5 Z" /><path d="M11.5 13.5 L20 4" /></IconBase>
);
export const IconSearch = (p: IconProps) => (
  <IconBase {...p}><circle cx="10.5" cy="10.5" r="5.5" /><path d="M15 15 L20 20" /></IconBase>
);
export const IconChevronDown = (p: IconProps) => (
  <IconBase {...p}><path d="M8 10 l4 4 4 -4" /></IconBase>
);
export const IconChevronRight = (p: IconProps) => (
  <IconBase {...p}><path d="M10 7 l5 5 -5 5" /></IconBase>
);
export const IconChevronLeft = (p: IconProps) => (
  <IconBase {...p}><path d="M14 7 l-5 5 5 5" /></IconBase>
);
export const IconArrowRight = (p: IconProps) => (
  <IconBase {...p}><path d="M4 12 h15 M14 6.5 L 19.5 12 L 14 17.5" /></IconBase>
);
export const IconCheck = (p: IconProps) => (
  <IconBase {...p}><path d="M5 12.5 l4.5 4.5 L 19 7.5" /></IconBase>
);
export const IconCheckCircle = (p: IconProps) => (
  <IconBase {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2 l2.5 2.5 4.5 -5" /></IconBase>
);
export const IconClipboard = (p: IconProps) => (
  <IconBase {...p}><rect x="6" y="5" width="12" height="16" rx="2" /><path d="M9.5 5 a2.5 2.5 0 0 1 5 0" /><path d="M9 11 h6 M9 15 h6" /></IconBase>
);
export const IconPlay = (p: IconProps) => (
  <IconBase {...p}><path d="M9 7 L 17 12 L 9 17 Z" /></IconBase>
);
export const IconDoc = (p: IconProps) => (
  <IconBase {...p}><path d="M7 3.5 h7 l4 4 V 20.5 H 7 Z" /><path d="M14 3.5 V 8 h4" /><path d="M10 12.5 h5 M10 16 h5" /></IconBase>
);
export const IconMegaphone = (p: IconProps) => (
  <IconBase {...p}><path d="M4 10 v4 h3 l7 4 V 6 l-7 4 Z" /><path d="M17.5 9.5 a 4 4 0 0 1 0 5" /></IconBase>
);
export const IconCalendar = (p: IconProps) => (
  <IconBase {...p}><rect x="4.5" y="6" width="15" height="14" rx="2" /><path d="M4.5 10.5 h15 M8.5 4 v3.5 M15.5 4 v3.5" /></IconBase>
);
export const IconGear = (p: IconProps) => (
  // A real toothed cog. The old version was radial spokes around a circle,
  // which read as a sun rather than a settings gear.
  <IconBase {...p} strokeLinejoin="miter">
    <path d="M 9.80 2.45 L 14.20 2.45 L 14.10 5.01 L 16.16 6.00 L 18.09 4.32 L 20.84 7.77 L 18.78 9.28 L 19.28 11.51 L 21.80 11.98 L 20.82 16.27 L 18.35 15.60 L 16.93 17.39 L 18.13 19.65 L 14.16 21.56 L 13.14 19.21 L 10.86 19.21 L 9.84 21.56 L 5.87 19.65 L 7.07 17.39 L 5.65 15.60 L 3.18 16.27 L 2.20 11.98 L 4.72 11.51 L 5.22 9.28 L 3.16 7.77 L 5.91 4.32 L 7.84 6.00 L 9.90 5.01 Z" />
    <circle cx="12" cy="12" r="3.4" />
  </IconBase>
);
export const IconKebab = (p: IconProps) => (
  <IconBase {...p}><circle cx="12" cy="5.5" r="1.1" fill="currentColor" /><circle cx="12" cy="12" r="1.1" fill="currentColor" /><circle cx="12" cy="18.5" r="1.1" fill="currentColor" /></IconBase>
);
export const IconExpand = (p: IconProps) => (
  <IconBase {...p}><path d="M14 5 h5 v5 M19 5 l-6.5 6.5" /><path d="M10 19 H5 v-5 M5 19 l6.5 -6.5" /></IconBase>
);
export const IconExternal = (p: IconProps) => (
  <IconBase {...p}><path d="M10 6 H5.5 V18.5 H18 V14" /><path d="M13.5 5 H19 v5.5 M19 5 l-8 8" /></IconBase>
);
export const IconBell = (p: IconProps) => (
  <IconBase {...p}><path d="M12 4.5 a5.5 5.5 0 0 1 5.5 5.5 c0 4 1.5 5.5 1.5 5.5 H5 s1.5 -1.5 1.5 -5.5 A5.5 5.5 0 0 1 12 4.5 Z" /><path d="M10.3 18.7 a1.8 1.8 0 0 0 3.4 0" /></IconBase>
);
export const IconLayers = (p: IconProps) => (
  <IconBase {...p}><path d="M12 4 L20 8.5 L12 13 L4 8.5 Z" /><path d="M4 13 L12 17.5 L20 13" /></IconBase>
);
export const IconPencil = (p: IconProps) => (
  <IconBase {...p}><path d="M5 19 l1 -4 L 16.5 4.5 a2 2 0 0 1 3 3 L 9 18 Z" /></IconBase>
);
export const IconFork = (p: IconProps) => (
  <IconBase {...p}><circle cx="7" cy="6" r="2" /><circle cx="17" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 8 v2 a4 4 0 0 0 4 4 h0 M17 8 v2 a4 4 0 0 1 -4 4 h0 M12 14 v2" /></IconBase>
);
export const IconSparkle = (p: IconProps) => (
  <IconBase {...p}><path d="M12 4 C 12.7 8 14.5 10 18.5 11 C 14.5 12 12.7 14 12 18 C 11.3 14 9.5 12 5.5 11 C 9.5 10 11.3 8 12 4 Z" /></IconBase>
);
export const IconGlobe = (p: IconProps) => (
  <IconBase {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12 h17 M12 3.5 c-5.5 5 -5.5 12 0 17 c5.5 -5 5.5 -12 0 -17" /></IconBase>
);
export const IconShuffle = (p: IconProps) => (
  <IconBase {...p}><path d="M4 7 h4 l8 10 h4 M16 17 l4 0 -0 0 M4 17 h4 l2.5 -3.1 M13.4 10.1 L16 7 h4" /><path d="M17.5 4.8 L20 7 l-2.5 2.2 M17.5 14.8 L20 17 l-2.5 2.2" /></IconBase>
);
export const IconBookmark = (p: IconProps) => (
  <IconBase {...p}><path d="M7 4.5 h10 V 20 l-5 -3.5 L7 20 Z" /></IconBase>
);
export const IconLeaf = (p: IconProps) => (
  <IconBase {...p}><path d="M6 18 C 5 10 10 5 19 5 C 19 14 14 19 6 18 Z" /><path d="M6 18 C 9 13 12 10 16 8" /></IconBase>
);
export const IconQuill = (p: IconProps) => (
  <IconBase {...p}><path d="M5 19 C 6 12 11 6 20 4 C 18 12 13 17 7 18" /><path d="M5 19 L 12 11" /></IconBase>
);
export const IconTag = (p: IconProps) => (
  <IconBase {...p}><path d="M4 5 h7 l9 9 -6 6 -10 -10 z" /><circle cx="8" cy="9" r="1.4" /></IconBase>
);
export const IconSprout = (p: IconProps) => (
  <IconBase {...p}><path d="M12 20 V10" /><path d="M12 13 C8 13 5 10 5 6 c4 0 7 2 7 6" /><path d="M12 10 c0 -4 3 -6 7 -6 c0 4 -3 7 -7 7" /></IconBase>
);
export const IconKey = (p: IconProps) => (
  <IconBase {...p}><circle cx="8" cy="12" r="3.5" /><path d="M11.5 12 H20 M17 12 v3 M20 12 v2.4" /></IconBase>
);
export const IconClock = (p: IconProps) => (
  <IconBase {...p}><circle cx="12" cy="12" r="8" /><path d="M12 7.5 V12 l3 2.4" /></IconBase>
);
export const IconPlus = (p: IconProps) => (
  <IconBase {...p}><path d="M12 5 v14 M5 12 h14" /></IconBase>
);
export const IconClose = (p: IconProps) => (
  <IconBase {...p}><path d="M6.5 6.5 L 17.5 17.5 M17.5 6.5 L 6.5 17.5" /></IconBase>
);
export const IconTrash = (p: IconProps) => (
  <IconBase {...p}><path d="M5 7 h14 M10 7 V5 h4 v2 M7 7 l1 13 h8 l1 -13 M10 11 v6 M14 11 v6" /></IconBase>
);
export const IconRefresh = (p: IconProps) => (
  <IconBase {...p}><path d="M19 12 a7 7 0 1 1 -2.2 -5.1 M17.5 3.5 v3.6 h-3.6" /></IconBase>
);
export const IconUpload = (p: IconProps) => (
  <IconBase {...p}><path d="M12 16.5 V4.5 M7 9.5 L12 4.5 L17 9.5" /><path d="M4.5 15.5 V19.5 H19.5 V15.5" /></IconBase>
);
export const IconEye = (p: IconProps) => (
  <IconBase {...p}><path d="M2.5 12 C5 7.5 8.5 5.5 12 5.5 s7 2 9.5 6.5 c-2.5 4.5 -6 6.5 -9.5 6.5 s-7 -2 -9.5 -6.5 z" /><circle cx="12" cy="12" r="2.6" /></IconBase>
);

/** Keyed registry for data-driven lookups. */
export const ICONS = {
  home: IconHome,
  chat: IconChat,
  book: IconBook,
  lineage: IconLineage,
  "shield-check": IconShieldCheck,
  flow: IconFlow,
  send: IconSend,
  search: IconSearch,
  "chevron-down": IconChevronDown,
  "chevron-right": IconChevronRight,
  "chevron-left": IconChevronLeft,
  "arrow-right": IconArrowRight,
  check: IconCheck,
  "check-circle": IconCheckCircle,
  clipboard: IconClipboard,
  play: IconPlay,
  doc: IconDoc,
  megaphone: IconMegaphone,
  calendar: IconCalendar,
  gear: IconGear,
  kebab: IconKebab,
  expand: IconExpand,
  external: IconExternal,
  bell: IconBell,
  layers: IconLayers,
  pencil: IconPencil,
  fork: IconFork,
  sparkle: IconSparkle,
  globe: IconGlobe,
  shuffle: IconShuffle,
  bookmark: IconBookmark,
  leaf: IconLeaf,
  quill: IconQuill,
  tag: IconTag,
  sprout: IconSprout,
  key: IconKey,
  clock: IconClock,
  plus: IconPlus,
  close: IconClose,
  trash: IconTrash,
  refresh: IconRefresh,
  upload: IconUpload,
  eye: IconEye,
} as const;

export type IconName = keyof typeof ICONS;

/** Convenience lookup component: `<Icon name="search" size={20} />`. */
export function Icon({ name, ...rest }: IconProps & { name: IconName }) {
  const Cmp = ICONS[name];
  return <Cmp {...rest} />;
}
