// GET /api/search?q=...&type=web|images&page=0
// Plain search-engine results. See lib/search.ts for where they come from.

import { NextResponse } from "next/server";
import { searchImages, searchWeb } from "@/lib/search";
import { credsFrom, friendlyError, NEEDS_KEY } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 400);
  const type = sp.get("type") === "images" ? "images" : "web";
  const page = Math.max(0, Math.min(9, Number(sp.get("page")) || 0));
  if (!q) return NextResponse.json({ error: "Type something to search for." }, { status: 400 });
  try {
    const creds = credsFrom(req);
    return NextResponse.json(type === "images" ? await searchImages(q, page, creds) : await searchWeb(q, page, creds));
  } catch (e) {
    if ((e as any)?.code === NEEDS_KEY) return NextResponse.json({ error: (e as Error).message, code: NEEDS_KEY }, { status: 401 });
    console.error("[search]", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
