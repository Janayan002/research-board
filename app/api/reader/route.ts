// GET /api/reader?url=...  → reader view of a page + whether it can be shown live in an iframe.

import { NextResponse } from "next/server";
import { readPage } from "@/lib/reader";
import { isSafePublicUrl } from "@/lib/web";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") || "";
  if (!isSafePublicUrl(url)) return NextResponse.json({ error: "That link can't be opened." }, { status: 400 });
  try {
    return NextResponse.json(await readPage(url));
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "That page took too long to load." : "Couldn’t read this page. Try opening it in your browser.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
