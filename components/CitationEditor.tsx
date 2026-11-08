"use client";

// Edit an item's source info and see/copy its citation.

import { useState } from "react";
import { CITE_STYLES, formatCitation, type CiteStyle } from "@/lib/citation";
import type { Citation } from "@/lib/types";

type Props = { cite: Citation; onChange: (c: Citation) => void; style: CiteStyle; setStyle: (s: CiteStyle) => void };

export default function CitationEditor({ cite, onChange, style, setStyle }: Props) {
  const [looking, setLooking] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<Citation>) => onChange({ ...cite, ...patch });

  // fill blank fields from the page's title / site / author / date
  const lookUp = async () => {
    if (!cite.pageUrl) return;
    setLooking(true);
    try {
      const r = await fetch(`/api/unfurl?url=${encodeURIComponent(cite.pageUrl)}`).then((r) => r.json());
      onChange({
        ...cite,
        title: cite.title || r.title,
        siteName: cite.siteName || r.siteName,
        creator: cite.creator || r.author,
        published: cite.published || r.published,
      });
    } catch { /* leave as is */ } finally {
      setLooking(false);
    }
  };

  const text = formatCitation(cite, style);
  const missingPage = !cite.pageUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div className="label" style={{ marginTop: 4 }}>Source & citation</div>
      {missingPage && (
        <div className="mock-banner">Add the page this came from for a complete citation.</div>
      )}
      <Field label="Page URL">
        <div style={{ display: "flex", gap: 4 }}>
          <input className="input sm" value={cite.pageUrl || ""} placeholder="https://…" onChange={(e) => set({ pageUrl: e.target.value.trim() || undefined })} />
          <button className="btn small" disabled={!cite.pageUrl || looking} onClick={lookUp} title="Fill in from the page">
            {looking ? <span className="spinner" /> : "Look up"}
          </button>
        </div>
      </Field>
      <Field label="Title (work or page)"><input className="input sm" value={cite.title || ""} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Artist / author"><input className="input sm" value={cite.creator || ""} onChange={(e) => set({ creator: e.target.value })} /></Field>
      <div style={{ display: "flex", gap: 6 }}>
        <Field label="Website"><input className="input sm" value={cite.siteName || ""} onChange={(e) => set({ siteName: e.target.value })} /></Field>
        <Field label="Published"><input className="input sm" value={cite.published || ""} placeholder="2024" onChange={(e) => set({ published: e.target.value })} /></Field>
      </div>
      <div className="muted" style={{ fontSize: 11 }}>Saved {cite.accessed}</div>

      <div className="type-chips">
        {CITE_STYLES.map((s) => (
          <button key={s.id} className={`chip ${style === s.id ? "on" : ""}`} style={{ height: 22, fontSize: 11 }} onClick={() => setStyle(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="cite-box">{text}</div>
      <button className="btn small" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
      }}>{copied ? "Copied" : "Copy citation"}</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-row" style={{ flex: 1, minWidth: 0 }}>
      <span className="mini">{label}</span>
      {children}
    </div>
  );
}
