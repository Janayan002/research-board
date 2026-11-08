"use client";

// Web page preview next to the board.
// "Live page" shows the real site in a frame (when the site allows it);
// "Reader" shows a clean version where you can click images to add them to the board.

import { useEffect, useRef, useState } from "react";
import { IconBack, IconClose, IconExternal, IconImage, IconPlus } from "./Icons";
import { usePreview } from "@/lib/preview";
import type { Citation } from "@/lib/types";
import type { PickedImage } from "./ImagePicker";

type Reader = {
  url: string; title?: string; siteName?: string; byline?: string; author?: string; published?: string;
  html: string; images: { src: string; alt?: string }[]; embeddable: boolean;
};

type Props = {
  width: number;
  setWidth: (w: number) => void;
  right: number; // space taken by the search panel
  onAddLink: (url: string) => void;
  onAddImages: (images: PickedImage[]) => void;
  onFindImages: (urls: string[], title: string) => void;
};

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const today = () => new Date().toISOString().slice(0, 10);

export default function PreviewPane({ width, setWidth, right, onAddLink, onAddImages, onFindImages }: Props) {
  const { url, open, close } = usePreview();
  const [history, setHistory] = useState<string[]>([]); // pages opened from links inside the reader
  const [data, setData] = useState<Reader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "reader">("live");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const dragging = useRef<{ x: number; w: number } | null>(null);

  // load reader data (also tells us if the live page can be embedded)
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/reader?url=${encodeURIComponent(url)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn’t load this page.");
        if (cancelled) return;
        setData(d);
        setMode(d.embeddable ? "live" : "reader");
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setMode("live"); } });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof Element && e.target.closest("input, textarea"))) close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [close]);

  if (!url) return null;

  const cite = (img?: { src: string; alt?: string }): Citation => ({
    title: img?.alt || data?.title,
    creator: data?.byline || data?.author,
    siteName: data?.siteName || host(data?.url || url),
    pageUrl: data?.url || url,
    imageUrl: img?.src,
    published: data?.published,
    accessed: today(),
  });

  const addImage = (src: string, alt?: string) => {
    onAddImages([{ src, cite: cite({ src, alt }) }]);
    setAdded((s) => new Set(s).add(src));
  };

  // clicks inside the reader: images go to the board, links open in this pane
  const onReaderClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const img = t.closest("img");
    if (img) {
      e.preventDefault();
      addImage(img.getAttribute("src")!, img.getAttribute("alt") || undefined);
      img.classList.add("added");
      return;
    }
    const a = t.closest("a");
    if (a && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      const href = a.getAttribute("href");
      if (href) { setHistory((h) => [...h, url]); open(href); }
    }
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    open(prev);
  };

  // drag the left edge to resize
  const onResizeDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX, w: width };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const max = Math.max(420, window.innerWidth - right - 420);
    setWidth(Math.round(Math.min(max, Math.max(360, dragging.current.w + (dragging.current.x - e.clientX)))));
  };

  const title = data?.title || host(url);

  return (
    <aside className="preview" style={{ right, width }} aria-label="Web page preview">
      <div className="pv-resize" onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={() => (dragging.current = null)} />
      <div className="pv-head">
        {history.length > 0 && <button className="icon-btn" onClick={goBack} aria-label="Back" title="Back"><IconBack size={16} /></button>}
        <div className="pv-title">
          <div className="pv-t" title={title}>{title}</div>
          <div className="pv-site">{data?.siteName || host(url)}</div>
        </div>
        <button className="icon-btn" onClick={close} aria-label="Close preview" title="Close  Esc"><IconClose size={16} /></button>
      </div>
      <div className="pv-bar">
        <div className="pv-seg" role="tablist">
          <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>Live page</button>
          <button className={mode === "reader" ? "on" : ""} onClick={() => setMode("reader")} disabled={!data && !error}>Reader</button>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn small ghost" onClick={() => onFindImages([url], `Images from ${data?.siteName || host(url)}`)} title="Pick images from this page"><IconImage size={13} /> Images</button>
        <button className="btn small" onClick={() => onAddLink(data?.url || url)}><IconPlus size={13} /> Add link</button>
        <a className="btn small" href={url} target="_blank" rel="noreferrer" title="Open in your browser"><IconExternal size={13} /> Open</a>
      </div>

      <div className="pv-body">
        {mode === "live" && (
          <>
            {data && !data.embeddable && (
              <div className="pv-note">This site doesn’t allow being shown inside other apps. Use <b>Reader</b> or open it in your browser.</div>
            )}
            {(!data || data.embeddable) && (
              <iframe
                key={url}
                src={url}
                title={title}
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            )}
          </>
        )}

        {mode === "reader" && (
          <div className="reader-scroll">
            {!data && !error && <div className="muted" style={{ padding: 20 }}><span className="spinner" /> Loading…</div>}
            {error && <div className="error-banner" style={{ margin: 16 }}>{error}</div>}
            {data && (
              <article className="reader" onClick={onReaderClick}>
                <div className="reader-hint">Click any image to add it to your board with its citation.</div>
                <h1>{data.title}</h1>
                <div className="reader-meta">
                  {[data.byline || data.author, data.siteName || host(data.url), data.published].filter(Boolean).join(", ")}
                </div>
                <div className="reader-content" dangerouslySetInnerHTML={{ __html: data.html }} />
                {added.size > 0 && <div className="reader-added">{added.size} image{added.size === 1 ? "" : "s"} added to your board</div>}
              </article>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
