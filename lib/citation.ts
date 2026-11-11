// Turn a Citation into Chicago / MLA / APA text (plain text, ready to paste).
// These follow the general web-source patterns; check your school's style guide for edge cases.

import type { Card, Citation } from "./types";

export type CiteStyle = "chicago" | "mla" | "apa";
export const CITE_STYLES: { id: CiteStyle; label: string }[] = [
  { id: "chicago", label: "Chicago" },
  { id: "mla", label: "MLA" },
  { id: "apa", label: "APA" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MLA_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

function parseDate(s?: string): Date | null {
  if (!s) return null;
  // a bare "2026-11-09" means that day where you are (new Date() would read it as UTC midnight,
  // which is the day before in the Americas)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
const isoDay = (s?: string) => /^\d{4}-\d{2}-\d{2}/.test(s || "");

const hostOf = (u?: string) => {
  if (!u) return "";
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};

const end = (s: string) => (/[.?!]$/.test(s) ? s : s + ".");

export function formatCitation(c: Citation, style: CiteStyle): string {
  const url = c.pageUrl || c.imageUrl || "";
  const site = c.siteName || hostOf(url);
  const title = c.title?.trim();
  const creator = c.creator?.trim();
  const pub = parseDate(c.published);
  const pubFull = pub && isoDay(c.published);
  const acc = parseDate(c.accessed) ?? new Date();

  if (style === "mla") {
    // Creator. "Title." Site, Day Mon. Year, URL. Accessed Day Mon. Year.
    const parts: string[] = [];
    if (creator) parts.push(end(creator));
    if (title) parts.push(`“${end(title)}”`);
    let container = site;
    if (pub) container += `, ${pubFull ? `${pub.getUTCDate()} ${MLA_MONTHS[pub.getUTCMonth()]} ` : ""}${pub.getUTCFullYear()}`;
    else if (c.published) container += `, ${c.published}`;
    if (url) container += `, ${url.replace(/^https?:\/\//, "")}`;
    if (container) parts.push(end(container));
    parts.push(`Accessed ${acc.getDate()} ${MLA_MONTHS[acc.getMonth()]} ${acc.getFullYear()}.`);
    return parts.join(" ");
  }

  if (style === "apa") {
    // Creator. (Year, Month Day). Title [Image]. Site. URL
    const who = creator || site || "Untitled";
    const date = pub
      ? `(${pub.getUTCFullYear()}${pubFull ? `, ${MONTHS[pub.getUTCMonth()]} ${pub.getUTCDate()}` : ""})`
      : c.published ? `(${c.published})` : "(n.d.)";
    const parts = [end(who), `${date}.`];
    if (title) parts.push(`${title}${c.imageUrl ? " [Image]" : ""}.`);
    if (site && site !== who) parts.push(end(site));
    if (url) parts.push(url);
    return parts.join(" ");
  }

  // Chicago (bibliography style): Creator. "Title." Site, Month Day, Year. URL.
  const parts: string[] = [];
  if (creator) parts.push(end(creator));
  if (title) parts.push(`“${end(title)}”`);
  let tail = site;
  if (pub) tail += `${tail ? ", " : ""}${pubFull ? `${MONTHS[pub.getUTCMonth()]} ${pub.getUTCDate()}, ` : ""}${pub.getUTCFullYear()}`;
  else if (c.published) tail += `${tail ? ", " : ""}${c.published}`;
  if (tail) parts.push(end(tail));
  if (!pub) parts.push(`Accessed ${MONTHS[acc.getMonth()]} ${acc.getDate()}, ${acc.getFullYear()}.`);
  if (url) parts.push(end(url));
  return parts.join(" ");
}

// Short credit line shown under an image on the canvas
export function creditLine(c?: Citation): string {
  if (!c) return "";
  const site = c.siteName || hostOf(c.pageUrl || c.imageUrl);
  return [c.creator, c.title, site].filter(Boolean).join(", ");
}

// Every citation on a page: images, links and the sources of research cards
export function collectCitations(cards: Card[]): { cardId: string; label: string; cite: Citation }[] {
  const out: { cardId: string; label: string; cite: Citation }[] = [];
  const day = (t: number) => new Date(t).toLocaleDateString("en-CA");
  const seen = new Set<string>();
  const push = (cardId: string, label: string, cite: Citation) => {
    const key = (cite.pageUrl || cite.imageUrl || "") + "|" + (cite.title || "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ cardId, label, cite });
  };
  for (const c of cards) {
    if (c.kind === "image") push(c.id, "Image", c.cite ?? { imageUrl: c.src.startsWith("data:") ? undefined : c.src, pageUrl: c.sourceUrl, title: c.caption, accessed: day(c.createdAt) });
    if (c.kind === "link") push(c.id, "Link", c.cite ?? { pageUrl: c.url, title: c.title, accessed: day(c.createdAt) });
    if (c.kind === "research") for (const s of c.sources) push(c.id, c.name, { pageUrl: s.url, title: s.title, accessed: day(c.createdAt) });
  }
  return out.filter((x) => x.cite.pageUrl || x.cite.imageUrl);
}
