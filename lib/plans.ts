export type PlanTier = "free" | "pro" | "max";

export const PLANS = {
  free: {
    name: "Free",
    nameZh: "免費版",
    monthlyUsd: 0,
    stripePriceId: null as string | null,
    limits: {
      insightsPerMonth: 3,
      cvTailorsPerMonth: 1,
      adUnlock: true,
      mockInterview: false,
      forceRefreshIndustry: false,
    },
    features: [
      "職缺流瀏覽（無限）",
      "AI 深度分析 3 次 / 月",
      "CV 客製 1 次 / 月",
      "看廣告解鎖額外分析次數",
    ],
  },
  pro: {
    name: "Pro",
    nameZh: "專業版",
    monthlyUsd: 9.9,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: {
      insightsPerMonth: 30,
      cvTailorsPerMonth: 15,
      adUnlock: false,
      mockInterview: false,
      forceRefreshIndustry: true,
    },
    features: [
      "AI 深度分析 30 次 / 月",
      "CV 客製 15 次 / 月",
      "產業 Top 100 強制更新",
      "無廣告",
    ],
  },
  max: {
    name: "Max",
    nameZh: "旗艦版",
    monthlyUsd: 29.9,
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID ?? null,
    limits: {
      insightsPerMonth: null as number | null,  // unlimited
      cvTailorsPerMonth: null as number | null,
      adUnlock: false,
      mockInterview: true,
      forceRefreshIndustry: true,
    },
    features: [
      "AI 深度分析無限次",
      "CV 客製無限次",
      "AI 模擬面試（即將推出）",
      "全功能優先使用",
    ],
  },
};

export function getPlan(tier: string) {
  return PLANS[(tier as PlanTier) in PLANS ? (tier as PlanTier) : "free"];
}

export const AD_DURATION_SEC = 30;

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Check usage against plan limit, accounting for monthly reset.
 * adUnlocks = extra credits earned by watching ads this month.
 */
export function checkLimit(opts: {
  used: number;
  adUnlocks: number;
  limit: number | null;
  usageMonth: string | null;
}): { allowed: boolean; remaining: number | null; resetNeeded: boolean } {
  const { used, adUnlocks, limit, usageMonth } = opts;
  const month = currentMonth();
  const resetNeeded = usageMonth !== month;
  const effectiveUsed = resetNeeded ? 0 : used;
  const effectiveAdUnlocks = resetNeeded ? 0 : adUnlocks;

  if (limit === null) return { allowed: true, remaining: null, resetNeeded };
  const remaining = Math.max(0, limit + effectiveAdUnlocks - effectiveUsed);
  return { allowed: remaining > 0, remaining, resetNeeded };
}
