// Site-wide password (SITE_PASSWORD env var). When it's not set, the app is open (handy for local dev).
// The cookie holds a hash of the password, so changing SITE_PASSWORD signs everyone out.

export const AUTH_COOKIE = "tack_auth";

export async function authToken(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tack:${password}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

// compare without bailing early, so timing doesn't leak how much matched
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
