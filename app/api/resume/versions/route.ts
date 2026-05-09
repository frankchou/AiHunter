import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 版本夾合併清單 — 僅 Max plan / SuperUser
//
// Returns two arrays:
//   resumes:      [ A 履歷 (1) , B 履歷 (N) ]
//   coverLetters: [ A CV (1)   , B CV (N)   ]
// Each item carries a normalized shape so the frontend can render both
// sources in the same row component:
//   { id, kind: "general"|"tailored", docType: "resume"|"cv",
//     fileName, jobId?, jobTitle?, company?, updatedAt, downloadable, hasContent }
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planTier: true, isSuperUser: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.isSuperUser && user.planTier !== "max") {
    return NextResponse.json({ error: "MAX_ONLY", planTier: user.planTier }, { status: 403 });
  }

  try {
    const [aResume, aCv, bResumes, bCvs] = await Promise.all([
      prisma.resume.findFirst({
        where: { userId: session.user.id, isActive: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, fileData: true, createdAt: true },
      }),
      prisma.coverLetter.findFirst({
        where: { userId: session.user.id, isActive: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, content: true, createdAt: true },
      }),
      prisma.resumeTailor.findMany({
        where: { userId: session.user.id, isCurrent: true },
        orderBy: { updatedAt: "desc" },
        include: { job: { select: { id: true, title: true, company: true } } },
      }),
      prisma.coverLetterTailor.findMany({
        where: { userId: session.user.id, isCurrent: true },
        orderBy: { updatedAt: "desc" },
        include: { job: { select: { id: true, title: true, company: true } } },
      }),
    ]);

    const resumes = [
      ...(aResume
        ? [{
            id: aResume.id,
            kind: "general" as const,
            docType: "resume" as const,
            fileName: aResume.fileName ?? "resume",
            updatedAt: aResume.createdAt,
            downloadable: !!aResume.fileData,
            hasContent: true,
          }]
        : []),
      ...bResumes.map((r) => ({
        id: r.id,
        kind: "tailored" as const,
        docType: "resume" as const,
        fileName: r.fileName ?? `resume_${r.id.slice(0, 6)}.pdf`,
        jobId: r.jobId,
        jobTitle: r.job?.title,
        company: r.job?.company,
        updatedAt: r.updatedAt,
        downloadable: false,
        hasContent: true,
      })),
    ];

    const coverLetters = [
      ...(aCv
        ? [{
            id: aCv.id,
            kind: "general" as const,
            docType: "cv" as const,
            fileName: aCv.fileName ?? "cv.pdf",
            updatedAt: aCv.createdAt,
            downloadable: false,   // text-only for now
            hasContent: !!aCv.content,
          }]
        : []),
      ...bCvs.map((c) => ({
        id: c.id,
        kind: "tailored" as const,
        docType: "cv" as const,
        fileName: c.fileName ?? `cv_${c.id.slice(0, 6)}.pdf`,
        jobId: c.jobId,
        jobTitle: c.job?.title,
        company: c.job?.company,
        updatedAt: c.updatedAt,
        downloadable: false,
        hasContent: !!c.content,
      })),
    ];

    return NextResponse.json({ resumes, coverLetters });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
