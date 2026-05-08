import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
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
