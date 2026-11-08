// Server-only: turn a web page into a clean "reader view" (title, text, images),
// and check whether the site allows being shown inside an iframe.

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { bestFromSrcset, extractImages, fetchHtml, isSafePublicUrl, pageInfoFrom, type FoundImage, type PageInfo } from "./web";

export type ReaderPage = PageInfo & {
  byline?: string;
  excerpt?: string;
  html: string; // sanitized article HTML
  images: FoundImage[];
  embeddable: boolean; // can it be shown in an iframe?
};

// Sites block iframes with X-Frame-Options or CSP frame-ancestors.
function canEmbed(headers?: Headers): boolean {
  if (!headers) return true;
  const xfo = (headers.get("x-frame-options") || "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const csp = (headers.get("content-security-policy") || "").toLowerCase();
  const fa = csp.match(/frame-ancestors([^;]*)/);
  if (fa && !/(^|\s)\*(\s|$)/.test(fa[1])) return false;
  return true;
}

// Only keep simple, safe formatting. Everything else is unwrapped or removed.
const KEEP = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "figure", "figcaption", "img", "a",
  "strong", "em", "b", "i", "u", "br", "hr", "pre", "code", "table", "thead", "tbody", "tr", "th", "td", "sup", "sub", "small", "span", "div", "section", "article"]);
const DROP = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "select", "textarea", "svg", "noscript", "video", "audio", "canvas", "link", "meta", "nav", "footer", "aside"]);

function sanitize(html: string, base: string): { html: string; images: FoundImage[] } {
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  const root = document.getElementById("root")!;
  const abs = (u?: string | null) => { if (!u) return null; try { const x = new URL(u, base); return /^https?:$/.test(x.protocol) ? x.toString() : null; } catch { return null; } };
  const images: FoundImage[] = [];

  const walk = (el: any) => {
    for (const child of Array.from(el.children) as any[]) {
      const tag = child.tagName.toLowerCase();
      if (DROP.has(tag)) { child.remove(); continue; }
      if (tag === "picture") { // keep just the <img> inside
        const img = child.querySelector("img");
        if (img) child.replaceWith(img); else child.remove();
        if (img) walk({ children: [img] });
        continue;
      }
      walk(child);
      if (!KEEP.has(tag)) { child.replaceWith(...Array.from(child.childNodes)); continue; }

      const keep: Record<string, string> = {};
      if (tag === "a") {
        const href = abs(child.getAttribute("href"));
        if (href) keep.href = href;
      }
      if (tag === "img") {
        const src = abs(bestFromSrcset(child.getAttribute("srcset") || child.getAttribute("data-srcset") || undefined)
          || child.getAttribute("data-src") || child.getAttribute("data-original") || child.getAttribute("src"));
        if (!src || /\.svg(\?|$)/i.test(src)) { child.remove(); continue; }
        keep.src = src;
        const alt = child.getAttribute("alt");
        if (alt) keep.alt = alt;
        images.push({ src, alt: alt || undefined });
      }
      for (const a of Array.from(child.attributes) as any[]) child.removeAttribute(a.name);
      for (const [k, v] of Object.entries(keep)) child.setAttribute(k, v);
      if (tag === "a") { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noreferrer"); }
      if (tag === "img") { child.setAttribute("loading", "lazy"); child.setAttribute("referrerpolicy", "no-referrer"); }
    }
  };
  walk(root);
  return { html: root.innerHTML, images };
}

export async function readPage(url: string): Promise<ReaderPage> {
  if (!isSafePublicUrl(url)) throw new Error("That link can't be opened.");
  const r = await fetchHtml(url, 3_000_000, false, 10000);
  const embeddable = canEmbed(r.headers);
  if (r.isImage) return { url, html: `<p><img src="${url}" alt=""></p>`, images: [{ src: url }], embeddable };

  const page = pageInfoFrom(r.html, r.finalUrl);
  let article: ReturnType<Readability["parse"]> = null;
  try {
    const { document } = parseHTML(r.html);
    article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
  } catch { /* some pages can't be parsed — fall back below */ }

  let clean = article?.content ? sanitize(article.content, r.finalUrl) : { html: "", images: [] as FoundImage[] };
  // pages that are mostly pictures (portfolios, galleries) often have little "article" text: add their images
  if (clean.images.length < 3) {
    const extra = extractImages(r.html, r.finalUrl, page).filter((i) => !clean.images.some((c) => c.src === i.src)).slice(0, 24);
    if (extra.length) {
      clean = {
        html: clean.html + (clean.html ? "<hr>" : "") + extra.map((i) => `<figure><img src="${i.src}" alt="${(i.alt || "").replace(/"/g, "&quot;")}" loading="lazy" referrerpolicy="no-referrer"></figure>`).join(""),
        images: [...clean.images, ...extra],
      };
    }
  }
  if (!clean.html) clean.html = `<p>${(article?.excerpt || "This page has no readable text. Try “Live page” or open it in your browser.").replace(/</g, "&lt;")}</p>`;

  return {
    ...page,
    title: page.title || article?.title || undefined,
    byline: article?.byline || page.author || undefined,
    excerpt: article?.excerpt || undefined,
    html: clean.html,
    images: clean.images,
    embeddable,
  };
}
