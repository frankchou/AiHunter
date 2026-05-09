import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MOCK_JOBS } from "@/lib/mock-data";
import { generateTailoredCoverLetter } from "@/lib/ai/cover-letter";
import { buildTailoredFileName } from "@/lib/ai/resume-tailor";
import type { ParsedResume, Job } from "@/lib/types";

async function ensureMaxOrSuper(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true, isSuperUser: true, name: true },
  });
  const ok = !!u && (u.isSuperUser || u.planTier === "max");
  return { ok, user: u };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.coverLetterTailor.findFirst({
      where: { userId: session.user.id, jobId: params.id, isCurrent: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return NextResponse.json(existing);
  } catch { /* fall through */ }
  return NextResponse.json({ data: null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ok, user } = await ensureMaxOrSuper(session.user.id);
  if (!ok) {
    return NextResponse.json({
      error: "MAX_ONLY",
      message: "針對性 CV 為 Max 旗艦專屬功能",
      planTier: user?.planTier ?? "free",
    }, { status: 403 });
  }

  try {
    let job = MOCK_JOBS.find((j) => j.id === params.id) ?? null;
    if (!job) {
      const dbJob = await prisma.job.findUnique({ where: { id: params.id } });
      if (dbJob) job = dbJob as unknown as Job;
    }
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const resume = await prisma.resume.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const generalCv = await prisma.coverLetter.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const parsedResume: ParsedResume = resume
      ? (resume.parsed as unknown as ParsedResume)
      : { name: user?.name ?? session.user.name ?? "User", headline: "Professional", skills: [], experience: [] };

    // Allow user-provided draft override (when they edit AI output and re-save)
    const body = await req.json().catch(() => ({}));
    let content: string;
    if (typeof body?.content === "string" && body.content.trim()) {
      content = body.content.trim();
    } else {
      content = await generateTailoredCoverLetter(job, parsedResume, generalCv?.content ?? null);
    }

    const fileName = buildTailoredFileName({
      company:  job.company,
      jobTitle: job.title,
      userName: user?.name ?? parsedResume.name ?? "User",
      kind:     "cv",
    });

    try {
      await prisma.coverLetterTailor.updateMany({
        where: { userId: session.user.id, jobId: params.id, isCurrent: true },
        data:  { isCurrent: false },
      });
      const saved = await prisma.coverLetterTailor.create({
        data: {
          userId:    session.user.id,
          jobId:     params.id,
          fileName,
          isCurrent: true,
          content,
        },
      });
      return NextResponse.json(saved);
    } catch {
      return NextResponse.json({ id: "mock", content, fileName, userId: session.user.id, jobId: params.id });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ok } = await ensureMaxOrSuper(session.user.id);
  if (!ok) return NextResponse.json({ error: "MAX_ONLY" }, { status: 403 });

  try {
    const result = await prisma.coverLetterTailor.deleteMany({
      where: { userId: session.user.id, jobId: params.id },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
