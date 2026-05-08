import Anthropic from "@anthropic-ai/sdk";
import type { Job, ParsedResume, Insight } from "@/lib/types";
import { getMockInsight } from "@/lib/mock-data";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateInsight(
  job: Job,
  resume: ParsedResume
): Promise<Insight> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getMockInsight(job.id, job.title, job.company);
  }

  const prompt = `You are a career coach helping a job candidate prepare for interviews. Analyze the fit and generate interview preparation materials.

CANDIDATE:
${resume.name} — ${resume.headline}
Skills: ${resume.skills.map((s) => `${s.name} ${s.years}yr`).join(", ")}
Experience: ${resume.experience.map((e) => `${e.title} @ ${e.company} (${e.years})`).join("; ")}

JOB: ${job.title} at ${job.company} (${job.city}, ${job.country})
${job.description.slice(0, 1200)}

Generate a comprehensive interview prep package. Respond in JSON only:
{
  "swot": {
    "S": ["strength 1 in zh-TW", "strength 2", "strength 3"],
    "W": ["weakness 1 in zh-TW", "weakness 2"],
    "O": ["opportunity 1 in zh-TW", "opportunity 2"],
    "T": ["threat 1 in zh-TW", "threat 2"]
  },
  "risks": [
    {"label": "label", "severity": "high|med|low", "note": "explanation in zh-TW"}
  ],
  "strategy": "2-3 sentence interview strategy in zh-TW",
  "questions": [
    {"q": "interview question in English", "outline": "answer outline in zh-TW"}
  ],
  "refs": [
    {"title": "resource title", "source": "source name", "url": "https://..."}
  ]
}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as { type: string; text: string }).text.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  return JSON.parse(text.slice(start, end)) as Insight;
}
