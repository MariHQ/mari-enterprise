/* Login canvas fixtures. Lifted out of `pages/LoginPage.tsx`, which is now a
   pure presenter and ships no demo content. Nothing here is importable by a
   consuming app. */

import type { LoginData } from "../../pages/LoginPage";
import type { PageFixtures } from "./types";
import {
  LONG_TITLE, LONG_PARAGRAPH, LONG_NAME, UNBREAKABLE, LONG_WORD, MIXED_SCRIPT,
} from "./stress";

const LONG_EMAIL =
  "alexandra.wilhelmina.featherstonehaugh-montgomery@platform-reliability-and-incident-response.enterprise-workspace.example.com";

const SUB = "Your product knowledge, curated.";

/** Signing in to a workspace that offers both social providers and SAML. */
const SIGN_IN: LoginData = {
  screen: "credentials",
  title: "Sign in to Mari",
  sub: SUB,
  register: false,
  name: "Maya Chen",
  email: "maya@team.com",
  password: "••••••••••",
  workspace: null,
  providers: ["github", "google", "sso"],
  allowRegister: true,
  allowBypass: false,
  handoff: null,
  magicLinkTo: "maya@team.com",
  resendIn: "0:42",
  codeDigits: ["4", "1", "9", "", "", ""],
};

const REGISTER: LoginData = { ...SIGN_IN, register: true, title: "Create your account" };

const TWO_FACTOR: LoginData = {
  ...SIGN_IN,
  screen: "two-factor",
  title: "Verify it’s you",
  sub: "One more step to keep your workspace secure.",
};

/** Long natural text (overflow) and pathological tokens (stress) through the
    same fields a real sign-in fills: an invite link that named a workspace,
    a prefilled identity, and a server error. */
function strained(extreme: boolean): LoginData {
  return {
    screen: "credentials",
    title: extreme ? MIXED_SCRIPT : LONG_NAME,
    sub: extreme ? UNBREAKABLE : LONG_PARAGRAPH,
    register: true,
    name: extreme ? MIXED_SCRIPT : LONG_NAME,
    email: extreme ? `${UNBREAKABLE}@example.com` : LONG_EMAIL,
    password: extreme ? LONG_WORD : "••••••••••",
    workspace: extreme ? UNBREAKABLE : LONG_TITLE,
    // A workspace with no third-party identity providers configured: the
    // credential form stands alone, and self-serve signup is closed.
    providers: extreme ? [] : ["github", "google", "sso"],
    allowRegister: !extreme,
    // The bypass banner has to survive the widest label the page can carry.
    allowBypass: extreme,
    handoff: null,
    magicLinkTo: extreme ? `${UNBREAKABLE}@example.com` : LONG_EMAIL,
    resendIn: extreme ? UNBREAKABLE : "0:42",
    codeDigits: ["4", "1", "9", "", "", ""],
  };
}

export const FIXTURES: PageFixtures<LoginData> = {
  "sign-in": { data: SIGN_IN },
  register: { data: REGISTER },
  loading: { data: SIGN_IN, loading: true },
  error: { data: SIGN_IN, error: "Incorrect email or password" },
  "oauth-github": { data: { ...SIGN_IN, screen: "oauth", handoff: "github" } },
  "oauth-google": { data: { ...SIGN_IN, screen: "oauth", handoff: "google" } },
  "magic-link": { data: { ...SIGN_IN, screen: "magic-link" } },
  "2fa": { data: TWO_FACTOR },
  // A server running with MARI_AUTH_BYPASS on: the one-click admin sign-in is
  // offered, and says so.
  bypass: { data: { ...SIGN_IN, allowBypass: true } },
  overflow: { data: strained(false), error: LONG_PARAGRAPH },
  stress: { data: strained(true), error: `${MIXED_SCRIPT}, ${UNBREAKABLE}` },
};
