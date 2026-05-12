// Maps our 37 internal industry IDs (lib/mock-data.ts INDUSTRIES) to the
// Twinkle Hub / 勞動部 "受僱員工人數、每人薪資-XX業(按職類別分)" dataset
// that backs the salary lookup. Multiple of our industries can share the
// same gov dataset (e.g. all 6 tech-ish industries collapse to 41692
// 出版影音及資通訊業) because that's the granularity the gov data offers.
//
// Industries with null have no government occupational-salary data;
// /salary will show an "等海外資料源接入後再開放" placeholder until
// Phase 2 layers in Adzuna data.

export interface IndustryDatasetMapping {
  datasetId: string;     // Twinkle / MOL dataset_id
  govName: string;       // 政府行業名稱 (shown as footnote in UI)
}

export const INDUSTRY_TO_DATASET: Record<string, IndustryDatasetMapping | null> = {
  // ─── Tech / IT (all map to 出版影音及資通訊業) ────────────────────────
  ai:                { datasetId: "41692", govName: "出版影音及資通訊業" },
  "tech.saas":       { datasetId: "41692", govName: "出版影音及資通訊業" },
  "tech.consumer":   { datasetId: "41692", govName: "出版影音及資通訊業" },
  "tech.infra":      { datasetId: "41692", govName: "出版影音及資通訊業" },
  "tech.security":   { datasetId: "41692", govName: "出版影音及資通訊業" },
  "tech.blockchain": { datasetId: "41692", govName: "出版影音及資通訊業" },
  telecom:           { datasetId: "41692", govName: "出版影音及資通訊業" },
  media:             { datasetId: "41692", govName: "出版影音及資通訊業" },

  // ─── Hardware / Semiconductor / Manufacturing → 製造業 ──────────────
  semiconductor:     { datasetId: "41685", govName: "製造業" },
  hardware:          { datasetId: "41685", govName: "製造業" },
  manufacturing:     { datasetId: "41685", govName: "製造業" },
  automotive:        { datasetId: "41685", govName: "製造業" },
  aerospace:         { datasetId: "41685", govName: "製造業" },
  fmcg:              { datasetId: "41685", govName: "製造業" },
  fashion:           { datasetId: "41685", govName: "製造業" },
  pharma:            { datasetId: "41685", govName: "製造業" },

  // ─── Finance → 金融及保險業 ────────────────────────────────────────
  fintech:           { datasetId: "41693", govName: "金融及保險業" },
  banking:           { datasetId: "41693", govName: "金融及保險業" },
  investment:        { datasetId: "41693", govName: "金融及保險業" },
  insurance:         { datasetId: "41693", govName: "金融及保險業" },

  // ─── Healthcare → 醫療保健 ─────────────────────────────────────────
  health:            { datasetId: "41698", govName: "醫療保健及社會工作服務業" },
  medical:           { datasetId: "41698", govName: "醫療保健及社會工作服務業" },

  // ─── Commerce / Hospitality / Logistics ────────────────────────────
  retail:            { datasetId: "41689", govName: "批發及零售業" },
  food:              { datasetId: "41691", govName: "住宿及餐飲業" },
  travel:            { datasetId: "41691", govName: "住宿及餐飲業" },
  logistics:         { datasetId: "41690", govName: "運輸及倉儲業" },

  // ─── Energy / Construction / Real estate ───────────────────────────
  energy:            { datasetId: "41686", govName: "電力及燃氣供應業" },
  construction:      { datasetId: "41688", govName: "營建工程業" },

  // ─── Professional services ─────────────────────────────────────────
  consulting:        { datasetId: "41695", govName: "專業、科學及技術服務業" },
  legal:             { datasetId: "41695", govName: "專業、科學及技術服務業" },
  advertising:       { datasetId: "41695", govName: "專業、科學及技術服務業" },

  // ─── Education / Culture ───────────────────────────────────────────
  education:         { datasetId: "41697", govName: "教育業" },
  gaming:            { datasetId: "41699", govName: "藝術、娛樂及休閒服務業" },
  sports:            { datasetId: "41699", govName: "藝術、娛樂及休閒服務業" },

  // ─── Other services / no gov data ──────────────────────────────────
  ngo:               { datasetId: "41700", govName: "其他服務業" },
  agriculture:       null,   // no 「按職類別分」 gov dataset
  government:        null,   // gov is the employer; no salary-by-occupation set
};

// Convenience reverse lookup (dataset_id → list of our industries that use it)
// Useful for "this dataset row applies to N of our industries" debugging.
export function industriesForDataset(datasetId: string): string[] {
  return Object.entries(INDUSTRY_TO_DATASET)
    .filter(([, m]) => m?.datasetId === datasetId)
    .map(([k]) => k);
}
