// Phase 2 of /salary: aggregate the existing Job table (populated by
// Adzuna via the Top 20 + job-feed pipelines) into salary percentiles
// broken down by country, company type, and experience bucket.
//
// Trade-offs vs the TW gov path:
//   - Real percentile distribution (P25/P50/P75) because we have many
//     individual job rows, not a pre-aggregated table.
//   - But: each job's salary is a min-max RANGE the EMPLOYER set, not
//     what an actual employee earns. Treat it as "advertised pay".
//   - Adzuna coverage by country is uneven (US/UK/AU/EU good; JP/KR/CN
//     near-zero); we expose that gap honestly in the response.
//   - Experience filter uses Job.yearsMin/yearsMax (Adzuna's "required
//     years" field), which is a proxy for the actual employee's
//     experience — fine for ballpark, lousy for personal benchmarking.

import { prisma } from "@/lib/prisma";
import type { CompanyType } from "./company-types";

// Display target is always TWD. These are coarse static rates — fine
// enough for "ballpark salary" use, not financial-grade. Update when
// they drift > 10%.
export const FX_TO_TWD: Record<string, number> = {
  TWD: 1,
  USD: 32,
  GBP: 40.5,
  EUR: 35,
  AUD: 21,
  CAD: 23,
  SGD: 24,
  JPY: 0.21,
  NZD: 19,
  CHF: 36,
  // Anything not listed → fall back to 1 (will look wrong; that's fine,
  // makes the bug obvious so we add the missing currency.)
};

// Maps user-facing country codes to Adzuna country tags. EU is a
// composite (Adzuna's per-country EU coverage is fragmented).
export const COUNTRY_TO_ADZUNA: Record<string, string[]> = {
  TW: ["TW"],
  US: ["US"],
  UK: ["GB"],
  AU: ["AU"],
  EU: ["DE", "FR", "NL", "ES", "IT", "PL"],
  // JP / KR / CN intentionally absent — Adzuna doesn't index them in a
  // meaningful way. The UI shows these as 灰 disabled chips.
};

// Buckets the user can pick; each maps to a Job.yearsMin / yearsMax
// overlap predicate.
export const EXPERIENCE_BUCKETS: Record<string, { label: string; min: number; max: number }> = {
  exp_0:    { label: "0 年（應屆）",   min: 0,  max: 0  },
  exp_1_3:  { label: "1-3 年",        min: 1,  max: 3  },
  exp_3_7:  { label: "3-7 年",        min: 3,  max: 7  },
  exp_7_10: { label: "7-10 年",       min: 7,  max: 10 },
  exp_10p:  { label: "10+ 年",        min: 10, max: 99 },
};

export interface AdzunaSalaryQuery {
  industry?:    string;        // our internal industry id (e.g., "ai")
  country:      keyof typeof COUNTRY_TO_ADZUNA;
  companyType?: CompanyType | null;
  experience?:  keyof typeof EXPERIENCE_BUCKETS | null;
}

export interface AdzunaSalaryResult {
  sampleSize:   number;
  p25Annual:    number | null;   // TWD per year
  p50Annual:    number | null;
  p75Annual:    number | null;
  meanAnnual:   number | null;
  monthlyFromAnnual: (annual: number | null) => number | null;
}

