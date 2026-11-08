"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRESETS } from "@/lib/presets";
import { useBoards, useHydrated } from "@/lib/store";
import type { Board } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const boards = useBoards((s) => s.boards);
  const createBoard = useBoards((s) => s.createBoard);
  const deleteBoard = useBoards((s) => s.deleteBoard);

  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [name, setName] = useState("");
  const [w, setW] = useState(PRESETS[0].w);
  const [h, setH] = useState(PRESETS[0].h);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const pick = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    setPresetId(id);
    if (p) {
      setW(p.w);
      setH(p.h);
    }
  };

  const create = () => {
    const width = Math.max(100, Math.min(20000, Math.round(w || 0)));
    const height = Math.max(100, Math.min(20000, Math.round(h || 0)));
    const id = createBoard(name.trim() || "Untitled research", { w: width, h: height, preset: presetId });
    router.push(`/board/${id}`);
  };

  const list = hydrated ? Object.values(boards).sort((a, b) => b.updatedAt - a.updatedAt) : [];

  return (
    <main className="home">
      <div className="home-header">
        <div>
          <h1 className="home-title">Research Board</h1>
          <div className="muted">Search with AI, keep what matters, and lay it out on a canvas.</div>
        </div>
      </div>

      <h2>New board — pick a frame size</h2>
      <div className="preset-grid">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`preset ${presetId === p.id ? "selected" : ""}`}
            onClick={() => pick(p.id)}
          >
            <div className="preset-thumb"><Thumb w={p.w} h={p.h} /></div>
            <div>
              <div className="preset-name">{p.label}</div>
              <div className="preset-size">{p.group} · {p.w}×{p.h}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="new-bar">
        <div className="field grow">
          <span className="label">Board name</span>
          <input
            className="input"
            placeholder="e.g. Bus stations — sculpture references"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </div>
        <div className="field">
          <span className="label">Width</span>
          <input className="input" style={{ width: 96 }} type="number" value={w}
            onChange={(e) => { setW(Number(e.target.value)); setPresetId("custom"); }} />
        </div>
        <div className="field">
          <span className="label">Height</span>
          <input className="input" style={{ width: 96 }} type="number" value={h}
            onChange={(e) => { setH(Number(e.target.value)); setPresetId("custom"); }} />
        </div>
        <button className="btn primary" style={{ height: 32 }} onClick={create}>Create board</button>
      </div>

      <h2>Your boards</h2>
      {!hydrated ? null : list.length === 0 ? (
        <div className="empty">No boards yet. Pick a size above to start.</div>
      ) : (
        <div className="board-grid">
          {list.map((b) => (
            <div key={b.id} className="board-tile" onClick={() => router.push(`/board/${b.id}`)}>
              <div className="board-tile-thumb"><BoardThumb board={b} /></div>
              <div className="board-tile-meta">
                <div className="board-tile-name">{b.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {b.cards.length} item{b.cards.length === 1 ? "" : "s"} · {b.frame.w}×{b.frame.h} · edited {timeAgo(b.updatedAt)}
                </div>
              </div>
              <button
                className="btn small del"
                style={confirmDel === b.id ? { color: "var(--danger)", borderColor: "var(--danger)", opacity: 1 } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirmDel === b.id) deleteBoard(b.id);
                  else { setConfirmDel(b.id); setTimeout(() => setConfirmDel(null), 3000); }
                }}
              >
                {confirmDel === b.id ? "Click to delete" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Thumb({ w, h }: { w: number; h: number }) {
  const max = 56;
  const s = max / Math.max(w, h);
  return <div style={{ width: w * s, height: h * s }} />;
}

// tiny preview of a board: frame + card rectangles
function BoardThumb({ board }: { board: Board }) {
  const { frame, cards } = board;
  let minX = 0, minY = 0, maxX = frame.w, maxY = frame.h;
  for (const c of cards) {
    const sc = c.scale ?? 1;
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w * sc); maxY = Math.max(maxY, c.y + 240 * sc);
  }
  const W = maxX - minX, H = maxY - minY;
  const s = Math.min(200 / W, 110 / H);
  return (
    <div style={{ position: "relative", width: W * s, height: H * s }}>
      <div style={{ position: "absolute", left: -minX * s, top: -minY * s, width: frame.w * s, height: frame.h * s, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }} />
      {cards.map((c) => (
        <div key={c.id} style={{
          position: "absolute", left: (c.x - minX) * s, top: (c.y - minY) * s, width: c.w * (c.scale ?? 1) * s,
          height: (c.kind === "note" ? 90 : c.kind === "link" ? 70 : 220) * (c.scale ?? 1) * s,
          background: c.kind === "note" ? c.color : "#d6d3d1", borderRadius: 2,
        }} />
      ))}
    </div>
  );
}

function timeAgo(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}
