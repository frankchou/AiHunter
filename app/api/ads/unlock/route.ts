import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentMonth } from "@/lib/plans";

// Called after user completes watching a rewarded ad
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planTier: true, usageMonth: true, adUnlocksUsed: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.planTier !== "free") {
    return NextResponse.json({ error: "Ad unlock is only for Free plan" }, { status: 403 });
  }

  const month = currentMonth();
  const resetNeeded = user.usageMonth !== month;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      adUnlocksUsed: resetNeeded ? 1 : user.adUnlocksUsed + 1,
      usageMonth: month,
    },
  });

  return NextResponse.json({ ok: true, unlocks: resetNeeded ? 1 : user.adUnlocksUsed + 1 });
}
