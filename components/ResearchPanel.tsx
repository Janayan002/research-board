"use client";

// The collapsible AI research panel on the right.
// Flow: pick a type → prompt → result list → keep / skip → generate a card or pull images → onto the canvas.

import { useState } from "react";
import { IconClose, IconImage, IconSearch, IconSparkle, IconTrash, RESEARCH_ICONS } from "./Icons";
import { hostOf } from "./CardView";
import { uid, useBoards } from "@/lib/store";
import { RESEARCH_TYPES, defaultSectionIds, researchType } from "@/lib/researchTypes";
import type { Board, Candidate, Card, GeneratedCard, ResearchSession } from "@/lib/types";

// a card before it has an id/position (Omit that works across each card kind)
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type NewCard = DistributiveOmit<Card, "id" | "x" | "y" | "createdAt">;

type Props = {
  board: Board;
  open: boolean;
  onClose: () => void;
  onAddCard: (card: NewCard) => void;
  onFindImages: (urls: string[], title: string, creator?: string) => void;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

type ResearchResponse = { candidates: Omit<Candidate, "id" | "status">[]; mock?: boolean };

export default function ResearchPanel({ board, open, onClose, onAddCard, onFindImages }: Props) {
  const addSession = useBoards((s) => s.addSession);
  const removeSession = useBoards((s) => s.removeSession);
  const updateCandidate = useBoards((s) => s.updateCandidate);
  const appendCandidates = useBoards((s) => s.appendCandidates);

  const [type, setType] = useState(RESEARCH_TYPES[0].id);
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({}); // candidate id → generating
  const [picks, setPicks] = useState<Record<string, string[]>>({}); // candidate id → section ids

  const rt = researchType(type);
  const toCands = (list: ResearchResponse["candidates"]): Candidate[] =>
    list.map((c) => ({ ...c, id: uid(), status: "new" as const }));

  const search = async () => {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await postJson<ResearchResponse>("/api/research", { query: q, type, count });
      addSession(board.id, { id: uid(), query: q, type, candidates: toCands(r.candidates), createdAt: Date.now(), mock: r.mock });
      setQuery("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const findMore = async (s: ResearchSession) => {
    setMoreLoading(s.id);
    setError(null);
    try {
      const r = await postJson<ResearchResponse>("/api/research", { query: s.query, type: s.type, count, exclude: s.candidates.map((c) => c.name) });
      appendCandidates(board.id, s.id, toCands(r.candidates));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMoreLoading(null);
    }
  };

  const generate = async (s: ResearchSession, c: Candidate) => {
    setBusy((b) => ({ ...b, [c.id]: true }));
    setError(null);
    try {
      const card = await postJson<GeneratedCard>("/api/card", {
        name: c.name, type: s.type, query: s.query, sections: picks[c.id] ?? defaultSectionIds(s.type), hintUrl: c.sourceUrl,
      });
      onAddCard({
        kind: "research", category: s.type, w: 340, name: card.name, subtitle: card.subtitle ?? c.meta,
        image: card.image, website: card.website, sections: card.sections, sources: card.sources,
      });
      updateCandidate(board.id, s.id, c.id, { status: "added" });
    } catch (e: any) {
      setError(`${c.name}: ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, [c.id]: false }));
    }
  };

  const generateAllKept = async (s: ResearchSession) => {
    for (const c of s.candidates.filter((c) => c.status === "kept")) await generate(s, c);
  };

  const addAsLink = (c: Candidate) => {
    if (!c.sourceUrl) return;
    onAddCard({ kind: "link", w: 280, url: c.sourceUrl, title: `${c.name} — ${c.sourceTitle || hostOf(c.sourceUrl)}` });
  };

  const toggleSection = (s: ResearchSession, candId: string, secId: string) =>
    setPicks((p) => {
      const cur = p[candId] ?? defaultSectionIds(s.type);
      return { ...p, [candId]: cur.includes(secId) ? cur.filter((x) => x !== secId) : [...cur, secId] };
    });

  return (
    <aside className={`tray right-panel ${open ? "" : "collapsed"}`} aria-hidden={!open}>
      <div className="rp-head">
        <div className="t"><IconSparkle size={18} /> Research</div>
        <button className="icon-btn" onClick={onClose} title="Hide panel  Ctrl \" aria-label="Hide research panel"><IconClose size={16} /></button>
      </div>

      <div className="rp-form">
        <div className="type-chips">
          {RESEARCH_TYPES.map((t) => {
            const I = RESEARCH_ICONS[t.id] ?? RESEARCH_ICONS.any;
            return (
              <button key={t.id} className={`chip ${type === t.id ? "on" : ""}`} onClick={() => setType(t.id)}>
                <I size={15} /> {t.label}
              </button>
            );
          })}
        </div>
        <textarea
          className="textarea"
          placeholder={rt.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) search(); e.stopPropagation(); }}
          rows={3}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="input" style={{ width: "auto" }} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[3, 6, 9, 12].map((n) => <option key={n} value={n}>{n} results</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button className="btn primary" onClick={search} disabled={loading || !query.trim()}>
            {loading ? <><span className="spinner" /> Searching…</> : <><IconSearch size={15} /> Search</>}
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
      </div>

      <div className="rp-scroll">
        {board.research.length === 0 && (
          <div className="muted" style={{ lineHeight: 1.55 }}>
            Pick what you’re looking for (artists, museums, articles, exhibitions, apps…) and describe it. Keep the results you like,
            then pull their images onto the canvas or generate a card with sources.
          </div>
        )}

        {board.research.map((s) => {
          const kept = s.candidates.filter((c) => c.status === "kept").length;
          const st = researchType(s.type);
          return (
            <section key={s.id}>
              <div className="session-head">
                <div style={{ flex: 1 }}>
                  <div className="session-type">{(() => { const I = RESEARCH_ICONS[st.id] ?? RESEARCH_ICONS.any; return <I size={14} />; })()} {st.label}</div>
                  <div className="session-q">{s.query}</div>
                </div>
                <button className="icon-btn" style={{ width: 28, height: 28 }} title="Remove this search" onClick={() => removeSession(board.id, s.id)}>
                  <IconTrash size={15} />
                </button>
              </div>
              {s.mock && (
                <div className="mock-banner" style={{ marginBottom: 8 }}>
                  Mock results — no API key set. Add ANTHROPIC_API_KEY to .env.local for real search.
                </div>
              )}
              {s.candidates.length === 0 && <div className="muted">No matches found. Try rewording.</div>}

              {s.candidates.map((c) => {
                const sel = picks[c.id] ?? defaultSectionIds(s.type);
                const imagesBtn = c.sourceUrl && (
                  <button className="btn small" onClick={() => onFindImages([c.sourceUrl!], `Images for ${c.name}`, s.type === "artist" ? c.name : undefined)}>
                    <IconImage size={14} /> Images
                  </button>
                );
                return (
                  <div key={c.id} className={`cand ${c.status}`}>
                    <div className="cand-top">
                      <div style={{ flex: 1 }}>
                        <div className="cand-name">{c.name}</div>
                        {c.meta && <div className="cand-meta">{c.meta}</div>}
                      </div>
                      {c.status === "added" && <span className="pill">On board</span>}
                    </div>
                    <div className="cand-why">{c.why}</div>
                    {c.sourceUrl && (
                      <a className="cand-src" href={c.sourceUrl} target="_blank" rel="noreferrer" title={c.sourceUrl}>
                        {c.sourceTitle || hostOf(c.sourceUrl)}
                      </a>
                    )}

                    {c.status === "new" || c.status === "skipped" ? (
                      <div className="cand-actions">
                        <button className="btn small primary" onClick={() => updateCandidate(board.id, s.id, c.id, { status: "kept" })}>Keep</button>
                        {c.status === "new"
                          ? <button className="btn small" onClick={() => updateCandidate(board.id, s.id, c.id, { status: "skipped" })}>Skip</button>
                          : <span className="muted" style={{ alignSelf: "center" }}>Skipped</span>}
                        {imagesBtn}
                      </div>
                    ) : (
                      <div className="gen-box">
                        <div className="label">Generate card with</div>
                        {st.sections.map((d) => (
                          <label key={d.id} className="chk">
                            <input type="checkbox" checked={sel.includes(d.id)} onChange={() => toggleSection(s, c.id, d.id)} />
                            {d.label}
                          </label>
                        ))}
                        <div className="cand-actions">
                          <button className="btn small primary" disabled={busy[c.id] || sel.length === 0} onClick={() => generate(s, c)}>
                            {busy[c.id] ? <><span className="spinner" /> Writing…</> : c.status === "added" ? "Generate again" : "Generate card"}
                          </button>
                          {imagesBtn}
                          {c.sourceUrl && <button className="btn small" onClick={() => addAsLink(c)}>Link only</button>}
                          {c.status === "kept" && (
                            <button className="btn small ghost" onClick={() => updateCandidate(board.id, s.id, c.id, { status: "new" })}>Undo</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="cand-actions">
                {kept > 0 && (
                  <button className="btn small primary" onClick={() => generateAllKept(s)}>Generate all kept ({kept})</button>
                )}
                <button className="btn small" disabled={moreLoading === s.id} onClick={() => findMore(s)}>
                  {moreLoading === s.id ? <><span className="spinner" /> Finding…</> : "Find more"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
