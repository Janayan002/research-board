// Server-only: calls Claude with the built-in web search tool.
// Docs: https://docs.claude.com/en/docs/agents-and-tools/tool-use/web-search-tool

import Anthropic from "@anthropic-ai/sdk";
import type { Source } from "./types";

// ---------- whose keys? ----------
// Each person can connect their own keys in the app (stored in their browser, sent with each request).
// The server's own keys in .env are only a fallback; leave them unset on a shared deployment so
// nobody spends the owner's money.

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Best answers, slower, costs the most" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Great answers, about half Opus's price" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fast and very cheap, less thorough" },
] as const;

export type Creds = { anthropicKey?: string; braveKey?: string; model?: string; own: boolean };

const cleanKey = (s?: string | null) => (s || "").trim().replace(/^["']|["']$/g, "");

export function credsFrom(req: Request): Creds {
  const userKey = cleanKey(req.headers.get("x-anthropic-key"));
  const userBrave = cleanKey(req.headers.get("x-brave-key"));
  const m = req.headers.get("x-ai-model") || "";
  return {
    anthropicKey: userKey || cleanKey(process.env.ANTHROPIC_API_KEY) || undefined,
    braveKey: userBrave || cleanKey(process.env.BRAVE_API_KEY) || undefined,
    // people can only choose the model when they pay for it
    model: userKey && MODELS.some((x) => x.id === m) ? m : undefined,
    own: Boolean(userKey),
  };
}

export const hasApiKey = (c: Creds) => Boolean(c.anthropicKey);
export const pickModel = (c: Creds, envVar: "RESEARCH_MODEL" | "CARD_MODEL") =>
  c.model || process.env[envVar] || "claude-haiku-5-5";

// No key anywhere: in development we show mock data, on a real deployment we ask for a key.
export const NEEDS_KEY = "needs_key";
export const mockAllowed = () => process.env.NODE_ENV !== "production";
export const needsKeyError = () => ({ error: "Connect your Claude API key to use AI search and research cards.", code: NEEDS_KEY });

export const maxSearches = () => {
  const n = Number(process.env.MAX_SEARCHES_PER_REQUEST || 4);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 4;
};

type RunOpts = { apiKey: string; model: string; system: string; prompt: string; searches: number; maxTokens?: number };

export type RunResult = { text: string; sources: Source[]; searchesUsed: number };

export async function runWithSearch(o: RunOpts): Promise<RunResult> {
  const client = new Anthropic({ apiKey: o.apiKey });
  // newer web search (filters pages before reading them) on Opus/Sonnet; Haiku uses the basic one
  const searchTool = o.model.includes("haiku")
    ? ({ type: "web_search_20250305", name: "web_search", max_uses: o.searches } as const)
    : ({ type: "web_search_20260209", name: "web_search", max_uses: o.searches } as const);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: o.prompt }];
  const blocks: any[] = [];
  let searchesUsed = 0;

  // Server tools can pause long turns (stop_reason "pause_turn"); send the turn back to continue.
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: o.model,
      max_tokens: o.maxTokens ?? 16000, // includes the model's thinking, so leave room
      system: o.system,
      messages,
      tools: [searchTool],
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
  if (status === 401) return "Your Claude API key was rejected. Check it under Connect AI.";
  if (status === 402 || /credit balance/i.test(err?.message || "")) return "Your Claude account is out of credits. Add some at platform.claude.com → Billing.";
  if (status === 404 && /model/i.test(err?.message || "")) return "Your API key can’t use this model. Pick another one under Connect AI.";
  if (status === 429) return "Rate limited by the API — wait a moment and try again.";
  if (status === 400 && /web search/i.test(err?.message || "")) return "Web search isn't enabled for this API key. Turn it on in the Claude Console at platform.claude.com.";
  if (status === 529 || status === 503) return "The AI service is busy right now. Try again in a minute.";
  return err?.message ? String(err.message).slice(0, 300) : "Something went wrong.";
}
