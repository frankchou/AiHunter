import type { Job, JobPreference } from "@/lib/types";
import { MOCK_JOBS } from "@/lib/mock-data";
import { fetchRemotiveJobs } from "./remotive";
import { fetchAdzunaJobs } from "./adzuna";
import { fetch104Jobs } from "./taiwan-104";
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
  const countries = prefs.locations
    .map(locationToCountry)
    .filter(Boolean) as string[];

  const sources: string[] = [];
  const errors: string[] = [];
  const allJobs: Job[] = [];

  // Always include mock data as baseline
  allJobs.push(...MOCK_JOBS);
  sources.push("mock");

  // 104 (Taiwan)
  if (countries.includes("TW") || prefs.locations.includes("Taipei")) {
    try {
      const jobs = await fetch104Jobs(keywords[0], "6001001000");
      if (jobs.length > 0) { allJobs.push(...jobs); sources.push("104"); }
    } catch (e) {
      errors.push(`104: ${(e as Error).message}`);
    }
  }

  // Remotive — always run as baseline source
  try {
    const jobs = await fetchRemotiveJobs(keywords.slice(0, 2));
    if (jobs.length > 0) { allJobs.push(...jobs); sources.push("remotive"); }
  } catch (e) {
    errors.push(`remotive: ${(e as Error).message}`);
  }

  // Adzuna
  try {
    const jobs = await fetchAdzunaJobs(keywords[0], countries.slice(0, 3));
    if (jobs.length > 0) { allJobs.push(...jobs); sources.push("adzuna"); }
  } catch (e) {
    errors.push(`adzuna: ${(e as Error).message}`);
  }

  // De-duplicate by externalId / sourceUrl
  const seen = new Set<string>();
  const unique = allJobs.filter((j) => {
    const key = j.externalId ?? j.sourceUrl;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // AI scoring
  const scored = await batchScoreJobs(unique, resume, prefs);

  return { jobs: scored, sources, errors };
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
    Taipei: "TW", Taiwan: "TW", "San Francisco": "US", "New York": "US",
    Remote: "US", Tokyo: "JP", London: "GB", Sydney: "AU",
    Singapore: "SG", Berlin: "DE",
  };
  return map[location] ?? null;
}
