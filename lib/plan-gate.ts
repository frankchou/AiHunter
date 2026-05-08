import { prisma } from "@/lib/prisma";
import { getPlan, withinLimit, type PlanTier } from "@/lib/plans";

type UsageKey = "analysisUsed" | "insightsUsed" | "cvTailorsUsed";
type LimitKey = "resumeAnalysisPerMonth" | "insightsPerMonth" | "cvTailorsPerMonth";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns true if user is allowed to perform the action; throws with user-facing message if not. */
export async function assertPlanLimit(
  userId: string,
  action: "resumeAnalysis" | "insight" | "cvTailor"
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true, usageMonth: true, analysisUsed: true, insightsUsed: true, cvTailorsUsed: true },
  });
  if (!user) throw new Error("User not found");

  const plan = getPlan(user.planTier ?? "free");
  const month = currentMonth();

  // Reset monthly counters if month changed
  if (user.usageMonth !== month) {
    await prisma.user.update({
      where: { id: userId },
      data: { usageMonth: month, analysisUsed: 0, insightsUsed: 0, cvTailorsUsed: 0 },
    });
    user.analysisUsed = 0;
    user.insightsUsed = 0;
    user.cvTailorsUsed = 0;
  }

  const checks: Record<typeof action, { usageKey: UsageKey; limitKey: LimitKey; label: string }> = {
    resumeAnalysis: { usageKey: "analysisUsed",  limitKey: "resumeAnalysisPerMonth", label: "履歷 AI 分析" },
    insight:        { usageKey: "insightsUsed",  limitKey: "insightsPerMonth",       label: "職缺 SWOT 分析" },
    cvTailor:       { usageKey: "cvTailorsUsed", limitKey: "cvTailorsPerMonth",      label: "AI 客製化履歷" },
  };

  const { usageKey, limitKey, label } = checks[action];
  const limit = plan.limits[limitKey] as number;
  const used = user[usageKey] as number;

  if (!withinLimit(used, limit)) {
    const tier = user.planTier ?? "free";
    const msg = tier === "free"
      ? `${label}已達免費版上限，請升級 Pro 或 Max 方案繼續使用。`
      : `本月 ${label} 次數已達上限（${limit} 次），下月自動重置，或升級至更高方案。`;
    throw Object.assign(new Error(msg), { code: "PLAN_LIMIT", tier });
  }
}

/** Call after a successful AI action to increment the usage counter. */
export async function incrementUsage(
  userId: string,
  action: "resumeAnalysis" | "insight" | "cvTailor"
): Promise<void> {
  const field: Record<typeof action, UsageKey> = {
    resumeAnalysis: "analysisUsed",
    insight:        "insightsUsed",
    cvTailor:       "cvTailorsUsed",
  };
  await prisma.user.update({
    where: { id: userId },
    data: { [field[action]]: { increment: 1 } },
  });
}

/** Quick check without throwing — used in UI to decide whether to show gated features. */
export async function canUseFeature(
  userId: string,
  feature: "jobAiScore" | "insight" | "cvTailor" | "savedJobs",
  currentSavedCount?: number
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true, usageMonth: true, analysisUsed: true, insightsUsed: true, cvTailorsUsed: true },
  });
  if (!user) return false;

  const plan = getPlan(user.planTier ?? "free");
  const month = currentMonth();
  const isNewMonth = user.usageMonth !== month;

  if (feature === "jobAiScore") return plan.limits.jobAiScore;

  if (feature === "savedJobs") {
    const count = currentSavedCount ?? 0;
    return withinLimit(count, plan.limits.savedJobs as number);
  }

  const used = isNewMonth ? 0 : (feature === "insight" ? user.insightsUsed : user.cvTailorsUsed);
  const limit = feature === "insight" ? plan.limits.insightsPerMonth : plan.limits.cvTailorsPerMonth;
  return withinLimit(used as number, limit as number);
}
