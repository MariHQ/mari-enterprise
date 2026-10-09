import { useState } from "react";
import type { FormEvent } from "react";
import { LogOut } from "lucide-react";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Input } from "../forms/Input";
import { Avatar } from "../data-display/Avatar";
import { Chip } from "../data-display/Chip";
import { Skeleton, SkeletonLine, SkeletonCircle } from "../data-display/Skeleton";
import { Logo } from "../shell/Logo";
import { GithubMark } from "../icons/marks";
import { focusRing } from "../tokens/focusRing";
import { useResync } from "../actions/useResync";

/* Auth session (AuthProvider / useAuth) ───────────────────────────────────
   The cookie-session identity feature, rendered here as a SELF-CONTAINED
   login/session card (no real auth, no network). Sign in / register, an
   optional dev "Bypass" escape hatch, and OAuth buttons; on submit it flips
   to the signed-in session view with the resolved user + logout.
   Source: web/src/lib/auth.tsx + web/src/pages/Login.tsx. */

export type AuthUser = { name: string; email: string; role: string; initials: string; provider: string };

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

const DIVIDER = "flex items-center gap-3 text-center font-term text-[11px] uppercase tracking-[0.08em] text-ink/65 before:h-px before:flex-1 before:bg-ink/12 after:h-px after:flex-1 after:bg-ink/12";

export type AuthSessionProps = {
  /** Start in the signed-in session view. */
  initialUser?: AuthUser | null;
  /** The identity a successful sign-in resolves to. A real app passes the
      authenticated user; this component does not invent one, so it can never
      show a fabricated name to somebody who actually signed in. */
  signedInAs: AuthUser;
  bypassEnabled?: boolean;
  oauth?: { github: boolean; google: boolean };
  loading?: boolean;
  className?: string;
};

export function AuthSession({ initialUser = null, signedInAs, bypassEnabled = true, oauth = { github: true, google: false }, loading = false, className = "" }: AuthSessionProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  /* The session was read once, at mount. A session that resolves after the
     first paint — which is the normal case, since the identity call is
     asynchronous — therefore never signed the reader in, and the panel kept
     offering a sign-in form to somebody already signed in (C1). The sign-in
     form's own fields are separate state, so adopting `user` cannot clobber a
     half-typed credential and nothing is held. */
  useResync(initialUser, setUser);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = (provider: string, override?: Partial<AuthUser>) => {
    setBusy(true);
    setTimeout(() => {
      setUser({ ...signedInAs, provider, ...(email ? { email } : {}), ...(name ? { name, initials: name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() } : {}), ...override });
      setBusy(false);
    }, 500);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!email.trim() || !password.trim() || (mode === "register" && !name.trim())) { setError("Please fill in every field."); return; }
    signIn("password");
  };

  if (loading) {
    return (
      <div className={`mx-auto max-w-[380px] ${className}`.trim()} aria-hidden="true">
        <Card>
          <div className="flex flex-col items-center gap-2 pt-2 pb-4">
            <SkeletonCircle size={40} />
            <SkeletonLine w={120} h={16} />
            <SkeletonLine w={180} h={10} />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <SkeletonLine w={72} h={10} />
                <Skeleton height={38} />
              </div>
            ))}
            <Skeleton height={38} className="mt-1" />
          </div>
          <div className="my-3.5"><SkeletonLine w="100%" h={9} /></div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton height={36} /><Skeleton height={36} />
          </div>
        </Card>
      </div>
    );
  }

  if (user) {
    return (
      <div className={`mx-auto max-w-[380px] ${className}`.trim()}>
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="scale-125"><Avatar initials={user.initials} /></span>
              <div className="min-w-0 w-full">
                <div className="break-words text-[15px] font-semibold text-ink">{user.name}</div>
                <div className="break-all text-[13px] text-ink/70">{user.email}</div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Chip label={user.role} tone="info" caps />
                <Chip label={`via ${user.provider}`} tone="neutral" />
              </div>
            </div>
            {/* Action bottom LEFT (CONVENTIONS.md §2). */}
            <div className="flex border-t border-ink/10 pt-3">
              <Button variant="danger" onClick={() => { setUser(null); setPassword(""); }}><LogOut size={14} /> Sign out</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-[380px] ${className}`.trim()}>
      <Card>
        <div className="flex flex-col items-center gap-1.5 pt-2 pb-4 text-center">
          <Logo size={40} wordmark="" />
          <h1 className="text-[19px] font-bold text-ink font-display">Mari</h1>
          <p className="text-[13px] text-ink/70">Your product knowledge, curated.</p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={submit}>
          {mode === "register" && (
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink/70">Name</span><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Maya Chen" className="w-full" /></label>
          )}
          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink/70">Email</span><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@team.com" className="w-full" /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ink/70">Password</span><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full" /></label>
          {error && <p role="alert" className="text-[12.5px] text-espelette">{error}</p>}
          <Button type="submit" variant="primary" block disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
        </form>

        {bypassEnabled && (
          <>
            <div className={`my-3.5 ${DIVIDER}`}>or use the escape hatch</div>
            <Button block disabled={busy} onClick={() => signIn("bypass", { name: "Dev User", email: "dev@localhost", initials: "DU" })}>Bypass</Button>
          </>
        )}

        <div className={`my-3.5 ${DIVIDER}`}>or continue with</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!oauth.github || busy} onClick={() => oauth.github && signIn("github")} title={oauth.github ? undefined : "GitHub OAuth not configured"}
            className={`inline-flex items-center justify-center gap-2 h-9 rounded-[4px] border border-ink/20 bg-paper text-[13px] font-medium text-ink/80 hover:border-ink/45 disabled:opacity-100 disabled:bg-flysch disabled:text-ink/65 disabled:border-ink/15 disabled:pointer-events-none ${focusRing}`}><GithubMark size={16} /> GitHub</button>
          <button type="button" disabled={!oauth.google || busy} onClick={() => oauth.google && signIn("google")} title={oauth.google ? undefined : "Google OAuth not configured"}
            className={`inline-flex items-center justify-center gap-2 h-9 rounded-[4px] border border-ink/20 bg-paper text-[13px] font-medium text-ink/80 hover:border-ink/45 disabled:opacity-100 disabled:bg-flysch disabled:text-ink/65 disabled:border-ink/15 disabled:pointer-events-none ${focusRing}`}><GoogleMark /> Google</button>
        </div>

        <p className="mt-4 text-center text-[12.5px] text-ink/70">
          {mode === "signin"
            ? <>New here? <button type="button" onClick={() => { setMode("register"); setError(null); }} className={`font-medium text-biscay-2 hover:text-ink rounded-[3px] ${focusRing}`}>Create an account</button></>
            : <>Already have an account? <button type="button" onClick={() => { setMode("signin"); setError(null); }} className={`font-medium text-biscay-2 hover:text-ink rounded-[3px] ${focusRing}`}>Sign in</button></>}
        </p>
      </Card>
    </div>
  );
}
