// POST /api/research  { query, type?, count?, exclude? }
// → { candidates: [{ name, why, meta, sourceUrl, sourceTitle }], mock?, searchesUsed? }

import { NextResponse } from "next/server";
import { extractJson, friendlyError, hasApiKey, maxSearches, runWithSearch } from "@/lib/ai";
import { mockCandidates } from "@/lib/mock";
import { researchType } from "@/lib/researchTypes";

export const runtime = "nodejs";
export const maxDuration = 60;

type Out = { candidates: { name: string; why: string; meta?: string; match?: string; sourceUrl?: string; sourceTitle?: string }[] };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = String(body.query || "").trim().slice(0, 1000);
  const rt = researchType(body.type);
  const count = Math.min(12, Math.max(1, Number(body.count) || 6));
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.map(String).slice(0, 50) : [];
  if (!query) return NextResponse.json({ error: "Type what you're looking for." }, { status: 400 });

  if (!hasApiKey()) {
    await new Promise((r) => setTimeout(r, 700)); // feel like a real request
    return NextResponse.json({ candidates: mockCandidates(query, rt, count, exclude), mock: true });
  }

  const system = `You are a research assistant for a visual artist, designer and creative technologist.
Their research is visual, so prefer results that have images online (artwork, installation views, spaces, products).
Find ${rt.find} for the user's request.

First decide what kind of request it is:
- If it NAMES a specific ${rt.singular} (e.g. a person's name, a title, an institution), the FIRST result must be exactly that one, with "match":"exact" and a "why" that briefly says who/what it is. Then add a few closely related ${rt.label.toLowerCase()} with "match":"related", each "why" saying how it relates to the named one.
- If it DESCRIBES what they want (a theme, material, place, idea), return matching results, all with "match":"related".
Use web search to find REAL results with evidence. Never invent names, titles, works, or URLs.
Prefer primary sources: the artist's/organization's own site, museum or gallery pages, the original publication, reputable arts press.

Reply with ONLY a JSON object, no prose, in exactly this shape:
{"candidates":[{"name":"...","match":"exact or related","meta":"${rt.metaHint}","why":"one specific sentence","sourceUrl":"https://...","sourceTitle":"..."}]}
- "name" is the name or title of the ${rt.singular}.
- sourceUrl must be a page that appeared in your search results and supports the "why" (ideally a page with images).
- If you find fewer good matches than requested, return fewer. Quality over quantity.`;

  try {
    const prompt =
      `Find up to ${count} ${rt.label.toLowerCase()} for this research request:\n"""${query}"""` +
      (exclude.length ? `\n\nAlready found — do NOT include these again: ${exclude.join("; ")}` : "");
    const r = await runWithSearch({
      model: process.env.RESEARCH_MODEL || "claude-haiku-5-5",
      system,
      prompt,
      searches: maxSearches(),
    });
    const parsed = extractJson<Out>(r.text);
    const candidates = (parsed.candidates || [])
      .filter((c) => c && c.name)
      .slice(0, count)
      .map((c) => ({
        name: String(c.name).slice(0, 200),
        meta: c.meta ? String(c.meta).slice(0, 160) : undefined,
        match: c.match === "exact" ? ("exact" as const) : ("related" as const),
        why: String(c.why || "").slice(0, 400),
        sourceUrl: c.sourceUrl ? String(c.sourceUrl) : undefined,
        sourceTitle: c.sourceTitle ? String(c.sourceTitle).slice(0, 200) : undefined,
      }));
    candidates.sort((a, b) => (a.match === "exact" ? -1 : 0) - (b.match === "exact" ? -1 : 0));
    return NextResponse.json({ candidates, searchesUsed: r.searchesUsed });
  } catch (e) {
    console.error("[research]", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
