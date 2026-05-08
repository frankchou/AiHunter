import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume, JobPreference, Job } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();
  const json = text.startsWith("{") ? JSON.parse(text) : JSON.parse(text.slice(text.indexOf("{")));
  return { score: Math.min(1, Math.max(0, json.score)), reasons: json.reasons ?? [] };
}

export async function batchScoreJobs(
  jobs: Job[],
  resume: ParsedResume,
  prefs: JobPreference
): Promise<Job[]> {
  const scored = await Promise.allSettled(
    jobs.map(async (job) => {
      const { score, reasons } = await scoreJob(job, resume, prefs);
      return { ...job, score, matchReasons: reasons };
    })
  );
  return scored
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<Job>).value)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
