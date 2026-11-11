"use client";

// Which web page is open in the preview pane (shared by the search panel and cards).

import { create } from "zustand";

type PreviewState = {
  url: string | null;
  open: (url: string) => void;
  close: () => void;
};

export const usePreview = create<PreviewState>((set) => ({
  url: null,
  open: (url) => {
    if (opensInBrowser(url)) { window.open(url, "_blank", "noopener,noreferrer"); return; }
    set({ url });
  },
  close: () => set({ url: null }),
}));

// Apps that refuse to be shown inside other sites and give the reader nothing but a login wall.
// Links to these open in a real browser tab instead of the preview pane.
const APP_SITES = [
  "instagram.com", "facebook.com", "fb.com", "threads.net", "threads.com", "tiktok.com",
  "x.com", "twitter.com", "linkedin.com", "snapchat.com", "discord.com", "reddit.com",
];
export function opensInBrowser(url: string) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return APP_SITES.some((d) => h === d || h.endsWith("." + d));
  } catch { return false; }
}

// Typed into the search box, does this look like a web address rather than a search?
// "pinterest.com", "www.tate.org.uk/art" and anything starting with http(s):// count; "e.g. this" or "3.5 inch" don't.
export function asAddress(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  if (/^https?:\/\//i.test(t)) { try { return new URL(t).toString(); } catch { return null; } }
  const host = t.split(/[/?#]/)[0];
  if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?$/i.test(host)) return null;
  try { return new URL("https://" + t).toString(); } catch { return null; }
}

// For <a> clicks: open in the preview pane, unless Cmd/Ctrl/Shift-click (then the browser handles it)
// or the site only works in a real browser tab.
export function previewClick(e: React.MouseEvent, url?: string) {
  if (!url || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  if (opensInBrowser(url)) return; // let the link's target="_blank" open a new tab
  e.preventDefault();
  usePreview.getState().open(url);
}
