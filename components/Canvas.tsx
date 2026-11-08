"use client";

// The infinite canvas: pan, zoom, the frame, and draggable/resizable cards.
// World coordinates = frame pixels. Screen = world * zoom + offset.

import { useEffect, useRef, useState } from "react";
import CardView from "./CardView";
import { useBoards } from "@/lib/store";
import type { Board, Page, Viewport } from "@/lib/types";

export type Tool = "select" | "hand" | "note";

type Props = {
  board: Board;
  page: Page;
  viewport: Viewport;
  setViewport: (v: Viewport | ((v: Viewport) => Viewport)) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  spaceDown: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onCreateNote: (worldX: number, worldY: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

type Gesture =
  | { type: "pan"; startX: number; startY: number; vx: number; vy: number }
  | { type: "drag"; id: string; startX: number; startY: number; cx: number; cy: number; w: number; moved: boolean }
  | { type: "resize"; id: string; startX: number; x: number; y: number; w: number };

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export default function Canvas(p: Props) {
  const { board, page, viewport: vp, setViewport, tool, spaceDown } = p;
  const updateCard = useBoards((s) => s.updateCard);
  const bringToFront = useBoards((s) => s.bringToFront);
  const updateText = (id: string, text: string) => updateCard(board.id, page.id, id, { text });

  const gesture = useRef<Gesture | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number; w: number } | null>(null);
  const [panning, setPanning] = useState(false);

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
    if (tool === "note") {
      e.preventDefault(); // keep focus for the new note's text box
      const w = toWorld(e.clientX, e.clientY);
      p.onCreateNote(w.x, w.y);
      return;
    }
    p.setSelectedId(null);
    p.setEditingId(null);
  };

  const onCardDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (e.button === 2) return;
    if (wantsPan(e)) return startPan(e);
    const card = page.cards.find((c) => c.id === id);
    if (!card) return;
    if (p.editingId === id) return; // typing inside the note
    p.setSelectedId(id);
    if (p.editingId) p.setEditingId(null);
    if (tool === "note") p.setTool("select");
    bringToFront(board.id, page.id, id);
    gesture.current = { type: "drag", id, startX: e.clientX, startY: e.clientY, cx: card.x, cy: card.y, w: card.w, moved: false };
    p.containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onResizeDown = (e: React.PointerEvent, id: string) => {
    const card = page.cards.find((c) => c.id === id);
    if (!card) return;
    gesture.current = { type: "resize", id, startX: e.clientX, x: card.x, y: card.y, w: card.w };
    p.containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.type === "pan") {
      setViewport((v) => ({ ...v, x: g.vx + (e.clientX - g.startX), y: g.vy + (e.clientY - g.startY) }));
    } else if (g.type === "drag") {
      const dx = (e.clientX - g.startX) / vp.zoom;
      const dy = (e.clientY - g.startY) / vp.zoom;
      if (Math.abs(dx) + Math.abs(dy) > 1) g.moved = true;
      setLive({ id: g.id, x: Math.round(g.cx + dx), y: Math.round(g.cy + dy), w: g.w });
    } else if (g.type === "resize") {
      const sc = page.cards.find((c) => c.id === g.id)?.scale ?? 1;
      const dw = (e.clientX - g.startX) / vp.zoom / sc;
      setLive({ id: g.id, x: g.x, y: g.y, w: Math.max(140, Math.round(g.w + dw)) });
    }
  };

  const onUp = () => {
    const g = gesture.current;
    gesture.current = null;
    setPanning(false);
    if (live && g && g.type !== "pan") {
      updateCard(board.id, page.id, live.id, { x: live.x, y: live.y, w: live.w });
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
        <div className="frame" style={{ width: board.frame.w, height: board.frame.h }}>
          <div className="frame-label" style={{ transform: `scale(${1 / vp.zoom})` }}>
            {page.name}<span>{board.frame.w} × {board.frame.h}</span>
          </div>
        </div>
        {page.cards.map((c) => (
          <CardView
            key={c.id}
            card={c}
            selected={p.selectedId === c.id}
            editing={p.editingId === c.id}
            live={live?.id === c.id ? live : undefined}
            onPointerDown={onCardDown}
            onResizeDown={onResizeDown}
            onDoubleClick={(id) => { if (c.kind === "note") p.setEditingId(id); }}
            onTextChange={updateText}
            onStopEditing={() => p.setEditingId(null)}
          />
        ))}
      </div>
    </div>
  );
}
