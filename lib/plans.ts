export type PlanTier = "free" | "pro" | "max";

// ── Ticket costs per feature ─────────────────────────────────────────────────
export const TICKET_COSTS = {
  insight:          1,
  cv:               1,
  analysis:         1,  // resume parse + analyze (shared counter)
  industryRefresh:  3,
} as const;
export type BillAction = keyof typeof TICKET_COSTS;

// ── Ad session config ────────────────────────────────────────────────────────
export const AD_DURATION_SEC       = 30;   // seconds per individual ad
export const AD_ADS_PER_SESSION    = 3;    // ads shown per unlock session
export const AD_UNLOCK_MONTHLY_CAP = 5;   // max unlock sessions per month → max 5 tickets/month

// Set NEXT_PUBLIC_ENABLE_AD_UNLOCK=false in .env.local to hide ad unlock UI and block the API.
// Set to true (or omit) once a real ad SDK is integrated and AdMob/AdSense account is approved.
export const AD_UNLOCK_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_AD_UNLOCK !== "false";

// ── Plan definitions ─────────────────────────────────────────────────────────
export const PLANS = {
  free: {
    name: "Free",
    nameZh: "免費版",
    monthlyUsd: 0,
    stripePriceId: null as string | null,
    limits: {
      insightsPerMonth:        3,
      cvTailorsPerMonth:       1,
      analysisPerMonth:        3,    // resume parse + analyze combined
      industryRefreshPerMonth: 0,    // always requires tickets for free
      adUnlock:                true,
      mockInterview:           false,
      forceRefreshIndustry:    false,
    },
    features: [
      "職缺流瀏覽（無限）",
      "AI 深度分析 3 次 / 月",
      "CV 客製 1 次 / 月",
      "履歷解析 3 次 / 月",
      "看廣告獲得解析券（每月上限 5 次）",
    ],
  },
  pro: {
    name: "Pro",
    nameZh: "專業版",
    monthlyUsd: 9.9,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: {
      insightsPerMonth:        30,
      cvTailorsPerMonth:       15,
      analysisPerMonth:        15,
      industryRefreshPerMonth: null as number | null,  // unlimited
      adUnlock:                false,
      mockInterview:           false,
      forceRefreshIndustry:    true,
    },
    features: [
      "AI 深度分析 30 次 / 月",
      "CV 客製 15 次 / 月",
      "履歷解析 15 次 / 月",
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
      insightsPerMonth:        null as number | null,
      cvTailorsPerMonth:       null as number | null,
      analysisPerMonth:        null as number | null,
      industryRefreshPerMonth: null as number | null,
      adUnlock:                false,
      mockInterview:           true,
      forceRefreshIndustry:    true,
    },
    features: [
      "AI 深度分析無限次",
      "CV 客製無限次",
      "履歷解析無限次",
      "AI 模擬面試（即將推出）",
      "全功能優先使用",
    ],
  },
};

export function getPlan(tier: string) {
  return PLANS[(tier as PlanTier) in PLANS ? (tier as PlanTier) : "free"];
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Basic limit check (used in SettingsView for display only).
 * Full billing logic (with ticket fallback) lives in lib/billing.ts.
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
