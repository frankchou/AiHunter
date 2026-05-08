import type { Job, JobPreference } from "@/lib/types";
import { MOCK_JOBS } from "@/lib/mock-data";
import { fetchRemotiveJobs } from "./remotive";
import { fetchAdzunaJobs } from "./adzuna";
import { fetch104Jobs } from "./taiwan-104";
import { fetchJSearchJobs } from "./jsearch";
import { batchScoreJobs } from "@/lib/ai/match";
import type { ParsedResume } from "@/lib/types";

export interface CrawlResult {
  jobs: Job[];
  sources: string[];
  errors: string[];
}

export async function crawlJobs(
  prefs: JobPreference,
  resume: ParsedResume
): Promise<CrawlResult> {
  const keywords = buildKeywords(prefs, resume);
  const countries = prefs.locations.map(locationToCountry).filter(Boolean) as string[];

  const sources: string[] = [];
  const errors: string[] = [];
  const allJobs: Job[] = [];

  // Always include mock data as baseline (filtered out before DB persist)
  allJobs.push(...MOCK_JOBS);
  sources.push("mock");

  // ── JSearch (LinkedIn / Indeed / Glassdoor aggregator) ─────────────────────
  // Build contextual queries: role + location, role + remote, etc.
  const jsearchQueries = buildJSearchQueries(keywords, prefs.locations, prefs.remote);
  try {
    const jobs = await fetchJSearchJobs(jsearchQueries, {
      remoteOnly: prefs.remote.length > 0 && !prefs.remote.includes("onsite"),
      datePosted: "month",
    });
    if (jobs.length > 0) { allJobs.push(...jobs); sources.push("jsearch"); }
  } catch (e) {
    errors.push(`jsearch: ${(e as Error).message}`);
  }

  // ── Remotive (remote-focused, always run as fallback) ──────────────────────
  try {
    const jobs = await fetchRemotiveJobs(keywords.slice(0, 2));
    if (jobs.length > 0) { allJobs.push(...jobs); sources.push("remotive"); }
  } catch (e) {
    errors.push(`remotive: ${(e as Error).message}`);
  }

  // ── Adzuna (multi-country, requires API key) ───────────────────────────────
  try {
    const adzunaCountries = countries.length ? countries : ["us", "gb", "sg"];
    const jobs = await fetchAdzunaJobs(keywords[0], adzunaCountries.slice(0, 3));
    if (jobs.length > 0) { allJobs.push(...jobs); sources.push("adzuna"); }
  } catch (e) {
    errors.push(`adzuna: ${(e as Error).message}`);
  }

  // ── 104 (Taiwan only — only works from TW IP) ──────────────────────────────
  if (countries.includes("TW") || prefs.locations.some(l => l === "Taipei" || l === "Taiwan")) {
    try {
      const jobs = await fetch104Jobs(keywords[0], "6001001000");
      if (jobs.length > 0) { allJobs.push(...jobs); sources.push("104"); }
    } catch (e) {
      errors.push(`104: ${(e as Error).message}`);
    }
  }

  // De-duplicate by externalId → sourceUrl → sourceHash
  const seen = new Set<string>();
  const unique = allJobs.filter((j) => {
    const key = j.externalId ?? j.sourceUrl ?? j.sourceHash ?? j.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // AI scoring
  const scored = await batchScoreJobs(unique, resume, prefs);

  return { jobs: scored, sources, errors };
}

// Build queries for JSearch: role + location combos
function buildJSearchQueries(keywords: string[], locations: string[], remote: string[]): string[] {
  const queries: string[] = [];
  const role = keywords[0] ?? "software engineer";

  // Location-based queries
  for (const loc of locations.slice(0, 2)) {
    if (loc !== "Remote") queries.push(`${role} in ${loc}`);
  }

  // Remote query
  if (remote.includes("remote") || remote.includes("hybrid")) {
    queries.push(`${role} remote`);
  }

  // Fallback: just the role if nothing else
  if (queries.length === 0) queries.push(role);

  // Add a secondary keyword query for better coverage
  if (keywords[1]) queries.push(`${keywords[1]} ${locations[0] ?? "remote"}`);

  return queries.slice(0, 4);
}

function buildKeywords(prefs: JobPreference, resume: ParsedResume): string[] {
  const kws: string[] = [];
  if (prefs.titles) kws.push(...prefs.titles.split(",").map((s) => s.trim()));
  kws.push(resume.headline.split("·")[0].trim());
  kws.push(...resume.skills.slice(0, 2).map((s) => s.name));
  return [...new Set(kws.filter(Boolean))].slice(0, 4);
}

function locationToCountry(location: string): string | null {
  const map: Record<string, string> = {
    Taipei: "TW", Taiwan: "TW",
    "San Francisco": "US", "New York": "US", "Los Angeles": "US",
    "Seattle": "US", "Austin": "US", "Boston": "US",
    Remote: "US",
    Tokyo: "JP", Osaka: "JP",
    London: "GB", Manchester: "GB",
    Sydney: "AU", Melbourne: "AU",
    Singapore: "SG",
    Berlin: "DE", Munich: "DE",
    "Hong Kong": "HK",
    Seoul: "KR",
    Toronto: "CA", Vancouver: "CA",
    Paris: "FR",
    Amsterdam: "NL",
  };
  return map[location] ?? null;
}
