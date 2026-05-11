import axios from "axios";
import { hashUrl } from "@/lib/utils";

// Adzuna response shape (subset we care about)
interface AdzunaApiJob {
  id:           string;
  title:        string;
  company:      { display_name: string };
  location:     { display_name: string; area: string[] };
  description:  string;
  redirect_url: string;
  salary_min?:  number;
  salary_max?:  number;
  created:      string;
  category?:    { label: string; tag: string };
  contract_type?: string;
}

interface AdzunaSearchResponse {
  results: AdzunaApiJob[];
  count:   number;
}

// Plain object we can insert into prisma.job
export interface AdzunaJobRow {
  externalId:  string;
  title:       string;
  company:     string;
  country:     string;
  city:        string;
  remote:      string;
  type:        string;
  salaryMin:   number | null;
  salaryMax:   number | null;
  ccy:         string;
  yearsMin:    number | null;
  yearsMax:    number | null;
  industry:    string;
  skills:      string[];
  description: string;
  source:      string;
  sourceUrl:   string;
  sourceHash:  string;
  postedAt:    Date | null;
}

const COUNTRY_CCY: Record<string, string> = {
  us: "USD", gb: "GBP", tw: "TWD", jp: "JPY", au: "AUD", sg: "SGD",
  de: "EUR", ca: "CAD", fr: "EUR", nl: "EUR", es: "EUR", it: "EUR",
  pl: "PLN", in: "INR", at: "EUR", be: "EUR", ch: "CHF", cz: "CZK",
  br: "BRL", mx: "MXN", nz: "NZD", za: "ZAR",
};

// Region tag (from AI Top 20) → Adzuna country codes.
// "Global" / unknown → broad probe across major markets.
export function countriesForRegion(region: string | null | undefined): string[] {
  if (!region) return ["us", "gb"];
  const r = region.toUpperCase();
  if (r === "US")     return ["us"];
  if (r === "GB" || r === "UK") return ["gb"];
  if (r === "EU")     return ["de", "gb", "fr", "nl", "es", "it", "pl"];
  if (r === "TW")     return ["tw"];   // Adzuna's TW support is uncertain; probe and silently fail on 404
  if (r === "GLOBAL") return ["us", "gb", "de", "sg", "au", "ca"];
  return ["us", "gb"];                  // safe fallback
}

function getKey() {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;
  return { appId, appKey };
}

// The probe MUST match what the modal will actually show: we fetch page 1
// (up to 50 results per country) and post-filter by `company.display_name`
// so the badge number == the modal's reality. The previous version that
// just read Adzuna's raw `count` field was wildly off for any company we
// had to use the `what_phrase=` fallback for — that count is "jobs that
// mention this string in the JD", not "jobs at this company".
export async function probeAndIngestCompanyJobs(
  companyName: string,
  countries: string[],
): Promise<AdzunaJobRow[]> {
  const k = getKey();
  if (!k || !companyName.trim()) return [];

  // Use the same fetch+filter pipeline as the modal — gives consistent count
  return fetchCompanyJobsPage(companyName, countries, { page: 1, pageSize: 50 });
}

// Back-compat shim — returns the count from probeAndIngestCompanyJobs.
// Callers that just need a number can use this; callers that want to also
// upsert the jobs at refresh time should use probeAndIngestCompanyJobs
// directly so they don't have to re-query Adzuna.
export async function probeCompanyJobCount(companyName: string, countries: string[]): Promise<number> {
  const rows = await probeAndIngestCompanyJobs(companyName, countries);
  return rows.length;
}

// Fetch one page of jobs for a company. Spread across `countries` —
// each country contributes up to `perCountry` jobs. Falls back to
// `what_phrase=` for company names that 400 with `company=` (OpenAI etc),
// then post-filters by company.display_name match either way.
async function adzunaFetchCountry(
  country: string,
  companyName: string,
  page: number,
  perPage: number,
  k: { appId: string; appKey: string },
): Promise<AdzunaApiJob[]> {
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`;
  const common = { app_id: k.appId, app_key: k.appKey, results_per_page: perPage };

  try {
    const { data } = await axios.get<AdzunaSearchResponse>(url, {
      params: { ...common, company: companyName },
      timeout: 12_000,
    });
    return data.results ?? [];
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status !== 400 && status !== 404) return [];
  }

  try {
    const { data } = await axios.get<AdzunaSearchResponse>(url, {
      params: { ...common, what_phrase: companyName },
      timeout: 12_000,
    });
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function fetchCompanyJobsPage(
  companyName: string,
  countries: string[],
  opts: { page: number; pageSize: number },
): Promise<AdzunaJobRow[]> {
  const k = getKey();
  if (!k || !companyName.trim()) return [];

  const perCountry = Math.max(opts.pageSize, 20);
  const collected: AdzunaJobRow[] = [];

  await Promise.all(countries.map(async (country) => {
    const results = await adzunaFetchCountry(country, companyName, opts.page, perCountry, k);
    for (const j of results) {
      // Always post-filter by company name (covers both `company=` and
      // `what_phrase=` fallback paths — the latter returns lots of noise)
      if (!j.company?.display_name?.toLowerCase().includes(companyName.toLowerCase())) continue;
      const area = j.location?.area ?? [];
      const city = area[area.length - 1] ?? j.location?.display_name ?? country.toUpperCase();
      collected.push({
          externalId:  `adzuna_${j.id}`,
          title:       j.title,
          company:     j.company.display_name,
          country:     country.toUpperCase(),
          city,
          remote:      j.title.toLowerCase().includes("remote") ? "remote" : "onsite",
          type:        j.contract_type === "permanent" ? "Full-time" : (j.contract_type ?? "Full-time"),
          salaryMin:   j.salary_min ?? null,
          salaryMax:   j.salary_max ?? null,
          ccy:         COUNTRY_CCY[country] ?? "USD",
          yearsMin:    null,
          yearsMax:    null,
          industry:    "tech.saas",
          skills:      [],
          description: (j.description ?? "").slice(0, 2000),
          source:      "adzuna",
          sourceUrl:   j.redirect_url,
          sourceHash:  hashUrl(j.redirect_url),
          postedAt:    j.created ? new Date(j.created) : null,
      });
    }
  }));

  // Sort newest first, take pageSize
  collected.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
  return collected.slice(0, opts.pageSize);
}
