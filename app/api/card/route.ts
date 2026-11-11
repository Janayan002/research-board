// POST /api/card  { name, type?, query?, sections: string[], hintUrl? }
// → GeneratedCard { name, subtitle, website, image, sections: [{label, text}], sources: [{title, url}] }

import { NextResponse } from "next/server";
import { credsFrom, extractJson, friendlyError, hasApiKey, maxSearches, mockAllowed, needsKeyError, pickModel, runWithSearch } from "@/lib/ai";
import { mockCard } from "@/lib/mock";
import { researchType, type SectionDef } from "@/lib/researchTypes";
import { firstImage } from "@/lib/web";
import type { GeneratedCard } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // bigger models with several searches can take a while

type Out = {
  name?: string;
  subtitle?: string;
  website?: string | null;
  sections?: { label: string; text: string }[];
  sources?: { title: string; url: string }[];
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 200);
  const rt = researchType(body.type);
  const query = String(body.query || "").trim().slice(0, 1000);
  const hintUrl = body.hintUrl ? String(body.hintUrl) : undefined;
  const ids: string[] = Array.isArray(body.sections) && body.sections.length ? body.sections : [rt.sections[0].id];
  const defs = ids.map((id) => rt.sections.find((s) => s.id === id)).filter(Boolean) as SectionDef[];
  if (!name) return NextResponse.json({ error: "Missing name." }, { status: 400 });

  const creds = credsFrom(req);
  if (!hasApiKey(creds)) {
    if (!mockAllowed()) return NextResponse.json(needsKeyError(), { status: 401 });
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json(mockCard(name, rt, defs.map((d) => d.label)));
  }

  const system = `You write concise, factual research cards for a visual artist's research board.
This card is about a ${rt.singular}. Use web search to verify every fact. Never invent works, dates, quotes or URLs.
If something is uncertain, say so briefly. Write in plain, clear language and in your own words.
Reply with ONLY a JSON object, no prose:
{"name":"...","subtitle":"${rt.metaHint}","website":"official page URL or null","sections":[{"label":"...","text":"..."}],"sources":[{"title":"...","url":"https://..."}]}
Include exactly these sections, in this order, using these labels:
${defs.map((d) => `- "${d.label}": ${d.instruction}`).join("\n")}
"sources" = the 2–5 pages you actually used. Prefer pages that show images of the work/place/product.`;

  const prompt =
    `Make a research card about: ${name}` +
    (query ? `\nThe user's research prompt (for context and the "Connection" section): """${query}"""` : "") +
    (hintUrl ? `\nA page about it: ${hintUrl}` : "");

  try {
    const r = await runWithSearch({
      apiKey: creds.anthropicKey!,
      model: pickModel(creds, "CARD_MODEL"),
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

    // Preview image: the official page first, then the source pages.
    const image = await firstImage([website, hintUrl, ...sources.map((s) => s.url)]);

    const out: GeneratedCard = {
      name: parsed.name || name,
      subtitle: parsed.subtitle ? String(parsed.subtitle).slice(0, 160) : undefined,
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
