export type PlanTier = "free" | "pro" | "max";

// ── Ticket costs per feature ─────────────────────────────────────────────────
// CV Tailor (針對性履歷) is Max-only and not billed via tickets/quota — see canUseCVTailor()
export const TICKET_COSTS = {
  insight:          1,
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
    monthlyTwd: 0,
    currency:   "TWD",
    stripePriceId: null as string | null,
    limits: {
      insightsPerMonth:        3,
      analysisPerMonth:        3,    // shared: resume parse + analyze + general CV write/draft
      industryRefreshPerMonth: 0,    // always requires tickets for free
      adUnlock:                true,
      tailoredDocuments:       false, // B 履歷 + B CV，Max only
      versionFolder:           false, // 履歷版本夾，Max only
      mockInterview:           false,
      forceRefreshIndustry:    false,
    },
    features: [
      "職缺流瀏覽（無限）",
      "AI 深度分析 3 次 / 月",
      "履歷解析 + CV 編寫 3 次 / 月（共用配額）",
      "看廣告獲得解析券（每月上限 5 次）",
    ],
  },
  pro: {
    name: "Pro",
    nameZh: "專業版",
    monthlyTwd: 300,
    currency:   "TWD",
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: {
      insightsPerMonth:        30,
      analysisPerMonth:        15,
      industryRefreshPerMonth: null as number | null,  // unlimited
      adUnlock:                false,
      tailoredDocuments:       false,
      versionFolder:           false,
      mockInterview:           false,
      forceRefreshIndustry:    true,
    },
    features: [
      "AI 深度分析 30 次 / 月",
      "履歷解析 + CV 編寫 15 次 / 月（共用配額）",
      "產業 Top 20 強制更新",
      "無廣告",
    ],
  },
  max: {
    name: "Max",
    nameZh: "旗艦版",
    monthlyTwd: 800,
    currency:   "TWD",
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID ?? null,
    limits: {
      insightsPerMonth:        null as number | null,
      analysisPerMonth:        null as number | null,
      industryRefreshPerMonth: null as number | null,
      adUnlock:                false,
      tailoredDocuments:       true,
      versionFolder:           true,
      mockInterview:           true,
      forceRefreshIndustry:    true,
    },
    features: [
      "AI 深度分析無限次",
      "履歷解析 + CV 編寫無限次",
      "針對性履歷 + 針對性 CV（每職缺一份，無限產生）",
      "履歷版本夾（集中管理所有版本）",
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

/** Convenience: is the user on the Max tier (or super user)? */
export function isMaxTier(planTier: string | null | undefined): boolean {
  return planTier === "max";
}

/** Cancellation / downgrade reasons surfaced in the feedback modal. */
export const CANCEL_REASON_KEYS = [
  "price",            // 太貴
  "not_using",        // 沒時間用 / 不再求職
  "missing_features", // 功能不夠用
  "found_job",        // 找到工作了
  "buggy",            // 系統不好用 / bug 太多
  "switched_tool",    // 改用其他工具
  "other",            // 其他
] as const;
export type CancelReasonKey = (typeof CANCEL_REASON_KEYS)[number];

export const CANCEL_REASON_LABELS: Record<CancelReasonKey, string> = {
  price:            "覺得太貴",
  not_using:        "沒時間用 / 不再求職",
  missing_features: "功能不夠用",
  found_job:        "已經找到工作了",
  buggy:            "系統不好用 / 遇到問題",
  switched_tool:    "改用其他工具",
  other:            "其他原因",
};

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
