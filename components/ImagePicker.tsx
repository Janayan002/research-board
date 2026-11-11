"use client";

// Modal that reads one or more web pages, shows their images, and lets you pick which to add.
// Each picked image keeps a citation (page title, site, author, date, URL, accessed date).

import { useEffect, useState } from "react";
import { IconClose, IconImage } from "./Icons";
import type { Citation } from "@/lib/types";

type PageInfo = { url: string; title?: string; siteName?: string; author?: string; published?: string };
type Found = { src: string; alt?: string; fallback?: string };
type PageResult = { url: string; status: "loading" | "done" | "error"; page?: PageInfo; images: Found[]; error?: string };

export type PickedImage = { src: string; cite: Citation; fallback?: string };

type Props = {
  urls: string[];
  title?: string;
  creator?: string; // e.g. the artist's name, when the images are of their work
  onAdd: (images: PickedImage[]) => void;
  onClose: () => void;
};

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const today = () => new Date().toLocaleDateString("en-CA");

export default function ImagePicker({ urls, title, creator, onAdd, onClose }: Props) {
  const [pages, setPages] = useState<PageResult[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState("");
  const [failed, setFailed] = useState<Set<string>>(new Set()); // images that wouldn't load (hotlink-blocked etc.)
  const [usedFallback, setUsedFallback] = useState<Set<string>>(new Set()); // sharpened URL failed, showing the page's own copy

  const load = (url: string) => {
    setPages((p) => (p.some((x) => x.url === url) ? p : [...p, { url, status: "loading", images: [] }]));
    fetch(`/api/images?url=${encodeURIComponent(url)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn’t read that page.");
        setPages((p) => p.map((x) => (x.url === url ? { ...x, status: "done", page: d.page, images: d.images } : x)));
      })
      .catch((e) => setPages((p) => p.map((x) => (x.url === url ? { ...x, status: "error", error: e.message } : x))));
  };

  useEffect(() => {
    Array.from(new Set(urls.filter(Boolean))).slice(0, 6).forEach(load);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const toggle = (src: string) =>
    setPicked((s) => { const n = new Set(s); n.has(src) ? n.delete(src) : n.add(src); return n; });

  const add = () => {
    const out: PickedImage[] = [];
    for (const p of pages) for (const img of p.images) {
      if (!picked.has(img.src)) continue;
      const fb = usedFallback.has(img.src);
      out.push({
        src: fb ? img.fallback! : img.src,
        fallback: fb ? undefined : img.fallback,
        cite: {
          title: img.alt || p.page?.title,
          creator: creator || p.page?.author,
          siteName: p.page?.siteName || host(p.page?.url || p.url),
          pageUrl: p.page?.url || p.url,
          imageUrl: fb ? img.fallback : img.src,
          published: p.page?.published,
          accessed: today(),
        },
      });
    }
    onAdd(out);
  };

  const addExtra = () => {
    let u = extra.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    load(u);
    setExtra("");
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <div className="t"><IconImage size={20} /> {title || "Add images from the web"}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>

        <div className="modal-bar">
          <input className="input" placeholder="Paste another page link to pull images from…" value={extra}
            onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addExtra(); }} />
          <button className="btn" onClick={addExtra}>Load page</button>
        </div>

        <div className="modal-body">
          {pages.length === 0 && <div className="muted">Paste a page link above.</div>}
          {pages.map((p) => {
            const visible = p.images.filter((i) => !failed.has(i.src));
            return (
              <section key={p.url} style={{ marginBottom: 22 }}>
                <div className="picker-page-head">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="picker-page-title">{p.page?.title || host(p.url)}</div>
                    <a className="muted" style={{ fontSize: 11 }} href={p.url} target="_blank" rel="noreferrer">
                      {p.page?.siteName || host(p.url)}{p.page?.author ? ` · ${p.page.author}` : ""}
                    </a>
                  </div>
                  {p.status === "done" && visible.length > 0 && (
                    <button className="btn small" onClick={() => setPicked((s) => {
                      const n = new Set(s);
                      const all = visible.every((i) => n.has(i.src));
                      visible.forEach((i) => (all ? n.delete(i.src) : n.add(i.src)));
                      return n;
                    })}>
                      {visible.every((i) => picked.has(i.src)) ? "Clear" : "Select all"}
                    </button>
                  )}
                </div>
                {p.status === "loading" && <div className="muted"><span className="spinner" /> Reading page…</div>}
                {p.status === "error" && <div className="error-banner">{p.error}</div>}
                {p.status === "done" && visible.length === 0 && <div className="muted">No usable images found on this page.</div>}
                <div className="picker-grid">
                  {visible.map((img) => (
                    <button key={img.src} className={`picker-item ${picked.has(img.src) ? "on" : ""}`} onClick={() => toggle(img.src)} title={img.alt || img.src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={usedFallback.has(img.src) ? img.fallback : img.src} alt={img.alt || ""} loading="lazy" referrerPolicy="no-referrer"
                        onError={() => img.fallback && !usedFallback.has(img.src)
                          ? setUsedFallback((f) => new Set(f).add(img.src))
                          : setFailed((f) => new Set(f).add(img.src))} />
                      <span className="picker-check">{picked.has(img.src) ? "✓" : ""}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="modal-foot">
          <div className="muted" style={{ fontSize: 11, flex: 1 }}>
            Each image is saved with its source and the date, so you can cite it later. Check usage rights before publishing.
          </div>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={picked.size === 0} onClick={add}>Add {picked.size || ""} image{picked.size === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  );
}
