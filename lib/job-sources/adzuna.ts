import axios from "axios";
import type { Job } from "@/lib/types";
import { hashUrl } from "@/lib/utils";

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  created: string;
  category: { label: string; tag: string };
  contract_type?: string;
}

const COUNTRY_CODES = ["tw", "gb", "us", "jp", "au", "sg", "de"];

const COUNTRY_CCY: Record<string, string> = {
  us: "USD", gb: "GBP", tw: "TWD", jp: "JPY",
  au: "AUD", sg: "SGD", de: "EUR",
};

const CATEGORY_INDUSTRY: Record<string, string> = {
  "it-jobs": "tech.saas",
  "scientific-qa-jobs": "tech.saas",
  "engineering-jobs": "ai",
  "finance-jobs": "fintech",
  "healthcare-nursing-jobs": "health",
  "retail-jobs": "retail",
};

export async function fetchAdzunaJobs(
  keywords: string = "product manager",
  countries: string[] = ["tw", "us", "jp"]
): Promise<Job[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const results: Job[] = [];

  for (const country of countries.filter((c) => COUNTRY_CODES.includes(c)).slice(0, 3)) {
    try {
      const { data } = await axios.get<{ results: AdzunaJob[] }>(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
        {
          params: {
            app_id: appId,
            app_key: appKey,
            results_per_page: 20,
            what: keywords,
          },
          timeout: 10_000,
        }
      );

      for (const j of data.results ?? []) {
        const sourceUrl = j.redirect_url;
        const area = j.location.area ?? [];
        const city = area[area.length - 1] ?? j.location.display_name ?? country.toUpperCase();
        const ccy = COUNTRY_CCY[country] ?? "USD";

        results.push({
          id: `adzuna_${j.id}`,
          externalId: `adzuna_${j.id}`,
          title: j.title,
          company: j.company.display_name,
          country: country.toUpperCase(),
          city,
          remote: j.title.toLowerCase().includes("remote") ? "remote" : "onsite",
          type: j.contract_type === "permanent" ? "Full-time" : (j.contract_type ?? "Full-time"),
          salaryMin: j.salary_min ?? null,
          salaryMax: j.salary_max ?? null,
          ccy,
          yearsMin: null,
          yearsMax: null,
          industry: CATEGORY_INDUSTRY[j.category?.tag] ?? "tech.saas",
          skills: [],
          description: j.description.slice(0, 2000),
          source: "adzuna",
          sourceUrl,
          sourceHash: hashUrl(sourceUrl),
          postedAt: new Date(j.created).toISOString(),
          crawledAt: new Date().toISOString(),
          score: null,
          matchReasons: [],
        });
      }
    } catch {
      // silently skip on error
    }
  }

  return results;
}
