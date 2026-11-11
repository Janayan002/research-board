"use client";

// Talking to the Tack Clipper browser extension (extension/bridge.js runs on Tack's pages).
// The extension queues clips; an open board takes them with useExtensionClips and acknowledges them.

import { useEffect, useRef, useState } from "react";
import type { Citation } from "./types";

export type Clip =
  | { id: string; kind: "image"; src: string; cite: Citation }
  | { id: string; kind: "link"; url: string; title?: string; cite: Citation }
  | { id: string; kind: "text"; text: string; cite?: Citation };

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : undefined);
const httpUrl = (v: unknown) => { const s = str(v, 4000); return s && /^https?:\/\//i.test(s) ? s : undefined; };

function cleanCite(c: any): Citation {
  return {
    title: str(c?.title, 300), creator: str(c?.creator, 200), siteName: str(c?.siteName, 200),
    pageUrl: httpUrl(c?.pageUrl), imageUrl: httpUrl(c?.imageUrl), published: str(c?.published, 40),
    accessed: str(c?.accessed, 20) || new Date().toLocaleDateString("en-CA"),
  };
}

// only accept well-formed clips (and image data that is really an image, at a sane size)
function cleanClip(x: any): Clip | null {
  const id = str(x?.id, 64);
  if (!id) return null;
  if (x.kind === "image") {
    const src = typeof x.src === "string" && (/^https?:\/\//i.test(x.src) || (/^data:image\/(jpeg|png|webp|gif);base64,/.test(x.src) && x.src.length < 2_500_000)) ? x.src : undefined;
    return src ? { id, kind: "image", src, cite: cleanCite(x.cite) } : null;
  }
  if (x.kind === "link") { const url = httpUrl(x.url); return url ? { id, kind: "link", url, title: str(x.title, 300), cite: cleanCite(x.cite) } : null; }
  if (x.kind === "text") { const text = str(x.text, 5000)?.trim(); return text ? { id, kind: "text", text, cite: x.cite ? cleanCite(x.cite) : undefined } : null; }
  return null;
}

const fromExtension = (e: MessageEvent) => e.source === window && e.origin === window.location.origin && e.data?.source === "tack-extension";

// On a board: receive clips, hand them to `onClips`, then tell the extension they're placed.
export function useExtensionClips(onClips: (clips: Clip[]) => void) {
  const handler = useRef(onClips);
  handler.current = onClips;
  useEffect(() => {
    const done = new Set<string>(); // the extension may resend before our ack lands
    const post = (type: string, extra = {}) => window.postMessage({ source: "tack-app", type, ...extra }, window.location.origin);
    const onMsg = (e: MessageEvent) => {
      if (!fromExtension(e)) return;
      if (e.data.type === "hello") post("ready");
      if (e.data.type !== "clips" || !Array.isArray(e.data.items)) return;
      const ids = e.data.items.map((x: any) => str(x?.id, 64)).filter(Boolean) as string[];
      const fresh = e.data.items.filter((x: any) => !done.has(x?.id)).map(cleanClip).filter(Boolean) as Clip[];
      ids.forEach((id) => done.add(id));
      if (fresh.length) handler.current(fresh);
      post("ack", { ids }); // bad items are dropped too, so they don't get stuck
    };
    window.addEventListener("message", onMsg);
    post("ready");
    return () => { window.removeEventListener("message", onMsg); post("gone"); };
  }, []);
}

// Is the extension installed? (it answers "ping" with "hello")
export function useHasExtension() {
  const [has, setHas] = useState(false);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (fromExtension(e) && e.data.type === "hello") setHas(true); };
    window.addEventListener("message", onMsg);
    window.postMessage({ source: "tack-app", type: "ping" }, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  return has;
}
