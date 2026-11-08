"use client";

// The right panel: a normal search engine (Web, Images) plus the AI research tab.

import { useRef, useState } from "react";
import { IconClose, IconImage, IconLink, IconPlus, IconSearch, IconSparkle } from "./Icons";
import ResearchPanel, { type NewCard } from "./ResearchPanel";
import type { PickedImage } from "./ImagePicker";
import type { Board, GeneratedCard } from "@/lib/types";

type WebResult = { title: string; url: string; snippet?: string; site?: string; favicon?: string; thumb?: string; age?: string };
type ImageResult = { src: string; thumb?: string; title?: string; pageUrl?: string; site?: string };
type Engine = "brave" | "claude" | "mock";
type Tab = "web" | "images" | "ai";

type Props = {
  board: Board;
  open: boolean;
  onClose: () => void;
  onAddCard: (card: NewCard) => void;
  onAddLink: (url: string) => void;
  onAddImages: (images: PickedImage[]) => void;
  onFindImages: (urls: string[], title: string, creator?: string) => void;
};

const host = (u?: string) => { try { return new URL(u || "").hostname.replace(/^www\./, ""); } catch { return u || ""; } };
const path = (u: string) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname).replace(/\/$/, ""); } catch { return u; } };
const today = () => new Date().toISOString().slice(0, 10);

const ENGINE_NOTE: Record<Engine, string> = {
  brave: "Results from Brave Search",
  claude: "Results from Claude web search (slower). A working Brave key makes this faster.",
  mock: "Mock results. Add a Brave or Claude API key in .env.local for real results.",
};

