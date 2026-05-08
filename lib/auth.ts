import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const hasRealDb =
  !!process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("user:password@host");

const providers = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
];

// Without a real DB we use JWT sessions so NextAuth never touches Prisma
function buildJwtOptions(): NextAuthOptions {
  return {
    providers,
    session: { strategy: "jwt" },
    callbacks: {
      session: ({ session, token }) => ({
        ...session,
        user: { ...session.user, id: token.sub ?? "" },
      }),
    },
    pages: { signIn: "/login" },
  };
}

function buildDbOptions(): NextAuthOptions {
  // Dynamic require so the import only runs when we actually have a DB
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaAdapter } = require("@next-auth/prisma-adapter");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require("@/lib/prisma");
  return {
    adapter: PrismaAdapter(prisma),
    providers,
    session: { strategy: "database" },
    callbacks: {
      session: ({ session, user }) => ({
        ...session,
        user: { ...session.user, id: user.id },
      }),
    },
    pages: { signIn: "/login" },
  };
}

export const authOptions: NextAuthOptions = hasRealDb
  ? buildDbOptions()
  : buildJwtOptions();

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
