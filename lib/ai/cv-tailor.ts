import Anthropic from "@anthropic-ai/sdk";
import type { Job, ParsedResume, CVTailor } from "@/lib/types";
import { getMockCV } from "@/lib/mock-data";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateCVTailor(
  job: Job,
  resume: ParsedResume
): Promise<CVTailor> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getMockCV(job.title, job.company);
  }

  const currentSummary = resume.summary ?? `${resume.headline} with ${resume.skills.length} years of experience.`;
  const bullets = resume.experience.flatMap((e) => e.bullets ?? [`${e.title} at ${e.company}`]);

  const prompt = `You are a professional resume writer. Tailor this candidate's resume to better match the target job. ONLY reframe/quantify existing facts — do NOT invent new experiences.

CANDIDATE SUMMARY: ${currentSummary}
EXPERIENCE BULLETS: ${bullets.slice(0, 6).map((b, i) => `${i + 1}. ${b}`).join("\n")}

TARGET JOB: ${job.title} at ${job.company}
${job.description.slice(0, 800)}

Respond in JSON only:
{
  "summary": {"before": "original summary", "after": "tailored summary"},
  "bullets": [
    {"before": "original bullet", "after": "tailored bullet"}
  ],
  "diffNote": "brief note about changes made in zh-TW"
}

Provide 3-4 bullet rewrites. Keep all facts truthful to the original.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  return JSON.parse(text.slice(start, end)) as CVTailor;
}
