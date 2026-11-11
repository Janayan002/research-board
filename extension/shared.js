// Helpers shared by the background worker and the popup.

export const TACK_URLS = ["https://tack-eta.vercel.app", "http://localhost:3000"];
export const today = () => new Date().toLocaleDateString("en-CA");
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Runs INSIDE the web page (via chrome.scripting): reads the page's citation details.
export function readPageInfo() {
  const meta = (...names) => {
    for (const n of names) {
      const el = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
      const v = el && el.getAttribute("content");
      if (v && v.trim()) return v.trim();
    }
    return undefined;
  };
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const time = document.querySelector("time[datetime]")?.getAttribute("datetime");
  const author = meta("author", "article:author", "twitter:creator", "parsely-author", "sailthru.author");
  return {
    pageUrl: canonical && /^https?:/.test(canonical) ? canonical : location.href,
    title: meta("og:title", "twitter:title") || document.title || undefined,
    siteName: meta("og:site_name", "application-name") || location.hostname.replace(/^www\./, ""),
    creator: author && !/^https?:/.test(author) ? author : undefined,
    published: (meta("article:published_time", "date", "pubdate", "DC.date.issued") || time || "").slice(0, 10) || undefined,
  };
}

// Runs INSIDE the web page: lists the real images on it (big enough to be content, best resolution).
export function readPageImages() {
  const seen = new Set();
  const out = [];
  const add = (src, alt, w, h) => {
    if (!src || !/^https?:/.test(src) || seen.has(src) || /\.svg(\?|$)/i.test(src)) return;
    seen.add(src);
    out.push({ src, alt: alt || undefined, w, h });
  };
  const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
  for (const img of Array.from(document.images)) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (w < 150 || h < 150) continue; // icons, avatars, spacers
    add(img.currentSrc || img.src, img.alt, w, h);
  }
  if (og) { try { add(new URL(og, location.href).href, undefined, 0, 0); } catch {} }
  return out.slice(0, 120);
}

// Runs INSIDE the web page: the alt text of the image that was right-clicked.
export function altFor(src) {
  const img = Array.from(document.images).find((i) => i.currentSrc === src || i.src === src);
  return img?.alt || undefined;
}

export async function inTab(tabId, func, args = []) {
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
    return r?.result;
  } catch {
    return undefined; // e.g. chrome:// pages and the Web Store can't be read
  }
}
