// Sign-in gate: pages and API routes need a signed-in user when Supabase is configured.
// It also refreshes the session cookie on every request, so people stay signed in.
// Without Supabase env vars (local dev), everything is open and boards stay in the browser.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/auth/", "/extension", "/icon.svg", "/tack-extension.zip"];

export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname, search } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
  if (user || isPublic) {
    // a signed-in person has no reason to see the sign-in page
    if (user && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return res;
  }

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // skip Next's build files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
