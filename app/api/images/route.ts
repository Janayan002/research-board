// GET /api/images?url=...  → { page: { url, title, siteName, author, published }, images: [{ src, alt }] }
// Lists the images on a web page so you can pick which ones to put on the canvas (no AI, free).

import { NextResponse } from "next/server";
import { isSafePublicUrl, pageImages } from "@/lib/web";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") || "";
  if (!isSafePublicUrl(url)) return NextResponse.json({ error: "Paste a full web address (https://…)." }, { status: 400 });
  try {
    return NextResponse.json(await pageImages(url));
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "That page took too long to load." : "Couldn’t read that page. Some sites block this — try another page, or drag images in directly.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
