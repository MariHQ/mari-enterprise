/* Preferences canvas fixtures.

   The page is a pure presenter, so every value on the canvas is authored here.
   The states that matter are the ones where the page has to render something
   OTHER than three tidy cards: an OAuth account, where there is no password to
   change, and the overflow/stress pair that a person with a very long name and
   an unfamiliar time zone actually produces. */

import type { PreferencesData } from "../../pages/PreferencesPage";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import { LONG_NAME, LONG_WORD, MIXED_SCRIPT, UNBREAKABLE } from "./stress";

const SUMMARY: PropertyItem[] = [
  { label: "Role", value: "Admin" },
  { label: "Member since", value: "Nov 3, 2024" },
  { label: "Last sign-in", value: "Today, 09:14" },
  { label: "Sessions", value: "2 active" },
];

const BASE: PreferencesData = {
  profile: {
    name: "Dana Reyes",
    email: "dana@acme-data.com",
    initials: "DR",
    timezone: "America/Los_Angeles",
    /* Present = the server stores a UI language for this account, so the
       control is drawn. Omitted, the page draws no language select at all —
       which is what `oauth` below leaves it as. */
    language: "en",
  },
  provider: "password",
  notifications: { mentions: true, digest: true, flowFailures: true },
  summary: SUMMARY,
};

export const FIXTURES: PageFixtures<PreferencesData> = {
  default: { data: BASE },

  loading: { data: BASE, loading: true },

  error: { data: BASE, error: "Could not reach the API. Retrying in 5s." },

  // "Dirty" is a state of the page's own edit buffer, which the canvas cannot
  // set from outside — so this renders the same form and the QA note is that
  // typing in it is what produces the Save/Discard pair.
  editing: { data: BASE },

  saved: { data: BASE },

  // The case the page exists to get right: no password form, because the
  // credential is GitHub's.
  oauth: {
    data: {
      ...BASE,
      /* No stored language either: the account signs in elsewhere and the
         server keeps nothing for it, so neither the password form nor the
         language select is drawn. */
      profile: {
        name: BASE.profile.name, email: "dana@users.noreply.github.com",
        initials: BASE.profile.initials, timezone: BASE.profile.timezone,
      },
      provider: "github",
    },
  },

  "notifications-off": {
    data: { ...BASE, notifications: { mentions: false, digest: false, flowFailures: false } },
  },

  overflow: {
    data: {
      ...BASE,
      profile: {
        name: LONG_NAME,
        email: "alexandra.wilhelmina.featherstonehaugh-montgomery@a-very-long-corporate-domain.example.com",
        initials: "AW",
        timezone: "America/Argentina/ComodRivadavia",
      },
      summary: [
        { label: "Role", value: "Workspace administrator and billing contact" },
        { label: "Member since", value: "Nov 3, 2024" },
        { label: "Last sign-in", value: "Today, 09:14 from a device with a very long user agent string" },
        { label: "Sessions", value: "2 active" },
      ],
    },
  },

  stress: {
    data: {
      ...BASE,
      profile: {
        name: MIXED_SCRIPT,
        email: UNBREAKABLE,
        initials: "部",
        timezone: LONG_WORD,
        /* A language tag this build has no label for: the select has to show
           the stored value rather than snapping to English and rewriting the
           setting on the next save. */
        language: LONG_WORD,
      },
      provider: "google",
      notifications: { mentions: true, digest: false, flowFailures: true },
      summary: [
        { label: LONG_WORD, value: MIXED_SCRIPT },
        { label: "Sessions", value: UNBREAKABLE },
      ],
    },
  },
};
