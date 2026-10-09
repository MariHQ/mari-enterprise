import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Mail, ShieldCheck, ArrowLeft, KeyRound } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { Logo, Brandmark } from "../shell/Logo";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { Spinner } from "../data-display/Spinner";
import { Alert } from "../feedback/Alert";
import { SkeletonPage } from "../data-display/Skeletons";
import { GithubMark } from "../icons/marks";
import { FieldError } from "../feedback/ErrorMessage";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite, why } from "../actions/useWrite";
import { focusRing } from "../tokens/focusRing";
import { btnDisabled } from "../actions/buttons";

/* Login (pages/login.md). Unauthenticated route — renders OUTSIDE the console
   shell. A centered auth card on a full-bleed backdrop with decorative brand
   marks in the corners.

   Pure presenter: which step of the auth flow is on screen, what the workspace
   is branded as, and which identity providers it offers all arrive in `data`.
   The canvas supplies them from `.preview/fixtures/login.ts`; a real app
   supplies them from its router and its workspace config. */

const STATES = [
  { id: "sign-in", label: "Sign in" },
  { id: "register", label: "Register" },
  { id: "loading", label: "Signing in…" },
  { id: "error", label: "Bad credentials" },
  { id: "oauth-github", label: "OAuth · GitHub" },
  { id: "oauth-google", label: "OAuth · Google" },
  { id: "magic-link", label: "Magic link sent" },
  { id: "2fa", label: "Two-factor" },
  { id: "bypass", label: "Sign-in bypass on" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/** A third-party identity provider the workspace offers. */
export type LoginProvider = "github" | "google" | "sso";

/** Which step of the auth flow is on screen. An app drives this from its own
    route/local state; it is never inferred from the shape of the data. */
export type LoginScreen = "credentials" | "oauth" | "magic-link" | "two-factor";

/** Everything the Login screen renders. */
/** Credentials a sign-in or registration submits. */
export type Credentials = { name: string; email: string; password: string; workspace: string };

/** What the login screen can do. Every handler may throw; the form shows it. */
export type LoginActions = {
  signIn?: (c: Credentials) => void | Promise<void>;
  register?: (c: Credentials) => void | Promise<void>;
  magicLink?: (email: string) => void | Promise<void>;
  oauth?: (provider: "github" | "google" | "sso") => void | Promise<void>;
  /** Sign in as the workspace admin with no credentials, when the server has
      the bypass enabled. */
  bypass?: () => void | Promise<void>;
  /** Submit the six-digit code from the authenticator app. `trustDevice` is
      the user's answer to "don't ask again on this browser"; a handler that
      does not offer that simply ignores it. */
  verifyCode?: (code: string, trustDevice: boolean) => void | Promise<void>;
  /** Send a fresh two-factor code. The 2FA screen had no resend at all while
      the magic-link screen had one, so a code that never arrived was a dead
      end (P-LG-5). */
  resendCode?: () => void | Promise<void>;
  /** Fall back to a recovery code when the device is gone. */
  useRecoveryCode?: () => void;
  /** Email a password-reset link. RECOVERY, which is a different job from the
      magic link: the magic link signs you in and leaves the forgotten password
      forgotten, so offering it as the only way back in meant the product had
      no password reset at all (P-LG-1). */
  resetPassword?: (email: string) => void | Promise<void>;
  /** Leave a post-submit screen and go back to the credentials form. Which
      screen is showing comes from `data`, so the page cannot undo it itself —
      without this, "Check your inbox" was a one-way door. */
  backToSignIn?: () => void;
};

export type LoginData = {
  screen: LoginScreen;
  /** The heading over the card. A workspace may brand it, so it is a value and
      not a label — but it is NOT the place for the product name: <Logo> prints
      the wordmark directly above it, and "Mari" here rendered "Mari" twice, as
      wordmark and as H1 within 60px. A blank value, or one that is only the
      wordmark, falls back to the screen's own heading (see `headingFor`). */
  title: string;
  sub: string;
  /** `credentials`: create an account rather than sign in. */
  register: boolean;
  /** Prefilled credential values. Empty string leaves a field blank. */
  name: string;
  email: string;
  password: string;
  /** Workspace named by the invite/SSO link. `null` hides the workspace field
      and the workspace goes unnamed on the submit button. */
  workspace: string | null;
  /** Providers this workspace offers. Empty renders the form on its own. */
  providers: LoginProvider[];
  /** Offer to switch between signing in and creating an account. */
  allowRegister: boolean;
  /** The server has the sign-in bypass turned on (MARI_AUTH_BYPASS). Offer the
      one-click way in. This is DATA, not a build flag: the escape hatch is a
      server setting, so only a server that actually honours it can show the
      button. A demo instance advertises it; a real one never renders it. */
  allowBypass: boolean;
  /** `oauth`: the provider we handed off to. */
  handoff: "github" | "google" | null;
  /** `magic-link`: where the link went, and the resend countdown. */
  magicLinkTo: string;
  resendIn: string;
  /** `two-factor`: one entry per code box, "" for an empty box. */
  codeDigits: string[];
};

function GoogleMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
}

/* ── Shared unauthenticated framing ────────────────────────────────────────
   Login, Setup and Welcome are single-task screens with no sidebar, so they
   deliberately sit OFF the 1400px console grid (§11). What they do share is
   each other: one backdrop, one 672px column, one centered logo/title/sub
   header, one card, and a primary-bottom-left action row. Keep these three
   constants identical across the three files. */
const AUTH_SHELL = "relative h-full w-full overflow-x-hidden overflow-y-auto bg-paper";
const AUTH_COL = "relative mx-auto flex min-h-full max-w-2xl flex-col justify-center";
const AUTH_ACTIONS = "flex flex-wrap items-center gap-2";

function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="pointer-events-none absolute -left-6 -top-8 rotate-[-12deg] text-biscay/[0.08]"><Brandmark size={140} /></span>
      <span className="pointer-events-none absolute -bottom-10 -right-6 rotate-[8deg] text-moss/[0.08]"><Brandmark size={160} /></span>
    </div>
  );
}

