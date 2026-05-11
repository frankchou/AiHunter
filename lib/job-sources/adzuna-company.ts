import axios from "axios";
import { hashUrl } from "@/lib/utils";

// Adzuna's free-tier rate limit is aggressive — empirically, firing 20
// parallel calls returns 429 on ~16 of them. All Adzuna API traffic in
// this module flows through this single limiter so background refreshes
// (which can otherwise dispatch 120+ concurrent calls) play nice.
//
// Also wraps automatic retry on transient 429/503 — without retry, a
// single throttled request would cache jobCount=0 for that company until
// the next manual refresh (which is exactly the "Microsoft (0) in AI but
// (1119) in SaaS" bug).
const adzunaLimit = (() => {
  const CONCURRENCY = 4;
  let active = 0;
  const queue: Array<() => void> = [];
  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= CONCURRENCY) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      // Retry on 429 / 503 with exponential backoff. Adzuna's throttle is
      // short-lived (seconds), so 3 attempts with 0.5/1/2s waits is plenty.
      // Other errors (400, network) propagate immediately — callers handle
      // 400 by falling back to what_phrase, etc.
      const backoffs = [500, 1000, 2000];
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= backoffs.length; attempt++) {
        try {
          return await fn();
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status !== 429 && status !== 503) throw err;
          lastErr = err;
          if (attempt < backoffs.length) {
            await new Promise((r) => setTimeout(r, backoffs[attempt]));
          }
        }
      }
      throw lastErr;
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  };
})();

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
const PHRASE_SAMPLE_SIZE = 50;        // Adzuna's per-page max
// Deep-scan budget for what_phrase fallback. 5 × 50 = 250 candidates per
// country. Beyond ~5 pages the match-yield falls off sharply and rate-
// limit risk climbs; empirically this captures most of the
// display_name=Employer rows for fallback employers (OpenAI etc).
const PHRASE_FALLBACK_PAGES = 5;

function matchesDisplayName(j: AdzunaApiJob, companyName: string): boolean {
  const dn = j.company?.display_name;
  if (!dn) return false;
  return dn.toLowerCase().includes(companyName.toLowerCase());
}

// Deep-scan the what_phrase fallback path. Adzuna's strict `company=` index
// doesn't include many AI-native employers (OpenAI, Anthropic etc.) — for
// those we look at what_phrase results and post-filter by display_name. A
// single 50-row page often surfaces ZERO real matches because the top
// results are jobs at OTHER companies that just mention the employer in
// the JD. Paginating up to PHRASE_FALLBACK_PAGES surfaces the real matches
// that exist deeper in the result set.
async function deepScanWhatPhrase(
  country: string,
  companyName: string,
  k: { appId: string; appKey: string },
): Promise<AdzunaApiJob[]> {
  const matched: AdzunaApiJob[] = [];
  for (let page = 1; page <= PHRASE_FALLBACK_PAGES; page++) {
    try {
      const { data } = await adzunaLimit(() =>
        axios.get<AdzunaSearchResponse>(
          `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`,
          {
            params: { app_id: k.appId, app_key: k.appKey, results_per_page: PHRASE_SAMPLE_SIZE, sort_by: "date", what_phrase: companyName },
            timeout: 12_000,
          },
        ),
      );
      const rows = data.results ?? [];
      for (const j of rows) if (matchesDisplayName(j, companyName)) matched.push(j);
      if (rows.length < PHRASE_SAMPLE_SIZE) break;   // hit the end
    } catch {
      break;
    }
  }
  return matched;
}

async function adzunaCountOne(country: string, companyName: string, k: { appId: string; appKey: string }): Promise<number> {
  // Strict path: Adzuna's company index is authoritative — use its count as-is.
  try {
    const { data } = await adzunaLimit(() =>
      axios.get<AdzunaSearchResponse>(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
        {
          params: { app_id: k.appId, app_key: k.appKey, results_per_page: 1, company: companyName },
          timeout: 10_000,
        },
      ),
    );
    return data.count ?? 0;
  } catch {
    /* fall through */
  }
  // Phrase fallback: deep-scan + post-filter. Counts what we'd ACTUALLY
  // show in the modal, so badge and list always agree on the same set.
  const matched = await deepScanWhatPhrase(country, companyName, k);
  return matched.length;
}

