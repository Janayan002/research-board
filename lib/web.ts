// Server-only helpers for reading web pages: link previews, citation info, and the images on a page.

export type PageInfo = {
  url: string;
  title?: string;
  image?: string; // og:image
  siteName?: string;
  author?: string;
  published?: string;
};

export type FoundImage = { src: string; alt?: string; width?: number; height?: number; fallback?: string }; // fallback = the URL as the page had it, if we upgraded it

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

const NAMED: Record<string, string> = { mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", middot: "·", bull: "•", copy: "©", eacute: "é", egrave: "è", aacute: "á", oacute: "ó", uuml: "ü", ouml: "ö", auml: "ä" };
const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m)
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'")
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

// Largest candidate from a srcset like "a.jpg 400w, b.jpg 1200w" (with its width, when given in w)
// Parsed like the HTML spec: a URL is a run of non-spaces (it may contain commas, e.g. Wix/Cloudinary),
// then optional descriptors up to the next comma.
function parseSrcset(srcset: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < srcset.length) {
    while (i < srcset.length && /[\s,]/.test(srcset[i])) i++;
    let j = i;
    while (j < srcset.length && !/\s/.test(srcset[j])) j++;
    let url = srcset.slice(i, j);
    let desc = "";
    if (url.endsWith(",")) url = url.replace(/,+$/, "");
    else {
      const k = srcset.indexOf(",", j);
      desc = srcset.slice(j, k < 0 ? srcset.length : k).trim();
      j = k < 0 ? srcset.length : k + 1;
    }
    if (url) out.push([url, desc]);
    i = j;
  }
  return out;
}
function srcsetBest(srcset?: string): { url: string; w?: number } | undefined {
  if (!srcset) return undefined;
  const items = parseSrcset(srcset).filter((p) => !p[0].startsWith("data:")); // skip inline placeholders
  items.sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0));
  const top = items[0];
  return top ? { url: top[0], w: top[1]?.endsWith("w") ? parseFloat(top[1]) : undefined } : undefined;
}
const bestFromSrcset = (srcset?: string) => srcsetBest(srcset)?.url;

// Many sites first load a tiny (often blurred) placeholder and swap in the real image with JavaScript.
// We only see the first HTML, so read the lazy-loading attributes before src, and skip placeholders.
const SRCSET_ATTRS = ["data-srcset", "data-lazy-srcset", "data-bgset", "srcset"];
const SRC_ATTRS = ["data-image", "data-src", "data-lazy-src", "data-original", "data-full-src", "data-hi-res-src", "data-zoom-image", "data-orig-file", "data-large-file", "src"];
export function bestImageSrc(get: (name: string) => string | null | undefined): string | undefined {
  for (const a of SRCSET_ATTRS) {
    const best = srcsetBest(get(a) || undefined);
    if (best && !(best.w && best.w < 200)) return best.url; // a srcset of only tiny sizes is a placeholder
  }
  for (const a of SRC_ATTRS) {
    const v = get(a)?.trim();
    if (v && !v.startsWith("data:")) return v;
  }
  return undefined;
}

