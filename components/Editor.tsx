"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Canvas, { clampZoom, type Tool } from "./Canvas";
import LeftPanel from "./LeftPanel";
import ResearchPanel, { type NewCard } from "./ResearchPanel";
import { hostOf } from "./CardView";
import { IconBack, IconHand, IconImage, IconLink, IconNote, IconPanelRight, IconSelect, IconSparkle } from "./Icons";
import { uid, useBoards } from "@/lib/store";
import { NOTE_COLORS } from "@/lib/presets";
import type { Board, Card, Viewport } from "@/lib/types";

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const MAX_PASTE_BYTES = 1.5 * 1024 * 1024; // pasted images are stored in the browser, keep them small

// true when the user is typing in a text field (so shortcuts and paste shouldn't fire)
const isTyping = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest("input, textarea, select, [contenteditable]");

export default function Editor({ board }: { board: Board }) {
  const addCard = useBoards((s) => s.addCard);
  const updateCard = useBoards((s) => s.updateCard);
  const removeCard = useBoards((s) => s.removeCard);
  const renameBoard = useBoards((s) => s.renameBoard);
  const saveViewport = useBoards((s) => s.setViewport);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>(board.viewport ?? { x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [spaceDown, setSpaceDown] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [popover, setPopover] = useState<null | "link" | "image">(null);
  const [popUrl, setPopUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const cascade = useRef(0);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // ----- viewport helpers -----
  const size = () => {
    const el = containerRef.current;
    return { w: el?.clientWidth ?? 1000, h: el?.clientHeight ?? 700 };
  };

  const fit = useCallback(() => {
    const { w, h } = size();
    const pad = 80;
    const zoom = clampZoom(Math.min((w - pad * 2) / board.frame.w, (h - pad * 2) / board.frame.h));
    setViewport({ zoom, x: (w - board.frame.w * zoom) / 2, y: (h - board.frame.h * zoom) / 2 });
  }, [board.frame.w, board.frame.h]);

  // first open: fit the frame to the screen
  useEffect(() => { if (!board.viewport) fit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // save the viewport (debounced) so the board reopens where you left it
  useEffect(() => {
    const t = setTimeout(() => saveViewport(board.id, viewport), 400);
    return () => clearTimeout(t);
  }, [viewport, board.id, saveViewport]);

  const zoomBy = (k: number) => {
    const { w, h } = size();
    setViewport((v) => {
      const z = clampZoom(v.zoom * k);
      const r = z / v.zoom;
      return { zoom: z, x: w / 2 - (w / 2 - v.x) * r, y: h / 2 - (h / 2 - v.y) * r };
    });
  };

  const centerWorld = () => {
    const { w, h } = size();
    return { x: (w / 2 - viewport.x) / viewport.zoom, y: (h / 2 - viewport.y) / viewport.zoom };
  };

  const focusCard = (id: string) => {
    const c = board.cards.find((x) => x.id === id);
    setSelectedId(id);
    if (!c) return;
    const { w, h } = size();
    const s = c.scale ?? 1;
    setViewport((v) => ({ ...v, x: w / 2 - (c.x + (c.w * s) / 2) * v.zoom, y: h / 2 - (c.y + 120 * s) * v.zoom }));
  };

  // ----- adding cards -----
  // new cards get a scale so they're readable at the current zoom (like placing them at "screen size")
  const readableScale = () => Math.round(Math.min(4, Math.max(1, 0.75 / viewport.zoom)) * 100) / 100;

  const place = (card: NewCard, at?: { x: number; y: number }): string => {
    const id = uid();
    const scale = readableScale();
    let pos = at;
    if (!pos) {
      const c = centerWorld();
      const off = (cascade.current++ % 6) * 28 * scale;
      pos = { x: c.x - (card.w * scale) / 2 + off, y: c.y - 120 * scale + off };
    }
    addCard(board.id, { ...card, id, scale, x: Math.round(pos.x), y: Math.round(pos.y), createdAt: Date.now() } as Card);
    setSelectedId(id);
    return id;
  };

  const createNote = (x: number, y: number) => {
    const s = readableScale();
    const id = place({ kind: "note", w: 240, text: "", color: NOTE_COLORS[0] }, { x: x - 20 * s, y: y - 20 * s });
    setEditingId(id);
    setTool("select");
  };

  const addLink = async (url: string, at?: { x: number; y: number }) => {
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (IMAGE_URL.test(url)) return addImage(url, at);
    const id = place({ kind: "link", w: 280, url, title: "" }, at);
    try {
      const r = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`).then((r) => r.json());
      if (r.title) updateCard(board.id, id, { title: r.title });
    } catch { /* keep the bare link */ }
  };

  const addImage = (src: string, at?: { x: number; y: number }, sourceUrl?: string) =>
    place({ kind: "image", w: 320, src, sourceUrl: sourceUrl || (src.startsWith("data:") ? undefined : src) }, at);

  const addImageFile = (file: File, at?: { x: number; y: number }) => {
    if (file.size > MAX_PASTE_BYTES) return flash("That image is over 1.5 MB — paste a link to it instead, or use a smaller file.");
    const reader = new FileReader();
    reader.onload = () => addImage(String(reader.result), at);
    reader.readAsDataURL(file);
  };

  // ----- paste & drop -----
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const file = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith("image/"));
      if (file) { e.preventDefault(); return addImageFile(file); }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      e.preventDefault();
      if (/^https?:\/\/\S+$/i.test(text)) addLink(text);
      else { const id = place({ kind: "note", w: 260, text, color: NOTE_COLORS[0] }); setSelectedId(id); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const at = { x: (e.clientX - rect.left - viewport.x) / viewport.zoom, y: (e.clientY - rect.top - viewport.y) / viewport.zoom };
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (file) return addImageFile(file, at);
    // dragging an image from another web page gives us HTML with an <img>
    const html = e.dataTransfer.getData("text/html");
    const img = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    const url = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")).split("\n")[0].trim();
    if (img && /^https?:/.test(img)) return addImage(img, at, url && url !== img ? url : undefined);
    if (/^https?:\/\//.test(url)) addLink(url, at);
  };

  // ----- keyboard shortcuts -----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "\\") { e.preventDefault(); setPanelOpen((o) => !o); return; }
      if (isTyping(e.target)) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomBy(1.25); return; }
      if (mod && e.key === "-") { e.preventDefault(); zoomBy(0.8); return; }
      if (mod && e.key === "0") { e.preventDefault(); zoomBy(1 / viewport.zoom); return; }
      if (mod) return;
      if (e.shiftKey && e.key === "!") { fit(); return; }
      switch (e.key.toLowerCase()) {
        case "v": setTool("select"); break;
        case "h": setTool("hand"); break;
        case "n": setTool("note"); break;
        case "l": e.preventDefault(); setPopUrl(""); setPopover("link"); break;
        case "i": e.preventDefault(); setPopUrl(""); setPopover("image"); break;
        case "escape": setSelectedId(null); setEditingId(null); setPopover(null); setTool("select"); break;
        case "delete":
        case "backspace":
          if (selectedId) { removeCard(board.id, selectedId); setSelectedId(null); }
          break;
        case "enter":
          if (selectedId && board.cards.find((c) => c.id === selectedId)?.kind === "note") { e.preventDefault(); setEditingId(selectedId); }
          break;
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  const submitPopover = () => {
    const v = popUrl.trim();
    if (!v) return;
    if (popover === "link") addLink(v);
    else addImage(/^https?:\/\//i.test(v) || v.startsWith("data:") ? v : "https://" + v);
    setPopover(null);
    setPopUrl("");
  };

  const ToolBtn = ({ t, title, children }: { t: Tool; title: string; children: React.ReactNode }) => (
    <button className={`icon-btn ${tool === t ? "active" : ""}`} title={title} onClick={() => setTool(t)}>{children}</button>
  );

  return (
    <div className="editor">
      <header className="topbar">
        <Link href="/" className="icon-btn" title="All boards"><IconBack /></Link>
        <input className="title-input" value={board.name} onChange={(e) => renameBoard(board.id, e.target.value)} />
        <div className="sep" />
        <ToolBtn t="select" title="Select (V)"><IconSelect /></ToolBtn>
        <ToolBtn t="hand" title="Hand — pan (H, or hold Space)"><IconHand /></ToolBtn>
        <ToolBtn t="note" title="Note (N) — click the canvas to place"><IconNote /></ToolBtn>
        <button className={`icon-btn ${popover === "link" ? "active" : ""}`} title="Add link (L)" onClick={() => { setPopUrl(""); setPopover(popover === "link" ? null : "link"); }}><IconLink /></button>
        <button className={`icon-btn ${popover === "image" ? "active" : ""}`} title="Add image from URL (I)" onClick={() => { setPopUrl(""); setPopover(popover === "image" ? null : "image"); }}><IconImage /></button>
        <div className="spacer" />
        <span className="frame-size">{board.frame.w} × {board.frame.h}</span>
        <div className="sep" />
        <button className={`btn ${panelOpen ? "" : "primary"}`} onClick={() => setPanelOpen((o) => !o)} title="Toggle research panel (Ctrl/Cmd + \)">
          {panelOpen ? <IconPanelRight size={15} /> : <IconSparkle size={15} />} {panelOpen ? "Hide research" : "Research"}
        </button>
      </header>

      <div className="workspace">
        <LeftPanel board={board} selectedId={selectedId} onSelect={focusCard} onFit={fit} />

        <div className="canvas-wrap" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <Canvas
            board={board}
            viewport={viewport}
            setViewport={setViewport}
            tool={tool}
            setTool={setTool}
            spaceDown={spaceDown}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            editingId={editingId}
            setEditingId={setEditingId}
            onCreateNote={createNote}
            containerRef={containerRef}
          />

          {popover && (
            <div className="popover" style={{ left: popover === "link" ? 12 : 12 }}>
              <div className="label">{popover === "link" ? "Add a link" : "Add an image from a URL"}</div>
              <input
                autoFocus
                className="input"
                placeholder={popover === "link" ? "https://…" : "https://…/image.jpg"}
                value={popUrl}
                onChange={(e) => setPopUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitPopover(); if (e.key === "Escape") setPopover(null); }}
              />
              <div className="muted" style={{ fontSize: 11 }}>Tip: you can also paste (Ctrl/Cmd+V) or drag links and images straight onto the canvas.</div>
              <div className="popover-row">
                <button className="btn small" onClick={() => setPopover(null)}>Cancel</button>
                <button className="btn small primary" onClick={submitPopover}>Add</button>
              </div>
            </div>
          )}

          {toast && <div className="popover" style={{ left: "50%", transform: "translateX(-50%)", top: 12, width: "auto" }}>{toast}</div>}

          <div className="hint">
            Scroll to pan · <span className="kbd">Ctrl</span>+scroll or pinch to zoom · hold <span className="kbd">Space</span> to drag
          </div>
          <div className="zoom-ctl">
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => zoomBy(0.8)} title="Zoom out (Ctrl -)">−</button>
            <div className="pct">{Math.round(viewport.zoom * 100)}%</div>
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => zoomBy(1.25)} title="Zoom in (Ctrl +)">+</button>
            <button className="btn small ghost" onClick={fit} title="Fit frame (Shift+1)">Fit</button>
          </div>
        </div>

        <ResearchPanel board={board} open={panelOpen} onClose={() => setPanelOpen(false)} onAddCard={(c) => place(c)} />
      </div>
    </div>
  );
}

export { hostOf };
