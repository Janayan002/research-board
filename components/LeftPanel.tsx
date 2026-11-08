"use client";

// Left panel: the board's pages (like Figma pages) + controls for the selected item.

import { useState } from "react";
import { IconTrash, IconExternal, IconImage } from "./Icons";
import CitationEditor from "./CitationEditor";
import type { CiteStyle } from "@/lib/citation";
import { NOTE_COLORS } from "@/lib/presets";
import { useBoards } from "@/lib/store";
import type { Board, Page } from "@/lib/types";

type Props = {
  board: Board;
  page: Page;
  selectedId: string | null;
  citeStyle: CiteStyle;
  setCiteStyle: (s: CiteStyle) => void;
  onFindImages: (urls: string[], title: string, creator?: string) => void;
};

export default function LeftPanel({ board, page, selectedId, citeStyle, setCiteStyle, onFindImages }: Props) {
  const updateCard = useBoards((s) => s.updateCard);
  const removeCard = useBoards((s) => s.removeCard);
  const addCard = useBoards((s) => s.addCard);
  const addPage = useBoards((s) => s.addPage);
  const renamePage = useBoards((s) => s.renamePage);
  const deletePage = useBoards((s) => s.deletePage);
  const duplicatePage = useBoards((s) => s.duplicatePage);
  const movePage = useBoards((s) => s.movePage);
  const setCurrentPage = useBoards((s) => s.setCurrentPage);

  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const sel = page.cards.find((c) => c.id === selectedId) || null;

  return (
    <aside className="left-panel">
      <div className="panel-section pages-head">
        <div className="label">Pages</div>
        <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 16 }} title="Add page" onClick={() => addPage(board.id)}>+</button>
      </div>

      <div className="panel-scroll">
        {board.pages.map((p, i) => {
          const active = p.id === page.id;
          return (
            <div
              key={p.id}
              className={`page-item ${active ? "selected" : ""} ${dragOver === i && dragFrom !== i ? "drop-target" : ""}`}
              onClick={() => setCurrentPage(board.id, p.id)}
              onDoubleClick={() => setRenaming(p.id)}
              draggable={renaming !== p.id}
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.setData("application/x-page", String(i)); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
              onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
              onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) movePage(board.id, dragFrom, i); setDragFrom(null); setDragOver(null); }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
            >
              {renaming === p.id ? (
                <input
                  autoFocus
                  className="page-rename"
                  defaultValue={p.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { renamePage(board.id, p.id, e.target.value.trim() || p.name); setRenaming(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                />
              ) : (
                <>
                  <span className="page-name">{p.name}</span>
                  <span className="page-count">{p.cards.length || ""}</span>
                  <span className="page-actions" onClick={(e) => e.stopPropagation()}>
                    <button title="Rename" onClick={() => setRenaming(p.id)}>✎</button>
                    <button title="Duplicate page" onClick={() => duplicatePage(board.id, p.id)}>⧉</button>
                    {board.pages.length > 1 && (
                      <button
                        title={confirmDel === p.id ? "Click again to delete" : "Delete page"}
                        className={confirmDel === p.id ? "danger" : ""}
                        onClick={() => {
                          if (confirmDel === p.id) { deletePage(board.id, p.id); setConfirmDel(null); }
                          else { setConfirmDel(p.id); setTimeout(() => setConfirmDel(null), 3000); }
                        }}
                      >
                        {confirmDel === p.id ? "Delete?" : "✕"}
                      </button>
                    )}
                  </span>
                </>
              )}
            </div>
          );
        })}
        <div className="muted" style={{ padding: "10px 8px", fontSize: 11, lineHeight: 1.5 }}>
          Double-click to rename · drag to reorder · <span className="kbd">PgUp</span>/<span className="kbd">PgDn</span> to switch
        </div>
      </div>

      {sel && (
        <div className="panel-section selected-section" style={{ borderTop: "1px solid var(--line)", borderBottom: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="label">Selected · {sel.kind === "research" ? "card" : sel.kind}</div>
          {sel.kind === "note" && (
            <div className="color-row">
              {NOTE_COLORS.map((col) => (
                <div key={col} className={`swatch ${sel.color === col ? "on" : ""}`} style={{ background: col }}
                  onClick={() => updateCard(board.id, page.id, sel.id, { color: col })} />
              ))}
            </div>
          )}
          {sel.kind === "image" && (
            <>
              <input className="input sm" placeholder="Your caption / note" value={sel.caption || ""}
                onChange={(e) => updateCard(board.id, page.id, sel.id, { caption: e.target.value })} />
              <label className="chk" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={sel.showCredit !== false}
                  onChange={(e) => updateCard(board.id, page.id, sel.id, { showCredit: e.target.checked })} />
                Show credit on canvas
              </label>
              <CitationEditor
                key={sel.id}
                cite={sel.cite ?? { imageUrl: sel.src.startsWith("data:") ? undefined : sel.src, pageUrl: sel.sourceUrl, accessed: new Date(sel.createdAt).toISOString().slice(0, 10) }}
                onChange={(cite) => updateCard(board.id, page.id, sel.id, { cite })}
                style={citeStyle}
                setStyle={setCiteStyle}
              />
            </>
          )}
          {sel.kind === "link" && (
            <>
              <input className="input sm" placeholder="Title" value={sel.title}
                onChange={(e) => updateCard(board.id, page.id, sel.id, { title: e.target.value })} />
              <button className="btn small" onClick={() => onFindImages([sel.url], `Images from ${sel.title || sel.url}`)}>
                <IconImage size={12} /> Pull images from this page
              </button>
              <CitationEditor
                key={sel.id}
                cite={sel.cite ?? { pageUrl: sel.url, title: sel.title, accessed: new Date(sel.createdAt).toISOString().slice(0, 10) }}
                onChange={(cite) => updateCard(board.id, page.id, sel.id, { cite })}
                style={citeStyle}
                setStyle={setCiteStyle}
              />
            </>
          )}
          {sel.kind === "research" && (sel.website || sel.sources.length > 0) && (
            <button className="btn small" onClick={() => onFindImages(
              [sel.website, ...sel.sources.map((x) => x.url)].filter(Boolean) as string[],
              `Images for ${sel.name}`,
              sel.category === "artist" ? sel.name : undefined,
            )}>
              <IconImage size={12} /> Find images from its sources
            </button>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 11, width: 34 }}>Size</span>
            <button className="btn small" onClick={() => updateCard(board.id, page.id, sel.id, { scale: Math.max(0.25, (sel.scale ?? 1) / 1.25) })}>−</button>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, width: 38, textAlign: "center" }}>{Math.round((sel.scale ?? 1) * 100)}%</span>
            <button className="btn small" onClick={() => updateCard(board.id, page.id, sel.id, { scale: Math.min(8, (sel.scale ?? 1) * 1.25) })}>+</button>
          </div>
          {board.pages.length > 1 && (
            <select
              className="input"
              value=""
              onChange={(e) => {
                const to = e.target.value;
                if (!to) return;
                addCard(board.id, to, sel);
                removeCard(board.id, page.id, sel.id);
              }}
            >
              <option value="">Move to page…</option>
              {board.pages.filter((p) => p.id !== page.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            {(sel.kind === "link" || (sel.kind === "research" && sel.website)) && (
              <a className="btn small" href={sel.kind === "link" ? sel.url : sel.kind === "research" ? sel.website : "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <IconExternal size={12} /> Open
              </a>
            )}
            <button className="btn small" onClick={() => removeCard(board.id, page.id, sel.id)}>
              <IconTrash size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