/** The wordmark <Logo> prints. A `title` equal to it is not a heading. */
const WORDMARK = "Mari";

/** What the H1 says: the workspace's own heading where it has one, and
    otherwise the screen's — the same way Welcome ("Welcome to Mari") and Setup
    carry a heading distinct from the mark above them. */
function headingFor(data: LoginData): string {
  const given = data.title.trim();
  if (given && given !== WORDMARK) return given;
  return data.register ? "Create your account" : `Sign in to ${WORDMARK}`;
}

function AuthHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <span className="text-biscay"><Logo size={34} /></span>
      <h1 className="mt-4 font-display text-[26px] font-bold tracking-[-0.01em] text-ink [overflow-wrap:anywhere]">{title}</h1>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink/70 [overflow-wrap:anywhere]">{sub}</p>
    </div>
  );
}

const DIVIDER =
  "flex items-center gap-3 text-center font-term text-[11px] uppercase tracking-[0.08em] text-ink/65 before:h-px before:flex-1 before:bg-ink/12 after:h-px after:flex-1 after:bg-ink/12";

/* Third-party sign-in. SSO sits here rather than on the credential form: it is
   an alternative identity provider, not a second password field, and giving it
   its own full-width row keeps the enterprise path obvious without crowding
   the two consumer providers. Rendered only for the providers the workspace
   actually offers, so a credentials-only workspace shows no dead buttons. */
function OAuthRow({ providers, actions }: { providers: LoginProvider[]; actions?: LoginActions }) {
  if (!providers.length) return null;
  const base = `inline-flex items-center justify-center gap-2 h-9 rounded-[4px] border border-ink/20 bg-paper text-[13px] font-medium text-ink/80 hover:border-ink/45 disabled:pointer-events-none ${btnDisabled} ${focusRing}`;
  const social = providers.filter((p) => p !== "sso");
  return (
    <>
      <div className={`my-3.5 ${DIVIDER}`}>or continue with</div>
      {social.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {social.includes("github") && (
            <button type="button" className={base} onClick={() => actions?.oauth?.("github")}><GithubMark size={16} /> GitHub</button>
          )}
          {social.includes("google") && (
            <button type="button" className={base} onClick={() => actions?.oauth?.("google")}><GoogleMark /> Google</button>
          )}
        </div>
      )}
      {providers.includes("sso") && (
        <>
          <button type="button" className={`mt-2 w-full ${base}`} onClick={() => actions?.oauth?.("sso")}>
            <KeyRound size={16} /> Single sign-on (SAML)
          </button>
          <p className="mt-1.5 text-center text-[11.5px] text-ink/65">
            Workspace admins can require SSO for everyone on your domain.
          </p>
        </>
      )}
    </>
  );
}

