import { prisma } from "@/lib/prisma";
import {
  getPlan, currentMonth, TICKET_COSTS,
  PRO_COMPANY_FREE_PAGES_PER_MONTH,
  type BillAction,
} from "@/lib/plans";

// Maps action → DB field that tracks its monthly usage
const ACTION_FIELD: Partial<Record<BillAction, "insightsUsed" | "analysisUsed">> = {
  insight:  "insightsUsed",
  analysis: "analysisUsed",   // shared counter: resume parse + analyze + general CV write/draft
  // industryRefresh: no counter (free=tickets, pro/max=unlimited)
  // companyScoring: handled by dedicated consumeCompanyScoring() — per-company-per-month
};

function getLimit(action: BillAction, tier: string): number | null {
  const plan = getPlan(tier);
  switch (action) {
    case "insight":         return plan.limits.insightsPerMonth;
    case "analysis":        return plan.limits.analysisPerMonth;
    case "industryRefresh": return plan.limits.industryRefreshPerMonth;
    case "companyScoring":  return null; // not applicable — use consumeCompanyScoring()
  }
}

type OkResult   = { ok: true;  fromTicket: boolean };
type DenyResult = { ok: false; planTier: string; tickets: number; adSessionsLeft: number };
export type BillResult = OkResult | DenyResult;

/**
 * Atomically checks the plan limit and deducts usage or tickets.
 * Returns ok:true if the action is allowed (and already recorded in DB).
 * isSuperUser=true in the DB bypasses all limits with no usage tracking.
 */
export async function consumeUsage(userId: string, action: BillAction): Promise<BillResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSuperUser:   true,
      planTier:      true,
      usageMonth:    true,
      insightsUsed:  true,
      analysisUsed:  true,
      adTickets:     true,
      adUnlocksUsed: true,
    },
  });
  if (!user) return { ok: false, planTier: "free", tickets: 0, adSessionsLeft: 0 };

  // Super user bypasses all limits — no usage recorded
  if (user.isSuperUser) return { ok: true, fromTicket: false };

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

// ─── Company scoring (Top 20 modal) ──────────────────────────────────────
//
// Different from consumeUsage(): tracks per-company-per-month allowance for
// Pro tier (hard-cap, no ticket fallback). Free uses tickets, Max is free.
//
// Returns ok:true if unlocked (and usage recorded). Otherwise returns reason
// so UI can show the right prompt (升級 / 廣告券 / 等下月).

export type CompanyScoringDeny =
  | { ok: false; reason: "FREE_NO_TICKETS"; planTier: "free"; tickets: number; adSessionsLeft: number }
  | { ok: false; reason: "PRO_QUOTA_EXCEEDED"; planTier: "pro"; pagesUnlocked: number; quotaMax: number; resetAt: string }
  | { ok: false; reason: "NO_USER"; planTier: "free"; tickets: 0 };

export type CompanyScoringResult =
  | { ok: true; fromTicket: boolean; planTier: string }
  | CompanyScoringDeny;

function nextMonthFirstIso(): string {
  const d = new Date();
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

export async function consumeCompanyScoring(
  userId: string,
  companyName: string,
): Promise<CompanyScoringResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSuperUser:   true,
      planTier:      true,
      adTickets:     true,
      adUnlocksUsed: true,
      usageMonth:    true,
    },
  });
  if (!user) return { ok: false, reason: "NO_USER", planTier: "free", tickets: 0 };

  if (user.isSuperUser) return { ok: true, fromTicket: false, planTier: user.planTier };
  if (user.planTier === "max") return { ok: true, fromTicket: false, planTier: "max" };

  // Pro: hard-cap by monthly per-company allowance, no ticket fallback
  if (user.planTier === "pro") {
    const month = currentMonth();
    const usage = await prisma.companyUnlockUsage.findUnique({
      where: { userId_company_month: { userId, company: companyName, month } },
    });
    const pagesUsed = usage?.pagesUnlocked ?? 0;
    if (pagesUsed < PRO_COMPANY_FREE_PAGES_PER_MONTH) {
      await prisma.companyUnlockUsage.upsert({
        where:  { userId_company_month: { userId, company: companyName, month } },
        create: { userId, company: companyName, month, pagesUnlocked: 1 },
        update: { pagesUnlocked: { increment: 1 } },
      });
      return { ok: true, fromTicket: false, planTier: "pro" };
    }
    return {
      ok: false,
      reason: "PRO_QUOTA_EXCEEDED",
      planTier: "pro",
      pagesUnlocked: pagesUsed,
      quotaMax: PRO_COMPANY_FREE_PAGES_PER_MONTH,
      resetAt: nextMonthFirstIso(),
    };
  }

  // Free: pay 1 ticket per page
  const cost = TICKET_COSTS.companyScoring;
  if (user.adTickets >= cost) {
    await prisma.user.update({
      where: { id: userId },
      data:  { adTickets: { decrement: cost } },
    });
    return { ok: true, fromTicket: true, planTier: "free" };
  }
  const month = currentMonth();
  const resetNeeded = user.usageMonth !== month;
  const effectiveAdSessions = resetNeeded ? 0 : user.adUnlocksUsed;
  return {
    ok: false,
    reason: "FREE_NO_TICKETS",
    planTier: "free",
    tickets: user.adTickets,
    adSessionsLeft: Math.max(0, 5 - effectiveAdSessions),
  };
}

// Read-only: how many pages a Pro user has unlocked for this company this month.
// Used by UI to show "2/2 已用" before they try to click.
export async function getProMonthlyUsage(userId: string, companyName: string): Promise<{ used: number; quota: number; resetAt: string }> {
  const month = currentMonth();
  const usage = await prisma.companyUnlockUsage.findUnique({
    where: { userId_company_month: { userId, company: companyName, month } },
  });
  return {
    used:    usage?.pagesUnlocked ?? 0,
    quota:   PRO_COMPANY_FREE_PAGES_PER_MONTH,
    resetAt: nextMonthFirstIso(),
  };
}
