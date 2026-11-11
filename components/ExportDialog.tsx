"use client";

// Export / print pages. Renders the chosen pages into a print-only layer and opens the browser's
// print dialog, where you can print or "Save as PDF". Optionally adds a sources page (bibliography).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CardView from "./CardView";
import { IconClose, IconPrint } from "./Icons";
import { CITE_STYLES, collectCitations, formatCitation, type CiteStyle } from "@/lib/citation";
import type { Board, Page } from "@/lib/types";

type Paper = "frame" | "letter" | "a4";
const PAPERS: { id: Paper; label: string; note: string }[] = [
  { id: "frame", label: "Same as the page", note: "Exact page shape. Best for PDFs." },
  { id: "letter", label: "Letter", note: "8.5 × 11 in, for printing (US)" },
  { id: "a4", label: "A4", note: "210 × 297 mm, for printing" },
];
const PAPER_IN: Record<Exclude<Paper, "frame">, [number, number]> = { letter: [8.5, 11], a4: [8.27, 11.69] };
const MARGIN_IN = 0.4, PX = 96;
const noop = () => {};

type Props = { board: Board; page: Page; citeStyle: CiteStyle; onClose: () => void };

export default function ExportDialog({ board, page, citeStyle, onClose }: Props) {
  const [chosen, setChosen] = useState<Set<string>>(new Set([page.id]));
  const [paper, setPaper] = useState<Paper>("frame");
  const [names, setNames] = useState(false);
  const [sources, setSources] = useState(false);
  const [style, setStyle] = useState<CiteStyle>(citeStyle);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !printing) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, printing]);

  const pages = board.pages.filter((p) => chosen.has(p.id));
  const all = chosen.size === board.pages.length;
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const cites = pages.flatMap((p) => collectCitations(p.cards)).map((c) => formatCitation(c.cite, style));
  const bibliography = Array.from(new Set(cites)).sort((a, b) => a.localeCompare(b));

  // sheet geometry, in CSS px
  const { w: FW, h: FH } = board.frame;
  const landscape = FW >= FH;
  let sheetW = FW, sheetH = FH, pageCss = `size: ${FW}px ${FH}px; margin: 0;`;
  if (paper !== "frame") {
    const [a, b] = PAPER_IN[paper];
    const [pw, ph] = landscape ? [b, a] : [a, b];
    pageCss = `size: ${pw}in ${ph}in; margin: ${MARGIN_IN}in;`;
    sheetW = (pw - 2 * MARGIN_IN) * PX;
    sheetH = (ph - 2 * MARGIN_IN) * PX - 2; // a hair less, so rounding never spills onto a blank page
  }
  const label = names ? (paper === "frame" ? 0 : 28) : 0;
  const scale = Math.min(sheetW / FW, (sheetH - label) / FH);

  const print = () => {
    if (!pages.length) return;
    setPrinting(true);
  };

  // once the print layer is on the page: wait for images, then open the print dialog
  useEffect(() => {
    if (!printing) return;
    const style = document.createElement("style");
    style.textContent = `@page { ${pageCss} }`;
    document.head.appendChild(style);
    let done = false;
    const finish = () => { if (done) return; done = true; style.remove(); setPrinting(false); };
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".print-root img"));
    const ready = Promise.all(imgs.map((im) => im.complete ? Promise.resolve() : new Promise<void>((r) => { im.onload = im.onerror = () => r(); })));
    const timeout = new Promise((r) => setTimeout(r, 8000)); // don't wait forever on a slow image
    Promise.race([ready, timeout]).then(() => document.fonts?.ready).then(() => {
      window.addEventListener("afterprint", finish, { once: true });
      window.print();
      setTimeout(finish, 1500); // some browsers don’t fire afterprint (print() blocks until the dialog closes)
    });
    return () => { style.remove(); };
  }, [printing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget && !printing) onClose(); }}>
        <div className="modal export-modal" role="dialog" aria-label="Export or print">
          <div className="modal-head">
            <div className="t"><IconPrint size={19} /> Export or print</div>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
          </div>
          <div className="modal-body">
            <div className="ex-label">
              Pages
              <button className="ex-link" onClick={() => setChosen(all ? new Set([page.id]) : new Set(board.pages.map((p) => p.id)))}>
                {all ? "Just this page" : `All ${board.pages.length}`}
              </button>
            </div>
            <div className="ex-pages">
              {board.pages.map((p) => (
                <label key={p.id} className={`ex-page ${chosen.has(p.id) ? "on" : ""}`}>
                  <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} />
                  <span>{p.name}</span>
                  <span className="muted">{p.cards.length ? `${p.cards.length} item${p.cards.length === 1 ? "" : "s"}` : "empty"}</span>
                </label>
              ))}
            </div>

            <div className="ex-label">Paper</div>
            <div className="ex-papers">
              {PAPERS.map((x) => (
                <label key={x.id} className={`ca-model ${paper === x.id ? "on" : ""}`}>
                  <input type="radio" name="ex-paper" checked={paper === x.id} onChange={() => setPaper(x.id)} />
                  <span><b>{x.label}</b><span className="muted">{x.note}</span></span>
                </label>
              ))}
            </div>

            <div className="ex-label">Extras</div>
            <label className="ex-check"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} disabled={paper === "frame"} /> Page names above each page {paper === "frame" && <span className="muted">(paper sizes only)</span>}</label>
            <label className="ex-check">
              <input type="checkbox" checked={sources} onChange={(e) => setSources(e.target.checked)} /> Add a sources page
              {sources && (
                <select className="input sm" style={{ width: "auto", marginLeft: 8 }} value={style} onChange={(e) => setStyle(e.target.value as CiteStyle)}>
                  {CITE_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              )}
              {sources && <span className="muted" style={{ marginLeft: 6 }}>{bibliography.length} source{bibliography.length === 1 ? "" : "s"}</span>}
            </label>
          </div>
          <div className="modal-foot">
            <div className="muted" style={{ fontSize: 11.5, flex: 1 }}>To make a PDF, pick <b>Save as PDF</b> as the printer in the next window.</div>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!pages.length || printing} onClick={print}>
              {printing ? <><span className="spinner" /> Preparing…</> : `Print / Save PDF${pages.length > 1 ? ` (${pages.length} pages)` : ""}`}
            </button>
          </div>
        </div>
      </div>

      {printing && createPortal(
        <div className="print-root">
          {pages.map((p) => (
            <section key={p.id} className="print-sheet" style={{ width: sheetW, height: sheetH }}>
              <div>
              {label > 0 && <div className="print-name" style={{ height: label }}>{p.name}</div>}
              <div className={paper === "frame" ? "" : "print-edge"} style={{ width: FW * scale, height: FH * scale }}>
                <div className="print-frame" style={{ width: FW, height: FH, transform: `scale(${scale})` }}>
                  {p.cards.map((c) => (
                    <CardView key={c.id} card={c} selected={false} editing={false}
                      onPointerDown={noop} onResizeDown={noop} onDoubleClick={noop} onTextChange={noop} onStopEditing={noop} />
                  ))}
                </div>
              </div>
              </div>
            </section>
          ))}
          {sources && bibliography.length > 0 && (
            <section className="print-sheet print-sources" style={{ width: sheetW, minHeight: sheetH, fontSize: Math.max(11, sheetW / 70) }}>
              <h1>Sources</h1>
              {bibliography.map((b, i) => <p key={i}>{b}</p>)}
            </section>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