/* Switching between sign-in and register is a VIEW change, not a server call,
   so the page owns it. It used to be a <span>: unfocusable, unclickable, and
   invisible to a screen reader, so "Create an account" was decoration and the
   register screen could only be reached from the canvas. */
/* The bypass sign-in.

   A real <button> — not a link, not a span dressed as one. It performs an
   action (it creates a session) rather than going to an address, so button is
   both the correct element and the one that gets Enter, Space, focus and a
   name for free.

   It is rendered only when `data.allowBypass` says the SERVER has the escape
   hatch on, so a workspace that would reject the call never advertises it. The
   label says plainly what it does; an unexplained way past the password field
   is the kind of thing someone should recognise on sight. */
/* The six code boxes and their submit.

   The boxes were uncontrolled and the button had no handler, so the screen
   could be looked at and not used. They are one controlled value now: typing
   advances, Backspace on an empty box steps back, and pasting a six-digit code
   into any box fills all six — which is what people actually do with a code
   they just copied out of an app. */
function TwoFactorForm({ digits, error, actions }: {
  digits: string[];
  error: string | null;
  actions?: LoginActions;
}) {
  const len = Math.max(6, digits.length);
  const [code, setCode] = useState<string[]>(
    () => Array.from({ length: len }, (_, i) => digits[i] ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [trust, setTrust] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const value = code.join("");
  /* `ready` gates the BUTTON, so it has to include "there is something to
     submit to". `submit` used to return early when `verifyCode` was absent
     while the button stayed enabled, which is the worst of both: a live-looking
     primary action that silently does nothing (§2, P-LG-4). */
  const ready = value.length === len && !code.includes("") && Boolean(actions?.verifyCode);

  const put = (i: number, raw: string) => {
    const chars = raw.replace(/\D/g, "");
    if (!chars) { setCode((c) => c.map((x, j) => (j === i ? "" : x))); return; }
    setCode((c) => {
      const next = [...c];
      // One character types; a pasted run fills forward from here.
      for (let k = 0; k < chars.length && i + k < len; k += 1) next[i + k] = chars[k];
      return next;
    });
    boxes.current[Math.min(i + chars.length, len - 1)]?.focus();
  };

  const submit = async () => {
    if (!ready || !actions?.verifyCode) return;
    setBusy(true);
    setFailed(null);
    try {
      await actions.verifyCode(value, trust);
    } catch (e) {
      setFailed(why(e, "That code was not accepted."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="my-3 flex gap-2" aria-label="Verification code">
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => { boxes.current[i] = el; }}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : undefined}
            maxLength={len}
            value={d}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
              if (e.key === "Enter") void submit();
            }}
            className={`h-11 w-9 rounded-[4px] border border-ink/20 bg-paper text-center font-term text-[16px] text-ink outline-none focus:border-biscay-2 ${focusRing}`}
          />
        ))}
      </div>
      {/* "Don't ask again here" is the thing every user of an authenticator
          app wants and this screen did not offer, so every sign-in on a known
          browser cost a phone. It is a plain checkbox rather than a default,
          because extending a session is the user's decision to make. */}
      <label className="mt-1 flex items-center gap-2 text-[12.5px] text-ink/70">
        <input type="checkbox" className="accent-biscay" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
        Trust this browser and skip codes here
      </label>
      {/* XA-01/XA-02: one FieldError carried two different events. A refused
          code or a failed resend is a write, and neither is a complaint about
          one box; what the host handed the page is the read surface. */}
      <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
      {!failed && error && <ReadError>{error}</ReadError>}
      {resent && <div className="mt-3"><Alert tone="ok" title="New code sent">Enter the most recent code. Earlier codes no longer work.</Alert></div>}
      <div className={`mt-4 ${AUTH_ACTIONS}`}>
        <Button variant="primary" disabled={!ready || busy} onClick={() => void submit()}>
          {busy ? "Verifying…" : "Verify & continue"}
        </Button>
        {/* Resend existed on the magic-link screen and nowhere here, so a code
            that never arrived left the only way forward being to start over. */}
        {actions?.resendCode && (
          <Button
            variant="default"
            disabled={resending}
            onClick={() => {
              const send = actions.resendCode;
              if (!send) return;
              setResending(true);
              setFailed(null);
              void (async () => {
                try { await send(); setResent(true); }
                catch (e) { setFailed(why(e, "That code could not be sent.")); }
                finally { setResending(false); }
              })();
            }}
          >
            {resending ? "Sending…" : "Send a new code"}
          </Button>
        )}
        {actions?.useRecoveryCode && (
          <span className="text-[12.5px] text-ink/65">
            Lost your device?{" "}
            <button
              type="button"
              onClick={actions.useRecoveryCode}
              className={`font-medium text-biscay-2 hover:underline rounded-[3px] ${focusRing}`}
            >
              Use a recovery code
            </button>
          </span>
        )}
      </div>
    </>
  );
}

