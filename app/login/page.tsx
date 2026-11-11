"use client";

// Sign in: Google, a magic link by email, or email and password. Creating an account works the same way.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hasAccounts, supabase, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/client";

type Mode = "password" | "magic" | "signup" | "reset";

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

function Login() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => { const e = params.get("error"); return e ? friendly(e) : null; });
  const [sent, setSent] = useState<string | null>(null); // "check your email" message
  const [googleOn, setGoogleOn] = useState(false); // only offer Google once it's switched on in the Supabase project

  const pick = (m: Mode) => { setMode(m); setError(null); setSent(null); };
  useEffect(() => {
    if (!hasAccounts) return;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
      .then((r) => r.json()).then((s) => setGoogleOn(Boolean(s?.external?.google))).catch(() => {});
  }, []);

  if (!hasAccounts) {
    return (
      <main className="login">
        <div className="login-card">
          <div className="wordmark">Tack</div>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>Accounts aren't set up on this copy of Tack, so there's nothing to sign in to. Boards are saved in this browser.</p>
          <a className="btn primary" href="/">Open Tack</a>
        </div>
      </main>
    );
  }

  const callback = (to = safeNext) => `${location.origin}/auth/callback?next=${encodeURIComponent(to)}`;

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, then?: () => void) => {
    setBusy(true); setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(friendly(error.message));
    else then?.();
  };

  const google = () => run(() => supabase()!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supabase()!;
    const em = email.trim();
    if (mode === "password") return run(() => sb.auth.signInWithPassword({ email: em, password }), () => { location.href = safeNext; });
    if (mode === "signup") return run(() => sb.auth.signUp({ email: em, password, options: { emailRedirectTo: callback() } }), () => setSent(`We sent a confirmation link to ${em}. Open it to finish creating your account.`));
    if (mode === "magic") return run(() => sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: callback() } }), () => setSent(`We sent a sign-in link to ${em}. Open it on this device to continue.`));
    return run(() => sb.auth.resetPasswordForEmail(em, { redirectTo: callback("/account/password") }), () => setSent(`If ${em} has an account, a link to set a new password is on its way.`));
  };

  const needsPassword = mode === "password" || mode === "signup";

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="wordmark">Tack</div>

        <nav className="pipe-nav sm login-modes" aria-label="Sign-in method">
          <button type="button" className={mode === "password" ? "on" : ""} onClick={() => pick("password")}>Sign in</button>
          <button type="button" className={mode === "magic" ? "on" : ""} onClick={() => pick("magic")}>Email link</button>
          <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => pick("signup")}>Sign up</button>
        </nav>

        {googleOn && (
          <>
            <button type="button" className="btn login-google" onClick={google} disabled={busy}>
              <GoogleMark /> Continue with Google
            </button>
            <div className="login-or"><span>or</span></div>
          </>
        )}

        {sent ? (
          <p className="login-sent">{sent}</p>
        ) : (
          <>
            <label className="field">
              <span className="label">Email</span>
              <input className="input" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {needsPassword && (
              <label className="field">
                <span className="label">Password</span>
                <input className="input" type="password" required minLength={mode === "signup" ? 8 : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                {mode === "signup" && <span className="muted" style={{ fontSize: 12 }}>At least 8 characters.</span>}
              </label>
            )}
            {error && <div className="error-banner" role="alert">{error}</div>}
            <button className="btn primary" type="submit" disabled={busy || !email || (needsPassword && !password)}>
              {busy ? "One moment…" : mode === "password" ? "Sign in" : mode === "signup" ? "Create account" : mode === "magic" ? "Send sign-in link" : "Send reset link"}
            </button>
            {mode === "password" && (
              <button type="button" className="crumb-link login-forgot" onClick={() => pick("reset")}>Forgot your password?</button>
            )}
            {mode === "reset" && <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Enter the email you signed up with and we'll send a link to set a new password.</p>}
          </>
        )}
        <p className="muted login-skip">
          No account yet? <a href={safeNext}>Keep going without one</a>. Boards stay in this browser until you sign in.
        </p>
      </form>
    </main>
  );
}

const friendly = (m: string) => {
  const l = m.toLowerCase();
  if (l.includes("invalid login credentials")) return "That email and password don't match.";
  if (l.includes("email not confirmed")) return "Confirm your email first: open the link we sent you, then sign in.";
  if (l.includes("rate limit")) return "Too many tries. Wait a minute and try again.";
  if (l.includes("already registered")) return "There's already an account for that email. Sign in instead.";
  if (l.includes("expired") || (l.includes("invalid") && l.includes("link"))) return "That link has expired or was already used. Request a new one.";
  if (l.includes("code verifier")) return "That link was opened in a different browser from the one that asked for it. Request a new link here and open it in this browser.";
  if (l.includes("provider is not enabled")) return "Google sign-in isn't available here yet. Use your email instead.";
  return m;
};

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6C6.5 42.6 14.6 48 24 48z" />
  </svg>
);
