import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume, JobPreference, Job } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCORE_LIMIT = 25;    // max jobs to AI-score per crawl
const CONCURRENCY = 5;     // parallel Claude calls

interface MatchResult {
  score: number;
  reasons: string[];
}

export async function scoreJob(
  job: Job,
  resume: ParsedResume,
  prefs: JobPreference
): Promise<MatchResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { score: 0.5 + Math.random() * 0.4, reasons: ["AI 匹配 (demo mode)"] };
  }

  const prompt = `You are a job-matching AI. Score how well this candidate fits the job.
Treat Chinese and English skill names as equivalent (e.g. "機器學習"="Machine Learning", "前端"="Frontend").

CANDIDATE RESUME:
Name: ${resume.name}
Headline: ${resume.headline}
Skills: ${resume.skills.map((s) => `${s.name} (${s.years}yr)`).join(", ")}
Experience: ${resume.experience.map((e) => `${e.title} at ${e.company} (${e.years})`).join("; ")}
Languages: ${(resume.languages ?? []).join(", ")}

CANDIDATE PREFERENCES:
Locations: ${prefs.locations.join(", ")}
Remote: ${prefs.remote.join(", ")}
Industries: ${prefs.industries.join(", ")}
Min Salary: ${prefs.salaryMin} ${prefs.salaryCcy}
Preferred titles: ${prefs.titles}

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.city}, ${job.country} (${job.remote})
Industry: ${job.industry}
Salary: ${job.salaryMin}–${job.salaryMax} ${job.ccy}
Required years: ${job.yearsMin}–${job.yearsMax}
Required skills: ${job.skills.join(", ")}
Description: ${job.description.slice(0, 800)}

Respond in JSON only:
{
  "score": 0.0–1.0,
  "reasons": ["reason 1 in zh-TW", "reason 2 in zh-TW", "reason 3 in zh-TW"]
}`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in response");
  const json = JSON.parse(raw.slice(start, end + 1));
  return { score: Math.min(1, Math.max(0, json.score)), reasons: json.reasons ?? [] };
}

export async function batchScoreJobs(
  jobs: Job[],
  resume: ParsedResume,
  prefs: JobPreference
): Promise<Job[]> {
  // Skip mocks; sort by date (newest first); cap at SCORE_LIMIT
  const realJobs = jobs.filter((j) => !j.id.startsWith("mock_"));
  const toIso = (d: Date | string | null | undefined) =>
    d ? (typeof d === "string" ? d : d.toISOString()) : "";
  const sorted = [...realJobs].sort((a, b) =>
    toIso(b.postedAt).localeCompare(toIso(a.postedAt))
  );
  const toScore = sorted.slice(0, SCORE_LIMIT);
  const skip = sorted.slice(SCORE_LIMIT).map((j) => ({ ...j, score: null, matchReasons: [] }));

  // Score in batches of CONCURRENCY
  const results: Job[] = [];
  for (let i = 0; i < toScore.length; i += CONCURRENCY) {
    const batch = toScore.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (job) => {
        const { score, reasons } = await scoreJob(job, resume, prefs);
        return { ...job, score, matchReasons: reasons };
      })
    );
    for (let idx = 0; idx < settled.length; idx++) {
      const r = settled[idx];
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        console.warn("[batchScoreJobs] scoring failed for", batch[idx]?.title, "—", r.reason);
        results.push({ ...batch[idx], score: null, matchReasons: [] });
      }
    }
  }

  return [...results, ...skip].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
