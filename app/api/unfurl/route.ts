// GET /api/unfurl?url=...  → { url, title, image, siteName }
// Free link previews (no AI): reads the page's <title> and og:image.

import { NextResponse } from "next/server";
import { isSafePublicUrl, unfurl } from "@/lib/web";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") || "";
  if (!isSafePublicUrl(url)) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  return NextResponse.json(await unfurl(url));
}