// Image services put the size (and sometimes a blur) in the URL. Ask them for a large, sharp copy instead.
// Only touches hosts/patterns we know; callers keep the original URL as a fallback in case the guess 404s.
export function upgradeImageUrl(src: string): string {
  let u: URL;
  try { u = new URL(src); } catch { return src; }
  const h = u.hostname.toLowerCase();
  const p = u.searchParams;
  const path = u.pathname;

  // Next.js image optimizer: /_next/image?url=/real.jpg&w=16 → the real image
  if (path.endsWith("/_next/image") && p.get("url")) { try { return new URL(p.get("url")!, u.origin).toString(); } catch { return src; } }
  // Wix: /media/<file>/v1/fill/w_147,h_98,…,blur_2/<name> → the original file
  if (h === "static.wixstatic.com") { const m = path.match(/^(\/media\/[^/]+)\/v1\//); return m ? u.origin + m[1] : src; }
  // Squarespace: ?format=100w → 2500w (bare URL = original, also fine)
  if (/(^|\.)squarespace-cdn\.com$/.test(h)) { if (p.has("format")) p.set("format", "2500w"); return u.toString(); }
  // Webflow responsive variants: name-p-500.jpeg → name.jpeg
  if (/website-files\.com$|webflow\.com$/.test(h)) { u.pathname = path.replace(/-p-\d+(\.\w+)$/, "$1"); return u.toString(); }
  // Cloudinary: drop transformation segments (w_50,e_blur:300,…) between /upload/ and the file
  if (h === "res.cloudinary.com") { u.pathname = path.replace(/\/upload\/(?:[a-z]{1,3}_[^/]*\/)+/, "/upload/"); return u.toString(); }
  // Medium: /v2/resize:fill:20:20/quality:20/blur:30/… → /v2/resize:fit:1600/…
  if (h === "miro.medium.com") { const segs = path.split("/").filter(Boolean); if (segs[0] === "v2") { u.pathname = "/v2/resize:fit:1600/" + segs.slice(1).filter((s) => !s.includes(":")).join("/"); } return u.toString(); }
  // Ghost: /content/images/size/w300/format/webp/… → /content/images/…
  if (path.includes("/content/images/size/")) { u.pathname = path.replace(/\/content\/images\/size\/w\d+(?:h\d+)?(?:\/format\/\w+)?\//, "/content/images/"); return u.toString(); }
  // Substack: /image/fetch/w_40,…,e_blur/… → a large size
  if (h === "substackcdn.com") { u.pathname = path.replace(/\/image\/fetch\/[^/]+\//, "/image/fetch/w_1456,c_limit,f_auto,q_auto:good/"); return u.toString(); }
  // Cargo: /w/500/q/75/i/<id>/file.jpg → /t/original/i/<id>/file.jpg
  if (h === "freight.cargo.site") { u.pathname = path.replace(/^\/(?:[wh]\/\d+\/)+(?:q\/\d+\/)?i\//, "/t/original/i/"); return u.toString(); }
  // Behance project images: /project_modules/disp/… → max_1200
  if (h.endsWith("behance.net") && path.includes("/project_modules/")) { u.pathname = path.replace(/\/project_modules\/[^/]+\//, "/project_modules/max_1200/"); return u.toString(); }
  // WordPress: photo-300x200.jpg → photo.jpg; Jetpack's i0.wp.com takes resize params
  if (path.includes("/wp-content/uploads/")) u.pathname = path.replace(/-\d+x\d+(\.\w+)$/, "$1");
  if (/^i\d\.wp\.com$/.test(h)) ["resize", "fit", "w", "h"].forEach((k) => p.delete(k));
  // Shopify: name_200x.jpg / _small.jpg → name.jpg
  if (h === "cdn.shopify.com" || path.includes("/cdn/shop/")) {
    u.pathname = u.pathname.replace(/_(?:\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande)(?:_crop_\w+)?(?=(?:@\dx)?\.\w+$)/, "");
    if (p.has("width")) p.set("width", "2000");
    p.delete("height");
  }
  // query-param image CDNs (imgix, Contentful, Sanity, Prismic, Unsplash, Storyblok…): bigger, no blur
  if (/imgix\.net$|ctfassets\.net$|cdn\.sanity\.io$|images\.prismic\.io$|images\.unsplash\.com$|storyblok\.com$|datocms-assets\.com$/.test(h)) {
    for (const k of ["w", "width"]) if (p.has(k) && Number(p.get(k)) < 1600) p.set(k, "1600");
    ["h", "height", "blur", "px", "q"].forEach((k) => p.delete(k));
  }
  p.delete("blur");
  return u.toString();
}

// The URL to use for an image, plus the original to fall back on if the upgraded one won't load.
export function sharpImage(src: string): { src: string; fallback?: string } {
  const up = upgradeImageUrl(src);
  return up !== src ? { src: up, fallback: src } : { src };
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
    const sharp = sharpImage(src);
    const key = sharp.src.split("?")[0];
    if (seen.has(key)) return;
    seen.add(key);
    images.push({ ...sharp, alt: alt ? decode(alt).slice(0, 200) : undefined, width: w, height: h });
  };

  if (page?.image) add(page.image, page.title);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = bestImageSrc((name) => attr(tag, name));
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