export default function SearchPanel({ board, open, onClose, onAddCard, onAddLink, onAddImages, onFindImages }: Props) {
  const [tab, setTab] = useState<Tab>("web");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const [web, setWeb] = useState<{ q: string; results: WebResult[]; page: number; more: boolean; engine?: Engine; warning?: string } | null>(null);
  const [imgs, setImgs] = useState<{ q: string; images: ImageResult[]; page: number; more: boolean; engine?: Engine; warning?: string } | null>(null);
  const [loading, setLoading] = useState<null | "web" | "images" | "more">(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set()); // urls added to the board
  const [carding, setCarding] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const run = async (kind: "web" | "images", q: string, page = 0) => {
    if (!q) return;
    setLoading(page ? "more" : kind);
    setError(null);
    try {
      const res = await fetch(`/api/search?type=${kind}&page=${page}&q=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Search failed.");
      if (kind === "web") {
        setWeb((prev) => ({ q, page, more: d.more, engine: d.engine, warning: d.warning, results: page && prev ? [...prev.results, ...d.results] : d.results }));
      } else {
        setImgs((prev) => ({ q, page, more: d.more, engine: d.engine, warning: d.warning, images: page && prev ? [...prev.images, ...d.images] : d.images }));
        if (!page) { setPicked(new Set()); setFailed(new Set()); }
      }
      if (!page) scrollRef.current?.scrollTo({ top: 0 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const submit = () => {
    const q = input.trim();
    if (!q) return;
    setQuery(q);
    if (tab === "ai") return;
    run(tab, q);
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
    // re-run the current query in the new tab, like switching tabs on Google
    if (t === "web" && query && web?.q !== query) run("web", query);
    if (t === "images" && query && imgs?.q !== query) run("images", query);
  };

  const summarize = async (r: WebResult) => {
    setCarding(r.url);
    setError(null);
    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: r.title, type: "any", query, sections: ["summary", "facts"], hintUrl: r.url }),
      });
      const card: GeneratedCard & { error?: string } = await res.json();
      if (!res.ok) throw new Error(card.error || "Couldn’t make a card.");
      onAddCard({ kind: "research", category: "any", w: 340, name: card.name, subtitle: card.subtitle ?? r.site, image: card.image ?? r.thumb, website: r.url, sections: card.sections, sources: card.sources.length ? card.sources : [{ title: r.title, url: r.url }] });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCarding(null);
    }
  };

  const togglePick = (src: string) => setPicked((s) => { const n = new Set(s); n.has(src) ? n.delete(src) : n.add(src); return n; });

  const addPicked = () => {
    if (!imgs) return;
    const list: PickedImage[] = imgs.images.filter((i) => picked.has(i.src)).map((i) => ({
      src: i.src,
      fallback: i.thumb && i.thumb !== i.src ? i.thumb : undefined,
      cite: { title: i.title, siteName: i.site, pageUrl: i.pageUrl, imageUrl: i.src.startsWith("data:") ? undefined : i.src, accessed: today() },
    }));
    onAddImages(list);
    setPicked(new Set());
  };

  const visibleImages = imgs?.images.filter((i) => !failed.has(i.src)) ?? [];

  return (
    <aside className={`tray right-panel ${open ? "" : "collapsed"}`} aria-hidden={!open}>
      <div className="rp-head">
        <div className="t"><IconSearch size={17} /> Search</div>
        <button className="icon-btn" onClick={onClose} title="Hide panel  Ctrl \" aria-label="Hide search panel"><IconClose size={16} /></button>
      </div>

      <div className="sp-top">
        {tab !== "ai" && (
          <form className="sp-box" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <IconSearch size={16} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={tab === "images" ? "Search images" : "Search the web"}
              aria-label="Search"
            />
            {input && <button type="button" className="sp-clear" aria-label="Clear" onClick={() => setInput("")}><IconClose size={14} /></button>}
          </form>
        )}
        <div className="sp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "web"} className={tab === "web" ? "on" : ""} onClick={() => switchTab("web")}><IconLink size={15} /> Web</button>
          <button role="tab" aria-selected={tab === "images"} className={tab === "images" ? "on" : ""} onClick={() => switchTab("images")}><IconImage size={15} /> Images</button>
          <button role="tab" aria-selected={tab === "ai"} className={tab === "ai" ? "on" : ""} onClick={() => switchTab("ai")}><IconSparkle size={15} /> AI research</button>
        </div>
      </div>

      {tab === "ai" ? (
        <ResearchPanel board={board} onAddCard={onAddCard} onFindImages={onFindImages} />
      ) : (
        <div className="rp-scroll sp-scroll" ref={scrollRef}>
          {error && <div className="error-banner">{error}</div>}

          {tab === "web" && (
            <>
              {loading === "web" && <div className="muted"><span className="spinner" /> Searching…</div>}
              {!web && loading !== "web" && <div className="muted sp-empty">Search like you would on Google. Add any result to your board as a link, pull images from its page, or turn it into a summary card.</div>}
              {web && loading !== "web" && (
                <>
                  {web.warning && <div className="error-banner" style={{ marginBottom: 10 }}>{web.warning}</div>}
                  {web.engine && <div className="sp-engine">{ENGINE_NOTE[web.engine]}</div>}
                  {web.results.length === 0 && <div className="muted">No results for “{web.q}”.</div>}
                  {web.results.map((r) => (
                    <article key={r.url} className="wr">
                      <div className="wr-site">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.favicon ? <img src={r.favicon} alt="" /> : <span className="wr-fav" />}
                        <div style={{ minWidth: 0 }}>
                          <div className="wr-name">{r.site || host(r.url)}</div>
                          <div className="wr-path">{path(r.url)}</div>
                        </div>
                      </div>
                      <a className="wr-title" href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
                      {r.snippet && <p className="wr-snippet">{r.age ? <span className="muted">{r.age}. </span> : null}{r.snippet}</p>}
                      <div className="wr-actions">
                        <button className="btn small" disabled={added.has(r.url)} onClick={() => { onAddLink(r.url); setAdded((s) => new Set(s).add(r.url)); }}>
                          <IconPlus size={13} /> {added.has(r.url) ? "Added" : "Add"}
                        </button>
                        <button className="btn small ghost" onClick={() => onFindImages([r.url], `Images from ${r.site || host(r.url)}`)}><IconImage size={13} /> Images</button>
                        <button className="btn small ghost" disabled={carding === r.url} onClick={() => summarize(r)}>
                          {carding === r.url ? <><span className="spinner" /> Summarizing…</> : <><IconSparkle size={13} /> Summarize</>}
                        </button>
                      </div>
                    </article>
                  ))}
                  {web.more && web.results.length > 0 && (
                    <button className="btn sp-more" disabled={loading === "more"} onClick={() => run("web", web.q, web.page + 1)}>
                      {loading === "more" ? <><span className="spinner" /> Loading…</> : "More results"}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {tab === "images" && (
            <>
              {loading === "images" && <div className="muted"><span className="spinner" /> Searching images…</div>}
              {!imgs && loading !== "images" && <div className="muted sp-empty">Search for images, click the ones you want, then add them to your board. Each one keeps its source for citations.</div>}
              {imgs && loading !== "images" && (
                <>
                  {imgs.warning && <div className="error-banner" style={{ marginBottom: 10 }}>{imgs.warning}</div>}
                  {imgs.engine && <div className="sp-engine">{ENGINE_NOTE[imgs.engine]}</div>}
                  {visibleImages.length === 0 && <div className="muted">No images for “{imgs.q}”.</div>}
                  <div className="ir-grid">
                    {visibleImages.map((i) => (
                      <button key={i.src} className={`ir ${picked.has(i.src) ? "on" : ""}`} onClick={() => togglePick(i.src)} title={i.title || ""}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.thumb || i.src} alt={i.title || ""} loading="lazy" referrerPolicy="no-referrer"
                          onError={() => setFailed((f) => new Set(f).add(i.src))} />
                        <span className="ir-site">{i.site}</span>
                        <span className="picker-check">{picked.has(i.src) ? "✓" : ""}</span>
                      </button>
                    ))}
                  </div>
                  {imgs.more && visibleImages.length > 0 && (
                    <button className="btn sp-more" disabled={loading === "more"} onClick={() => run("images", imgs.q, imgs.page + 1)}>
                      {loading === "more" ? <><span className="spinner" /> Loading…</> : "More images"}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === "images" && picked.size > 0 && (
        <div className="sp-addbar">
          <span>{picked.size} selected</span>
          <button className="btn small ghost" onClick={() => setPicked(new Set())}>Clear</button>
          <button className="btn small primary" onClick={addPicked}><IconPlus size={13} /> Add to board</button>
        </div>
      )}
    </aside>
  );
}
