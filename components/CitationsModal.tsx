"use client";

// Every citation on the page (or the whole board), formatted and ready to copy.

import { useEffect, useState } from "react";
import { IconClose, IconCopy, IconQuote } from "./Icons";
import { CITE_STYLES, collectCitations, formatCitation, type CiteStyle } from "@/lib/citation";
import type { Board, Page } from "@/lib/types";

type Props = { board: Board; page: Page; style: CiteStyle; setStyle: (s: CiteStyle) => void; onSelect: (pageId: string, cardId: string) => void; onClose: () => void };

export default function CitationsModal({ board, page, style, setStyle, onSelect, onClose }: Props) {
  const [scope, setScope] = useState<"page" | "board">("page");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const pages = scope === "page" ? [page] : board.pages;
  const items = pages.flatMap((p) => collectCitations(p.cards).map((c) => ({ ...c, pageId: p.id, pageName: p.name, text: formatCitation(c.cite, style) })));
  // bibliographies are alphabetical
  const sorted = [...items].sort((a, b) => a.text.localeCompare(b.text));

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 760 }}>
        <div className="modal-head">
          <div className="t"><IconQuote size={20} /> Citations</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <div className="modal-bar">
          <div className="type-chips">
            <button className={`chip plain ${scope === "page" ? "on" : ""}`} onClick={() => setScope("page")}>This page</button>
            <button className={`chip plain ${scope === "board" ? "on" : ""}`} onClick={() => setScope("board")}>Whole board</button>
          </div>
          <div style={{ flex: 1 }} />
          <div className="type-chips">
            {CITE_STYLES.map((s) => (
              <button key={s.id} className={`chip plain ${style === s.id ? "on" : ""}`} onClick={() => setStyle(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="modal-body">
          {sorted.length === 0 && <div className="muted">No sources yet. Images, links and research cards you add will show up here.</div>}
          {sorted.map((it, i) => (
            <div key={i} className="cite-row">
              <div className="cite-text">{it.text}</div>
              <div className="cite-meta">
                <span className="muted">{it.label}{scope === "board" ? ` · ${it.pageName}` : ""}</span>
                <button className="btn small ghost" onClick={() => { onSelect(it.pageId, it.cardId); onClose(); }}>Show</button>
                <button className="btn small" onClick={() => copy(it.text, String(i))}><IconCopy size={13} /> {copied === String(i) ? "Copied" : "Copy"}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <div className="muted" style={{ fontSize: 11, flex: 1 }}>Auto-generated from page info — double-check names and titles before you submit.</div>
          <button className="btn primary" disabled={!sorted.length} onClick={() => copy(sorted.map((s) => s.text).join("\n\n"), "all")}>
            {copied === "all" ? "Copied!" : `Copy all (${sorted.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
