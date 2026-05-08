// ─── Core domain types ────────────────────────────────────────────────────────

export interface ParsedResume {
  name: string;
  headline: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  skills: { name: string; years: number }[];
  experience: {
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    years: string;
    location: string;
    bullets?: string[];
  }[];
  education?: { degree: string; school: string; startYear?: string; year: string; major?: string }[];
  certifications?: string[];
  awards?: string[];
  languages?: string[];
}

export interface ResumeAnalysis {
  score: number;
  keywords: string[];
  swot: { S: string[]; W: string[]; O: string[]; T: string[] };
  suggestions: { field: string; suggestion: string }[];
  comment: string;
}

export interface JobPreference {
  locations: string[];
  salaryMin: number;
  salaryMax: number | null;
  salaryCcy: string;
  industries: string[];
  employment: string[];
  remote: string[];
  languages: string[];
  titles: string;
}

export interface Job {
  id: string;
  externalId?: string | null;
  title: string;
  company: string;
  ticker?: string | null;
  country: string;
  city: string;
  remote: string;          // "onsite" | "hybrid" | "remote"
  type: string;            // "Full-time" | "Contract" | ...
  salaryMin?: number | null;
  salaryMax?: number | null;
  ccy: string;
  yearsMin?: number | null;
  yearsMax?: number | null;
  industry: string;
  skills: string[];
  description: string;
  source: string;
  sourceUrl: string;
  sourceHash?: string | null;
  postedAt?: Date | string | null;
  crawledAt: Date | string;
  score?: number | null;
  matchReasons: string[];
}

export interface SavedJob {
  id: string;
  jobId: string;
  stage: string;           // "saved" | "preparing" | "applied" | "interview" | "closed"
  notes?: string | null;
  savedAt: Date | string;
  job: Job;
}

export type SWOTKey = "S" | "W" | "O" | "T";

export interface Insight {
  swot: Record<SWOTKey, string[]>;
  risks: { label: string; severity: "high" | "med" | "low"; note: string }[];
  strategy: string;
  questions: { q: string; outline: string }[];
  refs: { title: string; source: string; url: string }[];
}

export interface CVTailor {
  summary: { before: string; after: string };
  bullets: { before: string; after: string }[];
  diffNote: string;
}

export interface IndustryCompany {
  rank: number;
  name: string;
  ticker: string;
  price: number | null;
  d1: number | null;
  m1: number | null;
  y1: number | null;
  pros: string[];
  cons: string[];
  profile: string;
  trend: string;
  sources: { name: string; url: string }[];
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JobFilters {
  q?: string;
  countries?: string[];
  remote?: string[];
  industries?: string[];
  sources?: string[];
  yearsMin?: number;
  yearsMax?: number;
  titles?: string;
  sort?: "score" | "date" | "salary";
  page?: number;
  pageSize?: number;
}
