// POST /api/login  { password }  → sets the login cookie

import { NextResponse } from "next/server";
import { AUTH_COOKIE, authToken, sameString } from "@/lib/auth";

export async function POST(req: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => ({}));
  const given = typeof body?.password === "string" ? body.password : "";
  if (!sameString(await authToken(given), await authToken(password))) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
