// Server-only: calls Claude with the built-in web search tool.
// Docs: https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool

import Anthropic from "@anthropic-ai/sdk";
import type { Source } from "./types";

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

export const maxSearches = () => {
  const n = Number(process.env.MAX_SEARCHES_PER_REQUEST || 4);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 4;
};

type RunOpts = { model: string; system: string; prompt: string; searches: number; maxTokens?: number };

export type RunResult = { text: string; sources: Source[]; searchesUsed: number };

export async function runWithSearch(o: RunOpts): Promise<RunResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: o.prompt }];
  const blocks: any[] = [];
  let searchesUsed = 0;

  // Server tools can pause long turns (stop_reason "pause_turn"); send the turn back to continue.
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: o.model,
      max_tokens: o.maxTokens ?? 2500,
      system: o.system,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: o.searches }],
    });
    blocks.push(...res.content);
    searchesUsed += (res.usage as any)?.server_tool_use?.web_search_requests ?? 0;
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
    break;
  }

  // The answer is the text written after the last search result.
  let lastResult = -1;
  blocks.forEach((b, i) => { if (b.type === "web_search_tool_result") lastResult = i; });
  const text = blocks.slice(lastResult + 1).filter((b) => b.type === "text").map((b) => b.text).join("");

  // Sources: pages Claude cited first, then other search results.
  const seen = new Set<string>();
  const sources: Source[] = [];
  const add = (url?: string, title?: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    sources.push({ url, title: title || url });
  };
  for (const b of blocks) if (b.type === "text" && Array.isArray(b.citations)) for (const c of b.citations) add(c.url, c.title);
  for (const b of blocks) if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) add(r.url, r.title);

  return { text, sources, searchesUsed };
}

// Pull the JSON object out of the model's reply (handles ```json fences and extra prose).
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON found in model reply");
  return JSON.parse(body.slice(start, end + 1)) as T;
}

export function friendlyError(e: unknown): string {
  const err = e as any;
  const status = err?.status;
  if (status === 401) return "Your API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
  if (status === 429) return "Rate limited by the API — wait a moment and try again.";
  if (status === 400 && /web search/i.test(err?.message || "")) return "Web search isn't enabled for this API key. Turn it on in the Claude Console (Settings → Privacy).";
  if (status === 529 || status === 503) return "The AI service is busy right now. Try again in a minute.";
  return err?.message ? String(err.message).slice(0, 300) : "Something went wrong.";
}
