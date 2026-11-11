// Keeps people signed in: refreshes the Supabase session cookie on every request.
// There's no sign-in wall. Anyone can use Tack with boards saved in their browser, and sign in
// later to keep them in an account. Without Supabase env vars, accounts are off altogether.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // a signed-in person has no reason to see the sign-in page
  if (user && req.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
  return res;
}

export const config = {
  // skip Next's build files and the API (it doesn't use the session)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
