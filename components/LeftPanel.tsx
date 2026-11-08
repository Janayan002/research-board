"use client";

import { IconFrame, IconImage, IconLink, IconNote, IconPerson, IconTrash, IconExternal } from "./Icons";
import { hostOf } from "./CardView";
import { NOTE_COLORS } from "@/lib/presets";
import { useBoards } from "@/lib/store";
import type { Board, Card } from "@/lib/types";

export function cardTitle(c: Card): string {
  switch (c.kind) {
    case "note": return c.text.split("\n")[0].slice(0, 60) || "Empty note";
    case "link": return c.title || hostOf(c.url);
    case "image": return c.caption || (c.src.startsWith("data:") ? "Pasted image" : hostOf(c.sourceUrl || c.src));
    case "artist": return c.name;
  }
}

const ICONS = { note: IconNote, link: IconLink, image: IconImage, artist: IconPerson };

type Props = {
  board: Board;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFit: () => void;
};

export default function LeftPanel({ board, selectedId, onSelect, onFit }: Props) {
  const updateCard = useBoards((s) => s.updateCard);
  const removeCard = useBoards((s) => s.removeCard);
  const sel = board.cards.find((c) => c.id === selectedId) || null;
  const layers = [...board.cards].reverse(); // top-most first, like Figma

  return (
    <aside className="left-panel">
      <div className="panel-section" style={{ paddingBottom: 8 }}>
        <div className="label">Layers</div>
      </div>
      <div className="panel-scroll">
        <div className="layer" onClick={onFit} title="Zoom to frame">
          <span className="layer-icon"><IconFrame size={13} /></span>
          <span className="layer-name">Frame · {board.frame.w}×{board.frame.h}</span>
        </div>
        {layers.length === 0 && (
          <div className="muted" style={{ padding: "10px 8px", lineHeight: 1.5 }}>
            Nothing here yet. Add notes from the toolbar, paste a link or image, or use Research on the right.
          </div>
        )}
        {layers.map((c) => {
          const I = ICONS[c.kind];
          return (
            <div key={c.id} className={`layer ${c.id === selectedId ? "selected" : ""}`} onClick={() => onSelect(c.id)}>
              <span className="layer-icon"><I size={13} /></span>
              <span className="layer-name">{cardTitle(c)}</span>
            </div>
          );
        })}
      </div>

      {sel && (
        <div className="panel-section" style={{ borderTop: "1px solid var(--line)", borderBottom: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="label">Selected · {sel.kind}</div>
          {sel.kind === "note" && (
            <div className="color-row">
              {NOTE_COLORS.map((col) => (
                <div key={col} className={`swatch ${sel.color === col ? "on" : ""}`} style={{ background: col }}
                  onClick={() => updateCard(board.id, sel.id, { color: col })} />
              ))}
            </div>
          )}
          {sel.kind === "image" && (
            <input className="input" placeholder="Caption" value={sel.caption || ""}
              onChange={(e) => updateCard(board.id, sel.id, { caption: e.target.value })} />
          )}
          {sel.kind === "link" && (
            <input className="input" placeholder="Title" value={sel.title}
              onChange={(e) => updateCard(board.id, sel.id, { title: e.target.value })} />
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 11, width: 34 }}>Size</span>
            <button className="btn small" onClick={() => updateCard(board.id, sel.id, { scale: Math.max(0.25, (sel.scale ?? 1) / 1.25) })}>−</button>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, width: 38, textAlign: "center" }}>{Math.round((sel.scale ?? 1) * 100)}%</span>
            <button className="btn small" onClick={() => updateCard(board.id, sel.id, { scale: Math.min(8, (sel.scale ?? 1) * 1.25) })}>+</button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(sel.kind === "link" || (sel.kind === "artist" && sel.website)) && (
              <a className="btn small" href={sel.kind === "link" ? sel.url : sel.kind === "artist" ? sel.website : "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <IconExternal size={12} /> Open
              </a>
            )}
            <button className="btn small" onClick={() => removeCard(board.id, sel.id)}>
              <IconTrash size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
