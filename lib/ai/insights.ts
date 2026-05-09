import Anthropic from "@anthropic-ai/sdk";
import type { Job, ParsedResume, Insight } from "@/lib/types";
import { getMockInsight } from "@/lib/mock-data";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateInsight(job: Job, resume: ParsedResume): Promise<Insight> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getMockInsight(job.id, job.title, job.company);
  }

  const prompt = `You are a senior career coach and industry analyst. Analyze this job opportunity for the candidate and generate a comprehensive prep package.

CANDIDATE:
${resume.name} — ${resume.headline}
Skills: ${resume.skills.map((s) => `${s.name} ${s.years}yr`).join(", ")}
Experience: ${resume.experience.map((e) => `${e.title} @ ${e.company} (${e.years})`).join("; ")}
Languages: ${(resume.languages ?? []).join(", ")}

JOB: ${job.title} at ${job.company} (${job.city}, ${job.country} · ${job.remote})
Industry: ${job.industry}
${job.description.slice(0, 1500)}

Respond in JSON only (all text fields in zh-TW):
{
  "companyTrend": "2-3 sentences on company business direction, financial health, hiring signals, 1-2 year outlook",
  "industryTrend": "2-3 sentences on industry macro trends, key technologies, growth areas candidate should know",
  "swot": {
    "S": ["candidate strength vs this JD", "strength 2", "strength 3"],
    "W": ["candidate gap vs this JD", "gap 2"],
    "O": ["opportunity if hired", "opportunity 2"],
    "T": ["risk or threat", "risk 2"]
  },
  "risks": [
    {"label": "short label", "severity": "high|med|low", "note": "explanation"}
  ],
  "strategy": "2-3 sentence apply + interview strategy tailored to this specific role",
  "questions": [
    {"q": "likely interview question", "outline": "answer outline using candidate background"}
  ],
  "refs": []
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
