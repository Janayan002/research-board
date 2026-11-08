"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, Citation } from "@/lib/types";
import { creditLine } from "@/lib/citation";
import { researchType } from "@/lib/researchTypes";
import { RESEARCH_ICONS } from "./Icons";

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

type Props = {
  card: Card;
  selected: boolean;
  editing: boolean;
  // position/size overrides while dragging or resizing (committed on pointer up)
  live?: { x: number; y: number; w: number };
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onResizeDown: (e: React.PointerEvent, id: string) => void;
  onDoubleClick: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onStopEditing: () => void;
};

export function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default function CardView(p: Props) {
  const { card, selected, editing, live } = p;
  const x = live?.x ?? card.x;
  const y = live?.y ?? card.y;
  const w = live?.w ?? card.w;

  const scale = card.scale ?? 1;
  const style: React.CSSProperties = {
    left: x, top: y, width: w,
    background: card.kind === "note" ? card.color : undefined,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: "0 0",
  };

  return (
    <div
      className={`card card-${card.kind} ${selected ? "selected" : ""}`}
      style={style}
      data-card-id={card.id}
      onPointerDown={(e) => p.onPointerDown(e, card.id)}
      onDoubleClick={(e) => { e.stopPropagation(); p.onDoubleClick(card.id); }}
    >
      {card.kind === "note" && (editing
        ? <NoteEditor text={card.text} onChange={(t) => p.onTextChange(card.id, t)} onDone={p.onStopEditing} />
        : card.text ? card.text : <span className="placeholder">Double-click to write</span>)}

      {card.kind === "link" && (
        <>
          <div className="host">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://www.google.com/s2/favicons?domain=${hostOf(card.url)}&sz=32`} alt="" />
            {hostOf(card.url)}
          </div>
          <div className="t">{card.title || hostOf(card.url)}</div>
          <a href={card.url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>{card.url}</a>
        </>
      )}

      {card.kind === "image" && <ImageBody src={card.src} caption={card.caption} cite={card.cite} sourceUrl={card.sourceUrl} showCredit={card.showCredit !== false} />}

      {card.kind === "research" && (
        <>
          {card.image && <HeroImage src={card.image} />}
          <div className="body">
            <div className="tag">{(() => { const I = RESEARCH_ICONS[card.category] ?? RESEARCH_ICONS.any; return <I size={14} />; })()} {capitalize(researchType(card.category).singular)}</div>
            <h3>{card.name}</h3>
            {card.subtitle && <div className="sub">{card.subtitle}</div>}
            {card.website && (
              <a className="site" href={card.website} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>
                {hostOf(card.website)}
              </a>
            )}
            {card.sections.map((s, i) => (
              <div className="sec" key={i}>
                <div className="label">{s.label}</div>
                <p>{s.text}</p>
              </div>
            ))}
            {card.sources.length > 0 && (
              <div className="srcs">
                <div className="label">Sources</div>
                {card.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.url} onPointerDown={(e) => e.stopPropagation()}>
                    {s.title || hostOf(s.url)}
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="resize" onPointerDown={(e) => { e.stopPropagation(); p.onResizeDown(e, card.id); }} />
    </div>
  );
}

function NoteEditor({ text, onChange, onDone }: { text: string; onChange: (t: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  };
  useEffect(() => {
    const focus = () => {
      const el = ref.current;
      if (!el || document.activeElement === el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    };
    focus();
    grow();
    // check again next frame in case the click that created the note moved focus
    const raf = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <textarea
      ref={ref}
      value={text}
      placeholder="Write a note…"
      onChange={(e) => { onChange(e.target.value); grow(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={onDone}
      onKeyDown={(e) => { if (e.key === "Escape") onDone(); e.stopPropagation(); }}
      rows={1}
    />
  );
}

function ImageBody({ src, caption, cite, sourceUrl, showCredit }: { src: string; caption?: string; cite?: Citation; sourceUrl?: string; showCredit: boolean }) {
  const [broken, setBroken] = useState(false);
  const link = cite?.pageUrl || sourceUrl;
  const credit = creditLine(cite) || (link ? hostOf(link) : "");
  return (
    <>
      {broken
        ? <div className="broken">Image couldn’t load<br />{src.startsWith("data:") ? "" : src}</div>
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={src} alt={caption || cite?.title || ""} onError={() => setBroken(true)} draggable={false} referrerPolicy="no-referrer" />}
      {caption && <div className="cap">{caption}</div>}
      {showCredit && credit && (
        <div className="credit">
          {link
            ? <a href={link} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>{credit}</a>
            : credit}
        </div>
      )}
    </>
  );
}

function HeroImage({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="hero" src={src} alt="" onError={() => setBroken(true)} draggable={false} referrerPolicy="no-referrer" />;
}
