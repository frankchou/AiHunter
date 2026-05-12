import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Single source of truth for "wipe the user out". Reads every cookie
// on the incoming request and clears anything starting with a NextAuth
// prefix — covers base names, chunked session-token pieces
// (.0/.1/...), and the OAuth-flow ephemerals (state, nonce,
// pkce.code_verifier, callback-url) in one pass. Future NextAuth
// additions are picked up automatically.
//
// Set-Cookie attributes mirror NextAuth's defaults (path=/, httpOnly,
// sameSite=lax, secure iff `__Secure-`/`__Host-` prefix) so the
// browser actually matches & deletes — without that, prefixed cookies
// silently survive the clear.
//
// Location header is relative so it works on localhost, Codespaces,
// and prod behind a proxy without resolving the wrong host.

export const dynamic = "force-dynamic";

function isNextAuthCookie(name: string): boolean {
  return (
    name.startsWith("next-auth.") ||
    name.startsWith("__Secure-next-auth.") ||
    name.startsWith("__Host-next-auth.")
  );
}

function buildLogoutResponse() {
  const res = new NextResponse(null, {
    status: 302,
    headers: { Location: "/login" },
  });
  for (const c of cookies().getAll()) {
    if (!isNextAuthCookie(c.name)) continue;
    res.cookies.set(c.name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: c.name.startsWith("__Secure-") || c.name.startsWith("__Host-"),
    });
  }
  return res;
}

export async function GET()  { return buildLogoutResponse(); }
export async function POST() { return buildLogoutResponse(); }
