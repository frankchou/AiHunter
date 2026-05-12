import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NextAuth's /api/auth/* routes MUST be dynamic. Without this, Next.js
// App Router can cache GET /api/auth/csrf — and when the cached
// response is served without a fresh Set-Cookie, the next POST to
// /api/auth/signin/google fails the csrf cookie-vs-body match. NextAuth
// then walks a fallback path that surfaces as "sometimes Google login
// works, sometimes URL bounces back to /login?callbackUrl=..."
// intermittently. force-dynamic kills the cache and the intermittency
// with it.
export const dynamic = "force-dynamic";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
