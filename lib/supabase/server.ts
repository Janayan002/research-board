// Supabase on the server (route handlers), reading the session from the request cookies.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const serverHasAccounts = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { for (const { name, value, options } of list) store.set(name, value, options); } catch { /* read-only in some contexts */ }
      },
    },
  });
}
