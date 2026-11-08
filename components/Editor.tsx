"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Canvas, { clampZoom, type Tool } from "./Canvas";
import LeftPanel from "./LeftPanel";
import ResearchPanel, { type NewCard } from "./ResearchPanel";
import ImagePicker, { type PickedImage } from "./ImagePicker";
import CitationsModal from "./CitationsModal";
import type { CiteStyle } from "@/lib/citation";
import { hostOf } from "./CardView";
import { IconFit, IconHand, IconImage, IconLink, IconMinus, IconNote, IconPlus, IconQuote, IconSelect, IconSparkle } from "./Icons";
import { currentPage, uid, useBoards } from "@/lib/store";
import { NOTE_COLORS } from "@/lib/presets";
import type { Board, Card, Citation, Viewport } from "@/lib/types";

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const MAX_PASTE_BYTES = 1.5 * 1024 * 1024; // pasted images are stored in the browser, keep them small

// true when the user is typing in a text field (so shortcuts and paste shouldn't fire)
const isTyping = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest("input, textarea, select, [contenteditable]");

const today = () => new Date().toISOString().slice(0, 10);
const looksLikeImage = (u: string) => IMAGE_URL.test(u.split("#")[0]);

export default function Editor({ board }: { board: Board }) {
  const addCard = useBoards((s) => s.addCard);
  const updateCard = useBoards((s) => s.updateCard);
  const removeCard = useBoards((s) => s.removeCard);
  const saveViewport = useBoards((s) => s.setViewport);

  const setCurrentPage = useBoards((s) => s.setCurrentPage);
  const page = currentPage(board);

  const containerRef = useRef<HTMLDivElement | null>(null);
  // the viewport belongs to one page; keep the page id with it so switching pages never mixes them up
  const [view, setView] = useState<{ pageId: string; vp: Viewport }>({ pageId: page.id, vp: page.viewport ?? { x: 0, y: 0, zoom: 1 } });
  const viewport = view.pageId === page.id ? view.vp : page.viewport ?? view.vp;
  const setViewport = useCallback(
    (u: Viewport | ((v: Viewport) => Viewport)) => setView((prev) => ({ pageId: prev.pageId, vp: typeof u === "function" ? u(prev.vp) : u })),
    []
  );
  const [tool, setTool] = useState<Tool>("select");
  const [spaceDown, setSpaceDown] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [popover, setPopover] = useState<null | "link" | "image">(null);
  const [popUrl, setPopUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { urls: string[]; title: string; creator?: string }>(null);
  const [showCitations, setShowCitations] = useState(false);
  const [citeStyle, setCiteStyleState] = useState<CiteStyle>("chicago");
  const pendingSelect = useRef<string | null>(null);
  const cascade = useRef(0);

  // remember the citation style between visits (wrapped in try: storage can be unavailable)
  useEffect(() => {
    try { const v = localStorage.getItem("cite-style"); if (v === "mla" || v === "apa" || v === "chicago") setCiteStyleState(v); } catch {}
  }, []);
  const setCiteStyle = (s: CiteStyle) => { setCiteStyleState(s); try { localStorage.setItem("cite-style", s); } catch {} };

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // ----- viewport helpers -----
  // The canvas fills the window; the floating trays cover its edges, so "visible" means the area between them.
  const LEFT_TRAY = 252, RIGHT_TRAY = 372, DOCK = 80;
  const visible = () => {
    const el = containerRef.current;
    const w = el?.clientWidth ?? 1200, h = el?.clientHeight ?? 800;
    const x0 = w > 900 ? LEFT_TRAY : 0;
    const x1 = panelOpen && w > 900 ? w - RIGHT_TRAY : w;
    return { x0, x1, y0: 0, y1: h - DOCK, cx: (x0 + x1) / 2, cy: (h - DOCK) / 2 };
  };

  const fitViewport = useCallback((): Viewport => {
    const v = visible();
    const pad = 70;
    const zoom = clampZoom(Math.min((v.x1 - v.x0 - pad * 2) / board.frame.w, (v.y1 - v.y0 - pad * 2) / board.frame.h));
    return { zoom, x: v.cx - (board.frame.w * zoom) / 2, y: v.cy - (board.frame.h * zoom) / 2 + 10 };
  }, [board.frame.w, board.frame.h, panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const fit = useCallback(() => setViewport(fitViewport()), [fitViewport, setViewport]);

  // opening the board or switching pages: restore that page's view (or fit the frame the first time)
  useEffect(() => {
    setView({ pageId: page.id, vp: page.viewport ?? fitViewport() });
    setSelectedId(pendingSelect.current);
    pendingSelect.current = null;
    setEditingId(null);
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // save the viewport (debounced) so each page reopens where you left it
  useEffect(() => {
    const t = setTimeout(() => saveViewport(board.id, view.pageId, view.vp), 400);
    return () => clearTimeout(t);
  }, [view, board.id, saveViewport]);

  const zoomBy = (k: number) => {
    const { cx, cy } = visible();
    setViewport((v) => {
      const z = clampZoom(v.zoom * k);
      const r = z / v.zoom;
      return { zoom: z, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
    });
  };

  const centerWorld = () => {
    const { cx, cy } = visible();
    return { x: (cx - viewport.x) / viewport.zoom, y: (cy - viewport.y) / viewport.zoom };
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
    addCard(board.id, page.id, { ...card, id, scale, x: Math.round(pos.x), y: Math.round(pos.y), createdAt: Date.now() } as Card);
    setSelectedId(id);
    return id;
  };

  const createNote = (x: number, y: number) => {
    const s = readableScale();
    const id = place({ kind: "note", w: 240, text: "", color: NOTE_COLORS[0] }, { x: x - 20 * s, y: y - 20 * s });
    setEditingId(id);
    setTool("select");
  };

  const unfurl = (url: string) => fetch(`/api/unfurl?url=${encodeURIComponent(url)}`).then((r) => r.json()).catch(() => ({}));

  const addLink = async (url: string, at?: { x: number; y: number }) => {
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    if (looksLikeImage(url)) return addImage(url, at, { imageUrl: url, accessed: today() });
    const id = place({ kind: "link", w: 280, url, title: "", cite: { pageUrl: url, accessed: today() } }, at);
    const r = await unfurl(url);
    updateCard(board.id, page.id, id, {
      title: r.title || "",
      cite: { pageUrl: r.url || url, title: r.title, siteName: r.siteName, creator: r.author, published: r.published, accessed: today() },
    });
  };

  const addImage = (src: string, at?: { x: number; y: number }, cite?: Citation) =>
    place({ kind: "image", w: 320, src, sourceUrl: cite?.pageUrl, cite: cite ?? { accessed: today() } }, at);

  // image from another site: cite it right away, then fill in details from its page
  const addWebImage = async (src: string, pageUrl: string | undefined, alt: string | undefined, at?: { x: number; y: number }) => {
    const id = addImage(src, at, { imageUrl: src, pageUrl, title: alt || undefined, accessed: today() });
    if (!pageUrl) return;
    const r = await unfurl(pageUrl);
    const card = useBoards.getState().boards[board.id]?.pages.find((p) => p.id === page.id)?.cards.find((c) => c.id === id);
    if (!card || card.kind !== "image") return;
    const c = card.cite ?? { accessed: today() };
    updateCard(board.id, page.id, id, {
      cite: { ...c, pageUrl: r.url || pageUrl, title: c.title || r.title, siteName: c.siteName || r.siteName, creator: c.creator || r.author, published: c.published || r.published },
    });
  };

  const addImageFile = (file: File, at?: { x: number; y: number }) => {
    if (file.size > MAX_PASTE_BYTES) return flash("That image is over 1.5 MB — paste a link to it instead, or use a smaller file.");
    const reader = new FileReader();
    reader.onload = () => {
      addImage(String(reader.result), at, { title: file.name && !/^image\.\w+$/.test(file.name) ? file.name.replace(/\.\w+$/, "") : undefined, accessed: today() });
      flash("Image added — add the page it came from (left panel) to cite it.");
    };
    reader.readAsDataURL(file);
  };

  // images picked from a web page: lay them out in a grid around the center of the view
  const addPicked = (imgs: PickedImage[]) => {
    setPicker(null);
    if (!imgs.length) return;
    const scale = readableScale();
    const cols = Math.min(4, imgs.length);
    const cellW = 340 * scale, cellH = 300 * scale;
    const c = centerWorld();
    const x0 = c.x - (cols * cellW) / 2;
    const y0 = c.y - (Math.ceil(imgs.length / cols) * cellH) / 2;
    imgs.forEach((img, i) => {
      place({ kind: "image", w: 320, src: img.src, sourceUrl: img.cite.pageUrl, cite: img.cite },
        { x: x0 + (i % cols) * cellW, y: y0 + Math.floor(i / cols) * cellH });
    });
    flash(`Added ${imgs.length} image${imgs.length === 1 ? "" : "s"} with citations.`);
  };

  const openPicker = (urls: string[], title: string, creator?: string) => setPicker({ urls, title, creator });

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
    const alt = html.match(/<img[^>]+alt=["']([^"']*)["']/i)?.[1];
    const url = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")).split("\n")[0].trim();
    if (img && /^https?:/.test(img)) {
      // if the image was inside a link, that link is usually the page it belongs to
      const page = url && url !== img && !looksLikeImage(url) ? url : undefined;
      return addWebImage(img, page, alt, at);
    }
    if (/^https?:\/\//.test(url)) addLink(url, at);
  };

  // ----- keyboard shortcuts -----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "\\") { e.preventDefault(); setPanelOpen((o) => !o); return; }
      if (isTyping(e.target) || document.querySelector(".modal-backdrop")) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomBy(1.25); return; }
      if (mod && e.key === "-") { e.preventDefault(); zoomBy(0.8); return; }
      if (mod && e.key === "0") { e.preventDefault(); zoomBy(1 / viewport.zoom); return; }
      if (mod) return;
      if (e.shiftKey && e.key === "!") { fit(); return; }
      // PageUp / PageDown switch pages
      if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        const i = board.pages.findIndex((p) => p.id === page.id) + (e.key === "PageUp" ? -1 : 1);
        if (board.pages[i]) setCurrentPage(board.id, board.pages[i].id);
        return;
      }
      switch (e.key.toLowerCase()) {
        case "v": setTool("select"); break;
        case "h": setTool("hand"); break;
        case "n": setTool("note"); break;
        case "l": e.preventDefault(); setPopUrl(""); setPopover("link"); break;
        case "i": e.preventDefault(); setPopUrl(""); setPopover("image"); break;
        case "escape": setSelectedId(null); setEditingId(null); setPopover(null); setTool("select"); break;
        case "delete":
        case "backspace":
          if (selectedId) { removeCard(board.id, page.id, selectedId); setSelectedId(null); }
          break;
        case "enter":
          if (selectedId && page.cards.find((c) => c.id === selectedId)?.kind === "note") { e.preventDefault(); setEditingId(selectedId); }
          break;
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  const submitPopover = () => {
    let v = popUrl.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    if (popover === "link") addLink(v);
    else if (looksLikeImage(v)) addImage(v, undefined, { imageUrl: v, accessed: today() });
    else openPicker([v], "Pick images from this page");
    setPopover(null);
    setPopUrl("");
  };

  const DockTool = ({ t, tip, children }: { t: Tool; tip: string; children: React.ReactNode }) => (
    <span className="dock-tip" data-tip={tip}>
      <button className={`icon-btn ${tool === t ? "active" : ""}`} aria-label={tip} onClick={() => setTool(t)}>{children}</button>
    </span>
  );
  const togglePopover = (kind: "link" | "image") => { setPopUrl(""); setPopover(popover === kind ? null : kind); };

  return (
    <div className="editor">
      <div className="canvas-wrap" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <Canvas
          board={board}
          page={page}
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
      </div>

      <LeftPanel board={board} page={page} selectedId={selectedId} citeStyle={citeStyle} setCiteStyle={setCiteStyle} onFindImages={openPicker} />

      <nav className="dock" aria-label="Tools" style={{ left: `calc(50% ${panelOpen ? "- 60px" : "+ 126px"})` }}>
        <DockTool t="select" tip="Select  V"><IconSelect /></DockTool>
        <DockTool t="hand" tip="Move around  H or Space"><IconHand /></DockTool>
        <div className="sep" />
        <DockTool t="note" tip="Note  N"><IconNote /></DockTool>
        <span className="dock-tip" data-tip="Link  L">
          <button className={`icon-btn ${popover === "link" ? "active" : ""}`} aria-label="Add link" onClick={() => togglePopover("link")}><IconLink /></button>
        </span>
        <span className="dock-tip" data-tip="Images from the web  I">
          <button className={`icon-btn ${popover === "image" ? "active" : ""}`} aria-label="Add images" onClick={() => togglePopover("image")}><IconImage /></button>
        </span>
        <div className="sep" />
        <span className="dock-tip" data-tip="Citations for this page">
          <button className="icon-btn" aria-label="Citations" onClick={() => setShowCitations(true)}><IconQuote /></button>
        </span>
        <span className="dock-tip" data-tip={"Research  Ctrl \\"}>
          <button className={`icon-btn ${panelOpen ? "active" : ""}`} aria-label="Research panel" onClick={() => setPanelOpen((o) => !o)}><IconSparkle /></button>
        </span>
      </nav>

      {popover && (
        <div className="popover">
          <div className="label" style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--paper)" }}>
            {popover === "link" ? <IconLink size={16} /> : <IconImage size={16} />}
            {popover === "link" ? "Add a link" : "Add images from the web"}
          </div>
          <input
            autoFocus
            className="input"
            placeholder={popover === "link" ? "https://…" : "Paste a page link to pick from its images"}
            value={popUrl}
            onChange={(e) => setPopUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitPopover(); if (e.key === "Escape") setPopover(null); }}
          />
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
            {popover === "image"
              ? "A direct image link works too. You can also drag images from other tabs onto the canvas."
              : "You can also paste a link anywhere on the canvas."}
          </div>
          <div className="popover-row">
            <button className="btn small ghost" onClick={() => setPopover(null)}>Cancel</button>
            <button className="btn small primary" onClick={submitPopover}>{popover === "link" ? "Add link" : "Find images"}</button>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <div className="zoom-ctl" style={{ right: panelOpen ? RIGHT_TRAY + 16 : 16 }}>
        <button className="icon-btn" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out  Ctrl −"><IconMinus size={16} /></button>
        <div className="pct">{Math.round(viewport.zoom * 100)}%</div>
        <button className="icon-btn" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in  Ctrl +"><IconPlus size={16} /></button>
        <button className="icon-btn" onClick={fit} aria-label="Fit frame" title="Fit frame  Shift 1"><IconFit size={16} /></button>
      </div>

      <ResearchPanel board={board} open={panelOpen} onClose={() => setPanelOpen(false)} onAddCard={(c) => place(c)} onFindImages={openPicker} />

      {picker && <ImagePicker urls={picker.urls} title={picker.title} creator={picker.creator} onAdd={addPicked} onClose={() => setPicker(null)} />}
      {showCitations && (
        <CitationsModal
          board={board}
          page={page}
          style={citeStyle}
          setStyle={setCiteStyle}
          onClose={() => setShowCitations(false)}
          onSelect={(pageId, cardId) => {
            if (pageId === page.id) setSelectedId(cardId);
            else { pendingSelect.current = cardId; setCurrentPage(board.id, pageId); }
          }}
        />
      )}
    </div>
  );
}

export { hostOf };
