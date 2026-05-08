import axios from "axios";
import type { Job } from "@/lib/types";
import { hashUrl } from "@/lib/utils";

interface JSearchJob {
  job_id: string;
  employer_name: string;
  employer_logo: string | null;
  job_publisher: string;        // "LinkedIn" | "Indeed" | "Glassdoor" | etc.
  job_employment_type: string;  // "FULLTIME" | "PARTTIME" | "CONTRACTOR" | "INTERN"
  job_title: string;
  job_apply_link: string;
  job_description: string;
  job_is_remote: boolean;
  job_posted_at_datetime_utc: string | null;
  job_city: string | null;
  job_state: string | null;
  job_country: string;           // ISO-2 e.g. "US", "TW", "JP"
  job_required_skills: string[] | null;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_salary_period: string | null;  // "YEAR" | "MONTH" | "HOUR"
  job_required_experience: {
    required_experience_in_months: number | null;
  } | null;
  job_highlights: {
    Qualifications?: string[];
    Responsibilities?: string[];
  } | null;
}

interface JSearchResponse {
  status: string;
  data: JSearchJob[];
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULLTIME: "Full-time",
  PARTTIME: "Part-time",
  CONTRACTOR: "Contract",
  INTERN: "Internship",
};

const COUNTRY_CCY: Record<string, string> = {
  US: "USD", GB: "GBP", TW: "TWD", JP: "JPY",
  AU: "AUD", SG: "SGD", DE: "EUR", HK: "HKD",
  CA: "CAD", FR: "EUR", NL: "EUR", KR: "KRW",
};

function inferIndustry(title: string, publisher: string): string {
  const t = title.toLowerCase();
  if (t.includes("data") || t.includes("ml") || t.includes("ai") || t.includes("machine learning")) return "ai";
  if (t.includes("software") || t.includes("engineer") || t.includes("developer") || t.includes("backend") || t.includes("frontend")) return "tech.saas";
  if (t.includes("product")) return "tech.saas";
  if (t.includes("finance") || t.includes("accounting") || t.includes("fintech")) return "fintech";
  if (t.includes("marketing") || t.includes("growth")) return "tech.consumer";
  if (t.includes("design") || t.includes("ux") || t.includes("ui")) return "tech.consumer";
  if (t.includes("sales") || t.includes("account")) return "tech.saas";
  return "tech.saas";
}

function normalizeSalary(
  minRaw: number | null,
  maxRaw: number | null,
  period: string | null
): { min: number | null; max: number | null } {
  if (!minRaw && !maxRaw) return { min: null, max: null };
  // Convert hourly / monthly → annual
  const multiplier = period === "HOUR" ? 2080 : period === "MONTH" ? 12 : 1;
  return {
    min: minRaw ? Math.round(minRaw * multiplier) : null,
    max: maxRaw ? Math.round(maxRaw * multiplier) : null,
  };
}

export async function fetchJSearchJobs(
  queries: string[],  // e.g. ["product manager Taiwan", "senior engineer remote"]
  options: { remoteOnly?: boolean; datePosted?: "all" | "today" | "3days" | "week" | "month" } = {}
): Promise<Job[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  const { remoteOnly = false, datePosted = "week" } = options;
  const results: Job[] = [];
  const seen = new Set<string>();

  for (const query of queries.slice(0, 4)) {
    try {
      const { data } = await axios.get<JSearchResponse>(
        "https://jsearch.p.rapidapi.com/search",
        {
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
          params: {
            query,
            page: "1",
            num_results: "10",
            date_posted: datePosted,
            remote_jobs_only: remoteOnly ? "true" : "false",
          },
          timeout: 15_000,
        }
      );

      for (const j of data.data ?? []) {
        if (seen.has(j.job_id)) continue;
        seen.add(j.job_id);

        const sourceUrl = j.job_apply_link;
        const { min, max } = normalizeSalary(j.job_min_salary, j.job_max_salary, j.job_salary_period);
        const expMonths = j.job_required_experience?.required_experience_in_months ?? null;
        const skills = j.job_required_skills?.slice(0, 8) ?? [];

        // Build a clean description from highlights if available
        let description = j.job_description?.slice(0, 2000) ?? "";
        if (j.job_highlights?.Responsibilities?.length) {
          description = j.job_highlights.Responsibilities.join("\n").slice(0, 1000)
            + "\n\n" + description.slice(0, 1000);
        }

        results.push({
          id: `jsearch_${j.job_id}`,
          externalId: `jsearch_${j.job_id}`,
          title: j.job_title,
          company: j.employer_name,
          ticker: null,
          country: j.job_country?.toUpperCase() ?? "—",
          city: [j.job_city, j.job_state].filter(Boolean).join(", ") || (j.job_is_remote ? "Remote" : "—"),
          remote: j.job_is_remote ? "remote" : "onsite",
          type: EMPLOYMENT_TYPE_MAP[j.job_employment_type] ?? "Full-time",
          salaryMin: min,
          salaryMax: max,
          ccy: j.job_salary_currency ?? COUNTRY_CCY[j.job_country?.toUpperCase() ?? ""] ?? "USD",
          yearsMin: expMonths ? Math.floor(expMonths / 12) : null,
          yearsMax: null,
          industry: inferIndustry(j.job_title, j.job_publisher),
          skills,
          description: description.slice(0, 3000),
          source: `jsearch:${j.job_publisher.toLowerCase()}`,  // e.g. "jsearch:linkedin"
          sourceUrl,
          sourceHash: hashUrl(sourceUrl),
          postedAt: j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc).toISOString() : null,
          crawledAt: new Date().toISOString(),
          score: null,
          matchReasons: [],
        });
      }
    } catch (e) {
      console.warn(`[jsearch] query="${query}" error:`, (e as Error).message);
    }
  }

  return results;
}
