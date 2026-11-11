"use client";

// Web page preview next to the board.
// "Live page" shows the real site in a frame (when the site allows it);
// "Reader" shows a clean version where you can click images to add them to the board.

import { useEffect, useRef, useState } from "react";
import { IconBack, IconClose, IconForward, IconExternal, IconImage, IconPlus } from "./Icons";
import { opensInBrowser, usePreview } from "@/lib/preview";
import type { Citation } from "@/lib/types";
import type { PickedImage } from "./ImagePicker";

type Reader = {
  url: string; title?: string; siteName?: string; byline?: string; author?: string; published?: string;
  html: string; images: { src: string; alt?: string }[]; embeddable: boolean;
};

type Props = {
  width: number;
  setWidth: (w: number) => void;
  onBackToSearch: () => void; // back from the first page: close the preview and show search
  onAddLink: (url: string) => void;
  onAddImages: (images: PickedImage[]) => void;
  onFindImages: (urls: string[], title: string) => void;
};

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const today = () => new Date().toLocaleDateString("en-CA");

export default function PreviewPane({ width, setWidth, onBackToSearch, onAddLink, onAddImages, onFindImages }: Props) {
  const { url, open, close } = usePreview();
  // Back / forward like a browser. Pages opened from outside (search results, cards) start fresh,
  // so Back from the first page returns to search.
  const [history, setHistory] = useState<string[]>([]);
  const [forward, setForward] = useState<string[]>([]);
  const internalNav = useRef(false);
  useEffect(() => {
    if (!internalNav.current) { setHistory([]); setForward([]); }
    internalNav.current = false;
  }, [url]);
  const [data, setData] = useState<Reader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "reader">("live");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const dragging = useRef<{ x: number; w: number } | null>(null);
  // "Live page" normally loads the site through Tack (/api/live), so Tack sees every click and
  // Reader / Images / Add link follow you. If a site looks broken that way, "Original" shows the real
  // site in a plain frame instead (remembered per site) — but then the browser hides your clicks.
  const [originalHosts, setOriginalHosts] = useState<string[]>([]);
  useEffect(() => { try { setOriginalHosts(JSON.parse(localStorage.getItem("live-original") || "[]")); } catch {} }, []);
  const original = url ? originalHosts.includes(host(url)) : false;
  const setOriginal = (on: boolean) => {
    if (!url) return;
    const h = host(url);
    const next = on ? [...originalHosts.filter((x) => x !== h), h] : originalHosts.filter((x) => x !== h);
    setOriginalHosts(next);
    try { localStorage.setItem("live-original", JSON.stringify(next.slice(-200))); } catch {}
  };
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const navigateRef = useRef<(u: string) => void>(() => {}); // set below, after navigate() is defined
  const [frameUrl, setFrameUrl] = useState<string | null>(null); // what the frame shows (a site may change the address without reloading)
  const softNav = useRef(false);
  // in "Original" mode we can only tell that the frame moved (it loads again), and say so
  const frameLoads = useRef(0);
  const [liveMoved, setLiveMoved] = useState(false);
  const [addr, setAddr] = useState("");
  useEffect(() => {
    frameLoads.current = 0; setLiveMoved(false); setAddr(url || "");
    if (!softNav.current) setFrameUrl(url);
    softNav.current = false;
  }, [url]);

  // messages from the page loaded through Tack
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow || e.data?.source !== "tack-live") return;
      const u = typeof e.data.url === "string" && /^https?:\/\//.test(e.data.url) ? e.data.url : null;
      if (!u) return;
      if (e.data.type === "navigate") navigateRef.current(u);
      if (e.data.type === "page") { softNav.current = true; navigateRef.current(u); } // address changed, page didn't reload
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof Element && e.target.closest("input, textarea"))) close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [close]);

  // if a sharpened image URL won't load, switch back to the one the page used
  const articleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      const fb = img.dataset.fallback;
      if (fb && img.getAttribute("src") !== fb) { img.setAttribute("src", fb); delete img.dataset.fallback; }
    };
    el.addEventListener("error", onError, true); // error doesn't bubble, so listen while it travels down
    return () => el.removeEventListener("error", onError, true);
  }, [data, mode, url]);

  // (all hooks must run before this early return, every render)
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

  const addImage = (src: string, alt?: string, fallback?: string) => {
    onAddImages([{ src, fallback, cite: cite({ src, alt }) }]);
    setAdded((s) => new Set(s).add(src));
  };

  // clicks inside the reader: images go to the board, links open in this pane
  const onReaderClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const img = t.closest("img");
    if (img) {
      e.preventDefault();
      addImage(img.getAttribute("src")!, img.getAttribute("alt") || undefined, img.dataset.fallback);
      img.classList.add("added");
      return;
    }
    const a = t.closest("a");
    if (a && !(e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      const href = a.getAttribute("href");
      if (href) navigate(href);
    }
  };

  const go = (raw: string) => {
    let u = raw.trim();
    if (!u || !url) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { new URL(u); } catch { return; }
    if (u === url) { setLiveMoved(false); return; }
    navigate(u);
  };

  // go to a new page inside the pane (clears Forward, like a browser)
  navigateRef.current = (u: string) => navigate(u);
  function navigate(u: string) {
    if (!url) return;
    if (opensInBrowser(u)) { open(u); return; } // opens a new tab; this page stays
    internalNav.current = true;
    setHistory((h) => [...h, url]);
    setForward([]);
    open(u);
  }

  // dragging an image out of the reader: carry its citation so the board can keep it
  const onReaderDragStart = (e: React.DragEvent) => {
    const img = (e.target as HTMLElement).closest?.("img");
    if (!img) return;
    const src = img.getAttribute("src")!;
    const payload = { src, fallback: img.dataset.fallback, cite: cite({ src, alt: img.getAttribute("alt") || undefined }) };
    e.dataTransfer.setData("application/x-tack-image", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) { onBackToSearch(); return; }
    internalNav.current = true;
    setHistory((h) => h.slice(0, -1));
    setForward((f) => [url, ...f]);
    open(prev);
  };

  const goForward = () => {
    const next = forward[0];
    if (!next) return;
    internalNav.current = true;
    setForward((f) => f.slice(1));
    setHistory((h) => [...h, url]);
    open(next);
  };

  // drag the left edge to resize
  const onResizeDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX, w: width };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const max = Math.max(420, window.innerWidth - 420);
    setWidth(Math.round(Math.min(max, Math.max(372, dragging.current.w + (dragging.current.x - e.clientX)))));
  };

  const title = data?.title || host(url);

  return (
    <aside className="preview" style={{ right: 0, width }} aria-label="Web page preview">
      <div className="pv-resize" onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={() => (dragging.current = null)} />
      <form className="pv-nav" onSubmit={(e) => { e.preventDefault(); go(addr); }}>
        <button type="button" className="icon-btn" onClick={goBack} aria-label={history.length ? "Back" : "Back to search"}
          title={history.length ? "Back" : "Back to search"}><IconBack size={16} /></button>
        <button type="button" className="icon-btn" onClick={goForward} disabled={!forward.length} aria-label="Forward" title="Forward"><IconForward size={16} /></button>
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.stopPropagation()}
          spellCheck={false}
          aria-label="Page address"
          placeholder="Paste a page link"
        />
        <button type="button" className="icon-btn" onClick={close} aria-label="Close preview" title="Close  Esc"><IconClose size={16} /></button>
      </form>
      <div className="pv-head">
        <div className="pv-title">
          <div className="pv-t" title={title}>{title}</div>
          <div className="pv-site">{data?.siteName || host(url)}</div>
        </div>
      </div>
      <div className="pv-bar">
        <div className="pv-seg" role="tablist">
          <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>Live page</button>
          <button className={mode === "reader" ? "on" : ""} onClick={() => setMode("reader")} disabled={!data && !error}>Reader</button>
        </div>
        {/* in a narrow pane these move to their own row instead of squeezing the Live page / Reader switch */}
        <div className="pv-actions">
          <button className="btn small ghost" onClick={() => onFindImages([url], `Images from ${data?.siteName || host(url)}`)} title="Pick images from this page"><IconImage size={13} /> Images</button>
          <button className="btn small" onClick={() => onAddLink(data?.url || url)}><IconPlus size={13} /> Add link</button>
          <a className="btn small" href={url} target="_blank" rel="noreferrer" title="Open in your browser"><IconExternal size={13} /> Open</a>
        </div>
      </div>

      <div className="pv-body">
        {mode === "live" && (
          <>
            <button className="pv-hint" onClick={() => setMode("reader")}>
              <IconImage size={14} /> <span>Switch to <b>Reader</b> to drag images onto your board</span>
            </button>
            {original && data && !data.embeddable && (
              <div className="pv-note">This site doesn’t allow being shown inside other apps. Switch back to <b>Tack view</b> below, use <b>Reader</b>, or open it in your browser.</div>
            )}
            {original && liveMoved && (!data || data.embeddable) && (
              <div className="pv-moved">
                You’ve moved to another page, but in <b>Original</b> view the browser doesn’t tell Tack which one, so Reader,
                Images and Add link still use the page above. Switch to <b>Tack view</b> below to have them follow you.
                <button className="pv-moved-x" onClick={() => setLiveMoved(false)} aria-label="Dismiss">×</button>
              </div>
            )}
            {!original && frameUrl && (
              <iframe
                key={"t" + frameUrl}
                ref={frameRef}
                src={`/api/live?url=${encodeURIComponent(frameUrl)}`}
                title={title}
                sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            )}
            {original && frameUrl && (!data || data.embeddable) && (
              <iframe
                key={"o" + frameUrl}
                ref={frameRef}
                onLoad={() => { frameLoads.current += 1; if (frameLoads.current > 1) setLiveMoved(true); }}
                src={frameUrl}
                title={title}
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            )}
            <div className="pv-viewbar">
              <span className="pv-viewalt">
                {original
                  ? <>Original site · <button onClick={() => setOriginal(false)}>Use Tack view</button></>
                  : <>Looks broken? <button onClick={() => setOriginal(true)}>Show original</button></>}
              </span>
            </div>
          </>
        )}

        {mode === "reader" && (
          <div className="reader-scroll">
            {!data && !error && <div className="muted" style={{ padding: 20 }}><span className="spinner" /> Loading…</div>}
            {error && <div className="error-banner" style={{ margin: 16 }}>{error}</div>}
            {data && (
              <article className="reader" onClick={onReaderClick} onDragStart={onReaderDragStart} ref={articleRef}>
                <div className="reader-hint">Drag any image onto your board, or click it to add it. Its citation comes with it.</div>
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
