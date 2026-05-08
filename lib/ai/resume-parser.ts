import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FALLBACK: ParsedResume = {
  name: "使用者",
  headline: "Professional",
  skills: [],
  experience: [],
};

function hasValidKey() {
  const k = process.env.ANTHROPIC_API_KEY ?? "";
  return k.length > 10 && !k.startsWith("sk-ant-...");
}

export async function parseResumeText(rawText: string): Promise<ParsedResume> {
  if (!hasValidKey()) {
    return {
      name: "使用者",
      headline: "Product Manager",
      skills: [{ name: "Product Management", years: 3 }],
      experience: [{ title: "Product Manager", company: "公司", years: "2022–now", location: "Taipei" }],
    };
  }

  const prompt = `Extract structured information from this resume text. Respond in JSON only.

RESUME TEXT:
${rawText.slice(0, 4000)}

JSON schema:
{
  "name": "Full name",
  "headline": "Current title and years of experience summary",
  "email": "email if present",
  "phone": "phone if present",
  "location": "primary location",
  "summary": "professional summary paragraph if present",
  "skills": [{"name": "skill name", "years": 0}],
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "years": "2020–2023",
      "location": "city",
      "bullets": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [{"degree": "degree", "school": "school name", "year": "graduation year"}],
  "languages": ["zh-TW", "en"]
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    return JSON.parse(text.slice(start, end)) as ParsedResume;
  } catch {
    return FALLBACK;
  }
}
