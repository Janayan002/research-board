// Server-only helpers for reading web pages: link previews, citation info, and the images on a page.

export type PageInfo = {
  url: string;
  title?: string;
  image?: string; // og:image
  siteName?: string;
  author?: string;
  published?: string;
};

export type FoundImage = { src: string; alt?: string; width?: number; height?: number };

// Basic guard so the server only fetches public http(s) pages, not internal addresses.
// (Doesn't cover DNS rebinding — fine for a personal project, harden before a big launch.)
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (process.env.ALLOW_LOCAL_FETCH === "1") return true; // local testing only — never set this in production
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "0.0.0.0" || h === "[::1]") return false;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return false;
  }
  if (h.startsWith("[")) return false; // skip raw IPv6
  return true;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function meta(html: string, keys: string[]): string | undefined {
  for (const k of keys) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']+)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${k}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    if (m) return decode(m[1]);
  }
  return undefined;
}

// author / datePublished from JSON-LD blocks (common on news and museum sites)
function fromJsonLd(html: string): { author?: string; published?: string; name?: string } {
  const out: { author?: string; published?: string; name?: string } = {};
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const blk of blocks) {
    try {
      const json = JSON.parse(blk.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, ""));
      const items: any[] = Array.isArray(json) ? json : json["@graph"] ? json["@graph"] : [json];
      for (const it of items) {
        if (!out.published && (it.datePublished || it.dateCreated)) out.published = String(it.datePublished || it.dateCreated);
        const a = it.author || it.creator;
        if (!out.author && a) {
          const list = Array.isArray(a) ? a : [a];
          const names = list.map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean);
          if (names.length) out.author = names.join(", ");
        }
        if (!out.name && it.headline) out.name = String(it.headline);
      }
    } catch { /* ignore bad JSON-LD */ }
  }
  return out;
}

export async function fetchHtml(url: string, maxBytes: number, stopAtHead: boolean, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; ResearchBoard/0.1; +research canvas)", accept: "text/html,image/*" },
    });
    const type = res.headers.get("content-type") || "";
    const headers = res.headers;
    if (type.startsWith("image/")) return { finalUrl: res.url || url, html: "", isImage: true, headers };
    if (!type.includes("html")) return { finalUrl: res.url || url, html: "", isImage: false, headers };
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const dec = new TextDecoder();
      while (html.length < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (stopAtHead && html.includes("</head>")) break;
      }
      reader.cancel().catch(() => {});
    }
    return { finalUrl: res.url || url, html, isImage: false, headers };
  } finally {
    clearTimeout(t);
  }
}

// "2024-05-12T10:00:00Z" → "2024-05-12" (keeps other formats as they are)
const cleanDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}T/.test(d) ? d.slice(0, 10) : d);

export function pageInfoFrom(html: string, base: string): PageInfo {
  const ld = fromJsonLd(html);
  let image = meta(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
  if (image) { try { image = new URL(image, base).toString(); } catch { image = undefined; } }
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  let author = meta(html, ["author", "article:author", "parsely-author", "sailthru.author", "dc.creator"]) || ld.author;
  if (author && /^https?:\/\//.test(author)) author = undefined; // article:author is sometimes a profile URL
  return {
    url: base,
    title: meta(html, ["og:title", "twitter:title"]) || ld.name || (titleTag ? decode(titleTag) : undefined),
    image,
    siteName: meta(html, ["og:site_name", "application-name"]),
    author,
    published: cleanDate(meta(html, ["article:published_time", "datePublished", "date", "dc.date", "pubdate"]) || ld.published),
  };
}

// Title, site, author, date and preview image for a page (reads only the <head>).
export async function unfurl(url: string, timeoutMs = 5000): Promise<PageInfo> {
  if (!isSafePublicUrl(url)) return { url };
  try {
    const r = await fetchHtml(url, 400_000, true, timeoutMs);
    if (r.isImage) return { url, image: url };
    return pageInfoFrom(r.html, r.finalUrl);
  } catch {
    return { url };
  }
}

// Try several pages and return the first preview image found.
export async function firstImage(urls: (string | undefined)[]): Promise<string | undefined> {
  for (const u of urls.filter(Boolean).slice(0, 4) as string[]) {
    const r = await unfurl(u, 4000);
    if (r.image) return r.image;
  }
  return undefined;
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"))?.[1];

// Largest candidate from a srcset like "a.jpg 400w, b.jpg 1200w"
function bestFromSrcset(srcset?: string): string | undefined {
  if (!srcset) return undefined;
  const items = srcset.split(",").map((s) => s.trim().split(/\s+/)).filter((p) => p[0]);
  items.sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0));
  return items[0]?.[0];
}

// All the meaningful images on a page (skips icons, logos, tracking pixels), plus citation info.
export async function pageImages(url: string): Promise<{ page: PageInfo; images: FoundImage[] }> {
  if (!isSafePublicUrl(url)) throw new Error("That link can't be opened.");
  const r = await fetchHtml(url, 2_500_000, false, 8000);
  if (r.isImage) return { page: { url }, images: [{ src: url }] };
  const page = pageInfoFrom(r.html, r.finalUrl);
  return { page, images: extractImages(r.html, r.finalUrl, page) };
}

// Pull image URLs out of raw HTML (handles lazy-loading and srcset), skipping icons/logos.
export function extractImages(html: string, base: string, page?: PageInfo): FoundImage[] {
  const seen = new Set<string>();
  const images: FoundImage[] = [];
  const add = (raw: string | undefined, alt?: string, w?: number, h?: number) => {
    if (!raw || raw.startsWith("data:")) return;
    let src: string;
    try { src = new URL(decode(raw), base).toString(); } catch { return; }
    if (!/^https?:/.test(src)) return;
    const low = src.toLowerCase();
    if (/\.svg(\?|$)/.test(low) || /(sprite|logo|icon|favicon|avatar|pixel|spacer|badge|button|emoji|gravatar)/.test(low)) return;
    if ((w && w < 120) || (h && h < 120)) return;
    const key = src.split("?")[0];
    if (seen.has(key)) return;
    seen.add(key);
    images.push({ src, alt: alt ? decode(alt).slice(0, 200) : undefined, width: w, height: h });
  };

  if (page?.image) add(page.image, page.title);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = bestFromSrcset(attr(tag, "srcset") || attr(tag, "data-srcset")) || attr(tag, "data-src") || attr(tag, "data-original") || attr(tag, "data-lazy-src") || attr(tag, "src");
    add(src, attr(tag, "alt"), Number(attr(tag, "width")) || undefined, Number(attr(tag, "height")) || undefined);
    if (images.length >= 60) break;
  }
  for (const m of html.matchAll(/<source\b[^>]*srcset=["']([^"']+)["'][^>]*>/gi)) {
    add(bestFromSrcset(m[1]));
    if (images.length >= 60) break;
  }
  return images;
}

export { bestFromSrcset };
