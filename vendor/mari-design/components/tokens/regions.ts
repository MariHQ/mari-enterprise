/* Canonical server / region vocabulary.
 *
 * Pages used to mix "US West", "us-west", and "us-west-2" for the same thing.
 * There is exactly one spelling of each region now: the code (`us-west-2`) is
 * what appears in tables, chips, and API-ish contexts; `regionLabel()` is the
 * prose form for menus and headings. Never write a region string by hand. */

export type RegionCode = "us-west-2" | "us-east-1" | "eu-west-1" | "eu-central-1" | "ap-southeast-2";

export const REGIONS: { code: RegionCode; label: string; short: string }[] = [
  { code: "us-west-2", label: "US West (us-west-2)", short: "US West" },
  { code: "us-east-1", label: "US East (us-east-1)", short: "US East" },
  { code: "eu-west-1", label: "EU West (eu-west-1)", short: "EU West" },
  { code: "eu-central-1", label: "EU Central (eu-central-1)", short: "EU Central" },
  { code: "ap-southeast-2", label: "Asia Pacific (ap-southeast-2)", short: "Asia Pacific" },
];

const BY_CODE = new Map(REGIONS.map((r) => [r.code, r]));

/** Prose form for menus/headings: "US West (us-west-2)". */
export function regionLabel(code: string): string {
  return BY_CODE.get(code as RegionCode)?.label ?? code;
}

/** Compact form for dense table cells and chips: "US West". */
export function regionShort(code: string): string {
  return BY_CODE.get(code as RegionCode)?.short ?? code;
}

/** Options for a region <Select>/<Combobox>. Includes the "All regions" default. */
export const REGION_OPTIONS = [
  { value: "", label: "All regions" },
  ...REGIONS.map((r) => ({ value: r.code, label: r.label })),
];
