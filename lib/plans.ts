export const PLANS = {
  free: {
    name: "Free",
    nameZh: "免費版",
    price: 0,
    limits: {
      resumeAnalysisPerMonth: 1,   // 1次/月，onboarding後就不能重跑
      savedJobs: 5,
      insightsPerMonth: 0,         // 不能看職缺 SWOT
      cvTailorsPerMonth: 0,        // 不能用 CV Tailor
      jobAiScore: false,           // 職缺流不顯示 AI 匹配分數
    },
    features: [
      "AI 解析履歷（1次）",
      "履歷 AI 分析（每月 1 次）",
      "職缺流瀏覽",
      "儲存職缺（最多 5 個）",
    ],
  },
  pro: {
    name: "Pro",
    nameZh: "專業版",
    price: 299,
    limits: {
      resumeAnalysisPerMonth: 10,
      savedJobs: 200,
      insightsPerMonth: 30,
      cvTailorsPerMonth: 15,
      jobAiScore: true,
    },
    features: [
      "AI 解析履歷（無限次）",
      "履歷 AI 分析（每月 10 次）",
      "職缺流 AI 匹配評分",
      "職缺 SWOT 分析（每月 30 次）",
      "AI 客製化履歷（每月 15 次）",
      "儲存職缺（最多 200 個）",
    ],
  },
  max: {
    name: "Max",
    nameZh: "旗艦版",
    price: 599,
    limits: {
      resumeAnalysisPerMonth: -1,  // -1 = unlimited
      savedJobs: -1,
      insightsPerMonth: -1,
      cvTailorsPerMonth: -1,
      jobAiScore: true,
    },
    features: [
      "所有 Pro 功能，全部無限次",
      "職缺 SWOT 分析（無限次）",
      "AI 客製化履歷（無限次）",
      "儲存職缺（無限）",
      "每週 AI 求職市場報告（即將推出）",
      "AI 面試問題預測（即將推出）",
    ],
  },
} as const;

export type PlanTier = keyof typeof PLANS;

export function getPlan(tier: string): typeof PLANS[PlanTier] {
  return PLANS[(tier as PlanTier) in PLANS ? (tier as PlanTier) : "free"];
}

/** -1 means unlimited; otherwise check if used < limit */
export function withinLimit(used: number, limit: number): boolean {
  return limit === -1 || used < limit;
}