function BypassRow({ actions }: { actions?: LoginActions }) {
  // XA-04: hand-rolled busy/failed pair around one optional handler.
  const write = useWrite();
  return (
    <>
      <div className={`my-3.5 ${DIVIDER}`}>or</div>
      <Button
        variant="default"
        className="w-full justify-center"
        disabled={write.busy}
        onClick={() => { if (actions?.bypass) void write.run(() => actions.bypass!()); }}
      >
        <KeyRound size={15} /> {write.busy ? "Signing in…" : "Continue as workspace admin"}
      </Button>
      <p className="mt-1.5 text-center text-[12px] text-ink/65">
        Sign-in bypass is enabled on this server: anyone who can reach it has admin.
      </p>
      {/* XA-02: a refused sign-in sits beside a button, not under an input. */}
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
    </>
  );
}

function ModeToggle({ register, onToggle }: { register: boolean; onToggle: () => void }) {
  return (
    <p className="mt-4 text-center text-[12.5px] text-ink/70">
      {register ? "Already have an account? " : "New here? "}
      <button
        type="button"
        onClick={onToggle}
        className={`font-medium text-biscay-2 hover:text-ink rounded-[3px] ${focusRing}`}
      >
        {register ? "Sign in" : "Create an account"}
      </button>
    </p>
  );
}

/* One shape check for both "email me a link" affordances. Deliberately loose:
   an address is only ever really validated by mail arriving at it, and a
   stricter pattern rejects addresses that work. This catches the typo, which
   is the failure the user can still fix on this screen. */
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** The one password rule in the product. Preferences already enforced 8
    characters and a confirmation while Login's register mode and Setup's admin
    step enforced neither, so the same account had two different rules
    depending on which screen created or changed it (P-LG-6, P-ST-1). */