export async function probeCompanyJobCount(companyName: string, countries: string[]): Promise<number> {
  const k = getKey();
  if (!k || !companyName.trim()) return 0;
  const lookup = canonicalCompanyName(companyName);
  const counts = await Promise.all(countries.map((c) => adzunaCountOne(c, lookup, k)));
  return counts.reduce((a, b) => a + b, 0);
}

// Single-shot per-country probe that returns BOTH the authoritative count
// AND the matched rows in ONE pass. Strict path: count = Adzuna's
// data.count (could be thousands); rows = first 50 by date. Fallback path:
// count = matched.length; rows = all matched (typically much smaller).
async function scanCountryProbeAndRows(
  country: string,
  companyName: string,
  k: { appId: string; appKey: string },
): Promise<{ count: number; rows: AdzunaApiJob[] }> {
  // Strict path. data.count is real total; data.results is just this page.
  try {
    const { data } = await adzunaLimit(() =>
      axios.get<AdzunaSearchResponse>(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
        {
          params: { app_id: k.appId, app_key: k.appKey, results_per_page: PHRASE_SAMPLE_SIZE, sort_by: "date", company: companyName },
          timeout: 12_000,
        },
      ),
    );
    return { count: data.count ?? 0, rows: data.results ?? [] };
  } catch {
    /* fall through */
  }
  // Fallback path. Deep scan + post-filter is the only way to know the
  // real number of jobs whose display_name is this employer.
  const matched = await deepScanWhatPhrase(country, companyName, k);
  return { count: matched.length, rows: matched };
}

// At refresh time, get the authoritative count AND ingest every matched
// row across all configured countries in one pass. Caller upserts the
// rows into the Job table so the modal can paginate from DB without
// re-hitting Adzuna on each page change (modal page-2 onwards for strict
// employers like Google still hits Adzuna on-demand because we only
// pre-load page 1 for those).
export async function probeAndIngestCompanyJobs(
  companyName: string,
  countries: string[],
): Promise<{ count: number; firstPageJobs: AdzunaJobRow[] }> {
  const k = getKey();
  if (!k || !companyName.trim()) return { count: 0, firstPageJobs: [] };
  const lookup = canonicalCompanyName(companyName);

  const perCountry = await Promise.all(
    countries.map((c) => scanCountryProbeAndRows(c, lookup, k).then((r) => ({ country: c, ...r }))),
  );

  const count = perCountry.reduce((s, r) => s + r.count, 0);

  const flat: AdzunaJobRow[] = [];
  for (const { country, rows } of perCountry) {
    for (const j of rows) {
      if (!j.company?.display_name) continue;
      const area = j.location?.area ?? [];
      const city = area[area.length - 1] ?? j.location?.display_name ?? country.toUpperCase();
      flat.push({
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
  }
  flat.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0));
  return { count, firstPageJobs: flat };
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
  // Strict path: trust Adzuna's company-indexed results as-is, page-by-page.
  try {
    const { data } = await adzunaLimit(() =>
      axios.get<AdzunaSearchResponse>(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`,
        {
          params: { app_id: k.appId, app_key: k.appKey, results_per_page: perPage, sort_by: "date", company: companyName },
          timeout: 12_000,
        },
      ),
    );
    return data.results ?? [];
  } catch {
    /* fall through to phrase fallback */
  }
  // Phrase fallback: deep-scan across multiple Adzuna pages, post-filter
  // by display_name, then return the slice the caller asked for. Caller
  // pagination (`page`, `perPage`) applies AFTER the post-filter, so
  // modal page 1 = first N display_name matches by date.
  const matched = await deepScanWhatPhrase(country, companyName, k);
  const start = (page - 1) * perPage;
  return matched.slice(start, start + perPage);
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
