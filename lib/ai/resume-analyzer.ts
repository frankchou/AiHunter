import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume, ResumeAnalysis } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function hasValidKey() {
  const k = process.env.ANTHROPIC_API_KEY ?? "";
  return k.length > 10 && !k.startsWith("sk-ant-...");
}

function buildResumeSummary(parsed: ParsedResume): string {
  const lines: string[] = [];

  lines.push(`姓名: ${parsed.name ?? ""}`);
  if (parsed.email) lines.push(`Email: ${parsed.email}`);
  if (parsed.phone) lines.push(`電話: ${parsed.phone}`);
  if (parsed.location) lines.push(`地點: ${parsed.location}`);
  if (parsed.summary) lines.push(`\n摘要:\n${parsed.summary}`);

  const skills = parsed.skills ?? [];
  if (skills.length > 0) {
    lines.push(`\n技能 (${skills.length} 項):`);
    skills.forEach(s => lines.push(`  - ${s.name}${s.years > 0 ? ` (${s.years}年)` : ""}`));
  }

  const experience = parsed.experience ?? [];
  if (experience.length > 0) {
    lines.push(`\n工作經歷 (${experience.length} 段):`);
    experience.forEach(e => {
      const period = e.years || (e.startDate ? `${e.startDate}–${e.endDate ?? ""}` : "");
      lines.push(`  【${e.title ?? ""} | ${e.company ?? ""} | ${period}】`);
      (e.bullets ?? []).forEach(b => lines.push(`    • ${b}`));
    });
  }

  const education = parsed.education ?? [];
  if (education.length > 0) {
    lines.push(`\n學歷:`);
    education.forEach(ed => lines.push(`  - ${ed.degree ?? ""}${ed.major ? ` ${ed.major}` : ""} | ${ed.school ?? ""} (${ed.year ?? ""})`));
  }

  if (parsed.certifications?.length) lines.push(`\n證照: ${parsed.certifications.join(", ")}`);
  if (parsed.awards?.length) lines.push(`\n獎項: ${parsed.awards.join(", ")}`);

  return lines.join("\n");
}

export async function analyzeResume(parsed: ParsedResume): Promise<ResumeAnalysis> {
  if (!hasValidKey()) {
    return {
      score: 72,
      keywords: ["Product Management", "Cross-functional Collaboration", "Agile", "B2B", "Digital Transformation"],
      swot: {
        S: ["具備完整的產品管理生命週期經驗", "擁有跨國專案領導實績"],
        W: ["部分成就缺乏具體量化指標"],
        O: ["AI 產品市場快速成長，可切入相關職位", "跨國經驗在外商市場具吸引力"],
        T: ["同等級候選人履歷通常附有更多數字佐證"],
      },
      suggestions: [{ field: "工作成就", suggestion: "為關鍵成果加入具體數字，例如提升轉換率 X%、縮短交付週期 X 天" }],
      comment: "整體履歷結構完整，職涯發展脈絡清晰。補強量化數據後，競爭力將大幅提升。",
    };
  }

  const resumeText = buildResumeSummary(parsed);

  const prompt = `你是資深獵頭，請分析以下履歷並回傳 JSON。

規則：
1. 評分看「品質與競爭力」，不是「欄位齊不齊」。
2. 針對實際內容分析，不給泛用建議。
3. 關鍵字抽 6-8 個，格式：「中文 / English」。
4. SWOT 每項 2 條，每條 15 字以內。
5. suggestions 最多 3 條，每條 suggestion 30 字以內。
6. comment 最多 2 句。
7. 評分：85+=非常競爭；70-84=好；55-69=需改善；<55=有缺失。

履歷：
${resumeText}

只回傳 JSON，不要 markdown：
{"score":<0-100>,"keywords":["中文/English"],"swot":{"S":["優勢1","優勢2"],"W":["弱點1","弱點2"],"O":["機會1","機會2"],"T":["威脅1","威脅2"]},"suggestions":[{"field":"欄位","suggestion":"建議"}],"comment":"總評"}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const text = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start === -1 || end === 0) throw new Error(`No JSON object found in response: ${text.slice(0, 200)}`);
    const result = JSON.parse(text.slice(start, end)) as ResumeAnalysis;
    result.swot = result.swot ?? { S: [], W: [], O: [], T: [] };
    result.keywords = result.keywords ?? [];
    result.suggestions = result.suggestions ?? [];
    return result;
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    console.error(`[resume-analyzer] error (status=${status}):`, err);
    throw err;
  }
}
