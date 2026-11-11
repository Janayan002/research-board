"use client";

// "Connect AI": each person adds their own Claude API key (and optionally a Brave Search key),
// so AI search and research cards are billed to them. Keys stay in this browser.

import { useEffect, useState } from "react";
import { IconClose, IconKey } from "./Icons";
import { MODEL_CHOICES, useAiKeys } from "@/lib/aiKeys";

type Check = { anthropic?: string; brave?: string };

export default function ConnectAI() {
  const s = useAiKeys();
  const [ak, setAk] = useState("");
  const [bk, setBk] = useState("");
  const [model, setModel] = useState(s.model);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);

  // fill the form with the saved keys each time it opens
  useEffect(() => {
    if (!s.dialogOpen) return;
    setAk(s.anthropicKey); setBk(s.braveKey); setModel(s.model); setCheck(null);
  }, [s.dialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!s.dialogOpen) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") s.closeDialog(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [s.dialogOpen, s]);

  if (!s.dialogOpen) return null;

  const connected = Boolean(s.anthropicKey);
  const a = ak.trim(), b = bk.trim();

  const saveAndCheck = async () => {
    if (!a && !b) return;
    setChecking(true);
    setCheck(null);
    try {
      const headers: Record<string, string> = {};
      if (a) { headers["x-anthropic-key"] = a; headers["x-ai-model"] = model; }
      if (b) headers["x-brave-key"] = b;
      const r: Check = await fetch("/api/keys/check", { method: "POST", headers }).then((r) => r.json());
      setCheck(r);
      if ((!a || r.anthropic === "ok") && (!b || r.brave === "ok")) s.save({ anthropicKey: a, braveKey: b, model });
    } catch {
      setCheck({ anthropic: "Couldn’t check the key. Try again." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) s.closeDialog(); }}>
      <div className="modal connect-ai" role="dialog" aria-label="Connect AI">
        <div className="modal-head">
          <div className="t"><IconKey size={19} /> Connect your AI</div>
          <button className="icon-btn" onClick={s.closeDialog} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <div className="modal-body">
          <p className="ca-lead">
            Tack’s AI search and research cards run on <b>your own Claude account</b>, so you only pay for what you use.
            Your keys are saved in this browser only.
          </p>

          <label className="ca-label" htmlFor="ca-ak">Claude API key</label>
          <input id="ca-ak" className="input" type="password" autoComplete="off" spellCheck={false}
            placeholder="sk-ant-…" value={ak} onChange={(e) => { setAk(e.target.value); setCheck(null); }} />
          {check?.anthropic && <div className={`ca-status ${check.anthropic === "ok" ? "ok" : "bad"}`}>{check.anthropic === "ok" ? "✓ Key works" : check.anthropic}</div>}
          <div className="ca-help">
            Get one at <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">platform.claude.com</a> → API keys, and add a few dollars of credit under Billing.
            A Claude Pro or Max subscription doesn’t include API use, so it needs its own key.
          </div>

          <div className="ca-label">Model</div>
          <div className="ca-models">
            {MODEL_CHOICES.map((m) => (
              <label key={m.id} className={`ca-model ${model === m.id ? "on" : ""}`}>
                <input type="radio" name="ca-model" checked={model === m.id} onChange={() => { setModel(m.id); setCheck(null); }} />
                <span><b>{m.label}</b><span className="muted">{m.note}</span></span>
              </label>
            ))}
          </div>

          <label className="ca-label" htmlFor="ca-bk">Brave Search key <span className="muted">(optional)</span></label>
          <input id="ca-bk" className="input" type="password" autoComplete="off" spellCheck={false}
            placeholder="For faster, Google-like Web and Images results" value={bk} onChange={(e) => { setBk(e.target.value); setCheck(null); }} />
          {check?.brave && <div className={`ca-status ${check.brave === "ok" ? "ok" : "bad"}`}>{check.brave === "ok" ? "✓ Key works" : check.brave}</div>}
          <div className="ca-help">
            Free plan at <a href="https://brave.com/search/api/" target="_blank" rel="noreferrer">brave.com/search/api</a>. Without it, Web and Images search use Claude instead (slower).
          </div>
        </div>
        <div className="modal-foot">
          {connected && <button className="btn ghost" onClick={() => { s.disconnect(); setAk(""); setBk(""); setCheck(null); }}>Disconnect</button>}
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={s.closeDialog}>Cancel</button>
          <button className="btn primary" disabled={(!a && !b) || checking} onClick={saveAndCheck}>
            {checking ? <><span className="spinner" /> Checking…</> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Small status button for panels and the home sidebar.
export function ConnectAIButton({ className = "" }: { className?: string }) {
  const { anthropicKey, model, openDialog } = useAiKeys();
  const [ready, setReady] = useState(false); // saved keys load after the first render
  useEffect(() => setReady(true), []);
  const label = !ready ? "AI" : anthropicKey ? MODEL_CHOICES.find((m) => m.id === model)?.label ?? "AI" : "Connect AI";
  return (
    <button className={`ca-btn ${ready && anthropicKey ? "on" : ""} ${className}`} onClick={openDialog} title="Your Claude API key and model">
      <span className="ca-dot" aria-hidden /> {label}
    </button>
  );
}
