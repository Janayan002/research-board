// POST /api/keys/check  (keys in the x-anthropic-key / x-brave-key headers)
// → { anthropic?: "ok" | "error message", brave?: "ok" | "error message" }
// Checks keys without spending anything: lists models for Claude, one tiny search for Brave.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const clean = (s?: string | null) => (s || "").trim().replace(/^["']|["']$/g, "");

export async function POST(req: Request) {
  const ak = clean(req.headers.get("x-anthropic-key"));
  const bk = clean(req.headers.get("x-brave-key"));
  const model = req.headers.get("x-ai-model") || "";
  const out: { anthropic?: string; brave?: string } = {};

  if (ak) {
    try {
      const client = new Anthropic({ apiKey: ak, maxRetries: 0 });
      if (model) await client.models.retrieve(model);
      else await client.models.list({ limit: 1 });
      out.anthropic = "ok";
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) out.anthropic = "Claude didn’t accept this key. Copy it again from platform.claude.com → API keys.";
      else if (e instanceof Anthropic.PermissionDeniedError) out.anthropic = "This key isn’t allowed to use the API. Check its workspace in the Claude Console.";
      else if (e instanceof Anthropic.NotFoundError) out.anthropic = "This key works, but can’t use the model you picked. Try another model.";
      else out.anthropic = "Couldn’t reach Claude to check the key. Try again in a moment.";
    }
  }

  if (bk) {
    try {
      const r = await fetch("https://api.search.brave.com/res/v1/web/search?q=test&count=1", {
        headers: { Accept: "application/json", "X-Subscription-Token": bk },
      });
      out.brave = r.ok ? "ok" : r.status === 429 ? "ok" : "Brave didn’t accept this key. Check it at api-dashboard.search.brave.com.";
    } catch {
      out.brave = "Couldn’t reach Brave to check the key.";
    }
  }

  return NextResponse.json(out);
}
