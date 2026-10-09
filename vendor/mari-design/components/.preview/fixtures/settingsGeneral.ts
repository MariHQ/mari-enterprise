/* Settings → General canvas fixtures. Lifted out of
   `pages/SettingsGeneralPage.tsx` and `features/BrandingEditor.tsx`, which are
   now pure presenters and ship no demo content. */

import type { SettingsGeneralData } from "../../pages/SettingsGeneralPage";
import type { BrandHarvest, BrandPreviewStat, Branding } from "../../features/BrandingEditor";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, LONG_SOURCE, LONG_URL, LONG_WORD,
  UNBREAKABLE, MIXED_SCRIPT, HUGE_NUMBER_STR,
} from "./stress";

const SUMMARY: PropertyItem[] = [
  { label: "Plan", value: "Team" },
  { label: "Members", value: "24 active, 2 invited" },
  { label: "Region", value: "US West (us-west-2)" },
  { label: "Created", value: "Nov 3, 2024" },
];

const BRANDING: Branding = {};

const HARVEST: BrandHarvest = {
  title: "Northwind Analytics",
  themeColor: "#0B5CAD",
  cssColors: [["#0B5CAD", 42], ["#F4A11C", 18], ["#12333E", 12], ["#E8EEF3", 9], ["#7A2E1F", 5]],
  fonts: ["Sora", "Inter", "Source Serif Pro"],
  logo: null,
  warnings: ["No favicon found, used the theme-color meta tag instead."],
};

const PREVIEW_STATS: BrandPreviewStat[] = [
  { value: "1,284", label: "documents" },
  { value: "98%", label: "verified" },
  { value: "3", label: "sites live" },
];

const BASE: SettingsGeneralData = {
  section: "workspace",
  name: "Acme Data Platform",
  slug: "acme-data",
  plan: "team",
  timezone: "utc",
  language: "en",
  save: "clean",
  slugError: null,
  summary: SUMMARY,
  danger: false,
  lineage: { maxNodes: 35, hopDepth: 2, minConfidence: 0.72 },
  branding: BRANDING,
  brandHarvest: HARVEST,
  brandPreviewStats: PREVIEW_STATS,
};

/** The name the user has just typed but not saved. */
const EDITED = "Acme Data Platform (US)";

/** Long natural text (overflow) and pathological tokens (stress) through the
    same workspace record and rail summary a real workspace fills. */
function strained(extreme: boolean): SettingsGeneralData {
  const summary: PropertyItem[] = [
    { label: "Workspace", value: extreme ? UNBREAKABLE : LONG_NAME },
    { label: "Homepage", value: extreme ? UNBREAKABLE : LONG_URL, stacked: true },
    { label: "Members", value: extreme ? `${HUGE_NUMBER_STR} ${UNBREAKABLE}` : `${HUGE_NUMBER_STR} across every region` },
    { label: "Description", value: extreme ? `${LONG_WORD} ${MIXED_SCRIPT}` : LONG_PARAGRAPH, stacked: true },
  ];
  return {
    ...BASE,
    name: extreme ? UNBREAKABLE : LONG_NAME,
    slug: extreme ? UNBREAKABLE : LONG_SOURCE,
    save: "dirty",
    slugError: extreme ? MIXED_SCRIPT : LONG_TITLE,
    summary,
    danger: true,
  };
}

export const FIXTURES: PageFixtures<SettingsGeneralData> = {
  default: { data: BASE },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "Workspace settings are temporarily unavailable. Retrying…" },
  editing: { data: { ...BASE, name: EDITED, save: "dirty" } },
  saving: { data: { ...BASE, name: EDITED, save: "saving" } },
  saved: { data: { ...BASE, save: "saved" } },
  invalid: {
    data: {
      ...BASE,
      name: EDITED,
      slug: "Acme Data!",
      save: "dirty",
      slugError: "Slug may only contain lowercase letters, numbers, and hyphens.",
    },
  },
  branding: { data: { ...BASE, section: "branding" } },
  danger: { data: { ...BASE, danger: true } },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
