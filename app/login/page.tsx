"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (r.ok) {
      // only follow same-site paths
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    const d = await r.json().catch(() => ({}));
    setError(d.error || "Couldn’t sign in.");
    setBusy(false);
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="wordmark" aria-label="Tack">Tack</div>
        <label className="field">
          <span className="label">Password</span>
          <input className="input" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy || !password}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
