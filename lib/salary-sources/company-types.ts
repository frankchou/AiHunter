// Source-of-truth for the 6 buckets we expose on /salary's "企業類型"
// filter. The seed list in scripts/seed-company-classifications.mjs
// uses these exact keys. UI labels in zh-TW are co-located here so we
// don't drift between the seed and the rendered filter.

export const COMPANY_TYPES = {
  foreign_tier1:       "Tier-1 外商",        // FAANG + 半導體大廠 + 前段 AI 公司
  foreign_traditional: "傳統外商",            // IBM / Oracle / SAP / Cisco / Big-4 consulting / CPG
  tw_local:            "台商",               // Taiwan-listed conglomerates + local SaaS
  large_enterprise:    "大企業 (其他)",       // > 2000 員工但不歸前三類 (主要為其他國家大型 listed)
  sme:                 "中小企業",            // 50-2000 員工
  startup:             "新創",               // < 50 員工 OR < 5 年成立
} as const;

export type CompanyType = keyof typeof COMPANY_TYPES;
export const ALL_COMPANY_TYPES: CompanyType[] = Object.keys(COMPANY_TYPES) as CompanyType[];
