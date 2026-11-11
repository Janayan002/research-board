// Where Supabase sends people back after a magic link, Google sign-in or a password reset.
// It turns the one-time code in the URL into a session cookie, then continues to the app.

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const fail = (message: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  // Supabase sends expired links and cancelled Google sign-ins back here with an error instead of a code
  const described = url.searchParams.get("error_description");
  if (described) return fail(url.searchParams.get("error_code") === "otp_expired" ? "That link has expired or was already used. Request a new one." : described);

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
    return fail(error.message);
  }
  return NextResponse.redirect(new URL("/login", url.origin));
}