// Build the Prisma where clause given the filters. Note the JOIN on
// CompanyClassification — we use a sub-select that resolves company
// names belonging to the requested type, then constrain Job.company
// to match any of them via OR `contains`.
async function buildJobWhere(q: AdzunaSalaryQuery): Promise<Record<string, unknown> | null> {
  const where: Record<string, unknown> = {
    source: "adzuna",
    country: { in: COUNTRY_TO_ADZUNA[q.country] },
    OR: [
      { salaryMin: { not: null, gt: 0 } },
      { salaryMax: { not: null, gt: 0 } },
    ],
  };
  if (q.industry) {
    where.industry = q.industry;
  }
  if (q.companyType) {
    const matches = await prisma.companyClassification.findMany({
      where: { companyType: q.companyType },
      select: { companyName: true },
    });
    if (matches.length === 0) return null;   // nothing in this bucket
    where.OR = [
      ...(where.OR as Array<Record<string, unknown>>),
      // override OR: keep the salary>0 part *and* add the company-name match
    ];
    // Compose: (salaryMin>0 OR salaryMax>0) AND (company matches any seed)
    where.AND = [
      {
        OR: [
          { salaryMin: { not: null, gt: 0 } },
          { salaryMax: { not: null, gt: 0 } },
        ],
      },
      {
        OR: matches.map((m) => ({
          company: { contains: m.companyName, mode: "insensitive" as const },
        })),
      },
    ];
    delete where.OR;  // moved into AND
  }
  if (q.experience) {
    const b = EXPERIENCE_BUCKETS[q.experience];
    // Job spans [yearsMin, yearsMax]; bucket spans [b.min, b.max].
    // Overlap iff Job.yearsMin <= b.max AND Job.yearsMax >= b.min.
    // Allow nulls on either side as "matches anything".
    where.yearsMin = { lte: b.max };
    where.yearsMax = { gte: b.min };
  }
  return where;
}

function pickMidpoint(min: number | null, max: number | null): number | null {
  if (min != null && max != null && min > 0 && max > 0) return (min + max) / 2;
  if (min != null && min > 0) return min;
  if (max != null && max > 0) return max;
  return null;
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export async function aggregateAdzunaSalary(q: AdzunaSalaryQuery): Promise<AdzunaSalaryResult> {
  const where = await buildJobWhere(q);
  if (!where) {
    return { sampleSize: 0, p25Annual: null, p50Annual: null, p75Annual: null, meanAnnual: null, monthlyFromAnnual: () => null };
  }

  type JobSalaryRow = {
    salaryMin: number | null;
    salaryMax: number | null;
    ccy:       string | null;
  };
  const jobs: JobSalaryRow[] = await prisma.job.findMany({
    where: where as never,
    select: { salaryMin: true, salaryMax: true, ccy: true },
    take: 5000,
  });

  // Convert each job's midpoint salary into annual TWD. Adzuna salaryMin /
  // salaryMax are usually ANNUAL in local currency; some US listings are
  // monthly or hourly, but Adzuna normalises most. Treat the figure as
  // annual unless absurdly small (heuristic: < 100,000 in USD/GBP/etc.
  // would be plausible as monthly).
  const annualsTwd: number[] = [];
  for (const j of jobs) {
    const mid = pickMidpoint(j.salaryMin, j.salaryMax);
    if (mid == null) continue;
    const fx = j.ccy && FX_TO_TWD[j.ccy] ? FX_TO_TWD[j.ccy] : 1;
    const inTwd = mid * fx;
    // Reject obvious junk — Adzuna sometimes has 1-3 digit numbers due to
    // unit confusion. Anything < 100k TWD/year is almost certainly wrong.
    if (inTwd < 100_000) continue;
    // And cap at NT$30M/year — single Olympic-level outliers shouldn't
    // dominate the distribution.
    if (inTwd > 30_000_000) continue;
    annualsTwd.push(inTwd);
  }

  if (annualsTwd.length === 0) {
    return { sampleSize: 0, p25Annual: null, p50Annual: null, p75Annual: null, meanAnnual: null, monthlyFromAnnual: () => null };
  }
  annualsTwd.sort((a, b) => a - b);
  const mean = annualsTwd.reduce((s, x) => s + x, 0) / annualsTwd.length;
  return {
    sampleSize:        annualsTwd.length,
    p25Annual:         Math.round(percentile(annualsTwd, 0.25)),
    p50Annual:         Math.round(percentile(annualsTwd, 0.50)),
    p75Annual:         Math.round(percentile(annualsTwd, 0.75)),
    meanAnnual:        Math.round(mean),
    monthlyFromAnnual: (annual) => annual == null ? null : Math.round(annual / 12),
  };
}
