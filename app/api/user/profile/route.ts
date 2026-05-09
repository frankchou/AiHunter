import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      planTier: true,
      insightsUsed: true,
      analysisUsed: true,
      isSuperUser: true,
      usageMonth: true,
      stripeCustomerId: true,
    },
  });

  return NextResponse.json(user ?? {});
}
