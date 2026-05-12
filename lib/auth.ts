import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  // Always print NextAuth's internal logs to the dev server console.
  // Costs nothing in production (logs go to stdout); makes debugging
  // future auth-rail issues trivial — without this, csrf/state/pkce
  // failures are silent.
  debug: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 }, // 60 minutes
  callbacks: {
    async jwt({ token, user, account }) {
      // On first sign-in: create/find User in DB and store DB id in token
      if (account?.provider === "google" && user?.email) {
        try {
          const { prisma } = await import("@/lib/prisma");
          // Try to find existing user by email first
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });
          if (!dbUser) {
            // Create new user using Google's sub as the id
            dbUser = await prisma.user.create({
              data: {
                id: token.sub!,
                email: user.email,
                name: user.name ?? null,
                image: user.image ?? null,
              },
              select: { id: true },
            });
          }
          token.dbId = dbUser.id;
        } catch {
          // DB unavailable — fall back to Google sub so auth still works
          token.dbId = token.sub;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = ((token.dbId ?? token.sub) as string) ?? "";
      }
      return session;
    },
    // Override NextAuth's default `redirect` callback. Default falls
    // back to `baseUrl` when callbackUrl is missing/cross-origin — but
    // `/` is now the public landing, so falling there means
    // "successfully signed in, dropped on marketing page." Force /feed
    // as the post-login default; (dashboard)/layout routes to
    // /onboarding when resume/prefs are missing.
    async redirect({ url, baseUrl }) {
      const base = baseUrl.replace(/\/+$/, "");
      if (url.startsWith("/")) return `${base}${url}`;
      try {
        const parsed = new URL(url);
        if (parsed.origin === base) {
          const path = parsed.pathname + parsed.search;
          return path === "/" ? `${base}/feed` : `${base}${path}`;
        }
      } catch { /* fall through */ }
      return `${base}/feed`;
    },
  },
  pages: { signIn: "/login" },
};

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    dbId?: string;
  }
}
