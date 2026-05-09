import { prisma } from "@/lib/prisma";
import { getPlan, currentMonth, TICKET_COSTS, type BillAction } from "@/lib/plans";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "frank200231@gmail.com";

// Maps action → DB field that tracks its monthly usage
const ACTION_FIELD: Partial<Record<BillAction, "insightsUsed" | "cvTailorsUsed" | "analysisUsed">> = {
  insight:  "insightsUsed",
  cv:       "cvTailorsUsed",
  analysis: "analysisUsed",
  // industryRefresh has no counter: free=always tickets, pro/max=unlimited
};

function getLimit(action: BillAction, tier: string): number | null {
  const plan = getPlan(tier);
  switch (action) {
    case "insight":         return plan.limits.insightsPerMonth;
    case "cv":              return plan.limits.cvTailorsPerMonth;
    case "analysis":        return plan.limits.analysisPerMonth;
    case "industryRefresh": return plan.limits.industryRefreshPerMonth;
  }
}

type OkResult   = { ok: true;  fromTicket: boolean };
type DenyResult = { ok: false; planTier: string; tickets: number; adSessionsLeft: number };
export type BillResult = OkResult | DenyResult;

/**
 * Atomically checks the plan limit and deducts usage or tickets.
 * Returns ok:true if the action is allowed (and already recorded in DB).
 */
export async function consumeUsage(userId: string, action: BillAction): Promise<BillResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email:         true,
      planTier:      true,
      usageMonth:    true,
      insightsUsed:  true,
      cvTailorsUsed: true,
      analysisUsed:  true,
      adTickets:     true,
      adUnlocksUsed: true,
    },
  });
  if (!user) return { ok: false, planTier: "free", tickets: 0, adSessionsLeft: 0 };

  // Owner account bypasses all limits
  if (user.email === OWNER_EMAIL) return { ok: true, fromTicket: false };

  const month       = currentMonth();
  const resetNeeded = user.usageMonth !== month;
  const tickets     = user.adTickets;
  const ticketCost  = TICKET_COSTS[action];
  const limit       = getLimit(action, user.planTier ?? "free");
  const dbField     = ACTION_FIELD[action] ?? null;

  // Effective used count this month
  const rawUsed = dbField ? (user[dbField] as number) : 0;
  const effectiveUsed = resetNeeded ? 0 : rawUsed;

  const withinFreeQuota = limit === null || effectiveUsed < limit;

  if (withinFreeQuota) {
    if (dbField) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          [dbField]: resetNeeded ? 1 : { increment: 1 },
          usageMonth: resetNeeded ? month : undefined,
        },
      });
    }
    return { ok: true, fromTicket: false };
  }

  // Over free quota — try spending tickets
  if (tickets >= ticketCost) {
    const updateData: Record<string, unknown> = {
      adTickets: { decrement: ticketCost },
      usageMonth: resetNeeded ? month : undefined,
    };
    if (dbField) updateData[dbField] = resetNeeded ? 1 : { increment: 1 };

    await prisma.user.update({ where: { id: userId }, data: updateData });
    return { ok: true, fromTicket: true };
  }

  // Denied — return info for the 402 response
  const effectiveAdSessions = resetNeeded ? 0 : user.adUnlocksUsed;
  return {
    ok: false,
    planTier: user.planTier ?? "free",
    tickets,
    adSessionsLeft: Math.max(0, 5 - effectiveAdSessions),
  };
}
