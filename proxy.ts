// Password gate: every page and API route needs the login cookie when SITE_PASSWORD is set.

import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, sameString } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value || "";
  if (cookie && sameString(cookie, await authToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // skip Next's build files and the tab icon
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
