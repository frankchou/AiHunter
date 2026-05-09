import Anthropic from "@anthropic-ai/sdk";
import type { Job, ParsedResume } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FALLBACK_GENERAL_DRAFT = (name: string, headline: string) =>
  `Dear Hiring Manager,

我是 ${name}，${headline}。長期關注貴公司在所屬產業的發展，希望能成為團隊一員，將過往的經驗與成果帶入並持續學習成長。

過去工作中，我重視可量化的成果與跨部門協作，習慣主動釐清問題、推動執行細節，並在不確定性高的環境中找到下一步的優先順序。期待與貴司面談，進一步討論我能如何貢獻。

謝謝您撥冗審閱。

敬祝
平安順利`;

const FALLBACK_TAILORED = (name: string, company: string, jobTitle: string) =>
  `Dear ${company} Hiring Team,

我是 ${name}，看到 ${company} 開放的 ${jobTitle} 職缺非常感興趣。${company} 在產業中的定位與近期發展讓我相信這是一個能讓我發揮專業並持續學習的環境。

過往的經驗讓我能從職缺需求中對應出我能即刻貢獻的部分，包括相關的技術能力、跨部門協作以及解決問題的方式。我期待能透過面試進一步了解團隊的目標，並具體討論我能如何協助達成。

感謝您的時間，期待後續聯繫。

敬祝
${company} 一切順利`;

/**
 * AI: draft a general cover letter from the user's resume only (no specific job).
 */
export async function draftGeneralCoverLetter(resume: ParsedResume): Promise<string> {
  const name = resume.name ?? "求職者";
  const headline = resume.headline ?? "Professional";

  if (!process.env.ANTHROPIC_API_KEY) return FALLBACK_GENERAL_DRAFT(name, headline);

  const summary = resume.summary ?? "";
  const bullets = resume.experience
    .flatMap((e) => e.bullets ?? [`${e.title} at ${e.company}`])
    .slice(0, 6)
    .map((b, i) => `${i + 1}. ${b}`)
    .join("\n");

  const prompt = `You are a professional career writer. Write a polished, generic cover letter (zh-TW) for this candidate that they can later customize per job. ONLY use facts from the resume — do not invent.

CANDIDATE NAME: ${name}
HEADLINE: ${headline}
SUMMARY: ${summary}
EXPERIENCE BULLETS:
${bullets}

Output the cover letter text only, no markdown, no JSON wrapping. ~250 words. Use formal business tone in Traditional Chinese (zh-TW). Include a greeting, 2–3 body paragraphs, and a closing.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    return text || FALLBACK_GENERAL_DRAFT(name, headline);
  } catch {
    return FALLBACK_GENERAL_DRAFT(name, headline);
  }
}

/**
 * AI: produce a tailored cover letter for a specific job.
 * Uses A 履歷 + (optional) A CV as input alongside the job posting.
 */
export async function generateTailoredCoverLetter(
  job: Job,
  resume: ParsedResume,
  generalCv?: string | null
): Promise<string> {
  const name = resume.name ?? "求職者";
  if (!process.env.ANTHROPIC_API_KEY) return FALLBACK_TAILORED(name, job.company, job.title);

  const summary = resume.summary ?? "";
  const bullets = resume.experience
    .flatMap((e) => e.bullets ?? [`${e.title} at ${e.company}`])
    .slice(0, 6)
    .map((b, i) => `${i + 1}. ${b}`)
    .join("\n");

  const baseSection = generalCv
    ? `\nUSER'S GENERAL COVER LETTER (style reference, do not copy verbatim):\n${generalCv.slice(0, 800)}`
    : "";

  const prompt = `You are a professional career writer. Write a tailored cover letter (zh-TW) for this candidate applying to a specific job.

CANDIDATE NAME: ${name}
HEADLINE: ${resume.headline ?? ""}
SUMMARY: ${summary}
EXPERIENCE BULLETS:
${bullets}
${baseSection}

TARGET JOB: ${job.title} at ${job.company}
JOB DESCRIPTION:
${job.description.slice(0, 800)}

Rules:
- Tailor specifically to the company name and the job's key requirements.
- Reference 1–2 concrete points from the candidate's experience that map to the JD.
- Do NOT invent new experiences; only reframe what the resume contains.
- Output the cover letter text only, no markdown or JSON.
- ~250 words, formal business tone, Traditional Chinese (zh-TW).
- Include greeting, 2–3 body paragraphs, closing.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    return text || FALLBACK_TAILORED(name, job.company, job.title);
  } catch {
    return FALLBACK_TAILORED(name, job.company, job.title);
  }
}
