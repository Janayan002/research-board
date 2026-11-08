// Server-only helpers for reading web pages (link previews, artist images).

export type Unfurl = { url: string; title?: string; image?: string; siteName?: string };

// Basic guard so the server only fetches public http(s) pages, not internal addresses.
// (Doesn't cover DNS rebinding — fine for a personal project, harden before a big launch.)
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
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
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

function meta(html: string, keys: string[]): string | undefined {
  for (const k of keys) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']+)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${k}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    if (m) return decode(m[1]);
  }
  return undefined;
}

export async function unfurl(url: string, timeoutMs = 5000): Promise<Unfurl> {
  if (!isSafePublicUrl(url)) return { url };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; ResearchBoard/0.1; link preview)", accept: "text/html" },
    });
    const type = res.headers.get("content-type") || "";
    if (type.startsWith("image/")) return { url, image: url };
    if (!type.includes("html")) return { url };
    // only read the first ~400KB — <head> is near the top
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const dec = new TextDecoder();
      while (html.length < 400_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (html.includes("</head>")) break;
      }
      reader.cancel().catch(() => {});
    }
    const base = res.url || url;
    let image = meta(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]);
    if (image) { try { image = new URL(image, base).toString(); } catch { image = undefined; } }
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    return {
      url: base,
      title: meta(html, ["og:title", "twitter:title"]) || (titleTag ? decode(titleTag) : undefined),
      image,
      siteName: meta(html, ["og:site_name"]),
    };
  } catch {
    return { url };
  } finally {
    clearTimeout(t);
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
