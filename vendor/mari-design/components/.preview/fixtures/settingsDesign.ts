/* Settings → Design & brand canvas fixtures.

   The states that matter are the two ends of the flow: a workspace still on
   the Mari defaults (nothing set, which is what a new workspace looks like)
   and one whose brand has been read off its own website. */

import type { SettingsDesignData } from "../../pages/SettingsDesignPage";
import type { Branding, BrandHarvest, BrandPreviewStat } from "../../features/BrandingEditor";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import { LONG_TITLE, LONG_URL, LONG_WORD, MIXED_SCRIPT, UNBREAKABLE } from "./stress";

const HARVEST: BrandHarvest = {
  title: "Northwind Analytics",
  themeColor: "#0B5CAD",
  cssColors: [["#0B5CAD", 42], ["#F4A11C", 18], ["#12333E", 12], ["#E8EEF3", 9], ["#7A2E1F", 5]],
  fonts: ["Sora", "Inter", "Source Serif Pro"],
  logo: null,
  warnings: ["No favicon found, used the theme-color meta tag instead."],
};

const PREVIEW: BrandPreviewStat[] = [
  { value: "1,284", label: "documents" },
  { value: "98%", label: "verified" },
  { value: "3", label: "sites live" },
];

const SUMMARY: PropertyItem[] = [
  { label: "Doc sites", value: "3 live" },
  { label: "Exports", value: "PDF and Markdown" },
  { label: "Last changed", value: "Never" },
];

const BRANDED: Branding = {
  accent: "#0B5CAD",
  displayFont: "Sora",
  bodyFont: "Source Serif Pro",
};

const BASE: SettingsDesignData = {
  // Empty is a real state: still on the Mari defaults.
  branding: {},
  harvest: HARVEST,
  previewStats: PREVIEW,
  summary: SUMMARY,
};

export const FIXTURES: PageFixtures<SettingsDesignData> = {
  default: { data: BASE },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "Could not reach the API. Retrying in 5s." },

  branded: {
    data: {
      ...BASE,
      branding: BRANDED,
      summary: [...SUMMARY.slice(0, 2), { label: "Last changed", value: "Jul 18, 2026" }],
    },
  },

  // What the editor looks like straight after reading a site: the draft is
  // populated and the evidence panel has something to justify it with.
  imported: { data: { ...BASE, branding: BRANDED } },

  overflow: {
    data: {
      ...BASE,
      harvest: { ...HARVEST, title: LONG_TITLE, fonts: [LONG_WORD, "Inter", LONG_WORD], warnings: [LONG_URL] },
      summary: [
        { label: "Doc sites", value: LONG_TITLE },
        { label: "Exports", value: "PDF, Markdown, and a very long list of other formats" },
      ],
    },
  },

  stress: {
    data: {
      ...BASE,
      branding: { accent: "#0B5CAD", displayFont: MIXED_SCRIPT, bodyFont: UNBREAKABLE },
      harvest: { ...HARVEST, title: MIXED_SCRIPT, fonts: [UNBREAKABLE, MIXED_SCRIPT, LONG_WORD], warnings: [UNBREAKABLE] },
      summary: [{ label: LONG_WORD, value: MIXED_SCRIPT }],
    },
  },
};