export const PASSWORD_MIN = 8;
export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters.`;

const LINK_BTN = `text-[12.5px] font-medium text-biscay-2 hover:text-ink rounded-[3px] ${btnDisabled} ${focusRing}`;

function CredForm({ data, error, actions }: { data: LoginData; error: string | null; actions?: LoginActions }) {
  const { register, workspace } = data;
  /* Controlled, because the values have to leave the form. They used to be
     `defaultValue` on an uncontrolled input inside a form whose only handler
     was `preventDefault()` — so the submit button genuinely did nothing, and
     did it silently, with no console error to find. */
  const [name, setName] = useState(data.name);
  const [email, setEmail] = useState(data.email);
  const [password, setPassword] = useState(data.password);
  const [confirm, setConfirm] = useState("");
  const [ws, setWs] = useState(workspace ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* Which link is in flight, whether the address is unusable, and what was
     sent. "Email me a magic link instead" used to call the handler with
     whatever was in the box and then render nothing whatsoever: no address
     check, no busy state, no confirmation. You could not tell a sent link from
     a dead button (P-LG-3). */
  const [sending, setSending] = useState<"magic" | "reset" | null>(null);
  const [badEmail, setBadEmail] = useState(false);
  const [sent, setSent] = useState<"magic" | "reset" | null>(null);

  const run = register ? actions?.register : actions?.signIn;
  const tooShort = register && password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = register && confirm.length > 0 && password !== confirm;
  const credsOk = !register || (password.length >= PASSWORD_MIN && password === confirm);

  const sendLink = async (kind: "magic" | "reset", send: (email: string) => void | Promise<void>) => {
    setFailed(null);
    setSent(null);
    if (!looksLikeEmail(email)) { setBadEmail(true); return; }
    setBadEmail(false);
    setSending(kind);
    try {
      await send(email.trim());
      setSent(kind);
    } catch (err) {
      setFailed(why(err, "That email could not be sent."));
    } finally {
      setSending(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!run || !credsOk) return; // canvas: no server behind the page
    setBusy(true);
    setFailed(null);
    try {
      await run({ name, email, password, workspace: ws });
    } catch (err) {
      setFailed(why(err, "Sign in failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      {register && (
        <Field label="Name">
          <Input className="w-full" autoComplete="name" placeholder="Maya Chen" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <Field label={register ? "Email" : "Email or username"}>
        <Input className="w-full" type={register ? "email" : "text"} autoComplete={register ? "email" : "username"}
          placeholder={register ? "you@team.com" : "you@team.com or demo"} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <Input className="w-full" type="password" autoComplete={register ? "new-password" : "current-password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        {/* The rule is stated BEFORE it is broken, not as a rejection after
            submit. Same wording and same minimum as the Preferences password
            card, which is the point. */}
        {register && (
          <p className={`mt-1 text-[12px] ${tooShort ? "text-espelette" : "text-ink/70"}`}>
            {tooShort ? `Use at least ${PASSWORD_MIN} characters.` : PASSWORD_HINT}
          </p>
        )}
      </Field>
      {register && (
        <Field label="Confirm password">
          <Input className="w-full" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {mismatch && <p className="mt-1 text-[12px] text-espelette">The two passwords do not match.</p>}
        </Field>
      )}
      {workspace !== null && (
        <Field label="Workspace">
          <Input className="w-full" value={ws} onChange={(e) => setWs(e.target.value)} />
        </Field>
      )}
      {badEmail && <FieldError id="field.invalidEmail" />}
      {/* XA-01/XA-02: `badEmail` above genuinely accuses the Email box and
          stays a FieldError. This one is a refused sign-in, register or link
          send, which no single box can fix, plus whatever the host handed the
          page. Two events, two surfaces. */}
      <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
      {!failed && error && <ReadError>{error}</ReadError>}
      {sent === "magic" && (
        <Alert tone="ok" title="Sign-in link sent">
          We emailed a one-time sign-in link to {email.trim()}. Open it in this browser to finish signing in.
        </Alert>
      )}
      {sent === "reset" && (
        <Alert tone="ok" title="Reset link sent">
          We emailed a link for setting a new password to {email.trim()}. Check your inbox, and your spam folder.
        </Alert>
      )}
      {/* Primary bottom left, secondary to its right (§2). Each secondary is
          drawn only when the workspace has a handler for it, so nothing here
          is a button that cannot act. */}
      <div className={`mt-1 ${AUTH_ACTIONS}`}>
        <Button type="submit" variant="primary" disabled={busy || !run || !credsOk}>
          {busy
            ? register ? "Creating account…" : "Signing in…"
            : register ? "Create account"
            : workspace !== null ? `Sign in to ${workspace}` : "Sign in"}
        </Button>
        {!register && actions?.magicLink && (
          <button
            type="button"
            disabled={sending !== null}
            onClick={() => void sendLink("magic", actions.magicLink!)}
            className={LINK_BTN}
          >
            {sending === "magic" ? "Sending…" : "Email me a magic link instead"}
          </button>
        )}
        {/* Recovery, not a second way in. A magic link signs you in and leaves
            you with the same forgotten password next time. */}
        {!register && actions?.resetPassword && (
          <button
            type="button"
            disabled={sending !== null}
            onClick={() => void sendLink("reset", actions.resetPassword!)}
            className={LINK_BTN}
          >
            {sending === "reset" ? "Sending…" : "Forgot password?"}
          </button>
        )}
      </div>
    </form>
  );
}

/* The centered "hand-off" card used by the OAuth / magic-link framings. */
function NoticeCard({ icon, title, children, footer }: {
  icon: ReactNode; title: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <Card variant="plain">
      <div className="flex flex-col gap-3 py-2">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/70">{icon}</span>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold text-ink">{title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/70">{children}</p>
          </div>
        </div>
        {footer}
      </div>
    </Card>
  );
}

function Body({ data, error, actions }: { data: LoginData; error: string | null; actions?: LoginActions }) {
  /* Sign-in vs register is a view change, not a server call, so the page owns
     it: seeded from `data` so the canvas can pin either screen, then local so
     the toggle actually switches. */
  const [register, setRegister] = useState(data.register);
  switch (data.screen) {
    case "oauth": {
      const google = data.handoff === "google";
      return (
        <NoticeCard
          icon={google ? <GoogleMark size={22} /> : <GithubMark size={22} />}
          title={google ? "Redirecting to Google…" : "Redirecting to GitHub…"}
          footer={<span className="inline-flex items-center gap-2 text-[12.5px] text-ink/65"><Spinner size="sm" /> Waiting for authorization</span>}>
          {google
            ? "You’re being sent to Google to choose an account. This window will return here once you approve access."
            : "You’re being sent to GitHub to authorize Mari. This window will return here once you approve access."}
        </NoticeCard>
      );
    }
    case "magic-link":
      return (
        <NoticeCard icon={<Mail size={22} className="text-biscay-2" />} title="Check your inbox"
          footer={
            <div className={AUTH_ACTIONS}>
              <Button variant="primary" onClick={actions?.backToSignIn}><ArrowLeft size={14} /> Back to sign in</Button>
              <span className="text-[12px] text-ink/65">Didn’t get it? Resend in {data.resendIn}</span>
            </div>
          }>
          We emailed a one-time sign-in link to <b className="text-ink/80">{data.magicLinkTo}</b>.
          It expires in 10 minutes.
        </NoticeCard>
      );
    case "two-factor":
      return (
        <Card variant="plain">
          <div className="flex items-start gap-3 pb-3 pt-1">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink/15 text-biscay-2"><ShieldCheck size={22} /></span>
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-ink">Two-factor authentication</div>
              <p className="mt-1 text-[13px] text-ink/70">Enter the 6-digit code from your authenticator app.</p>
            </div>
          </div>
          <TwoFactorForm digits={data.codeDigits} error={error} actions={actions} />
        </Card>
      );
    default:
      return (
        <Card variant="plain">
          <CredForm data={{ ...data, register }} error={error} actions={actions} />
          <OAuthRow providers={data.providers} actions={actions} />
          {data.allowBypass && <BypassRow actions={actions} />}
          {data.allowRegister && <ModeToggle register={register} onToggle={() => setRegister((r) => !r)} />}
        </Card>
      );
  }
}

function LoginPage({ data, loading = false, error = null, actions, mobile = false }: PageProps<LoginData, LoginActions>) {
  if (loading) {
    return (
      <main id="main-content" aria-label="Main content" className={AUTH_SHELL}>
        <SkeletonPage
          variant="auth"
          /* The sign-in headline is `data.title`: a workspace can brand it,
             so it is a value and not a label. */
          label="sign in"
          mobile={mobile}
        />
      </main>
    );
  }
  return (
    <main id="main-content" aria-label="Main content" className={AUTH_SHELL}>
      <AuthBackdrop />
      <div className={`${AUTH_COL} ${mobile ? "px-4 py-10" : "px-6 py-16"}`}>
        <AuthHeader title={headingFor(data)} sub={data.sub} />
        <Body data={data} error={error} actions={actions} />
      </div>
    </main>
  );
}

export const page: PageModule<LoginData, LoginActions> = {
  id: "login",
  title: "Login",
  route: "/login",
  component: LoginPage,
  states: STATES.map((s) => ({ ...s })),
};
