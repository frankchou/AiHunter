export interface CultureTag {
  key: string;
  label: string;
  patterns: string[];
}

export const CULTURE_TAGS: CultureTag[] = [
  { key: "remote-friendly", label: "遠端友善", patterns: ["remote", "work from home", "wfh", "遠端", "居家"] },
  { key: "flexible", label: "彈性工作", patterns: ["flexible", "flexibility", "work-life balance", "彈性", "工作生活平衡"] },
  { key: "flat-org", label: "扁平組織", patterns: ["flat organization", "flat culture", "no hierarchy", "扁平", "水平組織"] },
  { key: "startup", label: "新創精神", patterns: ["startup", "fast-paced", "fast pace", "agile culture", "新創", "快速成長", "快節奏"] },
  { key: "learning", label: "學習成長", patterns: ["learning", "growth", "training", "mentorship", "upskill", "成長", "學習", "培訓", "導師"] },
  { key: "diversity", label: "多元包容", patterns: ["diversity", "inclusion", "inclusive", "equal opportunity", "多元", "包容", "平等"] },
  { key: "global", label: "國際化", patterns: ["global", "international", "multinational", "worldwide", "國際", "跨國", "全球"] },
  { key: "wellbeing", label: "員工福祉", patterns: ["wellbeing", "wellness", "mental health", "health insurance", "福利", "福祉", "健康保險"] },
  { key: "innovation", label: "創新文化", patterns: ["innovative", "innovation", "cutting-edge", "cutting edge", "創新", "尖端技術"] },
  { key: "collaboration", label: "協作文化", patterns: ["collaborative", "collaboration", "teamwork", "cross-functional", "協作", "團隊合作"] },
];

export function extractCultureTags(description: string): string[] {
  const lower = description.toLowerCase();
  return CULTURE_TAGS
    .filter((tag) => tag.patterns.some((p) => lower.includes(p.toLowerCase())))
    .map((tag) => tag.label);
}

export function cultureKeysToPatterns(keys: string[]): string[] {
  return keys.flatMap((key) => CULTURE_TAGS.find((t) => t.key === key)?.patterns ?? []);
}
