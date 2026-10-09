/* Settings → API keys canvas fixtures. Lifted out of
   `pages/SettingsApiKeysPage.tsx` and `features/SettingsApiKeys.tsx`. */

import type { SettingsApiKeysData } from "../../pages/SettingsApiKeysPage";
import type { ApiKey } from "../../features/SettingsApiKeys";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_URL, LONG_WORD, UNBREAKABLE, MIXED_SCRIPT, MANY_TAGS, repeat,
} from "./stress";

const KEYS: ApiKey[] = [
  { id: 1, name: "CI pipeline", prefix: "mk_live_a91f…", scopes: "search:read ingest:write", created: "2025-02-11", lastUsed: "2025-07-18", revoked: false },
  { id: 2, name: "MCP gateway", prefix: "mk_live_7c02…", scopes: "search:read facts:read", created: "2025-04-02", lastUsed: "2025-07-20", revoked: false },
  { id: 3, name: "Old bot (rotated)", prefix: "mk_live_3de8…", scopes: "search:read", created: "2024-12-01", lastUsed: "2025-03-30", revoked: true },
];

const MANY_KEYS: ApiKey[] = [
  ...KEYS,
  { id: 4, name: "Staging ingest", prefix: "mk_live_ b21c…", scopes: "ingest:write", created: "2025-05-03", lastUsed: "2025-07-19", revoked: false },
  { id: 5, name: "Docs preview bot", prefix: "mk_live_f440…", scopes: "search:read", created: "2025-05-22", lastUsed: "2025-07-15", revoked: false },
  { id: 6, name: "Grafana exporter", prefix: "mk_live_09aa…", scopes: "metrics:read", created: "2025-06-01", lastUsed: null, revoked: false },
  { id: 7, name: "Legacy sync (rotated)", prefix: "mk_live_1188…", scopes: "search:read", created: "2024-09-14", lastUsed: "2025-01-02", revoked: true },
];

const CREATED_KEY: ApiKey = {
  id: 99, name: "Nightly export bot", prefix: "mk_live_9f2a…",
  scopes: "search:read ingest:write", created: "2026-07-21", lastUsed: null, revoked: false,
};

const SUMMARY: PropertyItem[] = [
  { label: "Active keys", value: "2" },
  { label: "Revoked keys", value: "1" },
  { label: "Requests, 30 days", value: "184,220" },
  { label: "Oldest key", value: "Dec 1, 2024" },
];

const BASE: SettingsApiKeysData = {
  phase: "list",
  keys: KEYS,
  draft: { name: "Nightly export bot", scopes: "search:read ingest:write" },
  newSecret: null,
  confirmKeyId: null,
  summary: SUMMARY,
};

/** A workspace with no programmatic access at all. */
const EMPTY: SettingsApiKeysData = { ...BASE, keys: [] };

function strained(extreme: boolean): SettingsApiKeysData {
  const keys: ApiKey[] = extreme
    ? repeat((i) => ({
        id: i + 1,
        name: [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT][i % 3],
        prefix: UNBREAKABLE,
        scopes: MANY_TAGS.join(" "),
        created: "2025-01-01",
        lastUsed: i % 2 === 0 ? "2025-07-20" : null,
        revoked: i % 3 === 0,
      }), 5)
    : repeat((i) => ({
        id: i + 1,
        name: LONG_TITLE,
        prefix: LONG_URL,
        scopes: MANY_TAGS.slice(0, 10).map((t) => `${t}:read`).join(" "),
        created: "2025-01-01",
        lastUsed: i % 2 === 0 ? "2025-07-20" : null,
        revoked: i % 3 === 0,
      }), 4);
  return {
    ...BASE,
    keys,
    draft: { name: extreme ? UNBREAKABLE : LONG_TITLE, scopes: MANY_TAGS.join(" ") },
    newSecret: extreme ? UNBREAKABLE : LONG_URL,
  };
}

export const FIXTURES: PageFixtures<SettingsApiKeysData> = {
  default: { data: BASE },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "Your API keys are temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  single: { data: { ...BASE, keys: [KEYS[0]] } },
  many: { data: { ...BASE, keys: MANY_KEYS } },
  "create-key": { data: { ...BASE, phase: "create-key" } },
  "key-created": {
    data: {
      ...BASE,
      phase: "key-created",
      keys: [CREATED_KEY, ...KEYS],
      newSecret: "mk_live_9f2ac0d18b7e4a3c1d5e6f708192a3b4",
    },
  },
  "revoke-confirm": { data: { ...BASE, phase: "revoke-confirm", confirmKeyId: 2 } },
  revoked: { data: { ...BASE, phase: "list", keys: MANY_KEYS } },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
