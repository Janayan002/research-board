// POST /api/research  { query, count?, exclude? }
// → { candidates: [{ name, why, sourceUrl, sourceTitle }], mock?, searchesUsed? }

import { NextResponse } from "next/server";
import { extractJson, friendlyError, hasApiKey, maxSearches, runWithSearch } from "@/lib/ai";
import { mockCandidates } from "@/lib/mock";

export const runtime = "nodejs";
export const maxDuration = 60;

type Out = { candidates: { name: string; why: string; sourceUrl?: string; sourceTitle?: string }[] };

const SYSTEM = `You are a research assistant for a visual artist, designer and creative technologist.
The user describes what they are looking for (artists, designers, projects, apps, studios, etc).
Use web search to find REAL candidates with evidence. Never invent names, works, or URLs.
Prefer the artist's own site, museum or gallery pages, and reputable arts press as sources.

Reply with ONLY a JSON object, no prose, in exactly this shape:
{"candidates":[{"name":"...","why":"one specific sentence naming the relevant work(s) and how they match","sourceUrl":"https://...","sourceTitle":"..."}]}
- sourceUrl must be a page that appeared in your search results and supports the "why".
- If you find fewer good matches than requested, return fewer. Quality over quantity.`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = String(body.query || "").trim().slice(0, 1000);
  const count = Math.min(12, Math.max(1, Number(body.count) || 6));
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.map(String).slice(0, 50) : [];
  if (!query) return NextResponse.json({ error: "Type what you're looking for." }, { status: 400 });

  if (!hasApiKey()) {
    await new Promise((r) => setTimeout(r, 700)); // feel like a real request
    return NextResponse.json({ candidates: mockCandidates(query, count, exclude), mock: true });
  }

  try {
    const prompt =
      `Find up to ${count} candidates for this research request:\n"""${query}"""` +
      (exclude.length ? `\n\nAlready found — do NOT include these again: ${exclude.join("; ")}` : "");
    const r = await runWithSearch({
      model: process.env.RESEARCH_MODEL || "claude-haiku-5-5",
      system: SYSTEM,
      prompt,
      searches: maxSearches(),
    });
    const parsed = extractJson<Out>(r.text);
    const candidates = (parsed.candidates || [])
      .filter((c) => c && c.name)
      .slice(0, count)
      .map((c) => ({
        name: String(c.name).slice(0, 120),
        why: String(c.why || "").slice(0, 400),
        sourceUrl: c.sourceUrl ? String(c.sourceUrl) : undefined,
        sourceTitle: c.sourceTitle ? String(c.sourceTitle).slice(0, 200) : undefined,
      }));
    return NextResponse.json({ candidates, searchesUsed: r.searchesUsed });
  } catch (e) {
    console.error("[research]", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
