"use client";

// Set a new password, reached from the "forgot your password" email link.

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function NewPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    setBusy(true); setError(null);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else location.href = "/";
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="wordmark">Tack</div>
        <label className="field">
          <span className="label">New password</span>
          <input className="input" type="password" autoFocus required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>At least 8 characters.</span>
        </label>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy || password.length < 8}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </main>
  );
}
