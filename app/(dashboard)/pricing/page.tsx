import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PricingView } from "@/components/subscription/PricingView";
import { currentMonth } from "@/lib/plans";
import type { PlanTier } from "@/lib/plans";

export async function generateMetadata() {
  return { title: "升級方案 — AI Hunter" };
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      planTier: true,
      isSuperUser: true,
      insightsUsed: true,
      analysisUsed: true,
      adTickets: true,
      adUnlocksUsed: true,
      usageMonth: true,
    },
  });

  const tier = (user?.planTier ?? "free") as PlanTier;
  const month = currentMonth();
  const resetNeeded = user?.usageMonth !== month;

  return (
    <PricingView
      currentTier={tier}
      isSuperUser={user?.isSuperUser ?? false}
      showReturnToSettings={searchParams.from === "settings"}
      usageSummary={{
        insightsUsed:   resetNeeded ? 0 : (user?.insightsUsed ?? 0),
        analysisUsed:   resetNeeded ? 0 : (user?.analysisUsed ?? 0),
        adTickets:      user?.adTickets ?? 0,
        adUnlocksUsed:  resetNeeded ? 0 : (user?.adUnlocksUsed ?? 0),
        month,
      }}
    />
  );
}
