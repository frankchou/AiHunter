import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FALLBACK: ParsedResume = {
  name: "",
  headline: "",
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
      experience: [{ title: "Product Manager", company: "公司", startDate: "2022-01", endDate: "present", years: "2022 – 至今", location: "Taipei", bullets: [] }],
    };
  }

  const prompt = `You are a professional resume parser. Your job is to extract ALL information from the resume below and normalize it into the system's standard JSON format, regardless of the original language (Chinese/English/mixed), layout, or section naming conventions.

NORMALIZATION RULES:
1. Section mapping — recognize ANY of these as the same field:
   - summary: 自我介紹/個人簡介/摘要/專業摘要/About Me/Summary/Objective/Profile/個人特質/求職目標
   - experience: 工作經歷/工作經驗/職歷/經歷/任職經歷/Work Experience/Professional Experience/Employment
   - education: 學歷/教育背景/Education/Academic Background
   - certifications: 證照/資格/認證/執照/證書/Certifications/Licenses/Qualifications
   - awards: 獎項/榮譽/得獎/成就/Awards/Honors/Achievements/Recognition
   - skills: 技能/專長/Skills/Technical Skills/Core Competencies/專業技能

2. Date normalization:
   - Convert ROC calendar (民國) to CE: 民國N年 = N+1911年
   - Normalize to "YYYY-MM" or "YYYY" format
   - "至今"/"現在"/"Present"/"Now"/"Current" → "present"
   - For display (years field), use "YYYY.MM – YYYY.MM" or "YYYY.MM – 至今"

3. Skills extraction:
   - Extract skills from ALL sections (skills section, experience bullets, summary, etc.)
   - Estimate years from context (work experience dates, explicit mentions)
   - Include technical skills, tools, frameworks, methodologies, soft skills

4. Experience bullets:
   - Extract EVERY bullet point, dash item, and sub-item verbatim
   - Preserve specific numbers, percentages, metrics — these are critical
   - Keep in original language (do not translate)
   - For SUB-ITEMS (indented items, items under a main bullet using - or – or ‐ marker): prefix with "→ "
   - For TOP-LEVEL bullets (● or • or numbered): no prefix, just the text
   - Example: main bullet "主導系統建置" → "主導系統建置", sub-item "- 成功減少 30%" → "→ 成功減少 30%"

5. Name: Extract full name (Chinese + English if both present)

RESUME TEXT:
${rawText.slice(0, 12000)}

Return ONLY valid JSON, no markdown, no explanation. Use this exact schema:
{
  "name": "Full name (Chinese English if both)",
  "headline": "職稱 · X年經驗 summary",
  "email": "email or null",
  "phone": "phone number or null",
  "location": "city/country or null",
  "summary": "Full summary text, preserve line breaks with \\n",
  "skills": [{"name": "skill", "years": 0}],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or present",
      "years": "YYYY.MM – YYYY.MM",
      "location": "City or null",
      "bullets": ["verbatim bullet 1", "verbatim bullet 2"]
    }
  ],
  "education": [
    {
      "degree": "學位/Degree level",
      "major": "科系/Major",
      "school": "School name",
      "startYear": "YYYY or null",
      "year": "Graduation YYYY"
    }
  ],
  "certifications": ["Certification (issuer, year) verbatim"],
  "awards": ["Award name (year, context) verbatim"],
  "languages": ["zh-TW", "en"]
}`;

  try {
    const msg = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
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
