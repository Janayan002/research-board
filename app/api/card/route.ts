// POST /api/card  { name, query?, sections: string[], hintUrl? }
// → GeneratedCard { name, website, image, sections: [{label, text}], sources: [{title, url}] }

import { NextResponse } from "next/server";
import { extractJson, friendlyError, hasApiKey, maxSearches, runWithSearch } from "@/lib/ai";
import { mockCard } from "@/lib/mock";
import { sectionById, SECTIONS } from "@/lib/sections";
import { firstImage } from "@/lib/web";
import type { GeneratedCard } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Out = { name?: string; website?: string | null; sections?: { label: string; text: string }[]; sources?: { title: string; url: string }[] };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 200);
  const query = String(body.query || "").trim().slice(0, 1000);
  const hintUrl = body.hintUrl ? String(body.hintUrl) : undefined;
  const ids: string[] = Array.isArray(body.sections) && body.sections.length ? body.sections : ["bio"];
  const defs = ids.map(sectionById).filter(Boolean) as typeof SECTIONS;
  if (!name) return NextResponse.json({ error: "Missing name." }, { status: 400 });

  if (!hasApiKey()) {
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json(mockCard(name, defs.map((d) => d.label)));
  }

  const system = `You write concise, factual research cards for a visual artist's research board.
Use web search to verify every fact. Never invent works, dates, or URLs. If something is uncertain, say so briefly.
Write in plain, clear language. Reply with ONLY a JSON object, no prose:
{"name":"...","website":"official site URL or null","sections":[{"label":"...","text":"..."}],"sources":[{"title":"...","url":"https://..."}]}
Include exactly these sections, in this order, using these labels:
${defs.map((d) => `- "${d.label}": ${d.instruction}`).join("\n")}
"sources" = the 2–5 pages you actually used.`;

  const prompt =
    `Make a research card about: ${name}` +
    (query ? `\nThe user's research prompt (for context and the "Connection" section): """${query}"""` : "") +
    (hintUrl ? `\nA page that mentions them: ${hintUrl}` : "");

  try {
    const r = await runWithSearch({
      model: process.env.CARD_MODEL || "claude-haiku-5-5",
      system,
      prompt,
      searches: Math.min(3, maxSearches()),
    });
    const parsed = extractJson<Out>(r.text);
    const sources = (parsed.sources?.length ? parsed.sources : r.sources)
      .filter((s) => s && s.url)
      .slice(0, 6)
      .map((s) => ({ title: String(s.title || s.url).slice(0, 200), url: String(s.url) }));
    const website = parsed.website && /^https?:\/\//.test(parsed.website) ? parsed.website : undefined;

    // Preview image: the official site first, then the source pages.
    const image = await firstImage([website, hintUrl, ...sources.map((s) => s.url)]);

    const out: GeneratedCard = {
      name: parsed.name || name,
      website,
      image,
      sections: (parsed.sections || []).map((s) => ({ label: String(s.label), text: String(s.text) })),
      sources,
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error("[card]", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
