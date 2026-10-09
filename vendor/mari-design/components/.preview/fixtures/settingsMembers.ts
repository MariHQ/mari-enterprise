/* Settings → Members canvas fixtures. Lifted out of
   `pages/SettingsMembersPage.tsx` and `features/SettingsMembersTable.tsx`. */

import type { SettingsMembersData } from "../../pages/SettingsMembersPage";
import type { Member } from "../../features/SettingsMembersTable";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import {
  LONG_NAME, LONG_SOURCE, LONG_WORD, UNBREAKABLE, MIXED_SCRIPT, MANY_INITIALS, repeat,
} from "./stress";

const ROSTER: Member[] = [
  { id: 1, name: "Maya Chen", initials: "MC", email: "maya@team.com", role: "admin", status: "active", joined: "2024-11-03" },
  { id: 2, name: "Devon Park", initials: "DP", email: "devon@team.com", role: "manager", status: "active", joined: "2025-01-18" },
  { id: 3, name: "Priya Nair", initials: "PN", email: "priya@team.com", role: "user", status: "active", joined: "2025-03-22" },
  { id: 4, name: "Sam Okafor", initials: "SO", email: "sam@team.com", role: "user", status: "invited", joined: "2025-06-30" },
];

const MANY: Member[] = [
  ...ROSTER,
  { id: 5, name: "Lena Ford", initials: "LF", email: "lena@team.com", role: "user", status: "active", joined: "2025-02-09" },
  { id: 6, name: "Tomás Rivas", initials: "TR", email: "tomas@team.com", role: "manager", status: "active", joined: "2025-04-14" },
  { id: 7, name: "Aiko Sato", initials: "AS", email: "aiko@team.com", role: "user", status: "active", joined: "2025-05-01" },
  { id: 8, name: "Noah Klein", initials: "NK", email: "noah@team.com", role: "user", status: "invited", joined: "2025-07-02" },
  { id: 9, name: "Grace Hobbs", initials: "GH", email: "grace@team.com", role: "admin", status: "active", joined: "2024-10-20" },
  { id: 10, name: "Omar Farouk", initials: "OF", email: "omar@team.com", role: "user", status: "active", joined: "2025-06-11" },
];

const SUMMARY: PropertyItem[] = [
  { label: "Seats used", value: "24 of 50" },
  { label: "Admins", value: "2" },
  { label: "Pending invites", value: "1" },
  { label: "Provisioning", value: "GitHub team sync" },
];

const BASE: SettingsMembersData = {
  members: ROSTER,
  workspaceName: "Acme Data Platform",
  githubTeam: { connected: true, team: "acme/data-eng" },
  summary: SUMMARY,
  interaction: "none",
  invite: { name: "Jordan Lee", email: "jordan@team.com", role: "user" },
  focusMemberId: null,
};

/** A brand-new workspace: nobody has joined, so the page's own `isEmpty`
    check fires rather than the canvas faking it. */
const EMPTY: SettingsMembersData = { ...BASE, members: [] };

function strained(extreme: boolean): SettingsMembersData {
  const members: Member[] = extreme
    ? repeat((i) => ({
        id: i + 1,
        name: [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT][i % 3],
        initials: MANY_INITIALS[i % MANY_INITIALS.length],
        email: `${UNBREAKABLE}@${LONG_WORD}.example`,
        role: ["admin", "manager", "user"][i % 3],
        status: i % 2 === 0 ? "active" : "invited",
        joined: "2025-01-01",
      }), 5)
    : repeat((i) => ({
        id: i + 1,
        name: LONG_NAME,
        initials: MANY_INITIALS[i % MANY_INITIALS.length],
        email: `${LONG_WORD}.${i}@${LONG_SOURCE}`,
        role: ["admin", "manager", "user"][i % 3],
        status: i % 2 === 0 ? "active" : "invited",
        joined: "2025-01-01",
      }), 4);
  return {
    ...BASE,
    members,
    workspaceName: extreme ? UNBREAKABLE : LONG_NAME,
    githubTeam: { connected: true, team: extreme ? UNBREAKABLE : LONG_SOURCE },
  };
}

export const FIXTURES: PageFixtures<SettingsMembersData> = {
  default: { data: BASE },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "The member directory is temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  single: { data: { ...BASE, members: [ROSTER[0]] } },
  many: { data: { ...BASE, members: MANY } },
  "invite-open": { data: { ...BASE, interaction: "invite-open" } },
  pending: { data: { ...BASE, interaction: "pending" } },
  "invite-sent": { data: { ...BASE, interaction: "invite-sent" } },
  "remove-confirm": { data: { ...BASE, interaction: "remove-confirm", focusMemberId: 3 } },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
