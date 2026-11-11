"use client";

// Left panel: the board's pages (like Figma pages) + controls for the selected item.

import { useState } from "react";
import Link from "next/link";
import { IconDuplicate, IconExternal, IconImage, IconLink, IconPencil, IconPlus, IconText, IconTrash, RESEARCH_ICONS, IconPrint } from "./Icons";
import CitationEditor from "./CitationEditor";
import type { CiteStyle } from "@/lib/citation";
import { TEXT_COLORS, TEXT_FONTS, TEXT_SIZES, rememberTextStyle } from "@/lib/fonts";
import { useBoards } from "@/lib/store";
import type { Board, Page, TextCard } from "@/lib/types";

type Props = {
  board: Board;
  page: Page;
  selectedId: string | null;
  citeStyle: CiteStyle;
  setCiteStyle: (s: CiteStyle) => void;
  onFindImages: (urls: string[], title: string, creator?: string) => void;
  onGoToPage: (pageId: string) => void;
  onExport: () => void;
  selectionCount: number;
  onDeleteSelection: () => void;
};

export default function LeftPanel({ board, page, selectedId, citeStyle, setCiteStyle, onFindImages, onGoToPage, onExport, selectionCount, onDeleteSelection }: Props) {
  const updateCard = useBoards((s) => s.updateCard);
  const removeCard = useBoards((s) => s.removeCard);
  const addCard = useBoards((s) => s.addCard);
  const addPage = useBoards((s) => s.addPage);
  const renamePage = useBoards((s) => s.renamePage);
  const deletePage = useBoards((s) => s.deletePage);
  const duplicatePage = useBoards((s) => s.duplicatePage);
  const movePage = useBoards((s) => s.movePage);
  const renameBoard = useBoards((s) => s.renameBoard);

  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // the selected card can be on any page (all pages share one canvas)
  const cardPage = board.pages.find((p) => p.cards.some((c) => c.id === selectedId)) ?? page;
  const sel = cardPage.cards.find((c) => c.id === selectedId) || null;
  const [pageQuery, setPageQuery] = useState("");
  const shownPages = board.pages.map((p, i) => ({ p, i })).filter(({ p }) => !pageQuery || p.name.toLowerCase().includes(pageQuery.toLowerCase()));
  // style a text box, and use the same style for the next one you add
  const styleText = (patch: Partial<TextCard>) => {
    if (!sel) return;
    updateCard(board.id, cardPage.id, sel.id, patch);
    rememberTextStyle(patch);
  };

  return (
    <aside className="tray left-panel">
      <div className="board-head">
        <Link href="/" className="wordmark sm" title="All boards">Tack</Link>
        <nav className="pipe-nav sm" aria-label="Board"><Link href="/">Boards</Link></nav>
        <button className="icon-btn" onClick={onExport} title="Export or print  Ctrl P" aria-label="Export or print"><IconPrint size={17} /></button>
      </div>
      <div className="board-title">
        <input className="title-input" value={board.name} aria-label="Board name" onChange={(e) => renameBoard(board.id, e.target.value)} />
        <div className="muted board-size">{board.frame.w} × {board.frame.h} frame</div>
      </div>

      <div className="pages-head">
        <div className="label">Pages</div>
        <button className="icon-btn" style={{ width: 28, height: 28 }} title="Add page" aria-label="Add page" onClick={() => addPage(board.id)}><IconPlus size={16} /></button>
      </div>

      {board.pages.length >= 4 && (
        <div className="page-find">
          <input className="input sm" placeholder={`Find a page (${board.pages.length})`} value={pageQuery}
            onChange={(e) => setPageQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && shownPages[0]) onGoToPage(shownPages[0].p.id);
              if (e.key === "Escape") setPageQuery("");
            }} />
        </div>
      )}

      <div className="panel-scroll">
        {pageQuery && shownPages.length === 0 && <div className="muted" style={{ padding: "6px 9px", fontSize: 12 }}>No page called “{pageQuery}”.</div>}
        {shownPages.map(({ p, i }) => {
          const active = p.id === page.id;
          return (
            <div
              key={p.id}
              className={`page-item ${active ? "selected" : ""} ${dragOver === i && dragFrom !== i ? "drop-target" : ""}`}
              onClick={() => onGoToPage(p.id)}
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
                  <span className="page-dot" />
                  <span className="page-name">{p.name}</span>
                  <span className="page-count">{p.cards.length || ""}</span>
                  <span className="page-actions" onClick={(e) => e.stopPropagation()}>
                    <button title="Rename" aria-label="Rename page" onClick={() => setRenaming(p.id)}><IconPencil size={14} /></button>
                    <button title="Duplicate page" aria-label="Duplicate page" onClick={() => duplicatePage(board.id, p.id)}><IconDuplicate size={14} /></button>
                    {board.pages.length > 1 && (
                      <button
                        title={confirmDel === p.id ? "Click again to delete" : "Delete page"}
                        className={confirmDel === p.id ? "danger" : ""}
                        onClick={() => {
                          if (confirmDel === p.id) { deletePage(board.id, p.id); setConfirmDel(null); }
                          else { setConfirmDel(p.id); setTimeout(() => setConfirmDel(null), 3000); }
                        }}
                      >
                        {confirmDel === p.id ? "Delete?" : <IconTrash size={14} />}
                      </button>
                    )}
                  </span>
                </>
              )}
            </div>
          );
        })}
        <div className="muted" style={{ padding: "10px 9px", fontSize: 12, lineHeight: 1.5 }}>
          Click a page to jump to it. Double-click to rename, drag to reorder. <span className="kbd">PgUp</span> <span className="kbd">PgDn</span> next / previous page.
        </div>
      </div>

      {selectionCount > 1 && (
        <div className="selected-section">
          <div className="selected-title">{selectionCount} items selected</div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "0 0 10px" }}>
            Drag any of them to move them together, even onto another page. Shift-click to add or remove one.
          </div>
          <button className="btn small" onClick={onDeleteSelection}><IconTrash size={13} /> Delete {selectionCount} items</button>
        </div>
      )}

      {sel && (
        <div className="selected-section">
          <div className="selected-title">
            {sel.kind === "text" && <><IconText size={16} /> Text</>}
            {sel.kind === "link" && <><IconLink size={16} /> Link</>}
            {sel.kind === "image" && <><IconImage size={16} /> Image</>}
            {sel.kind === "research" && (() => { const I = RESEARCH_ICONS[sel.category] ?? RESEARCH_ICONS.any; return <><I size={16} /> {sel.name}</>; })()}
          </div>
          {sel.kind === "text" && (
            <>
              <div className="label">Font</div>
              <div className="font-list" role="listbox" aria-label="Font">
                {TEXT_FONTS.map((f) => (
                  <button key={f.name} role="option" aria-selected={sel.font === f.name}
                    className={`font-opt ${sel.font === f.name ? "on" : ""}`} style={{ fontFamily: f.family }}
                    onClick={() => styleText({ font: f.name })}>
                    {f.name}<small>{f.kind}</small>
                  </button>
                ))}
              </div>
              <div className="text-row">
                <select className="input sm" aria-label="Font size" value={sel.size}
                  onChange={(e) => styleText({ size: Number(e.target.value) })}>
                  {[...new Set([...TEXT_SIZES, sel.size])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} px</option>)}
                </select>
                <button className={`icon-btn bold-btn ${sel.bold ? "active" : ""}`} style={{ width: 32, height: 32 }}
                  aria-label="Bold" aria-pressed={!!sel.bold} onClick={() => styleText({ bold: !sel.bold })}>B</button>
              </div>
              <div className="color-row">
                {TEXT_COLORS.map((col) => (
                  <div key={col} className={`swatch ${sel.color === col ? "on" : ""}`} style={{ background: col }} title={col}
                    onClick={() => styleText({ color: col })} />
                ))}
              </div>
            </>
          )}
          {sel.kind === "image" && (
            <>
              <input className="input sm" placeholder="Your caption / note" value={sel.caption || ""}
                onChange={(e) => updateCard(board.id, cardPage.id, sel.id, { caption: e.target.value })} />
              <label className="chk" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={sel.showCredit !== false}
                  onChange={(e) => updateCard(board.id, cardPage.id, sel.id, { showCredit: e.target.checked })} />
                Show credit on canvas
              </label>
              <CitationEditor
                key={sel.id}
                cite={sel.cite ?? { imageUrl: sel.src.startsWith("data:") ? undefined : sel.src, pageUrl: sel.sourceUrl, accessed: new Date(sel.createdAt).toLocaleDateString("en-CA") }}
                onChange={(cite) => updateCard(board.id, cardPage.id, sel.id, { cite })}
                style={citeStyle}
                setStyle={setCiteStyle}
              />
            </>
          )}
          {sel.kind === "link" && (
            <>
              <input className="input sm" placeholder="Title" value={sel.title}
                onChange={(e) => updateCard(board.id, cardPage.id, sel.id, { title: e.target.value })} />
              <button className="btn small" onClick={() => onFindImages([sel.url], `Images from ${sel.title || sel.url}`)}>
                <IconImage size={12} /> Pull images from this page
              </button>
              <CitationEditor
                key={sel.id}
                cite={sel.cite ?? { pageUrl: sel.url, title: sel.title, accessed: new Date(sel.createdAt).toLocaleDateString("en-CA") }}
                onChange={(cite) => updateCard(board.id, cardPage.id, sel.id, { cite })}
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
          <div className="size-row">
            <span className="muted" style={{ fontSize: 12, flex: 1 }}>Size</span>
            <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Smaller" onClick={() => updateCard(board.id, cardPage.id, sel.id, { scale: Math.max(0.25, (sel.scale ?? 1) / 1.25) })}>−</button>
            <span className="val">{Math.round((sel.scale ?? 1) * 100)}%</span>
            <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Larger" onClick={() => updateCard(board.id, cardPage.id, sel.id, { scale: Math.min(8, (sel.scale ?? 1) * 1.25) })}>+</button>
          </div>
          {board.pages.length > 1 && (
            <select
              className="input sm"
              value=""
              onChange={(e) => {
                const to = e.target.value;
                if (!to) return;
                addCard(board.id, to, sel);
                removeCard(board.id, cardPage.id, sel.id);
              }}
            >
              <option value="">Move to page…</option>
              {board.pages.filter((p) => p.id !== cardPage.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            {(sel.kind === "link" || (sel.kind === "research" && sel.website)) && (
              <a className="btn small" href={sel.kind === "link" ? sel.url : sel.kind === "research" ? sel.website : "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <IconExternal size={12} /> Open
              </a>
            )}
            <button className="btn small" onClick={() => removeCard(board.id, cardPage.id, sel.id)}>
              <IconTrash size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
