// Server-only: plain search-engine results (web pages and images).
// Uses the Brave Search API when BRAVE_API_KEY is set (fast, Google-like results).
// Otherwise falls back to Claude's web search (slower), then to mock data.

import { extractJson, hasApiKey, runWithSearch } from "./ai";
import { pageImages } from "./web";

export type WebResult = { title: string; url: string; snippet?: string; site?: string; favicon?: string; thumb?: string; age?: string };
export type ImageResult = { src: string; thumb?: string; title?: string; pageUrl?: string; site?: string; width?: number; height?: number };
export type Engine = "brave" | "claude" | "mock";

const BRAVE = process.env.BRAVE_BASE_URL || "https://api.search.brave.com/res/v1"; // override only for testing
export const hasBrave = () => Boolean(process.env.BRAVE_API_KEY);

const clean = (s?: string) =>
  (s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const host = (u?: string) => { try { return new URL(u || "").hostname.replace(/^www\./, ""); } catch { return ""; } };

async function brave(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${BRAVE}/${path}?${qs}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_API_KEY! },
  });
  if (res.status === 401 || res.status === 403) throw new Error("Your Brave Search key was rejected. Check BRAVE_API_KEY in .env.local.");
  if (res.status === 429) throw new Error("Search limit reached for now — wait a moment and try again.");
  if (!res.ok) throw new Error(`Search failed (${res.status}).`);
  return res.json();
}

// ---------- web ----------
export async function searchWeb(q: string, page: number): Promise<{ results: WebResult[]; engine: Engine; more: boolean }> {
  if (hasBrave()) {
    const d = await brave("web/search", { q, count: 20, offset: Math.min(page, 9) });
    const results: WebResult[] = (d.web?.results || []).map((r: any) => ({
      title: clean(r.title),
      url: r.url,
      snippet: clean(r.description),
      site: r.profile?.name || r.meta_url?.hostname || host(r.url),
      favicon: r.meta_url?.favicon,
      thumb: r.thumbnail?.src,
      age: r.age,
    }));
    return { results, engine: "brave", more: Boolean(d.query?.more_results_available) && page < 9 };
  }

  if (hasApiKey()) {
    const r = await runWithSearch({
      model: process.env.RESEARCH_MODEL || "claude-haiku-5-5",
      system: `You are a search engine. Run ONE web search for the user's query exactly as typed${page ? ` (this is results page ${page + 1}, so look for different pages than the most obvious ones)` : ""}.
Then list the pages you found, in the order they ranked, as ONLY JSON:
{"results":[{"title":"page title","url":"https://...","snippet":"one or two sentences describing what's on the page"}]}
Only include pages that appeared in your search results. No commentary.`,
      prompt: q,
      searches: 1,
      maxTokens: 2000,
    });
    let results: WebResult[] = [];
    try {
      const parsed = extractJson<{ results: { title: string; url: string; snippet?: string }[] }>(r.text);
      results = (parsed.results || []).filter((x) => x?.url).map((x) => ({ title: clean(x.title) || host(x.url), url: x.url, snippet: clean(x.snippet), site: host(x.url) }));
    } catch { /* fall back to the raw result list */ }
    if (!results.length) results = r.sources.map((s) => ({ title: s.title, url: s.url, site: host(s.url) }));
    return { results, engine: "claude", more: page < 2 };
  }

  await new Promise((r) => setTimeout(r, 500));
  return {
    results: Array.from({ length: 8 }, (_, i) => ({
      title: `${q} — example result ${page * 8 + i + 1}`,
      url: `https://example.com/${encodeURIComponent(q)}/${page * 8 + i + 1}`,
      snippet: "Mock result. Add BRAVE_API_KEY (or ANTHROPIC_API_KEY) to .env.local to get real web results.",
      site: "example.com",
    })),
    engine: "mock",
    more: page < 2,
  };
}

// ---------- images ----------
export async function searchImages(q: string, page: number): Promise<{ images: ImageResult[]; engine: Engine; more: boolean }> {
  if (hasBrave()) {
    // the image endpoint has no paging, so ask for more results each time and return the new slice
    const count = Math.min(200, 50 * (page + 1));
    const d = await brave("images/search", { q, count, safesearch: "strict" });
    const all: ImageResult[] = (d.results || []).map((r: any) => ({
      src: r.properties?.url || r.thumbnail?.src,
      thumb: r.thumbnail?.src,
      title: clean(r.title),
      pageUrl: r.url,
      site: r.source || r.meta_url?.hostname || host(r.url),
      width: r.properties?.width,
      height: r.properties?.height,
    })).filter((x: ImageResult) => x.src);
    return { images: all.slice(page * 50), engine: "brave", more: all.length >= count && count < 200 };
  }

  if (hasApiKey()) {
    // No image search without Brave: find pages with Claude, then collect the images on those pages.
    const web = await searchWeb(`${q} images`, page);
    const pages = web.results.slice(0, 5);
    const settled = await Promise.allSettled(pages.map((p) => pageImages(p.url)));
    const images: ImageResult[] = [];
    settled.forEach((s, i) => {
      if (s.status !== "fulfilled") return;
      for (const img of s.value.images.slice(0, 12)) {
        images.push({ src: img.src, title: img.alt || s.value.page.title, pageUrl: s.value.page.url || pages[i].url, site: s.value.page.siteName || host(pages[i].url) });
      }
    });
    return { images, engine: "claude", more: web.more };
  }

  await new Promise((r) => setTimeout(r, 500));
  return {
    images: Array.from({ length: 12 }, (_, i) => {
      const hue = (i * 37 + page * 90) % 360;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${400 + (i % 3) * 80}"><rect width="100%" height="100%" fill="hsl(${hue},12%,${30 + (i % 4) * 8}%)"/><text x="30" y="60" font-family="sans-serif" font-size="26" fill="#ddd">mock ${page * 12 + i + 1}</text></svg>`;
      return { src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, title: `${q} (mock image ${page * 12 + i + 1})`, pageUrl: "https://example.com/", site: "example.com" };
    }),
    engine: "mock",
    more: page < 2,
  };
}
