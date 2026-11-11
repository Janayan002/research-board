"use client";

// Supabase in the browser: sign-in and the user's own boards (row-level security keeps it to their rows).
// When the project isn't configured (no env vars), the app runs without accounts: boards stay in this browser.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const hasAccounts = Boolean(SUPABASE_URL && SUPABASE_KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!hasAccounts) return null;
  return (client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY));
}
