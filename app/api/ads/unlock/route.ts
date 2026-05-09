import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentMonth, AD_UNLOCK_MONTHLY_CAP, AD_UNLOCK_ENABLED } from "@/lib/plans";

// Called after user completes watching all ads in one session (AD_ADS_PER_SESSION ads)
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planTier: true, usageMonth: true, adUnlocksUsed: true, adTickets: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!AD_UNLOCK_ENABLED) {
    return NextResponse.json({ error: "Ad unlock is disabled" }, { status: 503 });
  }

  if (user.planTier !== "free") {
    return NextResponse.json({ error: "Ad unlock is only for Free plan" }, { status: 403 });
  }

  const month = currentMonth();
  const resetNeeded = user.usageMonth !== month;
  const effectiveSessions = resetNeeded ? 0 : user.adUnlocksUsed;

  if (effectiveSessions >= AD_UNLOCK_MONTHLY_CAP) {
    return NextResponse.json({
      error: "MONTHLY_CAP_REACHED",
      sessionsUsed: AD_UNLOCK_MONTHLY_CAP,
      sessionsLeft: 0,
    }, { status: 429 });
  }

  const newSessions = effectiveSessions + 1;
  const newTickets  = user.adTickets + 1;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      adTickets:     newTickets,
      adUnlocksUsed: resetNeeded ? 1 : { increment: 1 },
      usageMonth:    resetNeeded ? month : undefined,
    },
  });

  return NextResponse.json({
    ok: true,
    tickets:      newTickets,
    sessionsUsed: newSessions,
    sessionsLeft: AD_UNLOCK_MONTHLY_CAP - newSessions,
  });
}
