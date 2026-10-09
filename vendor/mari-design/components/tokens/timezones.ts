/* Canonical time-zone vocabulary.
 *
 * Settings → General used to offer `{utc, pt, et}` — three made-up ids whose
 * LABELS were IANA zone names — while Preferences offered IANA ids with prose
 * labels ("Pacific — Los Angeles", em dash and all). The same account could
 * therefore be described two incompatible ways by two pages, and neither list
 * could name the zone most people are actually in.
 *
 * There is exactly one list now, the way `tokens/regions.ts` gives one
 * spelling of a region: the id is the IANA zone (`America/Los_Angeles`), which
 * is what the server stores and what `Intl` understands, and `timezoneLabel()`
 * is the prose form for menus. Labels carry no em/en dashes (CONVENTIONS §5).
 */

export type TimezoneOption = { id: string; label: string };

/** Ordered west to east, so scanning the menu matches the way a map reads. */
export const TIMEZONES: TimezoneOption[] = [
  { id: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { id: "America/Anchorage", label: "Alaska (Anchorage)" },
  { id: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { id: "America/Phoenix", label: "Arizona (Phoenix)" },
  { id: "America/Denver", label: "Mountain Time (Denver)" },
  { id: "America/Chicago", label: "Central Time (Chicago)" },
  { id: "America/Mexico_City", label: "Central Time (Mexico City)" },
  { id: "America/New_York", label: "Eastern Time (New York)" },
  { id: "America/Toronto", label: "Eastern Time (Toronto)" },
  { id: "America/Bogota", label: "Colombia (Bogota)" },
  { id: "America/Sao_Paulo", label: "Brazil (Sao Paulo)" },
  { id: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { id: "UTC", label: "UTC" },
  { id: "Europe/London", label: "United Kingdom (London)" },
  { id: "Europe/Dublin", label: "Ireland (Dublin)" },
  { id: "Europe/Lisbon", label: "Portugal (Lisbon)" },
  { id: "Europe/Madrid", label: "Spain (Madrid)" },
  { id: "Europe/Paris", label: "France (Paris)" },
  { id: "Europe/Amsterdam", label: "Netherlands (Amsterdam)" },
  { id: "Europe/Berlin", label: "Germany (Berlin)" },
  { id: "Europe/Zurich", label: "Switzerland (Zurich)" },
  { id: "Europe/Stockholm", label: "Sweden (Stockholm)" },
  { id: "Europe/Warsaw", label: "Poland (Warsaw)" },
  { id: "Europe/Athens", label: "Greece (Athens)" },
  { id: "Europe/Kyiv", label: "Ukraine (Kyiv)" },
  { id: "Europe/Istanbul", label: "Turkey (Istanbul)" },
  { id: "Africa/Lagos", label: "Nigeria (Lagos)" },
  { id: "Africa/Johannesburg", label: "South Africa (Johannesburg)" },
  { id: "Africa/Nairobi", label: "Kenya (Nairobi)" },
  { id: "Asia/Jerusalem", label: "Israel (Jerusalem)" },
  { id: "Asia/Dubai", label: "United Arab Emirates (Dubai)" },
  { id: "Asia/Karachi", label: "Pakistan (Karachi)" },
  { id: "Asia/Kolkata", label: "India (Kolkata)" },
  { id: "Asia/Dhaka", label: "Bangladesh (Dhaka)" },
  { id: "Asia/Bangkok", label: "Thailand (Bangkok)" },
  { id: "Asia/Jakarta", label: "Indonesia (Jakarta)" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Hong_Kong", label: "Hong Kong" },
  { id: "Asia/Shanghai", label: "China (Shanghai)" },
  { id: "Asia/Seoul", label: "South Korea (Seoul)" },
  { id: "Asia/Tokyo", label: "Japan (Tokyo)" },
  { id: "Australia/Perth", label: "Australia West (Perth)" },
  { id: "Australia/Adelaide", label: "Australia Central (Adelaide)" },
  { id: "Australia/Brisbane", label: "Australia East (Brisbane)" },
  { id: "Australia/Sydney", label: "Australia East (Sydney)" },
  { id: "Pacific/Auckland", label: "New Zealand (Auckland)" },
];

const BY_ID = new Map(TIMEZONES.map((t) => [t.id, t]));

/** Ids the console shipped before this file existed. Settings → General wrote
    `utc` / `pt` / `et` into the workspace row, so a workspace saved by the old
    build still holds one. Each maps to the zone it always meant, which is why
    reading one is safe: nothing is being reinterpreted, only spelled properly. */
const LEGACY: Record<string, string> = {
  utc: "UTC",
  pt: "America/Los_Angeles",
  mt: "America/Denver",
  ct: "America/Chicago",
  et: "America/New_York",
};

/** The IANA id for whatever the server handed back, legacy ids included. An
    unrecognised value is returned untouched: it is the account's real setting
    and must not be silently rewritten to UTC on the next save. */
export function normalizeTimezone(raw: string): string {
  if (!raw) return "";
  return LEGACY[raw.toLowerCase()] ?? raw;
}

/** Prose form for menus and rails: "Pacific Time (Los Angeles)". Falls back to
    the id, which is itself readable, rather than to a guess. */
export function timezoneLabel(id: string): string {
  const norm = normalizeTimezone(id);
  return BY_ID.get(norm)?.label ?? norm;
}

/** Options for a timezone `<Select>` / `<Combobox>`. */
export const TIMEZONE_OPTIONS = TIMEZONES.map((t) => ({ value: t.id, label: t.label }));

/** The list with `current` guaranteed present. A zone this build has no label
    for still has to be selectable, or the form would misstate the account and
    saving it would overwrite the real value. */
export function timezoneOptions(current: string): { value: string; label: string }[] {
  const norm = normalizeTimezone(current);
  if (!norm || BY_ID.has(norm)) return TIMEZONE_OPTIONS;
  return [{ value: norm, label: norm }, ...TIMEZONE_OPTIONS];
}
