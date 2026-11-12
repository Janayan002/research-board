"use client";

// The infinite canvas: pan, zoom, every page's frame side by side, and draggable/resizable cards.
// World coordinates = canvas pixels; each page's cards are relative to that page's frame
// (see lib/layout.ts). Screen = world * zoom + offset.

import { useEffect, useRef, useState } from "react";
import CardView from "./CardView";
import { useBoards } from "@/lib/store";
import type { Board, Card, Page, Viewport } from "@/lib/types";
import { pageIndexAt, pageOffset } from "@/lib/layout";
import { snapTo, type Box, type GapMark, type Guide } from "@/lib/snap";

export type Tool = "select" | "hand" | "text";

type Props = {
  board: Board;
  page: Page; // the current page
  viewport: Viewport;
  setViewport: (v: Viewport | ((v: Viewport) => Viewport)) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  spaceDown: boolean;
  selection: string[];
  setSelection: (ids: string[]) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onCreateText: (worldX: number, worldY: number) => void;
  onGoToPage: (pageId: string) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

type Gesture =
  | { type: "pan"; startX: number; startY: number; vx: number; vy: number }
  // dragging one or more selected cards; `id` is the one under the pointer. Sizes are measured from the
  // screen at the start (card heights depend on their content); `others` are the page's other cards, for snapping.
  | { type: "drag"; id: string; startX: number; startY: number; items: { id: string; x: number; y: number; w: number; h: number }[]; moved: boolean; additive: boolean; pageIdx: number; others: Box[] }
  | { type: "resize"; id: string; pageId: string; startX: number; x: number; y: number; w: number }
  // a selection box drawn on empty canvas (screen coordinates relative to the canvas)
  | { type: "marquee"; x0: number; y0: number; base: string[] };

type Live = Record<string, { x: number; y: number; w: number }>;

// Red alignment lines and gap labels, drawn on the screen (so they stay 1px at any zoom)
function GuideLayer({ pageIdx, guides, gaps, board, vp }: { pageIdx: number; guides: Guide[]; gaps: GapMark[]; board: Board; vp: Viewport }) {
  const off = pageOffset(board, pageIdx);
  const sx = (x: number) => (x + off.x) * vp.zoom + vp.x;
  const sy = (y: number) => (y + off.y) * vp.zoom + vp.y;
  return (
    <svg className="guides" aria-hidden>
      {guides.map((g, i) => g.axis === "x"
        ? <line key={i} x1={sx(g.at)} x2={sx(g.at)} y1={sy(g.from)} y2={sy(g.to)} />
        : <line key={i} y1={sy(g.at)} y2={sy(g.at)} x1={sx(g.from)} x2={sx(g.to)} />)}
      {gaps.map((g, i) => {
        const n = Math.round(g.to - g.from);
        const label = String(n);
        const lw = label.length * 7 + 10;
        if (g.axis === "x") {
          const y = sy(g.at), a = sx(g.from), b = sx(g.to), mx = (a + b) / 2;
          return (
            <g key={"g" + i} className="gap-label">
              <line x1={a} x2={b} y1={y} y2={y} /><line x1={a} x2={a} y1={y - 5} y2={y + 5} /><line x1={b} x2={b} y1={y - 5} y2={y + 5} />
              <rect x={mx - lw / 2} y={y + 6} width={lw} height={16} /><text x={mx} y={y + 14}>{label}</text>
            </g>
          );
        }
        const x = sx(g.at), a = sy(g.from), b = sy(g.to), my = (a + b) / 2;
        return (
          <g key={"g" + i} className="gap-label">
            <line y1={a} y2={b} x1={x} x2={x} /><line y1={a} y2={a} x1={x - 5} x2={x + 5} /><line y1={b} y2={b} x1={x - 5} x2={x + 5} />
            <rect x={x + 6} y={my - 8} width={lw} height={16} /><text x={x + 6 + lw / 2} y={my}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export default function Canvas(p: Props) {
  const { board, page, viewport: vp, setViewport, tool, spaceDown } = p;
  const updateCard = useBoards((s) => s.updateCard);
  const bringToFront = useBoards((s) => s.bringToFront);
  const moveCard = useBoards((s) => s.moveCard);
  const setCurrentPage = useBoards((s) => s.setCurrentPage);
  // find a card on any page
  const findCard = (id: string): { card: Card; page: Page; index: number } | null => {
    for (let i = 0; i < board.pages.length; i++) {
      const card = board.pages[i].cards.find((c) => c.id === id);
      if (card) return { card, page: board.pages[i], index: i };
    }
    return null;
  };
  const updateText = (id: string, text: string) => { const f = findCard(id); if (f) updateCard(board.id, f.page.id, id, { text }); };

  const gesture = useRef<Gesture | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [guides, setGuides] = useState<{ pageIdx: number; guides: Guide[]; gaps: GapMark[] } | null>(null);

  // where every card sits on the screen, as page-relative world boxes (heights come from the rendered content)
  const measure = (pageIdx: number): Record<string, Box> => {
    const el = p.containerRef.current;
    if (!el) return {};
    const rect = el.getBoundingClientRect();
    const off = pageOffset(board, pageIdx);
    const out: Record<string, Box> = {};
    el.querySelectorAll<HTMLElement>("[data-card-id]").forEach((n) => {
      const r = n.getBoundingClientRect();
      out[n.dataset.cardId!] = {
        x: (r.left - rect.left - vp.x) / vp.zoom - off.x, y: (r.top - rect.top - vp.y) / vp.zoom - off.y,
        w: r.width / vp.zoom, h: r.height / vp.zoom,
      };
    });
    return out;
  };

  // Wheel: pinch / ctrl+scroll zooms around the cursor, plain scroll pans (like Figma).
  // Needs a non-passive listener so we can preventDefault (stops browser page-zoom).
  useEffect(() => {
    const el = p.containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        // clamp so a mouse-wheel notch zooms gently while trackpad pinch stays smooth
        const d = Math.max(-50, Math.min(50, e.deltaY));
        setViewport((v) => {
          const z = clampZoom(v.zoom * Math.exp(-d * 0.008));
          const k = z / v.zoom;
          return { zoom: z, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
        });
      } else {
        setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [p.containerRef, setViewport]);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = p.containerRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - vp.x) / vp.zoom, y: (clientY - rect.top - vp.y) / vp.zoom };
  };

  const wantsPan = (e: React.PointerEvent) => tool === "hand" || spaceDown || e.button === 1;

  const startPan = (e: React.PointerEvent) => {
    gesture.current = { type: "pan", startX: e.clientX, startY: e.clientY, vx: vp.x, vy: vp.y };
    setPanning(true);
    p.containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    p.containerRef.current?.focus();
    if (wantsPan(e)) return startPan(e);
    if (tool === "text") {
      e.preventDefault(); // keep focus for the new text box
      const w = toWorld(e.clientX, e.clientY);
      p.onCreateText(w.x, w.y);
      return;
    }
    // start a selection box (shift keeps what's already selected)
    const rect = p.containerRef.current!.getBoundingClientRect();
    gesture.current = { type: "marquee", x0: e.clientX - rect.left, y0: e.clientY - rect.top, base: e.shiftKey ? p.selection : [] };
    p.containerRef.current?.setPointerCapture(e.pointerId);
    if (!e.shiftKey) p.setSelection([]);
    p.setEditingId(null);
  };

  const onCardDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (e.button === 2) return;
    if (wantsPan(e)) return startPan(e);
    const found = findCard(id);
    if (!found) return;
    const { page: cardPage } = found;
    if (p.editingId === id) return; // typing inside the text box
    if (cardPage.id !== page.id) setCurrentPage(board.id, cardPage.id);
    if (p.editingId) p.setEditingId(null);
    if (tool === "text") p.setTool("select");
    // shift-click adds or removes; clicking a card that's already selected drags the whole selection
    let sel = p.selection;
    let additive = false;
    if (e.shiftKey) {
      if (sel.includes(id)) { p.setSelection(sel.filter((x) => x !== id)); return; }
      sel = [...sel, id];
      additive = true;
    } else if (!sel.includes(id)) sel = [id];
    p.setSelection(sel);
    if (sel.length === 1) bringToFront(board.id, cardPage.id, id);
    const pageIdx = board.pages.findIndex((pg) => pg.id === cardPage.id);
    const boxes = measure(pageIdx);
    const items = sel.map((sid) => findCard(sid)).filter(Boolean).map((f) => ({ id: f!.card.id, x: f!.card.x, y: f!.card.y, w: f!.card.w, h: boxes[f!.card.id]?.h ?? 0 }));
    const others = cardPage.cards.filter((c) => !sel.includes(c.id) && boxes[c.id]).map((c) => boxes[c.id]);
    gesture.current = { type: "drag", id, startX: e.clientX, startY: e.clientY, items, moved: false, additive, pageIdx, others };
    p.containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onResizeDown = (e: React.PointerEvent, id: string) => {
    const found = findCard(id);
    if (!found) return;
    const { card } = found;
    gesture.current = { type: "resize", id, pageId: found.page.id, startX: e.clientX, x: card.x, y: card.y, w: card.w };
    p.containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.type === "pan") {
      setViewport((v) => ({ ...v, x: g.vx + (e.clientX - g.startX), y: g.vy + (e.clientY - g.startY) }));
    } else if (g.type === "drag") {
      let dx = (e.clientX - g.startX) / vp.zoom;
      let dy = (e.clientY - g.startY) / vp.zoom;
      if (Math.abs(dx) + Math.abs(dy) > 1) g.moved = true;
      // snap to other cards and the page (hold Cmd/Ctrl to move freely)
      if (g.moved && !e.metaKey && !e.ctrlKey && g.items.length) {
        const x0 = Math.min(...g.items.map((it) => it.x)) + dx, y0 = Math.min(...g.items.map((it) => it.y)) + dy;
        const x1 = Math.max(...g.items.map((it) => it.x + it.w)) + dx, y1 = Math.max(...g.items.map((it) => it.y + it.h)) + dy;
        const s = snapTo({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, g.others, board.frame, 6 / vp.zoom);
        dx += s.dx; dy += s.dy;
        setGuides(s.guides.length || s.gaps.length ? { pageIdx: g.pageIdx, guides: s.guides, gaps: s.gaps } : null);
      } else setGuides(null);
      const next: Live = {};
      for (const it of g.items) next[it.id] = { x: Math.round(it.x + dx), y: Math.round(it.y + dy), w: it.w };
      setLive(next);
    } else if (g.type === "resize") {
      const dw = (e.clientX - g.startX) / vp.zoom;
      setLive({ [g.id]: { x: g.x, y: g.y, w: Math.max(140, Math.round(g.w + dw)) } });
    } else if (g.type === "marquee") {
      const rect = p.containerRef.current!.getBoundingClientRect();
      const x1 = e.clientX - rect.left, y1 = e.clientY - rect.top;
      const b = { x: Math.min(g.x0, x1), y: Math.min(g.y0, y1), w: Math.abs(x1 - g.x0), h: Math.abs(y1 - g.y0) };
      setBox(b);
      // select every card the box touches (measured on screen, so card heights don't matter)
      const hit: string[] = [];
      p.containerRef.current!.querySelectorAll<HTMLElement>("[data-card-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left - rect.left, cy = r.top - rect.top;
        if (cx < b.x + b.w && cx + r.width > b.x && cy < b.y + b.h && cy + r.height > b.y) hit.push(el.dataset.cardId!);
      });
      p.setSelection(Array.from(new Set([...g.base, ...hit])));
    }
  };

  const onUp = () => {
    const g = gesture.current;
    gesture.current = null;
    setPanning(false);
    setBox(null);
    setGuides(null);
    if (g?.type === "drag" && !g.moved && !g.additive && p.selection.length > 1) p.setSelection([g.id]); // plain click inside a group: just that card
    if (live && g?.type === "resize") {
      const l = live[g.id];
      if (l) updateCard(board.id, g.pageId, g.id, { x: l.x, y: l.y, w: l.w });
    }
    if (live && g?.type === "drag" && g.moved) {
      for (const [id, l] of Object.entries(live)) {
        // dropped over another page? the card moves to that page (its position becomes relative to it)
        const f = findCard(id);
        if (!f) continue;
        const from = pageOffset(board, f.index);
        const centerX = from.x + l.x + f.card.w / 2;
        const to = pageIndexAt(board, centerX);
        if (to !== f.index) {
          const toOff = pageOffset(board, to);
          moveCard(board.id, f.page.id, board.pages[to].id, id, { x: l.x + from.x - toOff.x, y: l.y + from.y - toOff.y });
        } else {
          updateCard(board.id, f.page.id, id, { x: l.x, y: l.y });
        }
      }
    }
    setLive(null);
  };

  const cls = ["canvas", `tool-${tool}`, panning || spaceDown ? "panning" : ""].join(" ");

  return (
    <div
      ref={p.containerRef}
      className={cls}
      tabIndex={0}
      onPointerDown={onBackgroundDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="world" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
        {board.pages.map((pg, i) => {
          const off = pageOffset(board, i);
          return (
            <div key={pg.id} className={`page-group ${pg.id === page.id ? "current" : ""}`} style={{ transform: `translate(${off.x}px, ${off.y}px)` }}>
              <div className="frame" style={{ width: board.frame.w, height: board.frame.h }}>
                <button
                  className="frame-label"
                  style={{ transform: `scale(${1 / vp.zoom})` }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => p.onGoToPage(pg.id)}
                  title="Go to this page"
                >
                  {pg.name}<span>{board.frame.w} × {board.frame.h}</span>
                </button>
              </div>
              {pg.cards.map((c) => (
                <CardView
                  key={c.id}
                  card={c}
                  selected={p.selection.includes(c.id)}
                  editing={p.editingId === c.id}
                  live={live?.[c.id]}
                  onPointerDown={onCardDown}
                  onResizeDown={onResizeDown}
                  onDoubleClick={(id) => { if (c.kind === "text") p.setEditingId(id); }}
                  onTextChange={updateText}
                  onStopEditing={() => p.setEditingId(null)}
                />
              ))}
            </div>
          );
        })}
      </div>
      {box && <div className="marquee" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />}
      {guides && <GuideLayer {...guides} board={board} vp={vp} />}
    </div>
  );
}
