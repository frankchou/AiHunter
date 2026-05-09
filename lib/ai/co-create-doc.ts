import { prisma } from "@/lib/prisma";
import type { DocKind, DocSnapshot } from "@/lib/ai/co-create";
import type { ParsedResume } from "@/lib/types";

/** Load the document the chat is operating on, formatted as plain text for the AI. */
export async function loadDocSnapshot(opts: {
  userId:  string;
  docKind: DocKind;
  jobId?:  string | null;
}): Promise<DocSnapshot | null> {
  const { userId, docKind, jobId } = opts;

  if (docKind === "resume-a") {
    const r = await prisma.resume.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!r) return { kind: "resume-a", text: "（尚未上傳一般履歷）" };
    const parsed = r.parsed as unknown as ParsedResume;
    return {
      kind: "resume-a",
      text: formatResumeForAi(parsed),
    };
  }

  if (docKind === "cv-a") {
    const c = await prisma.coverLetter.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      kind: "cv-a",
      text: c?.content ?? "（尚未撰寫一般 CV）",
    };
  }

  if (docKind === "resume-b") {
    if (!jobId) return null;
    const t = await prisma.resumeTailor.findFirst({
      where: { userId, jobId, isCurrent: true },
      orderBy: { createdAt: "desc" },
      include: { job: { select: { title: true, company: true } } },
    });
    if (!t) return { kind: "resume-b", text: "（尚未產出針對性履歷）" };
    return {
      kind:     "resume-b",
      jobTitle: t.job?.title,
      company:  t.job?.company,
      text:     formatTailoredResumeForAi(t),
    };
  }

  if (docKind === "cv-b") {
    if (!jobId) return null;
    const t = await prisma.coverLetterTailor.findFirst({
      where: { userId, jobId, isCurrent: true },
      orderBy: { createdAt: "desc" },
      include: { job: { select: { title: true, company: true } } },
    });
    if (!t) return { kind: "cv-b", text: "（尚未產出針對性 CV）" };
    return {
      kind:     "cv-b",
      jobTitle: t.job?.title,
      company:  t.job?.company,
      text:     t.content,
    };
  }

  return { kind: "general", text: "（無特定文件 — 一般職涯諮詢）" };
}

function formatResumeForAi(p: ParsedResume): string {
  const lines: string[] = [];
  lines.push(`Name: ${p.name ?? ""}`);
  lines.push(`Headline: ${p.headline ?? ""}`);
  lines.push(`Summary: ${p.summary ?? ""}`);
  lines.push(``);
  lines.push(`Skills: ${p.skills.map((s) => s.name).join(", ")}`);
  lines.push(``);
  lines.push(`Experience:`);
  p.experience.forEach((e, i) => {
    lines.push(`  [${i}] ${e.title} @ ${e.company} (${e.years})`);
    (e.bullets ?? []).forEach((b, j) => {
      lines.push(`    bullet:${i}:${j}: ${b}`);
    });
  });
  return lines.join("\n");
}

interface TailoredResumeRow {
  summary:  unknown;
  bullets:  unknown;
  diffNote: string;
}

function formatTailoredResumeForAi(t: TailoredResumeRow): string {
  const sum = (t.summary ?? {}) as { before?: string; after?: string };
  const blts = (t.bullets ?? []) as { before?: string; after?: string }[];
  const lines: string[] = [];
  lines.push(`Summary (current "after"): ${sum.after ?? ""}`);
  lines.push(``);
  lines.push(`Bullets (current "after"):`);
  blts.forEach((b, i) => {
    lines.push(`  bullet:${i}: ${b.after ?? ""}`);
  });
  lines.push(``);
  lines.push(`Diff note: ${t.diffNote}`);
  return lines.join("\n");
}
