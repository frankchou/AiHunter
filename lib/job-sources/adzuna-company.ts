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

// AI Top 20 sometimes returns composite names like "Google/Alphabet" or
// "Meta (Facebook)". Adzuna doesn't index those as one company — querying
// with the composite string returns near-zero (and stored Job rows then
// have display_name = "Google", not the composite, so DB `contains` lookups
// also miss). Resolve to the first reasonable segment for any I/O against
// Adzuna and the Job table.
export function canonicalCompanyName(name: string): string {
  for (const part of name.split(/[/()]/).map((s) => s.trim())) {
    if (part.length >= 2) return part;
  }
  return name.trim();
}

// Returns Adzuna's `count` (sum across countries) — the same number the
// modal will use for pagination. Trust the search engine: if Adzuna says
// 8980 results are relevant to "OpenAI", the modal paginates through all
// of them. The post-filter applied in fetchCompanyJobsPage is the *display
// guarantee* (we only show rows whose company display_name matches), not
// the count source.
//
// Why not post-filter the count too? For names that fall back to
// `what_phrase=`, post-filter is too aggressive — we'd show "10" when
// Adzuna can give us hundreds (just spread across pages). The user wants
// to be able to drill in.
// Adzuna's `what_phrase` returns jobs that MENTION the company anywhere
// (title/description). For employers like OpenAI / Anthropic that aren't in
// Adzuna's strict company index, the raw count is wildly inflated — we'd
// claim 8979 jobs at OpenAI but the modal would render 0 (because the
// display_name on those rows isn't OpenAI). Filter the result set down to
// rows where the display_name actually contains the company name, and use
// THAT count for the badge. The modal applies the same filter, so the
// numbers match.
const PHRASE_SAMPLE_SIZE = 50;

function matchesDisplayName(j: AdzunaApiJob, companyName: string): boolean {
  const dn = j.company?.display_name;
  if (!dn) return false;
  return dn.toLowerCase().includes(companyName.toLowerCase());
}

async function adzunaCountOne(country: string, companyName: string, k: { appId: string; appKey: string }): Promise<number> {
  const base = `https://api.adzuna.com/v1/api/jobs/${country}/search/1`;
  // Strict path: Adzuna's company index is authoritative — use its count as-is.
  try {
    const { data } = await axios.get<AdzunaSearchResponse>(base, {
      params: { app_id: k.appId, app_key: k.appKey, results_per_page: 1, company: companyName },
      timeout: 10_000,
    });
    return data.count ?? 0;
  } catch {
    /* fall through to phrase fallback */
  }
  // Phrase fallback: pull a sample and count rows that actually match this
  // employer's display_name. Returns a lower bound (only first 50 results
  // by relevance) but it's the same lower bound the modal will display, so
  // badge stays consistent with list.
  try {
    const { data } = await axios.get<AdzunaSearchResponse>(base, {
      params: { app_id: k.appId, app_key: k.appKey, results_per_page: PHRASE_SAMPLE_SIZE, what_phrase: companyName },
      timeout: 12_000,
    });
    return (data.results ?? []).filter((j) => matchesDisplayName(j, companyName)).length;
  } catch {
    return 0;
  }
}

export async function probeCompanyJobCount(companyName: string, countries: string[]): Promise<number> {
  const k = getKey();
  if (!k || !companyName.trim()) return 0;
  const lookup = canonicalCompanyName(companyName);
  const counts = await Promise.all(countries.map((c) => adzunaCountOne(c, lookup, k)));
  return counts.reduce((a, b) => a + b, 0);
}

// Also ingest the first page worth of jobs at refresh time so modal page 1
// is already in our Job table. Modal pages 2+ fetch on-demand.
export async function probeAndIngestCompanyJobs(
  companyName: string,
  countries: string[],
): Promise<{ count: number; firstPageJobs: AdzunaJobRow[] }> {
  const k = getKey();
  if (!k || !companyName.trim()) return { count: 0, firstPageJobs: [] };

  const [count, firstPageJobs] = await Promise.all([
    probeCompanyJobCount(companyName, countries),
    fetchCompanyJobsPage(companyName, countries, { page: 1, pageSize: 10 }),
  ]);
  return { count, firstPageJobs };
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
  // sort_by=date gives stable pagination — without it Adzuna returns by
  // "relevance" which causes the top jobs to bleed across many pages so
  // page 2/3/… end up mostly duplicates of page 1.

  // Strict path: trust Adzuna's company-indexed results as-is.
  try {
    const { data } = await axios.get<AdzunaSearchResponse>(url, {
      params: { app_id: k.appId, app_key: k.appKey, results_per_page: perPage, sort_by: "date", company: companyName },
      timeout: 12_000,
    });
    return data.results ?? [];
  } catch {
    /* fall through to phrase fallback */
  }
  // Phrase fallback: post-filter by display_name. The post-filter yields a
  // RARE subset of the raw what_phrase results (often <10% match), so we
  // MUST oversample — using the caller's perPage (typically 10) often
  // returns zero matches even when matches exist deeper in the page. Pull
  // PHRASE_SAMPLE_SIZE per country, filter, then let the caller slice.
  // This is also what adzunaCountOne uses, so badge count and the
  // fetched rows come from the same sample.
  try {
    const { data } = await axios.get<AdzunaSearchResponse>(url, {
      params: { app_id: k.appId, app_key: k.appKey, results_per_page: PHRASE_SAMPLE_SIZE, sort_by: "date", what_phrase: companyName },
      timeout: 12_000,
    });
    return (data.results ?? []).filter((j) => matchesDisplayName(j, companyName));
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

  // Align Adzuna page N with modal page N: ask for `pageSize` results
  // per country at Adzuna page N. With sort_by=date this maps cleanly:
  // modal page 1 = newest 10×country, page 2 = next 10×country.
  const perCountry = opts.pageSize;
  const collected: AdzunaJobRow[] = [];
  const lookup = canonicalCompanyName(companyName);

  await Promise.all(countries.map(async (country) => {
    const results = await adzunaFetchCountry(country, lookup, opts.page, perCountry, k);
    for (const j of results) {
      // Note: we trust Adzuna's search relevance — `company=` was strict
      // already, and `what_phrase=` fallback returns whatever Adzuna thinks
      // is relevant. Each card displays the actual company.display_name so
      // the user can spot mismatches themselves.
      if (!j.company?.display_name) continue;
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
